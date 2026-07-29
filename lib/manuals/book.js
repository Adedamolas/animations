/**
 * Building a book, and driving one.
 *
 * A book is a group of boards hinged at the spine: a front pivot and a back
 * pivot, both placed on the spine edge so rotating them about y opens a cover
 * the way a real one opens. Between them sit the page block and a few loose
 * leaves that follow the front board out, each a little less than the one
 * before it.
 */

import * as THREE from "three";
import { clamp } from "@/lib/math";
import { LOOK } from "./catalog";
import { makeJacket, makeShadowTexture } from "./cover-art";
import { BLOCK_D, CT, H, LEAVES, OV, W } from "./dimensions";
import { Spring, bookSprings } from "./spring";
import { stepY } from "./choreography";

/**
 * Geometry and the invisible raycast target are shared by all three books;
 * only the jackets differ. Everything allocated here is pushed onto
 * `disposables` so the engine can free it in one pass.
 */
export function createBookBuilder(disposables) {
  const coverGeo = new THREE.BoxGeometry(W + OV, H + OV * 2, CT);
  const blockGeo = new THREE.BoxGeometry(W - 0.02, H, BLOCK_D);
  const spineGeo = new THREE.BoxGeometry(CT, H + OV * 2, BLOCK_D + CT * 2);
  const leafGeo = new THREE.PlaneGeometry(W - 0.05, H - 0.05);
  const hitGeo = new THREE.BoxGeometry(W * 1.3, H * 1.12, 1.0);
  const blobGeo = new THREE.PlaneGeometry(1, 1);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const shadowTex = makeShadowTexture();
  disposables.push(coverGeo, blockGeo, spineGeo, leafGeo, hitGeo, blobGeo, hitMat, shadowTex);

  const std = (opts) => {
    const m = new THREE.MeshStandardMaterial(opts);
    disposables.push(m);
    return m;
  };

  function buildBook(cfg, i, parent) {
    const jacket = makeJacket(cfg);
    disposables.push(jacket.front, jacket.back, jacket.spine, jacket.edge, jacket.endpaper);

    const root = new THREE.Group();
    const float = new THREE.Group(); // idle bob, kept off the spring channels
    root.add(float);
    parent.add(root);

    const boardEdge = std({ color: cfg.clothDark, roughness: 0.78, metalness: 0.02 });
    const inside = std({ map: jacket.endpaper, roughness: 0.9, metalness: 0 });
    const front = std({ map: jacket.front, roughness: 0.62, metalness: 0.04 });
    const back = std({ map: jacket.back, roughness: 0.62, metalness: 0.04 });
    const edge = std({ map: jacket.edge, roughness: 0.86, metalness: 0 });

    // BoxGeometry material order: +x, -x, +y, -y, +z, -z
    const frontPivot = new THREE.Group();
    frontPivot.position.set(-W / 2, 0, BLOCK_D / 2 + CT / 2);
    const frontMesh = new THREE.Mesh(coverGeo, [
      boardEdge, boardEdge, boardEdge, boardEdge, front, inside,
    ]);
    frontMesh.position.x = (W + OV) / 2;
    frontPivot.add(frontMesh);
    float.add(frontPivot);

    const backPivot = new THREE.Group();
    backPivot.position.set(-W / 2, 0, -BLOCK_D / 2 - CT / 2);
    const backMesh = new THREE.Mesh(coverGeo, [
      boardEdge, boardEdge, boardEdge, boardEdge, inside, back,
    ]);
    backMesh.position.x = (W + OV) / 2;
    backPivot.add(backMesh);
    float.add(backPivot);

    const spine = new THREE.Mesh(spineGeo, [
      boardEdge, std({ map: jacket.spine, roughness: 0.7, metalness: 0.05 }),
      boardEdge, boardEdge, boardEdge, boardEdge,
    ]);
    spine.position.set(-W / 2 - CT / 2, 0, 0);
    float.add(spine);

    const block = new THREE.Mesh(blockGeo, [edge, edge, edge, edge, inside, inside]);
    block.position.x = 0.01;
    float.add(block);

    const leafMat = std({ color: cfg.paper, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
    const leaves = [];
    for (let k = 0; k < LEAVES; k++) {
      const pivot = new THREE.Group();
      pivot.position.set(-W / 2 + 0.012, 0, BLOCK_D / 2 - 0.004 - k * 0.006);
      const mesh = new THREE.Mesh(leafGeo, leafMat);
      mesh.position.x = (W - 0.05) / 2;
      pivot.add(mesh);
      float.add(pivot);
      leaves.push(pivot);
    }

    // The pool of light a floating book sits in. There is no floor to catch a
    // real shadow, so this is a glow rather than a darkness.
    const blobMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      color: new THREE.Color(LOOK.wordmark),
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    disposables.push(blobMat);
    const blob = new THREE.Mesh(blobGeo, blobMat);
    blob.position.set(0, -H / 2 - 0.12, -0.35);
    blob.scale.set(W * 2.6, H * 0.5, 1);
    float.add(blob);

    const hit = new THREE.Mesh(hitGeo, hitMat);
    float.add(hit);

    return {
      i,
      cfg,
      root,
      float,
      frontPivot,
      backPivot,
      leaves,
      hit,
      scr: { x: 0, y: 0 },
      phase: i * 1.9,
      hitEdge: 0.5,
      slotScale: 1,
      exit: null,
      orbY: 0,
      orbYv: 0,
      orbPhase: "idle",
      orbTarget: 0,
      orbXs: new Spring(0, 70, 16),
      springs: bookSprings(),
    };
  }

  return buildBook;
}

const TAU = Math.PI * 2;

/**
 * Drag to turn, flick to spin, let go and it settles facing front. Returns how
 * "busy" the book is, 0…1 — the covers use it to stop breathing while it moves.
 */
function tumble(b, ctx, dt) {
  const { orbit, state } = ctx;
  const inDetail = state.mode === "detail" && state.selected === b;

  if (orbit.drag && inDetail) {
    const step = orbit.dx * 6.5;
    orbit.dx = 0;
    b.orbY += step;
    b.orbYv = clamp(b.orbYv * 0.5 + (step / Math.max(dt, 0.001)) * 0.5, -14, 14);
    b.orbXs.t = clamp(b.orbXs.t + orbit.dy * 3.2, -0.5, 0.5);
    orbit.dy = 0;
    b.orbPhase = "drag";
  } else {
    b.orbXs.t = 0;
    if (b.orbPhase === "drag") {
      // let go slowly and it settles to the nearest face; flick and it spins
      b.orbPhase = Math.abs(b.orbYv) > 0.6 ? "spin" : "return";
      if (b.orbPhase === "return") {
        b.orbTarget = Math.round((b.orbY + b.orbYv * 1.2) / Math.PI) * Math.PI;
      }
    }
    if (b.orbPhase === "spin") {
      b.orbYv *= Math.exp(-0.9 * dt);
      b.orbY += b.orbYv * dt;
      if (Math.abs(b.orbYv) < 0.5) {
        b.orbPhase = "return";
        b.orbTarget = Math.round((b.orbY + b.orbYv * 1.2) / Math.PI) * Math.PI;
      }
    } else if (b.orbPhase === "return") {
      b.orbYv += (16 * (b.orbTarget - b.orbY) - 8 * b.orbYv) * dt;
      b.orbY += b.orbYv * dt;
      if (Math.abs(b.orbTarget - b.orbY) < 0.002 && Math.abs(b.orbYv) < 0.01) {
        b.orbY = b.orbTarget;
        b.orbYv = 0;
        b.orbPhase = "idle";
      }
    }
  }

  const distRest = Math.abs(b.orbY - Math.round(b.orbY / TAU) * TAU);
  return clamp(Math.abs(b.orbYv) * 1.5 + (orbit.drag ? 1 : 0) + distRest * 2, 0, 1);
}

/** How far each board should stand open this frame. */
function coverTargets(b, ctx, t, activity) {
  const { state, orbit, ptr, view, idle } = ctx;
  const inDetail = state.mode === "detail" && state.selected === b;
  const orbiting = state.selected === b && state.mode !== "hero";
  const s = b.springs;

  let front = 0;
  let back = 0;

  if (inDetail) {
    // resting open a crack and breathing, but only while it is holding still
    front = 0.02 + (0.13 + Math.sin(t * 0.8 + b.phase) * 0.015 * idle) * (1 - activity);
    const nearBack = Math.round((b.orbY - Math.PI) / TAU) * TAU + Math.PI;
    const activityB = clamp(
      Math.abs(b.orbYv) * 1.5 + (orbit.drag ? 1 : 0) + Math.abs(b.orbY - nearBack) * 2,
      0, 1,
    );
    back = (0.1 + Math.sin(t * 0.8 + b.phase + 1.7) * 0.012 * idle) * (1 - activityB);
  }

  if (state.hovered === b && ptr.seen && state.mode === "hero") {
    const dxN = (ptr.cx - b.scr.x) / (view.w * 0.25);
    const dyN = (b.scr.y - ptr.cy) / (view.h * 0.3);
    s.tiltY.t = clamp(dxN * 0.28, -0.15, 0.15);
    s.tiltX.t = clamp(-dyN * 0.1, -0.09, 0.1);
    s.lift.t = 0.32;
    // the board slips more the further out along it you point
    front = 0.085 + b.hitEdge * 0.16 + clamp(dyN, 0, 1) * 0.09;
  } else {
    s.tiltY.t = 0;
    s.tiltX.t = 0;
    s.lift.t = 0;
  }

  // inertia: a spin flings whichever board is trailing
  if (orbiting) {
    front += clamp(b.orbYv * 0.16, 0, 0.75);
    back += clamp(-b.orbYv * 0.16, 0, 0.75);
  }
  return { front, back };
}

/** One book, one frame: read the inputs, run the springs, write the transform. */
export function tickBook(b, ctx, dt, t) {
  const { state, idle } = ctx;
  const s = b.springs;
  const orbiting = state.selected === b && state.mode !== "hero";

  const activity = orbiting ? tumble(b, ctx, dt) : 0;
  b.orbXs.update(dt);

  const { front, back } = coverTargets(b, ctx, t, activity);
  s.cover.t = front + s.drag.v * 1.15;
  s.coverB.t = back;
  s.sc.t = b.slotScale * (state.hovered === b && state.mode === "hero" ? 1.07 : 1);

  s.px.update(dt);
  if (b.exit) stepY(b, dt);
  else s.py.update(dt);
  s.pz.update(dt);
  s.rx.update(dt);
  s.ry.update(dt);
  s.rz.update(dt);
  s.sc.update(dt);
  s.tiltX.update(dt);
  s.tiltY.update(dt);
  s.lift.update(dt);
  s.cover.update(dt);
  s.coverB.update(dt);
  s.drag.update(dt);

  b.root.position.set(s.px.v, s.py.v + s.lift.v, s.pz.v);
  b.root.rotation.set(s.rx.v + s.tiltX.v + b.orbXs.v, s.ry.v + s.tiltY.v + b.orbY, s.rz.v);
  b.root.scale.setScalar(s.sc.v);

  b.float.position.y = Math.sin(t * 0.62 + b.phase) * 0.035 * idle;
  b.float.rotation.z = Math.sin(t * 0.48 + b.phase) * 0.012 * idle;

  b.frontPivot.rotation.y = -s.cover.v;
  b.backPivot.rotation.y = s.coverB.v;
  for (let k = 0; k < b.leaves.length; k++) {
    b.leaves[k].rotation.y = -s.cover.v * (0.62 - k * 0.085);
  }
}
