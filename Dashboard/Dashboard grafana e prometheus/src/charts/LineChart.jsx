import { useId, useState } from 'react'
import { nearest, niceScale, useWidth } from '../hooks.js'
import { formatTime } from '../format.js'
import { ChartTooltip, TooltipRow } from '../ui.jsx'

const TICK_STEPS_MIN = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360]

function timeTicks(from, to, maxTicks) {
  const spanMin = (to - from) / 60000
  const stepMin = TICK_STEPS_MIN.find((s) => spanMin / s <= maxTicks) ?? 360
  const stepMs = stepMin * 60000
  const offset = new Date(from).getTimezoneOffset() * 60000
  const ticks = []
  for (let t = Math.ceil((from - offset) / stepMs) * stepMs + offset; t <= to; t += stepMs) ticks.push(t)
  return ticks
}

/**
 * Linhas no tempo com crosshair e marcações (deploy).
 * hover/onHover: opcionais; juntos, vários gráficos compartilham o crosshair.
 */
export default function LineChart({
  points,
  from,
  to,
  series,
  format,
  axisFormat = format,
  annotations = [],
  label,
  height = 240,
  hover: hoverProp,
  onHover,
}) {
  const uid = useId()
  const [ref, width] = useWidth()
  const [own, setOwn] = useState(null)
  const hover = onHover ? hoverProp : own
  const setHover = onHover ?? setOwn

  const m = { top: 12, right: 8, bottom: 26, left: 56 }
  const innerW = Math.max(10, width - m.left - m.right)
  const innerH = height - m.top - m.bottom
  const baseY = m.top + innerH
  const { max, ticks } = niceScale(Math.max(0, ...points.flatMap((p) => series.map((s) => p[s.key] ?? 0))) * 1.08)
  const x = (t) => m.left + ((t - from) / (to - from)) * innerW
  const y = (v) => baseY - (v / max) * innerH
  const xs = points.map((p) => x(p.t))
  // Trechos contínuos com dado (sem tráfego, o quantil não existe).
  const runs = (k) => {
    const out = []
    let cur = []
    for (const p of points) {
      if (p[k] == null) {
        if (cur.length) out.push(cur)
        cur = []
      } else cur.push(p)
    }
    if (cur.length) out.push(cur)
    return out
  }
  const seg = (run, k) => run.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p[k]).toFixed(1)}`).join('')
  const line = (k) => runs(k).map((r) => seg(r, k)).join('')
  const area = (k) =>
    runs(k)
      .map((r) => `${seg(r, k)}L${x(r.at(-1).t)},${baseY}L${x(r[0].t)},${baseY}Z`)
      .join('')

  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const d = e.key === 'ArrowLeft' ? -1 : 1
    setHover(Math.min(points.length - 1, Math.max(0, (hover ?? points.length - 1) + d)))
  }
  const hp = hover != null ? points[hover] : null

  return (
    <div className="chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${label}. Use as setas para percorrer os valores.`}
          tabIndex={0}
          onPointerMove={(e) => setHover(nearest(xs, e.clientX - e.currentTarget.getBoundingClientRect().left))}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover(points.length - 1)}
          onBlur={() => setHover(null)}
          onKeyDown={onKey}
        >
          <defs>
            <linearGradient id={`${uid}-fill`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" style={{ stopColor: series[series.length - 1].color, stopOpacity: 0.16 }} />
              <stop offset="100%" style={{ stopColor: series[series.length - 1].color, stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {ticks.map((v) => (
            <g key={v}>
              <line className="grid-dotted" x1={m.left} x2={m.left + innerW} y1={y(v)} y2={y(v)} />
              <text className="tick" x={m.left - 10} y={y(v)} dy="0.32em" textAnchor="end">
                {axisFormat(v)}
              </text>
            </g>
          ))}
          {timeTicks(from, to, Math.max(3, Math.floor(innerW / 80))).map((t) => (
            <text key={t} className="tick" x={x(t)} y={height - 6} textAnchor="middle">
              {formatTime(t)}
            </text>
          ))}
          <path d={area(series[series.length - 1].key)} style={{ fill: `url(#${uid}-fill)` }} />
          {series.map((s) => (
            <path key={s.key} d={line(s.key)} className="series-line" style={{ stroke: s.color }} />
          ))}
          {annotations
            .filter((a) => a.t >= from && a.t <= to)
            .map((a) => {
              // Perto da borda direita, o rótulo vai para o lado esquerdo da linha.
              const w = a.label.length * 6.4 + 14
              const left = x(a.t) + 6 + w > m.left + innerW
              const rx = left ? x(a.t) - 6 - w : x(a.t) + 6
              return (
                <g key={a.t} className="annotation">
                  <line x1={x(a.t)} x2={x(a.t)} y1={m.top} y2={baseY} />
                  <rect x={rx} y={m.top} width={w} height={20} rx="3" />
                  <text x={rx + 7} y={m.top + 14}>
                    {a.label}
                  </text>
                </g>
              )
            })}
          {hp && (
            <g>
              <line className="crosshair" x1={x(hp.t)} x2={x(hp.t)} y1={m.top} y2={baseY} />
              {series
                .filter((s) => hp[s.key] != null)
                .map((s) => (
                  <circle key={s.key} className="hover-dot" cx={x(hp.t)} cy={y(hp[s.key])} r="4" style={{ fill: s.color }} />
                ))}
            </g>
          )}
        </svg>
      )}
      {hp && (
        <ChartTooltip x={x(hp.t)} y={m.top + 26} width={width}>
          <div className="tooltip-time">{formatTime(hp.t)}</div>
          {[...series].reverse().map((s) => (
            <TooltipRow key={s.key} color={s.color} name={s.name} value={hp[s.key] == null ? 'sem dados' : format(hp[s.key])} />
          ))}
        </ChartTooltip>
      )}
    </div>
  )
}
