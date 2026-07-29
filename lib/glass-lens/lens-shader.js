// The liquid-glass lens — a fullscreen post-process that samples a rendered
// scene texture (uTex) and bends it through a disc/rounded-rect "lens" at
// uCenter: chromatic dispersion, a fluid rim wave, a white nova, a tinted
// shimmer ring and a bright border line.
//
// Extracted so more than one experiment can point the same lens at different
// scenes — the glass-carousel aims it at a scrolling photo row; the liquid
// dock aims a wide rounded-rect version at a scrolling page.
//
// Ported originally from Yousuf Soomro's liquid-glass-carousel (MIT) —
// https://github.com/Yousuf-developer/liquid-glass-carousel — then generalised.

export const LENS_VERT = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const LENS_FRAG = /* glsl */ `
  #define PI 3.14159265
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex;
  uniform vec2  uRes;
  uniform vec2  uCenter;
  uniform float uSizeX;         // half-width (height-fraction units)
  uniform float uSizeY;         // half-height (height-fraction units)
  uniform float uAspect;        // W/H
  uniform float uZoom;
  uniform float uDispersion;
  uniform float uBlur;
  uniform float uGlow;
  uniform float uWhiteGlow;
  uniform float uNovaSize;
  
  uniform float uBlueRing;
  uniform float uRingRadius;
  uniform float uRingWidth;
  uniform float uShimmer;
  uniform float uShimmerFreq;
  uniform float uShimmerSpeed;
  uniform float uShimmerDepth;
  uniform float uTime;
  uniform float uRimStart;
  uniform float uRimTangential;
  uniform float uRimInward;
  uniform float uRimFreq1;
  uniform float uRimFreq2;
  uniform vec3  uBlueColor;
  uniform float uRimLine;
  uniform float uRimLinePos;
  uniform float uRimLineWidth;
  uniform float uVignette;     // overall vignette strength (0 = off)
  uniform float uVignetteSize; // radius where vignette begins
  uniform float uShape;        // 0 = circle, 1 = square
  uniform float uSquareRound;  // corner rounding for square (0..1)
  uniform float uRotation;     // lens rotation in radians
  uniform int   uSamples;

  const int MAX_SAMPLES = 16;

  // rounded-box signed distance (negative inside)
  float sdRoundBox(vec2 p, vec2 b, float r){
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  // Evaluate the disc lens centered at 'center' (screen-UV). Returns the
  // lensed color; 'outA' = how opaque this lens is here (0 outside disc).
  vec3 discLens(vec2 center, float aspectCorrect, out float outA) {
    // local coords, aspect-corrected so x/y are in the same screen units
    vec2 p = (vUv - center);
    p.x *= aspectCorrect;
    // rotate local space so the rect + all internals spin together
    float ca = cos(uRotation), sa = sin(uRotation);
    p = mat2(ca, -sa, sa, ca) * p;
    vec2 halfSize = vec2(uSizeX, uSizeY);
    // elliptical distance: 0 center .. 1 boundary
    float dist = length(p / halfSize);
    outA = 0.0;

    // mask shape: ellipse OR rounded rect, drives the cutoff.
    // maskND: 0 inside .. 1 at the shape boundary (>1 outside).
    float maskND;
    if (uShape > 0.5) {
      float corner = min(uSizeX, uSizeY) * clamp(uSquareRound, 0.0, 1.0);
      float sd = sdRoundBox(p, halfSize, corner);
      maskND = 1.0 + sd / min(uSizeX, uSizeY);
    } else {
      maskND = dist;
    }
    if (maskND > 1.0) return vec3(0.0);

    // shapeND: 0 center .. 1 boundary, following the chosen shape. Used by
    // nova / ring / border so they take the SAME shape.
    float shapeND = clamp(maskND, 0.0, 1.0);

    // deflection uses the elliptical radial nd so it bends smoothly from
    // the center even when the boundary is rectangular
    float nd = clamp(dist, 0.0, 1.0);
    vec2  offset = vUv - center;
    vec2  radialDir = normalize(offset + 1e-6);
    vec2  tangentDir = vec2(-radialDir.y, radialDir.x);
    // angle measured in ROTATED local space so the rim wave/shimmer spin too
    float angle = atan(p.y, p.x);

    // inward pull + fluid rim waves
    float pull = uZoom * 0.30 * (nd * nd);
    float rimStrength = smoothstep(uRimStart, 1.0, nd);
    float fluidWave = sin(angle * uRimFreq1) * 0.55 + sin(angle * uRimFreq2) * 0.25;
    float rScreen = (uSizeX + uSizeY) * 0.5;
    vec2  rimOff = tangentDir * fluidWave * rimStrength * rScreen * uRimTangential;
    vec2  rimPull = -radialDir * rimStrength * rScreen * uRimInward;

    vec2 baseUV = center + offset * (1.0 - pull) + rimOff + rimPull;

    // chromatic dispersion (weighted multi-sample, per-channel normalized)
    float rimMask = smoothstep(0.55, 1.0, nd);
    vec2  dispDir = offset * uDispersion * 0.004 * rimMask;
    int N = uSamples;
    if (N < 2) N = 2;
    if (N > MAX_SAMPLES) N = MAX_SAMPLES;
    vec3 col = vec3(0.0);
    vec3 caW = vec3(0.0);
    for (int i = 0; i < MAX_SAMPLES; i++) {
      if (i >= N) break;
      float t = float(i) / float(N - 1);
      vec2 sUV = baseUV + dispDir * (t - 0.5);
      vec3 s = texture2D(uTex, sUV).rgb;
      vec3 w = vec3(
        exp(-pow((t - 0.00) / 0.38, 2.0)),
        exp(-pow((t - 0.50) / 0.38, 2.0)),
        exp(-pow((t - 1.00) / 0.38, 2.0))
      );
      col += s * w;
      caW += w;
    }
    col /= max(caW, vec3(0.001));

    // optional blur near the rim
    float blurFade = 1.0 - smoothstep(0.72, 0.98, nd);
    if (uBlur > 0.01 && blurFade > 0.01) {
      vec2 blurRad = vec2(uBlur) / uRes * blurFade;
      vec3 bcol = vec3(0.0);
      float btw = 0.0;
      for (float a = 0.0; a < PI * 2.0; a += PI * 2.0 / 6.0) {
        for (float rr = 0.4; rr <= 1.001; rr += 0.3) {
          vec2 o = vec2(cos(a), sin(a)) * blurRad * rr;
          float w = 1.0 - rr * 0.38;
          bcol += texture2D(uTex, baseUV + o).rgb * w;
          btw += w;
        }
      }
      col = mix(bcol / btw, col, rimMask);
    }

    // glassy darkening toward center
    col *= mix(0.91, 1.0, smoothstep(0.0, 0.38, shapeND));

    // white nova glow at center
    float r2 = shapeND * shapeND * 0.25;
    float gs = max(uNovaSize * uGlow * 0.003, 0.004);
    float nova = exp(-r2 / gs) + exp(-r2 / (gs * 7.0)) * 0.18;
    nova *= uWhiteGlow * (uGlow / 17.0) * 1.15;
    col += vec3(nova);

    // blue ring + aura
    float dC = shapeND * 0.5;
    float tR = clamp(uRingRadius, 0.1, 0.49);
    float rW = max(uRingWidth, 0.003);
    float ring = exp(-pow((dC - tR) / rW, 2.0));
    ring *= uBlueRing * (uGlow / 17.0) * 1.8;
    if (uShimmer > 0.5) ring *= sin(angle * uShimmerFreq + uTime * uShimmerSpeed) * uShimmerDepth + (1.0 - uShimmerDepth);
    float ringAura = exp(-pow((dC - tR) / (rW * 6.0), 2.0)) * 0.28 * uBlueRing * (uGlow / 17.0);
    col += uBlueColor * (ring + ringAura);
    // bright border line
    col += vec3(exp(-pow((dC - uRimLinePos) / max(uRimLineWidth, 0.0001), 2.0)) * uRimLine);

    // lens alpha: solid inside, soft falloff at the very edge
    outA = smoothstep(1.0, 0.93, maskND);
    return col;
  }

  void main(){
    vec3 base = texture2D(uTex, vUv).rgb;  // scene, untouched
    vec3 outc = base;

    float a = 0.0;
    vec3 c = discLens(uCenter, uAspect, a);
    outc = mix(outc, c, a);

    // overall vignette: darken toward screen corners (aspect-correct)
    if (uVignette > 0.001) {
      vec2 vc = vUv - 0.5;
      vc.x *= uAspect;
      float d = length(vc) / max(uVignetteSize, 0.0001);
      float vig = 1.0 - uVignette * smoothstep(0.5, 1.0, d);
      outc *= clamp(vig, 0.0, 1.0);
    }

    gl_FragColor = vec4(outc, 1.0);
  }
`;
