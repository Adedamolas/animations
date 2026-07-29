// Manuals — vanilla three.js, no React.
//
// Three hardcovers held in a tight fan. Hover one and it lifts, tilts toward
// the cursor and lets its front board slip open by an amount that depends on
// where along the cover you are pointing. Drag sideways to peel it further.
// Click and it leaves the fan for a detail slot while the other two are sent
// out of frame on an authored curve; there you can tumble it, and the spin
// flings the trailing board open behind it.
//
//   const m = createManuals(mount, { onHover, onOpen, onClose });
//   m.open(i); m.close(); m.resize(); m.destroy();
//
// This file owns the stage — renderer, lights, camera and the frame loop.
// The parts it drives live next door:
//
//   dimensions.js    how big a book is
//   book.js          building one, and one book's frame
//   spring.js        the spring every channel runs on
//   layout.js        where the books stand, per viewport and per mode
//   choreography.js  the authored curve that sends a book out of frame
//   input.js         pointer and keyboard
//   cover-art.js     every jacket, painted on a canvas
//
// Studied from thebuggeddev/books (a three.js remake of trevornoah.com/books),
// rebuilt here with this playground's own geometry, choreography and subject.

import * as THREE from "three";
import { clamp } from "@/lib/math";
import { MANUALS } from "./catalog";
import { createBookBuilder, tickBook } from "./book";
import { bringBack, sendOut } from "./choreography";
import { createInput } from "./input";
import { cameraFor, computeSlots, setTargets } from "./layout";
import { Spring } from "./spring";

