/**
 * Team portraits: where the eyes and the head sit in each source photo, so every 4:5 frame
 * puts the eyes on one shared line (design-system §9.3). Measured on the published files in
 * public/images/echipa; fractions of the source width and height.
 *
 * Bologa's photo is already 4:5 with his head near the top edge, so it sets the shared line:
 * eyes at 16% of the frame height, head about 28% of it. The others are scaled to match.
 */

export type PortraitMeta = {
  /** Source size in px. */
  width: number;
  height: number;
  /** Centre between the eyes, as fractions of the source width and height. */
  eyeX: number;
  eyeY: number;
  /** Head height (crown to chin) as a fraction of the source height. */
  head: number;
  /** Below this the source is upscaled noticeably; the profile page caps the frame there (px). */
  maxFrameWidth?: number;
};

export const PORTRAITS: Record<string, PortraitMeta> = {
  "/images/echipa/andrei-marcoci.jpg": { width: 1440, height: 1440, eyeX: 0.45, eyeY: 0.195, head: 0.27 },
  "/images/echipa/mihail-dan-masca.png": { width: 600, height: 557, eyeX: 0.61, eyeY: 0.235, head: 0.23, maxFrameWidth: 300 },
  "/images/echipa/paul-bologa.jpg": { width: 1440, height: 1800, eyeX: 0.47, eyeY: 0.155, head: 0.27 },
  "/images/echipa/ana-maria-fertea.jpg": { width: 1289, height: 844, eyeX: 0.5, eyeY: 0.215, head: 0.19 },
};

/** The shared line: eyes at this fraction of the 4:5 frame's height. */
export const EYE_LINE = 0.16;
/** Target head height, as a fraction of the frame's height. */
export const HEAD_SIZE = 0.28;

const FRAME_RATIO = 5 / 4; // frame height / frame width

export type PortraitCrop = {
  /** Rendered image width, % of the frame width (≥ 100). */
  widthPct: number;
  /** Offset of the image's left edge, % of the frame width (≤ 0). */
  leftPct: number;
  /** Offset of the image's top edge, % of the frame height (≤ 0). */
  topPct: number;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round = (v: number) => Math.round(v * 100) / 100;

/**
 * Size and offset of a portrait inside a 4:5 frame, so that the eyes land on `eyeLine`, the head
 * is about `head` of the frame height, and the photo always covers the whole frame.
 */
export function portraitCrop(meta: PortraitMeta, eyeLine: number = EYE_LINE, head: number = HEAD_SIZE): PortraitCrop {
  const aspect = meta.width / meta.height;
  // Image height in frame-width units: big enough for the head size, never smaller than the frame.
  let imgH = (head * FRAME_RATIO) / meta.head;
  imgH = Math.max(imgH, FRAME_RATIO, 1 / aspect);
  const imgW = imgH * aspect;
  // Place the eyes on the line, then clamp so no edge of the frame is left uncovered.
  const top = clamp(eyeLine * FRAME_RATIO - meta.eyeY * imgH, FRAME_RATIO - imgH, 0);
  const left = clamp(0.5 - meta.eyeX * imgW, 1 - imgW, 0);
  return {
    widthPct: round(imgW * 100),
    leftPct: round(left * 100),
    topPct: round((top / FRAME_RATIO) * 100),
  };
}
