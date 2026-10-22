export type ImageTransform = { scale: number; x: number; y: number };
type Size = { width: number; height: number };

/** Keep the fitted image centered until zoom creates room to pan. */
export function constrainImage(
  next: ImageTransform,
  image: Size,
  viewport: Size,
): ImageTransform {
  const scale = Math.min(5, Math.max(1, next.scale));
  const maxX = Math.max(0, (image.width * scale - viewport.width) / 2);
  const maxY = Math.max(0, (image.height * scale - viewport.height) / 2);
  return {
    scale,
    x: maxX ? Math.max(-maxX, Math.min(maxX, next.x)) : 0,
    y: maxY ? Math.max(-maxY, Math.min(maxY, next.y)) : 0,
  };
}
