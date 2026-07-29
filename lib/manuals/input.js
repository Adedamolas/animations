/**
 * Pointer and keyboard. Owns the raycast, the peel-drag in the fan and the
 * tumble-drag in the detail view, and decides which gestures count as a tap.
 *
 * Everything it knows is exposed on the returned object; the frame loop reads
 * `ptr`, `orbit`, `rayBook` and `dragBook` and never listens for events itself.
 */

import * as THREE from "three";
import { clamp } from "@/lib/math";
import { W } from "./dimensions";

const TAP_SLOP = { mouse: 14, touch: 26 }; // px of wander still counted as a tap
const TAP_TIME = { mouse: 450, touch: 650 }; // …and how long it may be held

export function createInput({ canvas, camera, books, state, view, open, close }) {
  const ray = new THREE.Raycaster();
  const hitMeshes = books.map((b) => b.hit);
  const bookByHit = (o) => books.find((b) => b.hit === o);

  const ptr = {
    id: null, down: false, seen: false, moved: 0,
    cx: 0, cy: 0, lastX: 0, lastY: 0, downX: 0, t0: 0,
    ndcX: 0, ndcY: 0, type: "mouse",
  };
  const orbit = { drag: false, dx: 0, dy: 0 };

  const api = {
    ptr,
    orbit,
    dragBook: null,
    rayBook: null,
    isTouch: () => ptr.type === "touch" || ptr.type === "pen",
    castRay,
    clearRay() {
      api.rayBook = null;
    },
    destroy,
  };

  function castRay() {
    ray.setFromCamera({ x: ptr.ndcX, y: ptr.ndcY }, camera);
    const hits = ray.intersectObjects(hitMeshes, false);
    if (!hits.length) {
      api.rayBook = null;
      return;
    }
    const book = bookByHit(hits[0].object);
    api.rayBook = book;
    // 0 at the spine, 1 at the free edge — how far in you are pointing, which
    // is what decides how far the board slips open under the cursor
    const local = book.hit.worldToLocal(hits[0].point.clone());
    book.hitEdge = clamp(local.x / (W * 1.3) + 0.5, 0, 1);
  }

  function track(e) {
    ptr.cx = e.clientX;
    ptr.cy = e.clientY;
    ptr.ndcX = (e.clientX / view.w) * 2 - 1;
    ptr.ndcY = -(e.clientY / view.h) * 2 + 1;
    ptr.type = e.pointerType || "mouse";
    ptr.seen = true;
  }

  const onPointerMove = (e) => {
    if (ptr.id !== null && e.pointerId !== ptr.id) return;
    const dxN = (e.clientX - ptr.lastX) / view.w;
    const dyN = (e.clientY - ptr.lastY) / view.h;
    ptr.lastX = e.clientX;
    ptr.lastY = e.clientY;
    track(e);

    if (!ptr.down) return;
    ptr.moved += Math.abs(dxN * view.w) + Math.abs(dyN * view.h);
    if (api.dragBook) {
      // dragging away from the spine peels the board further open
      api.dragBook.springs.drag.t = clamp(((ptr.downX - e.clientX) / view.w) * 3.4, 0, 1);
    }
    if (orbit.drag) {
      orbit.dx += dxN;
      orbit.dy += dyN;
    }
  };

  const onPointerDown = (e) => {
    if (ptr.id !== null) return; // a second finger must not hijack the drag
    ptr.id = e.pointerId;
    // Seed the baseline, or a touch's first move is measured from wherever the
    // pointer last was and that jump reads as a drag — so taps never open.
    ptr.lastX = e.clientX;
    ptr.lastY = e.clientY;
    ptr.downX = e.clientX;
    ptr.moved = 0;
    ptr.t0 = performance.now();
    track(e);
    castRay();

    if (state.mode === "hero" && api.rayBook) {
      ptr.down = true;
      api.dragBook = api.rayBook;
      canvas.setPointerCapture(e.pointerId);
    } else if (state.mode === "detail" && api.rayBook === state.selected) {
      ptr.down = true;
      orbit.drag = true;
      orbit.dx = 0;
      orbit.dy = 0;
      canvas.setPointerCapture(e.pointerId);
    }
  };

  const onPointerUp = (e) => {
    if (ptr.id !== null && e.pointerId !== ptr.id) return;
    ptr.id = null;
    orbit.drag = false;
    if (api.dragBook) {
      // fingers wobble and press longer than a mouse, so a tap gets more slop
      const kind = api.isTouch() ? "touch" : "mouse";
      const quick = performance.now() - ptr.t0 < TAP_TIME[kind];
      api.dragBook.springs.drag.t = 0;
      if (ptr.moved <= TAP_SLOP[kind] && quick && state.mode === "hero") {
        open(api.dragBook);
      }
      api.dragBook = null;
    }
    ptr.down = false;
    if (api.isTouch()) api.rayBook = null; // touch has no hover to leave behind
  };

  /* The OS can take a gesture away — a scroll, a palm, an incoming call.
     Without this the board would stay peeled and the drag would never clear. */
  const onPointerCancel = (e) => {
    if (e && ptr.id !== null && e.pointerId !== ptr.id) return;
    ptr.id = null;
    ptr.down = false;
    orbit.drag = false;
    if (api.dragBook) {
      api.dragBook.springs.drag.t = 0;
      api.dragBook = null;
    }
    if (api.isTouch()) api.rayBook = null;
  };

  const onPointerLeave = () => {
    api.rayBook = null;
    state.kbIndex = -1;
    ptr.seen = false;
  };

  const onContextMenu = (e) => e.preventDefault();

  const onKey = (e) => {
    if (e.key === "Escape") close();
    if (state.mode !== "hero") return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const d = e.key === "ArrowRight" ? 1 : -1;
      const from = state.kbIndex < 0 ? (d > 0 ? -1 : 1) : state.kbIndex;
      state.kbIndex = (from + d + books.length) % books.length;
      e.preventDefault();
    }
    if ((e.key === "Enter" || e.key === " ") && state.hovered) {
      open(state.hovered);
      e.preventDefault();
    }
  };

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("contextmenu", onContextMenu);
  canvas.addEventListener("lostpointercapture", onPointerCancel);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  window.addEventListener("keydown", onKey);

  function destroy() {
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    canvas.removeEventListener("contextmenu", onContextMenu);
    canvas.removeEventListener("lostpointercapture", onPointerCancel);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
    window.removeEventListener("keydown", onKey);
  }

  return api;
}
