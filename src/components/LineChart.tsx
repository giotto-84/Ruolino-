import { useMemo, useState } from 'react';
import { fmt, formatDate } from './ui';

export interface Point {
  date: string;
  value: number;
}

/**
 * Single-series line chart: 2px line, 8px markers, recessive grid,
 * tap/hover anywhere to read the nearest value, table view for accessibility.
 */
export function LineChart({ points, unit, target, label }: { points: Point[]; unit: string; target?: number; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const W = 340;
  const H = 180;
  const pad = { l: 36, r: 10, t: 10, b: 24 };

  const geo = useMemo(() => {
    const vals = points.map((p) => p.value).concat(target !== undefined ? [target] : []);
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const span = max - min;
    min -= span * 0.12;
    max += span * 0.12;
    const t0 = new Date(points[0].date).getTime();
    const t1 = new Date(points[points.length - 1].date).getTime();
    const tx = (t: number) => (t1 === t0 ? (pad.l + W - pad.r) / 2 : pad.l + ((t - t0) / (t1 - t0)) * (W - pad.l - pad.r));
    const ty = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
    const xy = points.map((p) => [tx(new Date(p.date).getTime()), ty(p.value)] as const);
    const ticks = [0, 0.5, 1].map((f) => min + (max - min) * f);
    return { xy, ty, ticks };
  }, [points, target, pad.l, pad.r, pad.t, pad.b]);

  if (points.length === 0) return null;

  const nearest = (clientX: number, rect: DOMRect) => {
    const x = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    geo.xy.forEach(([px], i) => {
      if (Math.abs(px - x) < Math.abs(geo.xy[best][0] - x)) best = i;
    });
    setActive(best);
  };

  const cur = active !== null ? points[active] : points[points.length - 1];

  return (
    <figure style={{ margin: 0 }}>
      <div className="chart-tip" aria-live="polite">
        <span className="num" style={{ fontSize: 22 }}>
          {fmt(cur.value)} {unit}
        </span>{' '}
        <span className="muted small">{formatDate(cur.date, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${label}: ${points.length} misurazioni, ultima ${fmt(points[points.length - 1].value)} ${unit}`}
        onPointerMove={(e) => nearest(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerDown={(e) => nearest(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setActive(null)}
      >
        {geo.ticks.map((t, i) => (
          <g key={i}>
            <line className="grid" x1={pad.l} x2={W - pad.r} y1={geo.ty(t)} y2={geo.ty(t)} />
            <text className="axis" x={pad.l - 6} y={geo.ty(t) + 4} textAnchor="end">
              {fmt(t, t > 20 ? 0 : 1)}
            </text>
          </g>
        ))}
        {target !== undefined && <line className="target" x1={pad.l} x2={W - pad.r} y1={geo.ty(target)} y2={geo.ty(target)} />}
        <text className="axis" x={pad.l} y={H - 4}>
          {formatDate(points[0].date)}
        </text>
        {points.length > 1 && (
          <text className="axis" x={W - pad.r} y={H - 4} textAnchor="end">
            {formatDate(points[points.length - 1].date)}
          </text>
        )}
        {active !== null && <line className="cross" x1={geo.xy[active][0]} x2={geo.xy[active][0]} y1={pad.t} y2={H - pad.b} />}
        {points.length > 1 && <polyline className="series" points={geo.xy.map(([x, y]) => `${x},${y}`).join(' ')} />}
        {geo.xy.map(([x, y], i) => (
          <circle key={i} className="dot" cx={x} cy={y} r={active === i ? 6 : 4} />
        ))}
        <rect className="hit" x={0} y={0} width={W} height={H} />
      </svg>
      {target !== undefined && (
        <figcaption className="tiny muted">La linea tratteggiata verde è il tuo obiettivo ({fmt(target)} {unit}).</figcaption>
      )}
      <details className="tiny" style={{ marginTop: 6 }}>
        <summary className="muted">Vedi i dati in tabella</summary>
        <table style={{ width: '100%', marginTop: 6 }}>
          <tbody>
            {points
              .slice()
              .reverse()
              .map((p, i) => (
                <tr key={i}>
                  <td>{formatDate(p.date, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td style={{ textAlign: 'right' }}>
                    {fmt(p.value)} {unit}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
