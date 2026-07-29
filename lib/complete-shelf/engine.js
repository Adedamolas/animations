// The Complete Shelf engine — vanilla three.js, no React.
//
// A continuous walnut shelf of clothbound hardcovers. Browse by sliding the
// camera along the run (drag / wheel / arrows / buttons / markers); the centred
// volume lifts slightly. Inspect pulls the selected book forward off the shelf
// into an OrbitControls rig (orbit / pan / zoom) while the shelf dims back.
// Open it and you can turn the leaves by dragging.
//
//   const shelf = createShelf(mount, { onSelect(i){}, onMode(m){}, initialIndex });
//   shelf.select(i); shelf.next(); shelf.prev(); shelf.inspect(); shelf.close();
//   shelf.resize(); shelf.destroy();
//
// This file owns the browse/inspect state machine and the frame loop. The rest
// lives next door:
//
//   stage.js      renderer, lights, the walnut run, a mesh per volume
//   reading.js    the open book and the page turn
//   cover-art.ts  every jacket, painted on a canvas
//
// Assets are procedural. The Mint manifest (mint-assets.json) is imported only
// as a seam for future GLB books — no MCP is ever called here.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { clamp } from "@/lib/math";
import { buildStage } from "./stage";
import { createReader } from "./reading";
import manifest from "./mint-assets.json";

