import { useEffect, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { formatShortDate } from '../lib/dates';

/** Udvikling over tid. Tryk på grafen for at se en enkelt værdi. */
export default function LineChart({
  xs,
  ys,
  format,
  height = 220,
}: {
  xs: number[];
  ys: number[];
  format: (v: number) => string;
  height?: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    const node = el.current;
    if (!node || xs.length === 0) return;
    const css = getComputedStyle(document.documentElement);
    const color = (v: string) => css.getPropertyValue(v).trim();
    const accent = color('--accent');
    const line = color('--line');
    const muted = color('--muted');
    const axis: uPlot.Axis = {
      stroke: muted,
      grid: { stroke: line, width: 1 },
      ticks: { show: false },
      font: '12px -apple-system, system-ui, sans-serif',
    };
    const opts: uPlot.Options = {
      width: node.clientWidth,
      height,
      legend: { show: false },
      cursor: { drag: { x: false, y: false }, points: { size: 10, fill: accent } },
      scales: { x: { time: true } },
      axes: [
        { ...axis, values: (_u, splits) => splits.map((s) => formatShortDate(s * 1000)) },
        { ...axis, size: 52, values: (_u, splits) => splits.map((s) => format(s)) },
      ],
      series: [{}, { stroke: accent, width: 2, points: { show: true, size: 6, fill: accent, stroke: accent } }],
      hooks: { setCursor: [(u) => setPicked(u.cursor.idx ?? null)] },
    };
    const plot = new uPlot(opts, [xs, ys], node);
    const ro = new ResizeObserver(() => plot.setSize({ width: node.clientWidth, height }));
    ro.observe(node);
    return () => {
      ro.disconnect();
      plot.destroy();
    };
  }, [xs, ys, format, height]);

  const i = picked ?? xs.length - 1;
  return (
    <div>
      <p className="tnum mb-2 text-[15px]">
        <span className="font-semibold">{format(ys[i])}</span>
        <span className="text-muted"> {formatShortDate(xs[i] * 1000)}</span>
      </p>
      <div ref={el} className="w-full" />
    </div>
  );
}
