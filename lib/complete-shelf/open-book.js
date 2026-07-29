// The open-book rig — the readable interior of a volume.
//
// A book is a stack of leaves hinged at the spine (local x = 0). Each leaf is a
// subdivided plane whose turn is driven by ONE parameter per leaf, uTurn (0 = lying
// flat on the right, 1 = turned flat to the left). The turn is done inside a
// MeshStandardMaterial via onBeforeCompile, so the page BENDS as it goes (a curl
// that peaks mid-turn) and still takes the scene's warm light + casts shadow — the
// thing that actually sells "paper". No cloth solver; a physical curl model driven
// by drag, with the weighted settle handled by the engine.
//
//   const rig = createOpenBook(THREE, book);  scene.add(rig.group);
//   rig.setP(2.4);   // continuous read position across the leaves
//   rig.dispose();

import * as THREE from "three";
import { makeCoverTexture } from "./cover-art";
import { makeLeaves } from "./page-art";

const SEG = 30; // horizontal subdivisions → smooth curl

export function createOpenBook(book) {
  const group = new THREE.Group();

  const pageW = book.dims.depth * 0.94;
  const pageH = book.dims.height * 0.94;
  const coverW = book.dims.depth;
  const coverH = book.dims.height;

  // leaf sequence: cover + interior leaves (recto = right page, verso = left)
  const cover = makeCoverTexture(book);
  const inner = makeLeaves(book);
  const seq = [{ front: cover, back: inner[0].front }, ...inner.slice(1)];
  const L = seq.length;

  // geometry with the hinge at x = 0
  const pageGeo = new THREE.PlaneGeometry(pageW, pageH, SEG, 1);
  pageGeo.translate(pageW / 2, 0, 0);
  const coverGeo = new THREE.PlaneGeometry(coverW, coverH, SEG, 1);
  coverGeo.translate(coverW / 2, 0, 0);

  const leaves = [];
  for (let i = 0; i < L; i++) {
    const u = { uTurn: { value: 0 }, uCurl: { value: 0.16 }, uPageW: { value: i === 0 ? coverW : pageW } };
    const geo = i === 0 ? coverGeo : pageGeo;
    const recto = new THREE.Mesh(geo, curlMaterial(seq[i].front, u, false, i === 0));
    const verso = new THREE.Mesh(geo, curlMaterial(backTex(seq[i].back), u, true, i === 0));
    recto.castShadow = recto.receiveShadow = true;
    verso.castShadow = verso.receiveShadow = true;
    const pivot = new THREE.Group();
    pivot.add(recto, verso);
    group.add(pivot);
    leaves.push({ pivot, u, recto, verso });
  }

  // back cover board — fixed, sits at the very back of the block
  const boardMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(book.cloth).multiplyScalar(0.8), roughness: 0.9 });
  const board = new THREE.Mesh(coverGeo, boardMat);
  board.castShadow = board.receiveShadow = true;
  board.position.z = -0.03;
  group.add(board);

  function setP(p) {
    for (let i = 0; i < L; i++) {
      const t = clamp(p - i, 0, 1);
      const lf = leaves[i];
      lf.u.uTurn.value = t;
      // continuous z so the right + left blocks have thickness (no z-fighting)
      const depth = 0.006 * (L - i) + 0.004;
      lf.pivot.position.z = Math.cos(t * Math.PI) * depth;
    }
  }

  // curl amount — the engine drives this from turn speed so a flick flexes more
  function setCurl(c) {
    for (const lf of leaves) lf.u.uCurl.value = c;
  }

  setP(0);

  return {
    group,
    L,
    leaves,
    setP,
    setCurl,
    dispose() {
      pageGeo.dispose();
      coverGeo.dispose();
      boardMat.dispose();
      for (const lf of leaves) {
        disposeMat(lf.recto.material);
        disposeMat(lf.verso.material);
      }
    },
  };
}

// verso textures are seen through a back-facing plane → mirror U so text reads
function backTex(tex) {
  const t = tex.clone();
  t.wrapS = THREE.RepeatWrapping;
  t.center.set(0.5, 0.5);
  t.repeat.x = -1;
  t.needsUpdate = true;
  return t;
}

function disposeMat(m) {
  if (m.map) m.map.dispose();
  m.dispose();
}

// A MeshStandardMaterial that bends the page in its vertex stage. The bend is a
// rotation about the spine (x=0) plus a bow that peaks at mid-turn = the curl.
function curlMaterial(map, u, isBack) {
  const m = new THREE.MeshStandardMaterial({
    map,
    roughness: 0.95,
    metalness: 0,
    side: isBack ? THREE.BackSide : THREE.FrontSide,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTurn = u.uTurn;
    sh.uniforms.uCurl = u.uCurl;
    sh.uniforms.uPageW = u.uPageW;
    sh.vertexShader =
      "uniform float uTurn;\nuniform float uCurl;\nuniform float uPageW;\n" +
      sh.vertexShader
        .replace(
          "#include <beginnormal_vertex>",
          `
          float _t = uTurn * 3.14159265;
          vec3 objectNormal = normalize(vec3(sin(_t), 0.0, cos(_t)));
          #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
          #endif
          `,
        )
        .replace(
          "#include <begin_vertex>",
          `
          float turn = uTurn * 3.14159265;
          float fx = clamp(position.x / uPageW, 0.0, 1.0);
          // bow peaks mid-turn; the free half of the page curls the most
          float bow = sin(3.14159265 * fx) * uCurl * sin(uTurn * 3.14159265);
          float ca = cos(turn), sa = sin(turn);
          float nx = position.x * ca + bow * sa;
          float nz = -position.x * sa + bow * ca;
          vec3 transformed = vec3(nx, position.y, nz);
          `,
        );
  };
  m.customProgramCacheKey = () => (isBack ? "obk-back" : "obk-front");
  return m;
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