const EASE = 0.1; // browse camera lerp
const INSPECT_DUR = 0.72; // seconds for the pull-forward / return
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function createShelf(mount, cb = {}) {
  const { onSelect = () => {}, onMode = () => {}, initialIndex = 0 } = cb;
  // manifest is imported to honor the seam; procedural delivery builds textures.
  void manifest;

  const { renderer, scene, camera, books, bgMaterials, maxDepth } = buildStage(mount);
  const canvas = renderer.domElement;
  let W = mount.clientWidth;
  let H = mount.clientHeight;
  const last = books.length - 1;

  /* ------------------------------------------------------------------ state */
  let scroll = clamp(initialIndex, 0, last); // continuous position along the run
  let target = scroll;
  let selected = Math.round(scroll);
  let lastReported = -1;

  let insp = 0; // 0 browse .. 1 inspect
  let inspecting = false;
  let inspectIndex = -1;
  let controlsOn = false;
  let bgOpacity = 1;

  /* ---- OrbitControls: only live once fully inspecting ---- */
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.enablePan = true;
  controls.minDistance = 2.2;
  controls.maxDistance = 9;
  controls.enabled = false;

  const focal = new THREE.Vector3();
  const browseLook = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  /** Cast a pointer event at an object, in canvas space. */
  function hitTest(e, object, recursive = true) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(object, recursive).length > 0;
  }

  const reader = createReader({ scene, camera, controls, hitTest, onMode, controlsOn: () => controlsOn });

  /* ---------------------------------------------------------------- camera */
  function centerXAt(s) {
    const i = Math.floor(s);
    const a = books[clamp(i, 0, last)].centerX;
    const b = books[clamp(i + 1, 0, last)].centerX;
    return a + (b - a) * (s - i);
  }

  function browseCameraPose(pos, look) {
    const x = centerXAt(scroll);
    pos.set(x, 3.0, maxDepth / 2 + 6.2);
    look.set(x, 1.35, 0);
  }

  /* ----------------------------------------------------------- transitions */
  function startInspect() {
    if (inspecting) return;
    inspecting = true;
    inspectIndex = selected;
    onMode("inspect");
    const entry = books[inspectIndex];
    focal.set(entry.centerX, Math.max(1.5, entry.book.dims.height / 2 + 0.15), maxDepth / 2 + 3.0);
    // exclude the inspected book's materials from the dimming set
    entry.mats.forEach((m) => (m._keep = true));
  }

  function close() {
    if (!inspecting) return;
    reader.teardown(inspectIndex >= 0 ? books[inspectIndex] : null);
    controls.enabled = false;
    controlsOn = false;
    inspecting = false;
    onMode("browse");
  }

  function openBook() {
    if (!inspecting || reader.isOpen()) return;
    reader.open(books[inspectIndex], focal);
  }

  /* --------------------------------------------------------------- inputs */
  let snapTimer = 0;
  function kickSnap() {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => {
      target = Math.round(clamp(target, 0, last));
    }, 130);
  }

  function onWheel(e) {
    if (inspecting) return; // let OrbitControls zoom
    e.preventDefault();
    e.stopPropagation();
    target = clamp(target + e.deltaY * 0.0026, 0, last);
    kickSnap();
  }

  let dragging = false;
  let dragMoved = 0;
  let lastX = 0;
  let downX = 0;
  let downY = 0;

  function onDown(e) {
    downX = e.clientX;
    downY = e.clientY;
    if (inspecting) return; // controls own the pointer for orbit
    dragging = true;
    dragMoved = 0;
    lastX = e.clientX;
    canvas.setPointerCapture?.(e.pointerId);
  }

  function onMoveDrag(e) {
    if (!dragging || inspecting) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    dragMoved += Math.abs(dx);
    target = clamp(target - dx * 0.006, 0, last);
  }

  function onUp(e) {
    const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (inspecting) {
      // a click on the surroundings closes: the open book first, then the shelf
      if (dist < 6) {
        if (reader.isOpen()) {
          if (!hitTest(e, reader.state.rig.group)) reader.close();
        } else if (inspectIndex < 0 || !hitTest(e, books[inspectIndex].mesh, false)) {
          close();
        }
      }
      return;
    }
    dragging = false;
    if (dragMoved > 6) kickSnap();
    else handleClick(e);
  }

  function handleClick(e) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(books.map((b) => b.mesh), false);
    if (!hits.length) return;
    const idx = hits[0].object.userData.index;
    if (idx === selected) startInspect();
    else target = idx;
  }

  function onKey(e) {
    if (inspecting) {
      if (reader.isOpen()) {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") reader.turnPage(1);
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") reader.turnPage(-1);
        else if (e.key === "Escape") reader.close();
      } else {
        if (e.key === "Escape") close();
        else if (e.key === "Enter" || e.key === " ") openBook();
      }
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowDown") target = clamp(Math.round(target) + 1, 0, last);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") target = clamp(Math.round(target) - 1, 0, last);
    else if (e.key === "Enter" || e.key === " ") startInspect();
  }

  const readingDown = (e) => reader.onDown(e);
  const readingMove = (e) => reader.onMove(e, W);
  const readingUp = () => reader.onUp();

  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerdown", readingDown, true); // capture: pre-empt orbit
  window.addEventListener("pointermove", onMoveDrag);
  window.addEventListener("pointermove", readingMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointerup", readingUp);
  window.addEventListener("keydown", onKey);

  /* ------------------------------------------------------------------ loop */
  let raf = 0;
  const timer = new THREE.Timer(); // Clock is deprecated as of three 0.184
  timer.connect(document);

  function frame(now) {
    raf = requestAnimationFrame(frame);
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.05);

    // browse scroll
    if (!inspecting) {
      scroll += (target - scroll) * EASE;
      if (Math.abs(target - scroll) < 0.0005) scroll = target;
    }
    const sel = Math.round(clamp(scroll, 0, last));
    if (sel !== selected) selected = sel;
    if (selected !== lastReported && !inspecting) {
      lastReported = selected;
      onSelect(selected);
    }

    // inspect progress
    const want = inspecting ? 1 : 0;
    insp += (want - insp) * Math.min(1, dt / INSPECT_DUR) * 3.0;
    if (Math.abs(want - insp) < 0.001) insp = want;
    const e = easeInOut(insp);

    // per-book pop (skip the inspected one)
    for (let i = 0; i < books.length; i++) {
      const b = books[i];
      if (inspecting && i === inspectIndex) continue;
      const lift = i === selected && !inspecting ? 1 : 0;
      b.pop += (lift - b.pop) * 0.12;
      b.mesh.position.z = b.pop * 0.28;
      b.mesh.position.y = b.baseY + b.pop * 0.04;
    }

    // the inspected book: morph from shelf slot → presented pose
    if (inspectIndex >= 0) {
      const b = books[inspectIndex];
      b.mesh.position.set(
        THREE.MathUtils.lerp(b.centerX, focal.x, e),
        THREE.MathUtils.lerp(b.baseY, focal.y, e),
        THREE.MathUtils.lerp(0, focal.z, e),
      );
      b.mesh.rotation.set(
        THREE.MathUtils.lerp(b.baseRot.x, -0.06, e),
        THREE.MathUtils.lerp(b.baseRot.y, -Math.PI / 2, e),
        THREE.MathUtils.lerp(b.baseRot.z, 0, e),
      );
      if (insp === 0 && !inspecting) {
        b.mats.forEach((m) => (m._keep = false)); // fully returned
        inspectIndex = -1;
      }
    }

    if (reader.update(dt)) reader.teardown(inspectIndex >= 0 ? books[inspectIndex] : null);

    // dim the background during inspect
    bgOpacity += (1 - e * 0.88 - bgOpacity) * 0.2;
    for (const m of bgMaterials) m.opacity = m._keep ? 1 : bgOpacity;

    // camera: manual during browse + transition; OrbitControls once fully in
    if (insp >= 0.999 && inspecting) {
      if (!controlsOn) {
        controls.target.copy(focal);
        camera.position.set(focal.x, focal.y + 0.15, focal.z + 4.6);
        controls.enabled = true;
        controls.update();
        controlsOn = true;
      }
      controls.update();
    } else {
      controlsOn = false;
      controls.enabled = false;
      browseCameraPose(camera.position, browseLook);
      if (inspectIndex >= 0) {
        // blend toward the inspect pose during the transition
        const ipos = tmpLook.set(focal.x, focal.y + 0.15, focal.z + 4.6);
        camera.position.lerpVectors(camera.position, ipos, e);
        browseLook.lerpVectors(browseLook, focal, e);
      }
      camera.lookAt(browseLook);
    }

    renderer.render(scene, camera);
  }

  browseCameraPose(camera.position, browseLook);
  camera.lookAt(browseLook);
  onSelect(selected);
  lastReported = selected;
  frame();

  /* ---------------------------------------------------------------- resize */
  let rzTimer = 0;
  function doResize() {
    W = mount.clientWidth;
    H = mount.clientHeight;
    renderer.setSize(W, H);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }
  function onResize() {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(doResize, 120);
  }
  window.addEventListener("resize", onResize);

  return {
    select(i) {
      if (!inspecting) target = clamp(i, 0, last);
    },
    next() {
      if (!inspecting) target = clamp(Math.round(target) + 1, 0, last);
    },
    prev() {
      if (!inspecting) target = clamp(Math.round(target) - 1, 0, last);
    },
    inspect: startInspect,
    openBook,
    closeBook: reader.close,
    turnPage: reader.turnPage,
    close,
    _debugPage: reader.setPage,
    resize: doResize,
    destroy() {
      cancelAnimationFrame(raf);
      timer.dispose();
      clearTimeout(snapTimer);
      clearTimeout(rzTimer);
      reader.teardown(inspectIndex >= 0 ? books[inspectIndex] : null);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerdown", readingDown, true);
      window.removeEventListener("pointermove", onMoveDrag);
      window.removeEventListener("pointermove", readingMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointerup", readingUp);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const arr = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of arr) {
            if (m.map) m.map.dispose();
            m.dispose();
          }
        }
      });
      renderer.dispose();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    },
  };
}
