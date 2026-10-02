import { useEffect, useRef, useState } from 'react';

import { dur, useReducedMotion } from '@/theme/motion';

/** easeOutExpo-like deceleration, matching cubic-bezier(0.16, 1, 0.3, 1) closely. */
function decel(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * A number that glides to `target` (JS frames; for small SVG pieces like the progress ring).
 * Starts from `from` on mount so a value fills in; jumps when Reduce Motion is on.
 */
export function useTween(target: number, duration: number = dur.focal, from = 0): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? target : from);
  const current = useRef(value);

  useEffect(() => {
    const start = current.current;
    if (start === target) return;
    const time = reduced ? 0 : duration;
    let frame = 0;
    const t0 = Date.now();
    const step = () => {
      const t = time === 0 ? 1 : (Date.now() - t0) / time;
      const v = start + (target - start) * decel(t);
      current.current = t >= 1 ? target : v;
      setValue(current.current);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduced]);

  return value;
}
