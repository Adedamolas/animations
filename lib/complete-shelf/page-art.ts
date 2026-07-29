// Interior pages — the payoff when a volume is opened. Each leaf's two sides
// are painted on canvas: endpapers, a title page, a colophon/epigraph, and a
// couple of typeset prose spreads (seeded per book so every volume reads a
// little differently). Cream stock, ink serif, a gutter shadow near the spine.

import * as THREE from "three";
import { type Book, FOILS } from "./catalog";
import { SERIF, rng, canvas2d, toTexture } from "./cover-art";

const PAPER = "#efe6d1";
const INK = "#2c2620";
const INK_SOFT = "#5a5044";

const W = 512;
const H = 1024;

export type Leaf = { front: THREE.CanvasTexture; back: THREE.CanvasTexture };

// gutterSide: "left" = recto (right-hand page, spine on its left)
function pageBase(ctx: CanvasRenderingContext2D, gutterSide: "left" | "right", seed: number) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  // faint paper fibers
  const rnd = rng(seed * 5 + 2);
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 10;
    d[i] = clamp8(d[i] + n);
    d[i + 1] = clamp8(d[i + 1] + n);
    d[i + 2] = clamp8(d[i + 2] + n);
  }
  ctx.putImageData(img, 0, 0);
  // gutter shadow near the spine edge
  const x0 = gutterSide === "left" ? 0 : W;
  const g = ctx.createLinearGradient(x0, 0, x0 + (gutterSide === "left" ? 90 : -90), 0);
  g.addColorStop(0, "rgba(60,40,20,0.22)");
  g.addColorStop(1, "rgba(60,40,20,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // soft outer-edge shadow
  const oe = gutterSide === "left" ? W : 0;
  const g2 = ctx.createLinearGradient(oe, 0, oe + (gutterSide === "left" ? -40 : 40), 0);
  g2.addColorStop(0, "rgba(60,40,20,0.1)");
  g2.addColorStop(1, "rgba(60,40,20,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);
}

function clamp8(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

// left/right text margins depend on which side the gutter is on
function margins(gutterSide: "left" | "right") {
  const outer = 60;
  const inner = 84;
  return gutterSide === "left" ? { left: inner, right: W - outer } : { left: outer, right: W - inner };
}

function endpaper(book: Book, gutterSide: "left" | "right"): THREE.CanvasTexture {
  const { cv, ctx } = canvas2d(W, H);
  pageBase(ctx, gutterSide, book.seed + 3);
  // faint tint + a quiet repeating mark in the cloth colour
  const c = book.cloth;
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = c;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.05;
  const rnd = rng(book.seed);
  for (let y = 80; y < H - 60; y += 96) {
    for (let x = 70; x < W - 50; x += 96) {
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + rnd() * 6, y + rnd() * 6, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  return toTexture(cv);
}

function blank(book: Book, gutterSide: "left" | "right"): THREE.CanvasTexture {
  const { cv, ctx } = canvas2d(W, H);
  pageBase(ctx, gutterSide, book.seed + 11);
  return toTexture(cv);
}

function titlePage(book: Book): THREE.CanvasTexture {
  const { cv, ctx } = canvas2d(W, H);
  pageBase(ctx, "left", book.seed + 21);
  ctx.textAlign = "center";

  ctx.fillStyle = INK_SOFT;
  ctx.font = `500 15px ${SERIF}`;
  drawTracked(ctx, book.collection.toUpperCase(), W / 2 + 12, H * 0.2, 3);

  // title (wrapped)
  ctx.fillStyle = INK;
  const lines = wrap(setFont(ctx, `600 46px ${SERIF}`), book.title, W * 0.72);
  let y = H * 0.36;
  for (const ln of lines) {
    ctx.fillText(ln, W / 2 + 12, y);
    y += 56;
  }

  // rule
  const [, foil] = FOILS[book.foil];
  ctx.strokeStyle = foil;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 30, y + 10);
  ctx.lineTo(W / 2 + 54, y + 10);
  ctx.stroke();

  ctx.fillStyle = INK_SOFT;
  ctx.font = `italic 400 26px ${SERIF}`;
  ctx.fillText(book.author, W / 2 + 12, y + 56);

  // imprint at the foot
  ctx.fillStyle = INK_SOFT;
  ctx.font = `500 14px ${SERIF}`;
  drawTracked(ctx, "THE WALNUT PRESS", W / 2 + 12, H * 0.86, 2.5);
  ctx.font = `400 13px ${SERIF}`;
  ctx.fillText(book.year, W / 2 + 12, H * 0.89);
  return toTexture(cv);
}

function colophon(book: Book): THREE.CanvasTexture {
  const { cv, ctx } = canvas2d(W, H);
  pageBase(ctx, "right", book.seed + 31);
  const m = margins("right");
  ctx.textAlign = "left";
  ctx.fillStyle = INK_SOFT;
  ctx.font = `italic 400 25px ${SERIF}`;
  const epi = EPIGRAPHS[book.seed % EPIGRAPHS.length];
  const lines = wrap(ctx, epi, m.right - m.left);
  let y = H * 0.3;
  for (const ln of lines) {
    ctx.fillText(ln, m.left, y);
    y += 38;
  }
  ctx.font = `400 15px ${SERIF}`;
  ctx.fillStyle = INK_SOFT;
  ctx.fillText(`— ${book.author}`, m.left, y + 18);

  // small imprint note lower down
  ctx.font = `400 13px ${SERIF}`;
  ctx.fillStyle = "#7a7060";
  const note = wrap(ctx, `First edition. Set in a serif face and bound in ${clothName(book.cloth)} cloth with ${book.foil} foil.`, m.right - m.left);
  let yy = H * 0.78;
  for (const ln of note) {
    ctx.fillText(ln, m.left, yy);
    yy += 20;
  }
  return toTexture(cv);
}

function textPage(book: Book, idx: number, gutterSide: "left" | "right", withDropCap: boolean): THREE.CanvasTexture {
  const { cv, ctx } = canvas2d(W, H);
  pageBase(ctx, gutterSide, book.seed + 41 + idx);
  const m = margins(gutterSide);
  const colW = m.right - m.left;
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  const size = 25;
  const lineH = 40;
  const paras = prose(book.seed + idx * 7, withDropCap ? 3 : 2);
  let y = H * 0.16;

  for (let p = 0; p < paras.length; p++) {
    const words = paras[p].split(" ");
    let dropShift = 0;
    let firstLines = 0;
    if (withDropCap && p === 0) {
      // drop cap
      const cap = words[0][0].toUpperCase();
      ctx.font = `600 92px ${SERIF}`;
      ctx.fillStyle = INK;
      ctx.fillText(cap, m.left, y + 66);
      dropShift = ctx.measureText(cap).width + 8;
      words[0] = words[0].slice(1);
    }
    ctx.font = `400 ${size}px ${SERIF}`;
    // render with wrapping; first ~3 lines indented past the drop cap
    let line = "";
    let lx = m.left + dropShift;
    let lw = colW - dropShift;
    const flush = () => {
      ctx.fillText(line, lx, y);
      y += lineH;
      line = "";
      firstLines++;
      if (dropShift && firstLines >= 3) {
        lx = m.left;
        lw = colW;
      }
    };
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > lw && line) flush();
      else {
        line = test;
        continue;
      }
      line = w;
    }
    if (line) {
      ctx.fillText(line, lx, y);
      y += lineH;
    }
    y += 14; // paragraph spacing
    if (y > H - 120) break;
  }

  // running foot: title + page number
  ctx.fillStyle = "#8a8070";
  ctx.font = `italic 400 13px ${SERIF}`;
  ctx.textAlign = gutterSide === "left" ? "right" : "left";
  ctx.fillText(book.title, gutterSide === "left" ? m.right : m.left, H - 54);
  return toTexture(cv);
}

// ---- assemble a book's leaves (front cover already handled by cover-art) ----
export function makeLeaves(book: Book): Leaf[] {
  return [
    { front: endpaper(book, "left"), back: blank(book, "right") },
    { front: titlePage(book), back: blank(book, "right") },
    { front: colophon(book), back: textPage(book, 0, "right", true) },
    { front: textPage(book, 1, "left", false), back: textPage(book, 2, "right", false) },
    { front: textPage(book, 3, "left", false), back: endpaper(book, "right") },
  ];
}

// ---- helpers ----
function setFont(ctx: CanvasRenderingContext2D, f: string) {
  ctx.font = f;
  return ctx;
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
function drawTracked(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, tracking: number) {
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  let total = 0;
  for (const ch of text) total += ctx.measureText(ch).width + tracking;
  let x = cx - total / 2;
  for (const ch of text) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + tracking;
  }
  ctx.textAlign = prev;
}
function clothName(hex: string) {
  const map: [string, string][] = [
    ["#5b6b7e", "dusk-blue"],
    ["#6b6a3f", "olive"],
    ["#a8763e", "ochre"],
    ["#6e3a34", "oxblood"],
    ["#4a5560", "slate"],
    ["#6f7d63", "sage"],
  ];
  const found = map.find((m) => m[0] === hex);
  return found ? found[1] : "clothbound";
}

const EPIGRAPHS = [
  "To notice a thing is to begin to keep it.",
  "The plainest hours ask the most of our attention.",
  "What is made slowly is made twice: once in the hand, once in the mind.",
  "Every room is an argument about what matters.",
  "Light is the first material, and the last.",
  "We do not finish a thing; we agree to stop.",
  "The small is not the little — it is the near.",
];

// ---- seeded editorial prose (fictional, calm, readable at a glance) ----
const OPEN = [
  "There was, in those years, a particular quality to the afternoons",
  "It began, as these things do, with a smaller observation",
  "For a long time I kept the practice to myself",
  "The house faced east, which is to say it kept its mornings",
  "One learns, eventually, to trust the slower method",
  "I have been asked how the work is done, and the honest answer",
];
const MIDDLE = [
  "and the way the light would settle along the wall without hurry",
  "the sort of thing one notices only after it has already changed",
  "a habit of attention that asked for very little and returned a great deal",
  "as though the day itself were waiting for permission to continue",
  "which is not to say it was simple, only that it was clear",
  "and this, more than any method, is what I would try to describe",
];
const CLOSE = [
  "It is enough, I think, to have looked closely and to have stayed.",
  "The rest, as they say, is a matter of keeping at it.",
  "What remained was quiet, and it was ours.",
  "In the end the smallest things held the most.",
  "And so the hour passed, and was not wasted.",
  "That was the whole of it, and it was plenty.",
];

function prose(seed: number, count: number): string[] {
  const r = rng(seed);
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const sentences: string[] = [];
    const n = 2 + Math.floor(r() * 2);
    for (let s = 0; s < n; s++) {
      sentences.push(`${pick(OPEN)}, ${pick(MIDDLE)}. ${pick(CLOSE)}`);
    }
    out.push(sentences.join(" "));
  }
  return out;
}
