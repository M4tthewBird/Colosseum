/**
 * Moving and zooming a photo inside a square frame. Pure — see avatarCrop.test.ts.
 * Offsets are in screen points, from the photo centred in the frame.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Offset {
  x: number;
  y: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** Screen points per photo pixel: at zoom 1 the short side just fills the frame. */
export function photoScale(photo: Size, frame: number, zoom: number): number {
  return (frame / Math.min(photo.width, photo.height)) * zoom;
}

/** Keeps the frame fully on the photo. */
export function clampOffset(offset: Offset, photo: Size, frame: number, zoom: number): Offset {
  const s = photoScale(photo, frame, zoom);
  const maxX = (photo.width * s - frame) / 2;
  const maxY = (photo.height * s - frame) / 2;
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  };
}

/** The part of the photo inside the frame, in whole photo pixels. */
export function cropRect(photo: Size, frame: number, zoom: number, offset: Offset) {
  const s = photoScale(photo, frame, zoom);
  const { x, y } = clampOffset(offset, photo, frame, zoom);
  const side = Math.min(frame / s, photo.width, photo.height);
  const originX = photo.width / 2 - x / s - side / 2;
  const originY = photo.height / 2 - y / s - side / 2;
  const size = Math.round(side);
  return {
    originX: Math.max(0, Math.min(photo.width - size, Math.round(originX))),
    originY: Math.max(0, Math.min(photo.height - size, Math.round(originY))),
    width: size,
    height: size,
  };
}

/** How far apart two fingers are. */
export function pinchDistance(
  a: { pageX: number; pageY: number },
  b: { pageX: number; pageY: number },
) {
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}
