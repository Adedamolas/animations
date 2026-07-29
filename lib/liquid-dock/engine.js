// Liquid-glass dock engine — three.js, no React.
//
// A calm backdrop (near-black + a few slow drifting cool orbs + a huge ghosted
// wordmark of the active item) is rendered into an offscreen buffer, then
// drawn to screen through the liquid-glass lens shader shaped as a centered
// rounded-rect pill. There's no page to scroll — switching items just swaps
// the wordmark and nudges the orbs, so the dock stays the sole focus.
//
//   const dock = createDock(mountEl, { onLayout(rect){}, initialIndex:0 });
//   dock.setActive(2); dock.resize(); dock.destroy();

import * as THREE from "three";
import { LENS_VERT, LENS_FRAG } from "../glass-lens/lens-shader";
import { NAV, BG, DOCK } from "./config";

export function createDock(mount, cb = {}) {
  const { onLayout = () => {}, initialIndex = 0 } = cb;

  let W = mount.clientWidth;
  let H = mount.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(dpr);
  renderer.setSize(W, H);
  renderer.domElement.style.display = "block";
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG.base);
  const cam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -10, 10);

  // ---- soft radial texture shared by the orbs ----
  const orbTex = makeRadialTexture();

  // ---- drifting orbs ----
  const orbs = BG.orbs.map((o) => {
    const mat = new THREE.MeshBasicMaterial({
      map: orbTex,
      color: new THREE.Color(o.color),
      transparent: true,
      opacity: o.o,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.renderOrder = 1;
    scene.add(mesh);
    return { mesh, mat, cfg: o };
  });

  // ---- ghosted wordmark of the active item ----
  const wordTex = new THREE.CanvasTexture(document.createElement("canvas"));
  wordTex.colorSpace = THREE.SRGBColorSpace;
  wordTex.minFilter = THREE.LinearFilter;
  const wordMat = new THREE.MeshBasicMaterial({
    map: wordTex,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
  });
  const wordMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), wordMat);
  wordMesh.renderOrder = 2;
  scene.add(wordMesh);

  let activeIndex = initialIndex;
  const WORD_ALPHA = 0.12;
  // wordmark crossfade state machine
  let wordPhase = "idle"; // 'idle' | 'out' | 'in'
  let wordP = 0;

  function drawWord(word) {
    const canvas = wordTex.image;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BG.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const size = Math.min(W * 0.24, H * 0.34);
    ctx.font = `700 ${size}px 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillText(word.toLowerCase(), W / 2, H * DOCK.centerYFrac);
    wordTex.needsUpdate = true;
  }

  // ---- FBO + lens pass ----
  let rt = new THREE.WebGLRenderTarget(W * dpr, H * dpr);
  const lensScene = new THREE.Scene();
  const lensCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const U = {
    uTex: { value: rt.texture },
    uRes: { value: new THREE.Vector2(W * dpr, H * dpr) },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uSizeX: { value: 0.3 },
    uSizeY: { value: 0.04 },
    uShape: { value: 1.0 }, // rounded rect
    uSquareRound: { value: DOCK.round },
    uRotation: { value: 0.0 },
    uAspect: { value: W / H },
    uZoom: { value: DOCK.zoom },
    uDispersion: { value: DOCK.dispersion },
    uBlur: { value: 0.0 },
    uGlow: { value: DOCK.glow },
    uWhiteGlow: { value: DOCK.whiteGlow },
    uNovaSize: { value: DOCK.novaSize },
    uBlueRing: { value: DOCK.blueRing },
    uRingRadius: { value: DOCK.ringRadius },
    uRingWidth: { value: DOCK.ringWidth },
    uShimmer: { value: DOCK.shimmer ? 1.0 : 0.0 },
    uShimmerFreq: { value: DOCK.shimmerFreq },
    uShimmerSpeed: { value: DOCK.shimmerSpeed },
    uShimmerDepth: { value: DOCK.shimmerDepth },
    uTime: { value: 0.0 },
    uRimStart: { value: DOCK.rimStart },
    uRimTangential: { value: DOCK.rimTangential },
    uRimInward: { value: 0.0 },
    uRimFreq1: { value: DOCK.rimFreq1 },
    uRimFreq2: { value: DOCK.rimFreq2 },
    uBlueColor: { value: new THREE.Color(DOCK.tint) },
    uRimLine: { value: DOCK.rimLine },
    uRimLinePos: { value: DOCK.rimLinePos },
    uRimLineWidth: { value: DOCK.rimLineWidth },
    uVignette: { value: 0.0 },
    uVignetteSize: { value: 0.3 },
    uSamples: { value: DOCK.samples },
  };
  const lensMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: LENS_VERT, fragmentShader: LENS_FRAG });
  lensScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lensMat));

  let baseSX = 0.3;
  let baseSY = 0.04;
  function computeLens() {
    const effW = Math.min(DOCK.widthPx, W - 32);
    baseSX = effW / 2 / H;
    baseSY = DOCK.heightPx / 2 / H;
    // config.centerYFrac is measured from the top; the shader's y is bottom-up
    U.uCenter.value.set(0.5, 1 - DOCK.centerYFrac);
    U.uAspect.value = W / H;
    // report the dock's screen rect (px from top-left) so the DOM overlay can
    // sit exactly on the glass, using the engine's own measured size
    onLayout({ cx: W / 2, cy: H * DOCK.centerYFrac, w: effW, h: DOCK.heightPx });
  }

  // dock wobble spring (bumped when the active item changes)
  let wob = 0;
  let wobV = 0;

  function setActive(i) {
    if (i === activeIndex) return;
    activeIndex = i;
    wobV += 6;
    wordPhase = "out";
    wordP = 0;
    // give the orbs a gentle shove so the glass has fresh motion to bend
    for (const o of orbs) o.kick = (Math.random() - 0.5) * 0.5;
  }

  // ---- layout ----
  function layout() {
    W = mount.clientWidth;
    H = mount.clientHeight;
    renderer.setSize(W, H);
    cam.left = -W / 2;
    cam.right = W / 2;
    cam.top = H / 2;
    cam.bottom = -H / 2;
    cam.updateProjectionMatrix();
    rt.setSize(W * dpr, H * dpr);
    U.uRes.value.set(W * dpr, H * dpr);
    const D = Math.max(W, H) * 1.4;
    for (const o of orbs) o.mesh.scale.set(D * o.cfg.r, D * o.cfg.r, 1);
    wordMesh.geometry.dispose();
    wordMesh.geometry = new THREE.PlaneGeometry(W, H);
    wordMesh.position.set(0, 0, 0);
    drawWord(NAV[activeIndex]);
    computeLens();
  }

  // ---- loop ----
  let raf = 0;
  const clock = new THREE.Clock();
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // drift the orbs
    for (const o of orbs) {
      const c = o.cfg;
      const k = o.kick || 0;
      o.mesh.position.x = Math.sin(t * c.sp + c.ph) * W * (c.ax + k * 0.04);
      o.mesh.position.y = Math.cos(t * c.sp * 1.3 + c.ph) * H * c.ay;
      if (o.kick) o.kick *= 0.94;
    }

    // wordmark crossfade
    if (wordPhase === "out") {
      wordP += dt / 0.16;
      wordMat.opacity = WORD_ALPHA * Math.max(0, 1 - wordP);
      if (wordP >= 1) {
        drawWord(NAV[activeIndex]);
        wordPhase = "in";
        wordP = 0;
      }
    } else if (wordPhase === "in") {
      wordP += dt / 0.3;
      wordMat.opacity = WORD_ALPHA * Math.min(1, wordP);
      if (wordP >= 1) {
        wordMat.opacity = WORD_ALPHA;
        wordPhase = "idle";
      }
    }

    // wobble spring → dock breathes on change
    wobV += (-150 * wob - 17 * wobV) * dt;
    wob += wobV * dt;
    U.uSizeX.value = baseSX * (1 + wob * 0.05);
    U.uSizeY.value = baseSY * (1 - wob * 0.05);
    U.uTime.value += dt;

    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    renderer.setRenderTarget(null);
    renderer.render(lensScene, lensCam);
  }

  drawWord(NAV[activeIndex]);
  layout();
  frame();

  // ---- resize (debounced) ----
  let rzTimer = 0;
  function onResize() {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(layout, 120);
  }
  window.addEventListener("resize", onResize);

  return {
    setActive,
    resize: layout,
    destroy() {
      cancelAnimationFrame(raf);
      clearTimeout(rzTimer);
      window.removeEventListener("resize", onResize);
      for (const o of orbs) {
        o.mesh.geometry.dispose();
        o.mat.dispose();
      }
      orbTex.dispose();
      wordMesh.geometry.dispose();
      wordMat.dispose();
      wordTex.dispose();
      rt.dispose();
      lensMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    },
  };
}

// A soft white radial gradient, drawn once, tinted per-orb via material color.
function makeRadialTexture() {
  const s = 256;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
