import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';

/** Træk-for-at-sortere med et håndtag. Virker med finger og mus. */
export function useReorder(count: number, onMove: (from: number, to: number) => void, gap = 8) {
  const items = useRef<(HTMLElement | null)[]>([]);
  const state = useRef<{ index: number; startY: number; rects: DOMRect[]; pointerId: number; target: number } | null>(null);
  const [drag, setDrag] = useState<{ index: number; dy: number; target: number; height: number } | null>(null);

  const end = () => {
    const s = state.current;
    state.current = null;
    setDrag(null);
    if (s && s.target !== s.index) onMove(s.index, s.target);
  };

  const handleProps = (index: number) => ({
    style: { touchAction: 'none' } as CSSProperties,
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      e.preventDefault();
      const rects = items.current.slice(0, count).map((el) => el?.getBoundingClientRect() ?? new DOMRect());
      state.current = { index, startY: e.clientY, rects, pointerId: e.pointerId, target: index };
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ index, dy: 0, target: index, height: rects[index].height });
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const s = state.current;
      if (!s || s.pointerId !== e.pointerId) return;
      const dy = e.clientY - s.startY;
      const r = s.rects[s.index];
      const center = r.top + r.height / 2 + dy;
      let target = s.index;
      s.rects.forEach((ri, i) => {
        const c = ri.top + ri.height / 2;
        if (i < s.index && center < c) target = Math.min(target, i);
        if (i > s.index && center > c) target = Math.max(target, i);
      });
      s.target = target;
      setDrag({ index: s.index, dy, target, height: r.height });
    },
    onPointerUp: end,
    onPointerCancel: end,
  });

  const itemStyle = (i: number): CSSProperties => {
    if (!drag) return {};
    if (i === drag.index) return { transform: `translateY(${drag.dy}px)`, zIndex: 10, position: 'relative', boxShadow: '0 8px 24px rgb(0 0 0 / 0.35)' };
    const shift = drag.height + gap;
    if (drag.index < i && i <= drag.target) return { transform: `translateY(${-shift}px)`, transition: 'transform 150ms' };
    if (drag.target <= i && i < drag.index) return { transform: `translateY(${shift}px)`, transition: 'transform 150ms' };
    return { transition: 'transform 150ms' };
  };

  const register = (i: number) => (el: HTMLElement | null) => {
    items.current[i] = el;
  };

  return { handleProps, itemStyle, register, dragging: !!drag };
}
