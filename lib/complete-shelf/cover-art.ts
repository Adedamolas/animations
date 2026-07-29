// Procedural clothbound covers — every book's spine + front are painted on a
// 2D canvas and handed to three.js as textures. The look: a woven cloth base,
// an abstract motif and serif type stamped in metallic foil, an embossed frame.
//
// Canvas text uses a web-safe serif (Georgia) on purpose — next/font families
// are hashed and unreliable to name inside a raw canvas; the DOM overlay uses
// Newsreader for crisp editorial type. Textures are power-of-two so mipmaps +
// anisotropy stay on. Built once per book, then cached on the GPU.

import * as THREE from "three";
import { type Book, type Foil, FOILS } from "./catalog";

export const SERIF = 'Georgia, "Times New Roman", serif';

// ---- seeded RNG (mulberry32) ----
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

export function canvas2d(w: number, h: number) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  return { cv, ctx };
}

export function toTexture(cv: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8; // three clamps to the GPU max
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// ---- woven cloth base ----
function clothBase(ctx: CanvasRenderingContext2D, w: number, h: number, cloth: string, seed: number) {
  ctx.fillStyle = cloth;
  ctx.fillRect(0, 0, w, h);

  // fine woven grain via per-pixel luminance noise + a thread weave
  const [r, g, b] = hexRgb(cloth);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const rnd = rng(seed * 7 + 1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // thread weave: alternating warp/weft shading every 3px
      const weave = (((x % 3) === 0 ? -1 : 0) + ((y % 3) === 0 ? -1 : 0)) * 5;
      const n = (rnd() - 0.5) * 16 + weave;
      d[i] = clamp8(r + n);
      d[i + 1] = clamp8(g + n);
      d[i + 2] = clamp8(b + n);
    }
  }
  ctx.putImageData(img, 0, 0);

  // edge vignette for depth
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.62);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  // soft top sheen
  const sh = ctx.createLinearGradient(0, 0, 0, h);
  sh.addColorStop(0, "rgba(255,255,255,0.06)");
  sh.addColorStop(0.14, "rgba(255,255,255,0)");
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, w, h);
}

function clamp8(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

// diagonal metallic gradient across a bounding box, for foil fills/strokes
function foilGradient(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, foil: Foil) {
  const [hi, base, sh] = FOILS[foil];
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, hi);
  g.addColorStop(0.42, base);
  g.addColorStop(0.62, hi);
  g.addColorStop(1, sh);
  return g;
}

// set up an embossed foil stroke/fill context (call within save/restore)
function foilStamp(ctx: CanvasRenderingContext2D, foil: Foil) {
  const [, , sh] = FOILS[foil];
  ctx.shadowColor = sh;
  ctx.shadowBlur = 1.5;
  ctx.shadowOffsetX = 0.8;
  ctx.shadowOffsetY = 1.2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
}