export function createManuals(mount, cb = {}) {
  const { onHover = () => {}, onOpen = () => {}, onClose = () => {} } = cb;

  const view = { w: mount.clientWidth || 1, h: mount.clientHeight || 1 };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const idle = reduced ? 0 : 1;
  const disposables = [];

  /* ------------------------------------------------------------------ stage */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(view.w, view.h);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.touchAction = "none";
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, view.w / view.h, 0.1, 100);
  camera.position.set(0, 0.1, 9.6);

  // A painted sky, only ever seen as sheen on the cloth.
  const envTex = (() => {
    const cv = document.createElement("canvas");
    cv.width = 512;
    cv.height = 256;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#14141d";
    ctx.fillRect(0, 0, 512, 256);
    const blob = (x, y, r, color, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = a;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 256);
      ctx.globalAlpha = 1;
    };
    blob(140, 60, 200, "#ffffff", 0.85);
    blob(400, 40, 160, "#9aa6ff", 0.5);
    blob(300, 220, 190, "#ff9bb4", 0.28);
    const t = new THREE.CanvasTexture(cv);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(envTex).texture;
  disposables.push(envTex, scene.environment);
  pmrem.dispose();

  const hemi = new THREE.HemisphereLight(0x9aa8ff, 0x14141f, 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff6ea, 1.05);
  key.position.set(-4.5, 6, 7.5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xa9b6ff, 0.34);
  fill.position.set(5.5, 1, 4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xff9db8, 0.42);
  rim.position.set(2.5, 3.5, -6);
  scene.add(rim);

  /* ------------------------------------------------------------------ books */
  const bookRoot = new THREE.Group();
  scene.add(bookRoot);
  const buildBook = createBookBuilder(disposables);
  const books = MANUALS.map((cfg, i) => buildBook(cfg, i, bookRoot));

  let slots = computeSlots(view.w, view.h);

  /* ------------------------------------------------------------------ state */
  const state = { mode: "hero", selected: null, hovered: null, kbIndex: -1 };
  let closeTimer = 0;

  function open(b) {
    if (state.mode !== "hero" || !b) return;
    state.mode = "detail";
    state.selected = b;
    state.hovered = null;
    b.springs.drag.t = 0;
    setTargets(b, slots.detail);
    let k = 0;
    books.forEach((o) => {
      if (o !== b) sendOut(o, slots.hero[o.i].p[1], 0.02 + k++ * 0.07);
    });
    camTo("detail");
    onHover(-1, 0, 0);
    onOpen(b.i);
  }

  function close() {
    if (state.mode !== "detail") return;
    state.mode = "closing";
    const sel = state.selected;
    if (sel) {
      setTargets(sel, slots.hero[sel.i]);
      // unwind whatever rotation the tumbling left it at, the short way round
      sel.orbPhase = "return";
      sel.orbTarget = Math.round(sel.orbY / (Math.PI * 2)) * Math.PI * 2;
    }
    let k = 0;
    books.forEach((o) => {
      if (o !== sel) bringBack(o, slots.hero[o.i].p[1], 0.04 + k++ * 0.07);
    });
    camTo("hero");
    closeTimer = 1.05;
    onClose();
  }

  const input = createInput({ canvas: renderer.domElement, camera, books, state, view, open, close });

  /* ----------------------------------------------------------------- camera */
  const camX = new Spring(0, 13, 6.5);
  const camZ = new Spring(9.6, 13, 6.5);
  const lookX = new Spring(0, 13, 6.5);
  const lookY = new Spring(0, 13, 6.5);
  const parX = new Spring(0, 55, 13); // pointer parallax
  const parY = new Spring(0, 55, 13);

  function camTo(mode) {
    const c = cameraFor(mode, slots.portrait);
    camX.t = c.x;
    camZ.t = c.z;
    lookX.t = c.lookX;
    lookY.t = c.lookY;
  }

  /* ------------------------------------------------------------- the frame */
  const timer = new THREE.Timer(); // Clock is deprecated as of three 0.184
  timer.connect(document); // hidden tabs report a zero delta instead of a huge one
  const tmpV = new THREE.Vector3();
  let raf = 0;
  let lastHover = -2;

  function screenPos(b) {
    b.root.getWorldPosition(tmpV).project(camera);
    b.scr.x = (tmpV.x * 0.5 + 0.5) * view.w;
    b.scr.y = (-tmpV.y * 0.5 + 0.5) * view.h;
  }

  const ctx = { state, ptr: input.ptr, orbit: input.orbit, view, idle };

  function frame(now) {
    raf = requestAnimationFrame(frame);
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.05);
    const t = timer.getElapsed();

    if (closeTimer > 0) {
      closeTimer -= dt;
      if (closeTimer <= 0) {
        state.mode = "hero";
        state.selected = null;
      }
    }

    // hover: only in the fan, and only for a pointer that is actually here
    if (state.mode === "hero") {
      if (!input.isTouch() && input.ptr.seen && !input.ptr.down) input.castRay();
      const kb = state.kbIndex >= 0 ? books[state.kbIndex] : null;
      state.hovered = kb || (input.ptr.down ? input.dragBook : input.rayBook);
    } else {
      state.hovered = null;
    }

    const hoverIdx = state.hovered ? state.hovered.i : -1;
    if (hoverIdx !== lastHover) {
      lastHover = hoverIdx;
      const h = state.hovered;
      onHover(hoverIdx, h ? h.scr.x : 0, h ? h.scr.y : 0);
    }

    books.forEach((b) => {
      screenPos(b);
      tickBook(b, ctx, dt, t);
    });

    // parallax: the whole fan leans a few degrees toward the pointer
    const lean = state.mode === "hero" && input.ptr.seen && !input.isTouch();
    parX.t = lean ? clamp(input.ptr.ndcX, -1, 1) * 0.05 : 0;
    parY.t = lean ? clamp(input.ptr.ndcY, -1, 1) * 0.03 : 0;
    parX.update(dt);
    parY.update(dt);
    bookRoot.rotation.y = parX.v;
    bookRoot.rotation.x = -parY.v;

    camX.update(dt);
    camZ.update(dt);
    lookX.update(dt);
    lookY.update(dt);
    camera.position.set(camX.v, 0.1, camZ.v);
    camera.lookAt(lookX.v, lookY.v, 0);

    renderer.render(scene, camera);
  }

  /* ----------------------------------------------------------------- resize */
  function resize() {
    view.w = mount.clientWidth || 1;
    view.h = mount.clientHeight || 1;
    renderer.setSize(view.w, view.h);
    camera.aspect = view.w / view.h;
    camera.updateProjectionMatrix();

    slots = computeSlots(view.w, view.h);
    bookRoot.scale.setScalar(slots.fit);
    bookRoot.position.y = slots.groupY;

    if (state.mode === "detail" && state.selected) setTargets(state.selected, slots.detail);
    else books.forEach((b) => setTargets(b, slots.hero[b.i]));
    camTo(state.mode === "detail" ? "detail" : "hero");
  }

  // Seat the books in their slots, then let them rise into place on load.
  resize();
  books.forEach((b) => {
    const slot = slots.hero[b.i];
    b.springs.px.set(slot.p[0]);
    b.springs.py.set(slot.p[1] - 3.2);
    b.springs.pz.set(slot.p[2]);
    b.springs.rx.set(slot.r[0]);
    b.springs.ry.set(slot.r[1]);
    b.springs.rz.set(slot.r[2]);
    b.springs.sc.set(slot.s);
    bringBack(b, slot.p[1], 0.1 + b.i * 0.09);
  });

  const ro = new ResizeObserver(resize);
  ro.observe(mount);
  frame();

  return {
    open: (i) => open(books[i]),
    close,
    resize,
    destroy() {
      cancelAnimationFrame(raf);
      timer.dispose();
      ro.disconnect();
      input.destroy();
      disposables.forEach((d) => d.dispose?.());
      renderer.dispose();
      const canvas = renderer.domElement;
      if (canvas.parentNode === mount) mount.removeChild(canvas);
    },
  };
}
