// Procedural jackets. Every face of every book — front, back, spine, page
// edges, endpapers — is painted on a 2D canvas and handed to three.js as a
// texture, so the shelf ships with no image assets at all.
//
// Canvas text uses web-safe families on purpose: next/font families are hashed
// and unreliable to name inside a raw canvas. Sizes are power-of-two so mipmaps
// and anisotropy stay on — these covers are read at every scale from a thumb in
// the fan to a full-height detail view.

import * as THREE from "three";
import type { Manual, Motif } from "./catalog";

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'Inter, "Helvetica Neue", Arial, sans-serif';

const CW = 1024; // cover texture width
const CH = 1536; // …and height — the book's aspect is built from this ratio
export const COVER_ASPECT = CW / CH;

function canvas2d(w: number, h: number) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  return { cv, ctx: cv.getContext("2d")! };
}

function toTexture(cv: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8; // three clamps this to the GPU maximum
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

/** Woven cloth: a fine warp/weft grid under a soft light falloff. */
function cloth(ctx: CanvasRenderingContext2D, w: number, h: number, m: Manual) {
  ctx.fillStyle = m.cloth;
  ctx.fillRect(0, 0, w, h);

  // weave
  ctx.globalAlpha = 0.055;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1;
  const step = Math.max(3, Math.round(w / 220));
  ctx.beginPath();
  for (let x = 0; x < w; x += step) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
  }
  for (let y = 0; y < h; y += step) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // the light the cover is printed under
  const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
  g.addColorStop(0, "rgba(255,255,255,0.10)");
  g.addColorStop(0.45, "rgba(255,255,255,0)");
  g.addColorStop(1, "rgba(0,0,0,0.20)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // grain
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.fillStyle = Math.random() > 0.5 ? "#fff" : "#000";
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;
}

/** The blind-embossed rule that frames every jacket in the series. */
function frame(ctx: CanvasRenderingContext2D, w: number, h: number, m: Manual) {
  const pad = w * 0.075;
  ctx.strokeStyle = m.foil;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = w * 0.006;
  ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
  ctx.globalAlpha = 1;
}

/** Each book's mark — the thing it is actually about, drawn once, large. */
function motif(ctx: CanvasRenderingContext2D, w: number, h: number, m: Manual, kind: Motif) {
  const cx = w / 2;
  const top = h * 0.46;
  const box = w * 0.62;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (kind === "curve") {
    // an ease-out: all of its distance spent early, arriving flat
    const x0 = cx - box / 2;
    const y0 = top + box * 0.72;
    const x1 = cx + box / 2;
    const y1 = top - box * 0.06;
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = m.ink;
    ctx.lineWidth = w * 0.004;
    for (let i = 0; i <= 4; i++) {
      const y = y0 + ((y1 - y0) * i) / 4;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = m.foil;
    ctx.lineWidth = w * 0.022;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(x0 + box * 0.23, y1, x0 + box * 0.4, y1, x1, y1);
    ctx.stroke();
    // the handle that makes it that curve and not another
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = m.ink;
    ctx.lineWidth = w * 0.005;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + box * 0.23, y1);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = m.ink;
    ctx.beginPath();
    ctx.arc(x0 + box * 0.23, y1, w * 0.016, 0, Math.PI * 2);
    ctx.fill();
  }

  if (kind === "wave") {
    // a damped oscillation, settling into the line it was always heading for
    const x0 = cx - box / 2;
    const mid = top + box * 0.34;
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = m.ink;
    ctx.lineWidth = w * 0.004;
    ctx.setLineDash([w * 0.014, w * 0.014]);
    ctx.beginPath();
    ctx.moveTo(x0, mid);
    ctx.lineTo(x0 + box, mid);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = m.foil;
    ctx.lineWidth = w * 0.02;
    ctx.beginPath();
    for (let i = 0; i <= 220; i++) {
      const t = i / 220;
      const x = x0 + box * t;
      const y = mid - Math.sin(t * Math.PI * 4.6) * box * 0.34 * Math.exp(-3.1 * t);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = m.foil;
    ctx.beginPath();
    ctx.arc(x0 + box, mid, w * 0.018, 0, Math.PI * 2);
    ctx.fill();
  }

  if (kind === "disc") {
    // 0.97 of a circle, against the circle it was
    const r = box * 0.34;
    const cy = top + box * 0.34;
    ctx.globalAlpha = 0.34;
    ctx.strokeStyle = m.ink;
    ctx.lineWidth = w * 0.005;
    ctx.setLineDash([w * 0.012, w * 0.014]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = m.foil;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.97, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = m.cloth;
    ctx.font = `600 ${w * 0.085}px ${SANS}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("0.97", cx, cy + w * 0.004);
  }
  ctx.restore();
}

function frontFace(m: Manual) {
  const { cv, ctx } = canvas2d(CW, CH);
  cloth(ctx, CW, CH, m);
  frame(ctx, CW, CH, m);

  ctx.textAlign = "center";
  ctx.fillStyle = m.ink;

  // series line
  ctx.font = `500 ${CW * 0.026}px ${SANS}`;
  ctx.globalAlpha = 0.62;
  ctx.letterSpacing = `${CW * 0.012}px`;
  ctx.fillText("A MANUAL ON MOTION", CW / 2, CH * 0.128);
  ctx.letterSpacing = "0px";
  ctx.globalAlpha = 1;

  // title, set big and tight
  const size = m.lines.length > 2 ? CW * 0.135 : CW * 0.168;
  ctx.font = `600 ${size}px ${SERIF}`;
  m.lines.forEach((ln, i) => {
    ctx.fillText(ln, CW / 2, CH * 0.235 + i * size * 1.03);
  });

  motif(ctx, CW, CH, m, m.motif);

  // subtitle + author
  ctx.font = `italic ${CW * 0.038}px ${SERIF}`;
  ctx.globalAlpha = 0.82;
  ctx.fillText(m.subtitle, CW / 2, CH * 0.83);
  ctx.globalAlpha = 1;
  ctx.font = `500 ${CW * 0.03}px ${SANS}`;
  ctx.letterSpacing = `${CW * 0.008}px`;
  ctx.fillText(m.author.toUpperCase(), CW / 2, CH * 0.885);
  ctx.letterSpacing = "0px";

  return toTexture(cv);
}

function backFace(m: Manual) {
  const { cv, ctx } = canvas2d(CW, CH);
  cloth(ctx, CW, CH, m);
  frame(ctx, CW, CH, m);

  ctx.fillStyle = m.ink;
  ctx.textAlign = "left";
  const pad = CW * 0.145;

  // the blurb, wrapped by hand
  ctx.font = `${CW * 0.036}px ${SERIF}`;
  ctx.globalAlpha = 0.86;
  const words = m.blurb.split(" ");
  let line = "";
  let y = CH * 0.2;
  const maxW = CW - pad * 2;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW) {
      ctx.fillText(line, pad, y);
      y += CW * 0.058;
      line = word;
    } else line = test;
  }
  ctx.fillText(line, pad, y);
  ctx.globalAlpha = 1;

  // an ISBN that goes nowhere
  ctx.fillStyle = m.ink;
  ctx.globalAlpha = 0.14;
  ctx.fillRect(pad, CH * 0.78, CW * 0.3, CH * 0.09);
  ctx.globalAlpha = 1;
  ctx.font = `500 ${CW * 0.026}px ${SANS}`;
  ctx.globalAlpha = 0.6;
  ctx.fillText(`${m.pages} PAGES · ${m.year}`, pad, CH * 0.9);
  ctx.globalAlpha = 1;

  return toTexture(cv);
}

function spineFace(m: Manual) {
  const SW = 256;
  const { cv, ctx } = canvas2d(SW, CH);
  ctx.fillStyle = m.cloth;
  ctx.fillRect(0, 0, SW, CH);
  // the spine catches less light than the boards
  const g = ctx.createLinearGradient(0, 0, SW, 0);
  g.addColorStop(0, "rgba(0,0,0,0.34)");
  g.addColorStop(0.4, "rgba(255,255,255,0.06)");
  g.addColorStop(1, "rgba(0,0,0,0.34)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SW, CH);

  ctx.save();
  ctx.translate(SW / 2, CH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = m.ink;
  ctx.font = `600 ${SW * 0.38}px ${SERIF}`;
  ctx.fillText(m.title, 0, 0);
  ctx.restore();

  // foil bands, head and tail
  ctx.fillStyle = m.foil;
  ctx.globalAlpha = 0.7;
  ctx.fillRect(SW * 0.2, CH * 0.06, SW * 0.6, CH * 0.004);
  ctx.fillRect(SW * 0.2, CH * 0.93, SW * 0.6, CH * 0.004);
  ctx.globalAlpha = 1;

  return toTexture(cv);
}

/** The edge of the page block: hundreds of leaves, seen end-on. */
function pageEdge(m: Manual) {
  const { cv, ctx } = canvas2d(512, 512);
  ctx.fillStyle = m.paper;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 460; i++) {
    const x = Math.random() * 512;
    ctx.globalAlpha = 0.03 + Math.random() * 0.1;
    ctx.fillStyle = Math.random() > 0.35 ? "#8d7d5f" : "#fffaf0";
    ctx.fillRect(x, 0, Math.random() > 0.8 ? 2 : 1, 512);
  }
  ctx.globalAlpha = 1;
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "rgba(0,0,0,0.16)");
  g.addColorStop(0.5, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const tex = toTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Inside the boards: a flat colour with a printed plate. */
function endpaperFace(m: Manual) {
  const { cv, ctx } = canvas2d(512, 768);
  ctx.fillStyle = m.endpaper;
  ctx.fillRect(0, 0, 512, 768);
  ctx.globalAlpha = 0.09;
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#fff" : "#000";
    ctx.fillRect(Math.random() * 512, Math.random() * 768, 2, 2);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = m.foil;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 2;
  ctx.strokeRect(46, 60, 512 - 92, 768 - 120);
  ctx.globalAlpha = 1;
  return toTexture(cv);
}

/** The soft dark pool a floating book leaves under itself. */
export function makeShadowTexture() {
  const { cv, ctx } = canvas2d(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(0,0,0,0.62)");
  g.addColorStop(0.45, "rgba(0,0,0,0.26)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return toTexture(cv);
}

export type Jacket = ReturnType<typeof makeJacket>;

export function makeJacket(m: Manual) {
  return {
    front: frontFace(m),
    back: backFace(m),
    spine: spineFace(m),
    edge: pageEdge(m),
    endpaper: endpaperFace(m),
  };
}