// ---- abstract foil motif, centred at (cx,cy) within radius r ----
function drawMotif(ctx: CanvasRenderingContext2D, book: Book, cx: number, cy: number, r: number) {
  const rnd = rng(book.seed * 13 + 3);
  ctx.save();
  foilStamp(ctx, book.foil);
  const grad = foilGradient(ctx, cx - r, cy - r, r * 2, r * 2, book.foil);
  ctx.strokeStyle = grad;
  ctx.fillStyle = grad;

  switch (book.motif) {
    case "arcs": {
      ctx.lineWidth = r * 0.05;
      for (let i = 1; i <= 5; i++) {
        const rr = (r * i) / 5;
        ctx.beginPath();
        ctx.arc(cx, cy + r * 0.4, rr, Math.PI * 1.08, Math.PI * 1.92);
        ctx.stroke();
      }
      break;
    }
    case "rings": {
      ctx.lineWidth = r * 0.045;
      for (let i = 1; i <= 5; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (r * i) / 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case "grid": {
      ctx.lineWidth = r * 0.04;
      const n = 4;
      const s = (r * 1.4) / n;
      for (let i = 0; i <= n; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.7 + i * s, cy - r * 0.7);
        ctx.lineTo(cx - r * 0.7 + i * s, cy + r * 0.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.7, cy - r * 0.7 + i * s);
        ctx.lineTo(cx + r * 0.7, cy - r * 0.7 + i * s);
        ctx.stroke();
      }
      break;
    }
    case "waves": {
      ctx.lineWidth = r * 0.05;
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        for (let x = -r; x <= r; x += 4) {
          const y = Math.sin((x / r) * Math.PI * 2) * r * 0.16 + k * r * 0.28;
          if (x === -r) ctx.moveTo(cx + x, cy + y);
          else ctx.lineTo(cx + x, cy + y);
        }
        ctx.stroke();
      }
      break;
    }
    case "sunburst": {
      ctx.lineWidth = r * 0.035;
      const rays = 16;
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3);
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        ctx.stroke();
      }
      break;
    }
    case "bars": {
      const n = 6;
      const bh = (r * 1.5) / (n * 1.7);
      for (let i = 0; i < n; i++) {
        const bw = r * (0.5 + rnd() * 0.9);
        ctx.fillRect(cx - bw / 2, cy - r * 0.75 + i * bh * 1.7, bw, bh);
      }
      break;
    }
    case "diamond": {
      ctx.lineWidth = r * 0.045;
      for (let i = 1; i <= 4; i++) {
        const rr = (r * i) / 4;
        ctx.beginPath();
        ctx.moveTo(cx, cy - rr);
        ctx.lineTo(cx + rr * 0.72, cy);
        ctx.lineTo(cx, cy + rr);
        ctx.lineTo(cx - rr * 0.72, cy);
        ctx.closePath();
        ctx.stroke();
      }
      break;
    }
    case "columns": {
      ctx.lineWidth = r * 0.06;
      const n = 5;
      for (let i = 0; i < n; i++) {
        const x = cx - r * 0.6 + (i * (r * 1.2)) / (n - 1);
        ctx.beginPath();
        ctx.moveTo(x, cy - r * 0.8);
        ctx.lineTo(x, cy + r * 0.8);
        ctx.stroke();
      }
      break;
    }
    case "monogram": {
      ctx.font = `700 ${r * 1.7}px ${SERIF}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(book.author[0] || book.title[0], cx, cy + r * 0.05);
      break;
    }
    case "orbit": {
      ctx.lineWidth = r * 0.045;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.5);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.85, r * 0.34, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx + r * 0.85, cy, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "peaks": {
      ctx.lineWidth = r * 0.05;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        const base = cy + r * 0.6 - k * r * 0.34;
        ctx.moveTo(cx - r, base);
        let up = true;
        for (let x = -r; x <= r; x += r * 0.5) {
          ctx.lineTo(cx + x, base - (up ? r * 0.5 : 0));
          up = !up;
        }
        ctx.stroke();
      }
      break;
    }
    case "weave": {
      ctx.lineWidth = r * 0.09;
      const n = 4;
      const s = (r * 1.5) / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const x = cx - r * 0.7 + i * s;
          const y = cy - r * 0.7 + j * s;
          ctx.beginPath();
          if ((i + j) % 2 === 0) {
            ctx.moveTo(x, y - s * 0.4);
            ctx.lineTo(x, y + s * 0.4);
          } else {
            ctx.moveTo(x - s * 0.4, y);
            ctx.lineTo(x + s * 0.4, y);
          }
          ctx.stroke();
        }
      }
      break;
    }
  }
  ctx.restore();
}

// draw foil serif text, optionally wrapped, returns the y after the block
function foilText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  size: number,
  foil: Foil,
  maxW: number,
  lineH: number,
  weight = 500,
) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${SERIF}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  foilStamp(ctx, foil);
  const lines = wrap(ctx, text, maxW);
  let yy = y;
  for (const ln of lines) {
    ctx.fillStyle = foilGradient(ctx, cx - maxW / 2, yy - size, maxW, size * 1.2, foil);
    ctx.fillText(ln, cx, yy);
    yy += lineH;
  }
  ctx.restore();
  return yy;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// ---- spine (tall, narrow) ----
export function makeSpineTexture(book: Book): THREE.CanvasTexture {
  const W = 256;
  const H = 1024;
  const { cv, ctx } = canvas2d(W, H);
  clothBase(ctx, W, H, book.cloth, book.seed);

  // top + bottom foil rules
  ctx.save();
  foilStamp(ctx, book.foil);
  ctx.fillStyle = foilGradient(ctx, 0, 0, W, 4, book.foil);
  ctx.fillRect(W * 0.22, H * 0.1, W * 0.56, 3);
  ctx.fillRect(W * 0.22, H * 0.9, W * 0.56, 3);
  ctx.restore();

  // vertical title (reading bottom-to-top)
  ctx.save();
  ctx.translate(W / 2, H * 0.52);
  ctx.rotate(-Math.PI / 2);
  foilText(ctx, book.title, 0, -6, 52, book.foil, H * 0.66, 60, 600);
  ctx.font = `400 30px ${SERIF}`;
  ctx.fillStyle = foilGradient(ctx, -120, 40, 240, 34, book.foil);
  foilStamp(ctx, book.foil);
  ctx.textAlign = "center";
  ctx.fillText(book.author, 0, 44);
  ctx.restore();

  // small emblem near the bottom
  drawMotif(ctx, book, W / 2, H * 0.8, W * 0.2);
  return toTexture(cv);
}

// ---- front cover (portrait) ----
export function makeCoverTexture(book: Book): THREE.CanvasTexture {
  const W = 512;
  const H = 1024;
  const { cv, ctx } = canvas2d(W, H);
  clothBase(ctx, W, H, book.cloth, book.seed + 99);

  // embossed frame
  ctx.save();
  foilStamp(ctx, book.foil);
  ctx.strokeStyle = foilGradient(ctx, 0, 0, W, H, book.foil);
  ctx.lineWidth = 2.5;
  roundRect(ctx, W * 0.09, H * 0.06, W * 0.82, H * 0.88, 6);
  ctx.stroke();
  ctx.restore();

  // motif in the upper field
  drawMotif(ctx, book, W / 2, H * 0.36, W * 0.24);

  // title + author, lower third
  let y = H * 0.7;
  y = foilText(ctx, book.title, W / 2, y, 46, book.foil, W * 0.74, 52, 600);
  ctx.save();
  ctx.font = `italic 400 28px ${SERIF}`;
  ctx.fillStyle = foilGradient(ctx, W * 0.2, y, W * 0.6, 30, book.foil);
  foilStamp(ctx, book.foil);
  ctx.textAlign = "center";
  ctx.fillText(book.author, W / 2, y + 14);
  ctx.restore();

  // imprint at the very bottom
  ctx.save();
  ctx.font = `500 17px ${SERIF}`;
  ctx.fillStyle = foilGradient(ctx, W * 0.25, H * 0.88, W * 0.5, 18, book.foil);
  foilStamp(ctx, book.foil);
  ctx.textAlign = "center";
  ctx.fillText(book.collection.toUpperCase(), W / 2, H * 0.9);
  ctx.restore();

  return toTexture(cv);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- shared: paper block (top / fore-edge / bottom faces) ----
let pagesTex: THREE.CanvasTexture | null = null;
export function makePagesTexture(): THREE.CanvasTexture {
  if (pagesTex) return pagesTex;
  const W = 512;
  const H = 512;
  const { cv, ctx } = canvas2d(W, H);
  ctx.fillStyle = "#efe7d3";
  ctx.fillRect(0, 0, W, H);
  // stacked page edges — many faint lines
  const rnd = rng(7);
  for (let x = 0; x < W; x += 2) {
    const a = 0.05 + rnd() * 0.12;
    ctx.strokeStyle = `rgba(120,100,70,${a})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
    ctx.stroke();
  }
  const vg = ctx.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0, "rgba(255,255,255,0.15)");
  vg.addColorStop(0.5, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(90,70,40,0.18)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  pagesTex = toTexture(cv);
  return pagesTex;
}

