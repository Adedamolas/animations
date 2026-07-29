import { COVER_ASPECT } from "./cover-art";

/** The physical book, in scene units. */
export const W = 1.42; // board width
export const H = W / COVER_ASPECT; // …and height, straight off the texture's aspect
export const CT = 0.04; // board thickness
export const BLOCK_D = 0.23; // the page block
export const OV = 0.026; // how far the boards overhang the block
export const LEAVES = 6; // loose pages that fan when a cover opens
