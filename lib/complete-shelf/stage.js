/**
 * Everything the shelf is made of, built once: renderer, scene, the warm
 * editorial lighting, the walnut run, and a mesh per volume.
 *
 * Pure construction — no state, no input, no frame loop. `createShelf` takes
 * what comes back and drives it.
 */

import * as THREE from "three";
import { CATALOG, LOOK } from "./catalog";
import { makeSpineTexture, makeCoverTexture, makePagesTexture, makeWalnutTexture } from "./cover-art";

const GAP = 0.035; // gap between books along the shelf

export function buildStage(mount) {
  const w = mount.clientWidth;
  const h = mount.clientHeight;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  // PCFSoftShadowMap is deprecated as of three 0.184 and silently falls back
  // to this anyway; asking for it directly keeps the console clean.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.style.display = "block";
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const paper = new THREE.Color(LOOK.paper);
  scene.background = paper;
  scene.fog = new THREE.Fog(paper, 12, 30); // ends of the shelf melt into cream

  const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);

  /* ---- lighting: warm, soft, editorial ---- */
  const hemi = new THREE.HemisphereLight(0xfff6e8, 0x7a5738, 1.0);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1da, 1.3);
  key.position.set(-5, 9, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 40;
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -6;
  key.shadow.bias = -0.0004;
  key.shadow.radius = 4;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffe9cf, 0.42);
  fill.position.set(6, 3, 7);
  scene.add(fill);

  /* ---- book layout: walk the run, accumulating X ---- */
  const pages = makePagesTexture();
  const books = [];
  let cursor = 0;
  for (let i = 0; i < CATALOG.length; i++) {
    const b = CATALOG[i];
    if (i > 0) cursor += GAP;
    books.push({ book: b, centerX: cursor + b.dims.thickness / 2, pop: 0 });
    cursor += b.dims.thickness;
  }
  const runWidth = cursor;
  const maxDepth = Math.max(...CATALOG.map((b) => b.dims.depth));

  /* ---- the walnut run, extending well past both ends ---- */
  const walnut = makeWalnutTexture();
  const shelfGroup = new THREE.Group();
  scene.add(shelfGroup);

  const plankW = runWidth + 24;
  const shelfMat = new THREE.MeshStandardMaterial({ map: walnut, roughness: 0.62, metalness: 0.02, color: 0xffffff });
  walnut.repeat.set(plankW / 3, 1);
  const plank = new THREE.Mesh(new THREE.BoxGeometry(plankW, 0.5, maxDepth + 0.7), shelfMat);
  plank.position.set(runWidth / 2, -0.25, 0);
  plank.receiveShadow = true;
  shelfGroup.add(plank);

  // A low back rail — just a hint of shelf; cream fills the space above so the
  // run reads airy and editorial rather than boxed-in.
  const railMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(LOOK.walnut), roughness: 0.72 });
  const rail = new THREE.Mesh(new THREE.BoxGeometry(plankW, 0.34, 0.18), railMat);
  rail.position.set(runWidth / 2, 0.17, -maxDepth / 2 - 0.05);
  rail.receiveShadow = true;
  rail.castShadow = true;
  shelfGroup.add(rail);

  /* ---- a mesh per volume ---- */
  const bgMaterials = [shelfMat, railMat]; // everything that dims during inspect

  books.forEach((entry, index) => {
    const b = entry.book;
    const cloth = new THREE.Color(b.cloth);
    const clothDark = cloth.clone().multiplyScalar(0.82);
    const mkCloth = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, metalness: 0.0 });
    const mkTex = (tex) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88, metalness: 0.0 });
    const pageMat = new THREE.MeshStandardMaterial({ map: pages, roughness: 0.95, color: 0xffffff });

    // face order: +X front, -X back, +Y top, -Y bottom, +Z spine, -Z fore-edge
    const mats = [
      mkTex(makeCoverTexture(b)), mkCloth(clothDark), pageMat,
      pageMat, mkTex(makeSpineTexture(b)), pageMat,
    ];
    const geo = new THREE.BoxGeometry(b.dims.thickness, b.dims.height, b.dims.depth);
    const mesh = new THREE.Mesh(geo, mats);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(entry.centerX, b.dims.height / 2, 0);
    mesh.rotation.z = ((b.seed % 7) / 7 - 0.5) * 0.012; // subtle organic lean
    mesh.userData.index = index;
    shelfGroup.add(mesh);

    entry.mesh = mesh;
    entry.mats = mats;
    entry.baseY = b.dims.height / 2;
    entry.baseRot = { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z };
    // all dimmable; the inspected one is excluded at inspect time
    for (const m of mats) {
      m.transparent = true;
      bgMaterials.push(m);
    }
  });

  return { renderer, scene, camera, shelfGroup, books, bgMaterials, runWidth, maxDepth };
}