// ---- walnut shelf ----
let walnutTex: THREE.CanvasTexture | null = null;
export function makeWalnutTexture(): THREE.CanvasTexture {
  if (walnutTex) return walnutTex;
  const W = 1024;
  const H = 512;
  const { cv, ctx } = canvas2d(W, H);
  ctx.fillStyle = "#5b3f2b";
  ctx.fillRect(0, 0, W, H);
  const rnd = rng(101);
  // long grain streaks
  for (let i = 0; i < 240; i++) {
    const y = rnd() * H;
    const light = rnd() > 0.5;
    ctx.strokeStyle = light ? `rgba(120,86,54,${0.06 + rnd() * 0.1})` : `rgba(50,32,20,${0.08 + rnd() * 0.12})`;
    ctx.lineWidth = 0.6 + rnd() * 1.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= W; x += 32) {
      ctx.lineTo(x, y + Math.sin((x / W) * Math.PI * (2 + rnd() * 3) + i) * (2 + rnd() * 4));
    }
    ctx.stroke();
  }
  // a couple of plank seams
  for (const py of [H * 0.5]) {
    ctx.strokeStyle = "rgba(30,18,10,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(W, py);
    ctx.stroke();
  }
  walnutTex = toTexture(cv);
  walnutTex.wrapS = THREE.RepeatWrapping;
  walnutTex.wrapT = THREE.RepeatWrapping;
  return walnutTex;
}
