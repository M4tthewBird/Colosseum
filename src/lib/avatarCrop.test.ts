import { clampOffset, clampZoom, cropRect, photoScale, pinchDistance } from './avatarCrop';

const wide = { width: 2000, height: 1000 };
const tall = { width: 1000, height: 2000 };
const FRAME = 280;

describe('photoScale', () => {
  it('fills the frame with the short side at zoom 1', () => {
    expect(photoScale(wide, FRAME, 1) * wide.height).toBeCloseTo(FRAME);
    expect(photoScale(tall, FRAME, 1) * tall.width).toBeCloseTo(FRAME);
  });

  it('grows with the zoom', () => {
    expect(photoScale(wide, FRAME, 2)).toBeCloseTo(photoScale(wide, FRAME, 1) * 2);
  });
});

describe('clampZoom', () => {
  it('stays between 1 and 4', () => {
    expect(clampZoom(0.5)).toBe(1);
    expect(clampZoom(2)).toBe(2);
    expect(clampZoom(9)).toBe(4);
  });
});

describe('clampOffset', () => {
  it('moves a wide photo sideways only as far as it goes', () => {
    // 2000 × 1000 at 0.28 points per pixel is 560 × 280 on screen: 140 each way.
    expect(clampOffset({ x: 500, y: 500 }, wide, FRAME, 1)).toEqual({ x: 140, y: 0 });
    expect(clampOffset({ x: -500, y: -500 }, wide, FRAME, 1).x).toBe(-140);
  });

  it('allows more when zoomed in', () => {
    expect(clampOffset({ x: 500, y: 500 }, wide, FRAME, 2)).toEqual({ x: 420, y: 140 });
  });
});

describe('cropRect', () => {
  it('takes the middle by default', () => {
    expect(cropRect(wide, FRAME, 1, { x: 0, y: 0 })).toEqual({
      originX: 500,
      originY: 0,
      width: 1000,
      height: 1000,
    });
  });

  it('dragging the photo right shows its left side', () => {
    expect(cropRect(wide, FRAME, 1, { x: 140, y: 0 }).originX).toBe(0);
  });

  it('dragging the photo left shows its right side', () => {
    expect(cropRect(wide, FRAME, 1, { x: -140, y: 0 }).originX).toBe(1000);
  });

  it('takes a smaller part when zoomed in', () => {
    expect(cropRect(wide, FRAME, 2, { x: 0, y: 0 })).toEqual({
      originX: 750,
      originY: 250,
      width: 500,
      height: 500,
    });
  });

  it('works for tall photos', () => {
    expect(cropRect(tall, FRAME, 1, { x: 0, y: 140 }).originY).toBe(0);
  });

  it('never leaves the photo, even when dragged too far', () => {
    for (const zoom of [1, 1.37, 2.5, 4]) {
      for (const x of [-9999, 9999]) {
        for (const y of [-9999, 9999]) {
          const r = cropRect({ width: 1537, height: 1023 }, FRAME, zoom, { x, y });
          expect(r.originX).toBeGreaterThanOrEqual(0);
          expect(r.originY).toBeGreaterThanOrEqual(0);
          expect(r.originX + r.width).toBeLessThanOrEqual(1537);
          expect(r.originY + r.height).toBeLessThanOrEqual(1023);
          expect(r.width).toBe(r.height);
        }
      }
    }
  });

  it('copes with a square photo', () => {
    expect(cropRect({ width: 800, height: 800 }, FRAME, 1, { x: 50, y: 50 })).toEqual({
      originX: 0,
      originY: 0,
      width: 800,
      height: 800,
    });
  });
});

describe('pinchDistance', () => {
  it('measures between two fingers', () => {
    expect(pinchDistance({ pageX: 0, pageY: 0 }, { pageX: 3, pageY: 4 })).toBe(5);
  });
});
