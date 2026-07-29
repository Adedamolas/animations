/*
 * Adapted for this animations playground from the liquid-glass-carousel by
 * Yousuf Soomro — https://github.com/Yousuf-developer/liquid-glass-carousel
 *
 * MIT License — Copyright (c) 2026 Yousuf Soomro
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the above copyright notice being included.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
 */

// The carousel itself — three.js + GSAP, no React. An infinite flat row of
// image panels rendered into an offscreen buffer, then drawn to screen
// through the liquid-glass lens shader. The React component just mounts this
// and listens to the callbacks.
//
//   const carousel = createCarousel(mountEl, {
//     cursorElement,           // optional "View" label that trails the pointer
//     onActiveChange(i) {},    // centered image changed
//     onFocusChange(open) {},  // focus mode opened / closed
//     onEntryDone(done) {},    // entry animation settled
//   });
//   carousel.closeFocus(); carousel.replayEntry(); carousel.destroy();

import * as THREE from "three";
import { gsap } from "gsap";
import { PROJECTS, CONFIG, LENS, FOCUS, ENTRY } from "./config";
import { LENS_VERT, LENS_FRAG } from "../glass-lens/lens-shader";

export function createCarousel(mount, callbacks = {}) {
  const {
    cursorElement = null,
    onActiveChange = () => {},
    onFocusChange = () => {},
    onEntryDone = () => {},
  } = callbacks;

  let W = mount.clientWidth;
  let H = mount.clientHeight;

  // ---- renderer / scene / camera (orthographic, 1 unit = 1 px) ----
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.setClearColor(0xffffff, 1); // match page bg so FBO gaps blend
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(
    -W / 2,
    W / 2,
    H / 2,
    -H / 2,
    -100,
    100,
  );
  camera.position.z = 10;

  // ---- load the source images (textures + measured aspect) ----
  const loader = new THREE.TextureLoader();
  const sources = PROJECTS.map((img) => {
    const s = {
      tex: null,
      aspect: img.aspect || 1,
      locked: img.aspect != null,
    };
    loader.load(img.src, (tex) => {
      // mipmaps + anisotropy keep panels crisp while they render small
      // (the entry animation starts them at ~80px tall)
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      tex.colorSpace = THREE.SRGBColorSpace;
      if (!s.locked && tex.image) s.aspect = tex.image.width / tex.image.height;
      s.tex = tex;
      // aspect is now known -> rebuild slot offsets so spacing matches widths,
      // and re-center the row while the user hasn't scrolled yet
      recomputeTotal();
      if (!userInteracted) {
        scroll = centerForIndex(0);
        target = scroll;
      }
    });
    return s;
  });

  // width of one slot: height is fixed (PANEL_H), so width = aspect * PANEL_H + gap
  function slotWidth(srcIndex) {
    return sources[srcIndex].aspect * CONFIG.PANEL_H + CONFIG.GAP;
  }

  // cumulative x of each source's slot, and the total loop width
  let offsets = [];
  let totalWidth = 0;
  function recomputeTotal() {
    offsets = [];
    let acc = 0;
    for (let i = 0; i < sources.length; i++) {
      offsets.push(acc);
      acc += slotWidth(i);
    }
    totalWidth = acc;
  }
  recomputeTotal();

  // scroll value that puts panel `idx` dead-center. idx is an unbounded
  // integer (loop k, source = idx mod N) so focus / click / entry can aim
  // at an exact panel copy.
  function centerForIndex(idx) {
    const N = sources.length;
    const loop = Math.floor(idx / N);
    const s = ((idx % N) + N) % N;
    return offsets[s] + slotWidth(s) / 2 - CONFIG.GAP / 2 + loop * totalWidth;
  }

  // integer index (including loop) whose center is closest to `value`
  function nearestIndex(value) {
    if (!totalWidth) return 0;
    const N = sources.length;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < N; i++) {
      const center = offsets[i] + slotWidth(i) / 2 - CONFIG.GAP / 2;
      const k = Math.round((value - center) / totalWidth);
      const dist = Math.abs(center + k * totalWidth - value);
      if (dist < bestDist) {
        bestDist = dist;
        best = i + k * N;
      }
    }
    return best;
  }

  // which source index is closest to screen center (for the overlay text)
  function centerIndex(value) {
    if (!totalWidth) return 0;
    let bestI = 0;
    let bestDist = Infinity;
    for (let i = 0; i < sources.length; i++) {
      const center = offsets[i] + slotWidth(i) / 2 - CONFIG.GAP / 2;
      const k = Math.round((value - center) / totalWidth);
      const dist = Math.abs(center + k * totalWidth - value);
      if (dist < bestDist) {
        bestDist = dist;
        bestI = i;
      }
    }
    return bestI;
  }
  let lastCenter = -1;

  // ---- mesh pool ----
  // REPEATS copies of the whole image set so wide screens never run dry.
  const REPEATS = 4;
  const pool = [];
  for (let r = 0; r < REPEATS; r++) {
    for (let i = 0; i < sources.length; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xdddddd,
        transparent: true,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), mat);
      mesh.visible = false;
      scene.add(mesh);
      pool.push({ mesh, mat, srcIndex: i });
    }
  }

  // ---- scroll state ----
  let scroll = centerForIndex(0); // current (image 01 centered)
  let target = scroll; // desired
  let userInteracted = false; // true once the user scrolls (stops auto-recenter)
  let prevScroll = 0;
  let scrollEnergy = 0; // smoothed 0..1 scroll activity, drives panel shrink
  let pendingFocus = null; // {srcIndex} — open focus once a click-to-center settles
  let lastWheelAt = 0;
  let snapArmed = false; // wheel input arms the settle-snap; it fires once

  // ---- liquid-glass lens: FBO + fullscreen pass ----
  // The carousel renders into rt at device resolution (CSS-sized would render
  // at 1x and upscale — blurry on retina); a fullscreen quad then samples it
  // through the lens shader.
  const dpr = renderer.getPixelRatio();
  let rt = new THREE.WebGLRenderTarget(W * dpr, H * dpr);
  const lensScene = new THREE.Scene();
  const lensCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const lensUniforms = {
    uTex: { value: rt.texture },
    uRes: { value: new THREE.Vector2(W * dpr, H * dpr) },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uSizeX: { value: LENS.sizeX },
    uSizeY: { value: LENS.sizeY },
    uShape: { value: LENS.shape === "square" ? 1.0 : 0.0 },
    uSquareRound: { value: LENS.squareRound },
    uRotation: { value: 0.0 },
    uAspect: { value: W / H },
    uZoom: { value: LENS.zoom },
    uDispersion: { value: LENS.dispersion },
    uBlur: { value: LENS.blur },
    uGlow: { value: LENS.glow },
    uWhiteGlow: { value: LENS.whiteGlow },
    uNovaSize: { value: LENS.novaSize },
    uBlueRing: { value: LENS.blueRing },
    uRingRadius: { value: LENS.ringRadius },
    uRingWidth: { value: LENS.ringWidth },
    uShimmer: { value: LENS.shimmer ? 1.0 : 0.0 },
    uShimmerFreq: { value: LENS.shimmerFreq },
    uShimmerSpeed: { value: LENS.shimmerSpeed },
    uShimmerDepth: { value: LENS.shimmerDepth },
    uTime: { value: 0.0 },
    uRimStart: { value: LENS.rimStart },
    uRimTangential: { value: LENS.rimTangential },
    uRimInward: { value: LENS.rimInward },
    uRimFreq1: { value: LENS.rimFreq1 },
    uRimFreq2: { value: LENS.rimFreq2 },
    uBlueColor: { value: new THREE.Color(LENS.blueColor) },
    uRimLine: { value: LENS.rimLine },
    uRimLinePos: { value: LENS.rimLinePos },
    uRimLineWidth: { value: LENS.rimLineWidth },
    uVignette: { value: LENS.vignette },
    uVignetteSize: { value: LENS.vignetteSize },
    uSamples: { value: LENS.samples },
  };
  const lensMat = new THREE.ShaderMaterial({
    uniforms: lensUniforms,
    vertexShader: LENS_VERT,
    fragmentShader: LENS_FRAG,
  });
  const lensQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lensMat);
  lensScene.add(lensQuad);

  // ---- focus state ----
  // When focused, the lens props fade out (lensFx 1->0) and every panel
  // except the focused one slides down off-screen, staggered center-out.
  const focusState = {
    active: false,
    srcIndex: -1,
    poolIdx: -1,
    lensFx: ENTRY.enabled ? 0 : 1, // 0 during entry; blooms in later
    anim: null,
  };
  const drop = new Array(REPEATS * sources.length).fill(0); // per-panel drop 0..1
  let focusScale = 1; // eased scale-up applied to the focused panel
  const lastCenterX = new Array(REPEATS * sources.length); // per-pool x, undefined if hidden

  // ---- entry state ----
  // pEntry[poolIdx]: 0 = below screen at startH, 1 = settled in the real row.
  const pEntry = new Array(REPEATS * sources.length).fill(ENTRY.enabled ? 0 : 1);
  let entryActive = ENTRY.enabled;
  let entrySettled = false; // rise finished but panels held at small size
  const growArr = new Array(REPEATS * sources.length).fill(
    ENTRY.enabled ? 0 : 1,
  );
  let entryAnim = null;

  // lens props that fade out for focus/entry, with their full values
  const LENS_FX_KEYS = [
    "uDispersion",
    "uBlueRing",
    "uRimLine",
    "uVignette",
    "uZoom",
    "uRimTangential",
    "uRimInward",
  ];
  const lensFxFull = {};
  LENS_FX_KEYS.forEach((k) => (lensFxFull[k] = lensUniforms[k].value));

  // ---- layout: place pooled meshes for the current scroll (every frame) ----
  let panelRects = []; // visible panel screen rects for hit-testing
  let centeredPanel = null; // panel nearest screen center
  function layout() {
    panelRects = [];
    centeredPanel = null;
    let centeredDist = Infinity;
    const half = W / 2;
    const buffer = CONFIG.PANEL_H; // generous horizontal buffer
    pool.forEach((p, poolIdx) => {
      const rep = Math.floor(poolIdx / sources.length);
      const i = p.srcIndex;
      const src = sources[i];

      // slot center within one loop, shifted by scroll, wrapped, then pushed
      // out by this pool entry's repetition rung
      const slotCenterInLoop = offsets[i] + slotWidth(i) / 2 - CONFIG.GAP / 2;
      let x = slotCenterInLoop - scroll;
      x = ((x % totalWidth) + totalWidth) % totalWidth;
      x += (rep - Math.floor(REPEATS / 2)) * totalWidth;
      if (x > half + totalWidth) x -= totalWidth * REPEATS;

      const centerX = x;
      const inEntry = entryActive || entrySettled;
      if (!inEntry && (centerX < -half - buffer || centerX > half + buffer)) {
        p.mesh.visible = false;
        lastCenterX[poolIdx] = undefined;
        return;
      }
      lastCenterX[poolIdx] = centerX;

      // fixed size for every panel; shrink up to 25% with scroll speed
      const shrink = 1 - 0.25 * scrollEnergy;
      const h = CONFIG.PANEL_H * shrink;
      const wPx = src.aspect * CONFIG.PANEL_H * shrink;

      // bind texture once available
      if (src.tex && !p.bound) {
        p.mat.map = src.tex;
        p.mat.color.set(0xffffff);
        p.mat.needsUpdate = true;
        p.bound = true;
      }

      let y = 0;

      // focus: the focused panel grows and stays put, others slide down
      const isFocused = focusState.active && focusState.poolIdx === poolIdx;
      const d = drop[poolIdx] || 0;
      let drawW = wPx;
      let drawH = h;
      if (isFocused) {
        drawW = wPx * focusScale;
        drawH = h * focusScale;
      } else if (d > 0) {
        y = -d * H * FOCUS.dropDist;
      }

      p.mesh.visible = true;

      // entry: interpolate from (below screen, startH) up to the real state
      let finalX = centerX;
      let finalY = y;
      let finalW = drawW;
      let finalH = drawH;
      if (entryActive || entrySettled) {
        const pe = pEntry[poolIdx] || 0;
        const g = growArr[poolIdx] || 0;

        const curH = ENTRY.startH + (drawH - ENTRY.startH) * g;
        finalH = curH;
        finalW = curH * src.aspect;

        // constant-gap walk from the centered source, one copy per source.
        // Each slot uses ITS OWN current grow height, so a grown panel takes
        // more space and pushes neighbours outward.
        const cSrc = centerIndex(scroll);
        let di = i - cSrc;
        if (di > sources.length / 2) di -= sources.length;
        if (di < -sources.length / 2) di += sources.length;
        const N = sources.length;
        const midRep = Math.floor(REPEATS / 2);
        if (rep !== midRep) {
          p.mesh.visible = false;
          lastCenterX[poolIdx] = undefined;
          return;
        }
        const slotH = (s) => {
          const gg = growArr[midRep * N + s] || 0;
          return ENTRY.startH + (CONFIG.PANEL_H - ENTRY.startH) * gg;
        };
        let off = 0;
        if (di > 0) {
          for (let k = 0; k < di; k++) {
            const sa = (((cSrc + k) % N) + N) % N;
            const sb = (((cSrc + k + 1) % N) + N) % N;
            off +=
              (sources[sa].aspect * slotH(sa) +
                sources[sb].aspect * slotH(sb)) /
                2 +
              CONFIG.GAP;
          }
        } else if (di < 0) {
          for (let k = 0; k < -di; k++) {
            const sa = (((cSrc - k) % N) + N) % N;
            const sb = (((cSrc - k - 1) % N) + N) % N;
            off -=
              (sources[sa].aspect * slotH(sa) +
                sources[sb].aspect * slotH(sb)) /
                2 +
              CONFIG.GAP;
          }
        }
        finalX = off;
        if (finalX < -half - buffer || finalX > half + buffer) {
          p.mesh.visible = false;
          lastCenterX[poolIdx] = undefined;
          return;
        }

        // vertical: rise from below the screen up to real y
        const below = -H * ENTRY.fromBelow;
        finalY = below + (y - below) * pe;
      }

      p.mesh.position.set(finalX, finalY, 0);
      p.mesh.scale.set(finalW, finalH, 1);

      // screen rect (px, top-left origin) for pointer hit-testing
      const sx = centerX + W / 2;
      const sy = H / 2 - y;
      panelRects.push({
        left: sx - drawW / 2,
        right: sx + drawW / 2,
        top: sy - drawH / 2,
        bottom: sy + drawH / 2,
        poolIdx,
        srcIndex: i,
        centerX,
      });

      if (Math.abs(centerX) < centeredDist) {
        centeredDist = Math.abs(centerX);
        centeredPanel = { srcIndex: i, centerX, wPx, h, poolIdx };
      }
    });
  }

  // which visible panel (if any) is under a viewport point?
  function panelAtPointer(px, py) {
    for (let i = 0; i < panelRects.length; i++) {
      const r = panelRects[i];
      if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom)
        return r;
    }
    return null;
  }

  const el = renderer.domElement;

  // ---- "View" cursor follower ----
  if (cursorElement)
    gsap.set(cursorElement, {
      xPercent: 20,
      yPercent: 30,
      scale: 0,
      autoAlpha: 0,
    });
  const moveX = cursorElement
    ? gsap.quickTo(cursorElement, "x", { duration: 0.5, ease: "power3.out" })
    : null;
  const moveY = cursorElement
    ? gsap.quickTo(cursorElement, "y", { duration: 0.5, ease: "power3.out" })
    : null;

  let overPanel = false;

  function setView(on) {
    if (entryActive || entrySettled) on = false; // not during entry
    el.style.cursor = on ? "pointer" : "";
    if (on === overPanel || !cursorElement) return;
    overPanel = on;
    gsap.to(cursorElement, {
      scale: on ? 1 : 0,
      autoAlpha: on ? 1 : 0,
      duration: on ? 0.35 : 0.25,
      ease: on ? "power3.out" : "power3.in",
    });
  }

  // ---- input ----
  function onWheel(e) {
    e.preventDefault();
    if (focusState.active || entryActive || entrySettled) return;
    userInteracted = true;
    pendingFocus = null; // manual scroll cancels a click-to-center in flight
    target += (e.deltaY || e.deltaX) * CONFIG.WHEEL;
    lastWheelAt = performance.now();
    snapArmed = true;
  }

  function onPointerMove(e) {
    if (moveX) moveX(e.clientX);
    if (moveY) moveY(e.clientY);
    if (focusState.active) {
      setView(false);
      return;
    }
    setView(panelAtPointer(e.clientX, e.clientY) !== null);
  }
  function onLeave() {
    setView(false);
  }

  function onClick(e) {
    if (focusState.active || entryActive || entrySettled) return;
    const hit = panelAtPointer(e.clientX, e.clientY);
    if (!hit) return;
    // centered panel -> open right away; anything else glides to center
    // first and the tick loop opens focus once it arrives
    if (centeredPanel && hit.poolIdx === centeredPanel.poolIdx) {
      pendingFocus = null;
      openFocus();
      return;
    }
    userInteracted = true;
    target = centerForIndex(nearestIndex(scroll + hit.centerX));
    pendingFocus = { srcIndex: hit.srcIndex };
    setView(false);
  }

  // ---- focus open / close ----
  function openFocus() {
    if (focusState.active || !centeredPanel) return;
    const src = sources[centeredPanel.srcIndex];
    if (!src || !src.tex) return;

    focusState.active = true;
    focusState.srcIndex = centeredPanel.srcIndex;
    const focusPoolIdx = centeredPanel.poolIdx;
    focusState.poolIdx = focusPoolIdx;

    // pull scroll precisely to center so the focused panel is dead-centre
    target = centerForIndex(nearestIndex(scroll));

    // order the OTHER panels by distance from the focused card and group
    // near-equal distances, so left/right pairs leave together — a real
    // center-out wave radiating from the clicked card
    const focusX = lastCenterX[focusPoolIdx] || 0;
    const others = pool
      .map((p, idx) => ({ idx, x: lastCenterX[idx] }))
      .filter((o) => o.idx !== focusPoolIdx && o.x !== undefined)
      .map((o) => ({ idx: o.idx, dist: Math.abs(o.x - focusX) }))
      .sort((a, b) => a.dist - b.dist);

    let rank = 0;
    let prevDist = -1;
    const ranked = others.map((o) => {
      if (prevDist >= 0 && o.dist - prevDist > 1) rank++;
      prevDist = o.dist;
      return { idx: o.idx, rank };
    });

    // re-snapshot lens values so the fade/restore tracks live GUI sliders
    LENS_FX_KEYS.forEach((k) => (lensFxFull[k] = lensUniforms[k].value));

    if (focusState.anim) focusState.anim.kill();
    const tl = gsap.timeline();
    tl.to(
      focusState,
      { lensFx: 0, duration: FOCUS.lensFade, ease: "power3.out" },
      0,
    );
    tl.to(
      { v: focusScale },
      {
        v: FOCUS.centerScale,
        duration: FOCUS.focusDuration,
        ease: FOCUS.focusEase,
        onUpdate() {
          focusScale = this.targets()[0].v;
        },
      },
      0,
    );
    ranked.forEach((o) => {
      tl.to(
        drop,
        { [o.idx]: 1, duration: FOCUS.cardDuration, ease: FOCUS.cardEase },
        o.rank * FOCUS.stagger,
      );
    });
    focusState.anim = tl;

    setView(false);
    el.style.cursor = "";
    onFocusChange(true);
  }

  function closeFocus() {
    if (!focusState.active) return;
    if (focusState.anim) focusState.anim.kill();

    // return wave: farthest cards first (edges-in), symmetric pairs together
    const focusX = lastCenterX[focusState.poolIdx] || 0;
    const others = pool
      .map((p, idx) => ({ idx, x: lastCenterX[idx] }))
      .filter((o) => o.x !== undefined && (drop[o.idx] || 0) > 0)
      .map((o) => ({ idx: o.idx, dist: Math.abs(o.x - focusX) }))
      .sort((a, b) => b.dist - a.dist);

    let rank = 0;
    let prevDist = -1;
    const ranked = others.map((o) => {
      if (prevDist >= 0 && prevDist - o.dist > 1) rank++;
      prevDist = o.dist;
      return { idx: o.idx, rank };
    });

    // notify the host NOW so its UI animates in sync with the cards
    // returning; focusState.active stays true until the timeline finishes
    // (it still gates scroll input)
    onFocusChange(false);

    const tl = gsap.timeline({
      onComplete: () => {
        focusState.active = false;
        focusState.srcIndex = -1;
      },
    });
    tl.to(
      focusState,
      { lensFx: 1, duration: FOCUS.lensFade * 0.8, ease: "power3.inOut" },
      0,
    );
    tl.to(
      { v: focusScale },
      {
        v: 1,
        duration: FOCUS.focusDuration * 0.85,
        ease: FOCUS.focusEase,
        onUpdate() {
          focusScale = this.targets()[0].v;
        },
      },
      0,
    );
    ranked.forEach((o) => {
      tl.to(
        drop,
        {
          [o.idx]: 0,
          duration: FOCUS.cardDuration * 0.85,
          ease: FOCUS.cardEase,
        },
        o.rank * FOCUS.stagger * 0.7,
      );
    });
    focusState.anim = tl;
  }

  // ---- entry animation: rise from below, hold small, grow to full ----
  function playEntry() {
    if (entryAnim) entryAnim.kill();
    for (let k = 0; k < pEntry.length; k++) pEntry[k] = 0;
    entryActive = true;
    entrySettled = false;
    onEntryDone(false);
    for (let k = 0; k < growArr.length; k++) growArr[k] = 0;
    focusState.lensFx = 0; // no lens distortion during entry

    // center a panel cleanly; that panel rises first
    target = centerForIndex(nearestIndex(scroll));
    scroll = target;

    layout(); // populate lastCenterX
    const visible = [];
    for (let k = 0; k < lastCenterX.length; k++) {
      if (lastCenterX[k] !== undefined) visible.push(k);
    }

    const tl = gsap.timeline({ delay: ENTRY.delay });
    // each card rises after its own random delay
    const spread = ENTRY.stagger * Math.max(visible.length - 1, 1);
    let lastRiseEnd = 0;
    visible.forEach((idx) => {
      const at = Math.random() * spread;
      lastRiseEnd = Math.max(lastRiseEnd, at + ENTRY.riseDuration);
      tl.to(
        pEntry,
        { [idx]: 1, duration: ENTRY.riseDuration, ease: ENTRY.riseEase },
        at,
      );
    });

    // rise done -> hold at small size, then grow to full (staggered)
    tl.call(
      () => {
        entryActive = false;
        entrySettled = true;
      },
      null,
      lastRiseEnd,
    );

    // grow stagger ranked by slot distance from the centered source, so
    // symmetric left/right pairs grow together. outward = center first,
    // inward = edges first.
    const cSrcG = centerIndex(scroll);
    const Ng = sources.length;
    const midRepG = Math.floor(REPEATS / 2);
    const growList = [];
    let maxRank = 0;
    for (let k = 0; k < lastCenterX.length; k++) {
      if (lastCenterX[k] === undefined) continue;
      if (Math.floor(k / Ng) !== midRepG) continue;
      let di = (k % Ng) - cSrcG;
      if (di > Ng / 2) di -= Ng;
      if (di < -Ng / 2) di += Ng;
      const r = Math.abs(di);
      maxRank = Math.max(maxRank, r);
      growList.push({ idx: k, rank: r });
    }
    const growRanked = growList.map((v) => ({
      idx: v.idx,
      rank: ENTRY.growDir === "outward" ? v.rank : maxRank - v.rank,
    }));

    const growStart = lastRiseEnd + ENTRY.growDelay;
    let growEnd = growStart;

    // lens blooms back in the moment the grow begins
    tl.to(
      focusState,
      { lensFx: 1, duration: ENTRY.lensBloom, ease: ENTRY.lensBloomEase },
      growStart,
    );

    growRanked.forEach((o) => {
      const at = growStart + o.rank * ENTRY.growStagger;
      growEnd = Math.max(growEnd, at + ENTRY.growDuration);
      tl.to(
        growArr,
        { [o.idx]: 1, duration: ENTRY.growDuration, ease: ENTRY.growEase },
        at,
      );
    });
    // hand off to the normal full-size carousel
    tl.call(
      () => {
        entrySettled = false;
        for (let k = 0; k < growArr.length; k++) growArr[k] = 1;
        onEntryDone(true);
      },
      null,
      growEnd,
    );
    entryAnim = tl;
  }

  el.addEventListener("wheel", onWheel, { passive: false });
  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerleave", onLeave);
  el.addEventListener("click", onClick);

  // ---- animation loop ----
  let raf;
  function tick() {
    // settle-snap: wheel quiet + glide almost done -> aim at nearest center.
    // Redirecting the target (not the scroll) keeps it one continuous glide.
    if (
      CONFIG.SNAP &&
      snapArmed &&
      !focusState.active &&
      Math.abs(target - scroll) < CONFIG.SNAP_DIST &&
      performance.now() - lastWheelAt > CONFIG.SNAP_DELAY
    ) {
      target = centerForIndex(nearestIndex(target));
      snapArmed = false;
    }

    scroll += (target - scroll) * CONFIG.EASE;

    // tell the host which image is centered (overlay text)
    const ci = centerIndex(scroll);
    if (ci !== lastCenter) {
      lastCenter = ci;
      onActiveChange(ci);
    }

    // scroll speed -> energy 0..1, drives the panel shrink. Attack fast when
    // speeding up, decay slow when settling.
    const rawSpeed = scroll - prevScroll;
    prevScroll = scroll;
    const norm = Math.min(
      1,
      Math.abs(rawSpeed) / Math.max(1, CONFIG.SHRINK_MAX),
    );
    const k = norm > scrollEnergy ? CONFIG.SHRINK_ATTACK : CONFIG.SHRINK_DECAY;
    scrollEnergy += (norm - scrollEnergy) * k;

    layout();

    // click-to-center: once the glide has settled on the clicked panel, focus it
    if (pendingFocus && !focusState.active) {
      if (Math.abs(target - scroll) < 0.5) {
        const pf = pendingFocus;
        pendingFocus = null;
        if (centeredPanel && centeredPanel.srcIndex === pf.srcIndex)
          openFocus();
      }
    }

    // lens uniforms + focus/entry fade of the distortion props
    lensUniforms.uCenter.value.set(LENS.posX, LENS.posY);
    lensUniforms.uAspect.value = W / H;
    lensUniforms.uTime.value = performance.now() * 0.001;
    const rad = (a) => (a * Math.PI) / 180;
    lensUniforms.uRotation.value =
      rad(LENS.rotation) + rad(LENS.spin) * (performance.now() * 0.001);
    const fx = focusState.lensFx;
    LENS_FX_KEYS.forEach((key) => {
      lensUniforms[key].value = lensFxFull[key] * fx;
    });

    // render the carousel into the FBO, then the FBO through the lens
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(lensScene, lensCam);

    raf = requestAnimationFrame(tick);
  }
  tick();

  if (ENTRY.enabled) playEntry();

  // ---- resize / teardown ----
  function onResize() {
    W = mount.clientWidth;
    H = mount.clientHeight;
    renderer.setSize(W, H);
    camera.left = -W / 2;
    camera.right = W / 2;
    camera.top = H / 2;
    camera.bottom = -H / 2;
    camera.updateProjectionMatrix();
    rt.setSize(W * dpr, H * dpr);
    lensUniforms.uRes.value.set(W * dpr, H * dpr);
  }
  window.addEventListener("resize", onResize);

  function destroy() {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    el.removeEventListener("wheel", onWheel);
    el.removeEventListener("pointermove", onPointerMove);
    el.removeEventListener("pointerleave", onLeave);
    el.removeEventListener("click", onClick);
    if (focusState.anim) focusState.anim.kill();
    if (entryAnim) entryAnim.kill();
    renderer.dispose();
    rt.dispose();
    lensQuad.geometry.dispose();
    lensMat.dispose();
    pool.forEach((p) => {
      p.mesh.geometry.dispose();
      p.mat.dispose();
    });
    sources.forEach((s) => {
      if (s.tex) s.tex.dispose();
    });
    if (renderer.domElement.parentNode)
      renderer.domElement.parentNode.removeChild(renderer.domElement);
  }

  return {
    closeFocus,
    replayEntry: playEntry,
    refreshLayout: recomputeTotal, // call after changing PANEL_H / GAP
    lensUniforms, // exposed for the dev GUI
    destroy,
  };
}
