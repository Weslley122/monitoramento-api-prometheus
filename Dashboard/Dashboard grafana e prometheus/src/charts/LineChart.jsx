import { useId, useState } from 'react'
import { nearest, niceScale, useReveal, useWidth } from '../hooks.js'
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

const textW = (s) => s.length * 6.3 + 4

/**
 * Linhas no tempo, em segmentos retos, com crosshair.
 * - annotations: [{ t, label }] eventos (deploy) com o rótulo numa faixa acima do gráfico.
 * - references: [{ value, label, tone }] linhas tracejadas de referência (SLO, limite).
 * - spans: [{ from, to, label }] trechos sombreados (rollout).
 * - levels: [{ from, to, value, label }] médias de um trecho, tracejadas.
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
  references = [],
  spans = [],
  levels = [],
  label,
  height = 260,
  hover: hoverProp,
  onHover,
}) {
  const uid = useId()
  const [ref, width] = useWidth()
  const [own, setOwn] = useState(null)
  const hover = onHover ? hoverProp : own
  const setHover = onHover ?? setOwn
  const reveal = useReveal(ref)

  const notes = annotations.filter((a) => a.t >= from && a.t <= to)
  const m = { top: notes.length ? 30 : 10, right: 8, bottom: 26, left: 52 }
  const innerW = Math.max(10, width - m.left - m.right)
  const innerH = height - m.top - m.bottom
  const baseY = m.top + innerH
  const dataMax = Math.max(0, ...points.flatMap((p) => series.map((s) => p[s.key] ?? 0)), ...levels.map((l) => l.value))
  const refMax = Math.max(0, ...references.map((r) => r.value))
  const { max, ticks } = niceScale(Math.max(dataMax * 1.08, refMax * 1.15))
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
  const line = (k) =>
    runs(k)
      .map((run) => run.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p[k]).toFixed(1)}`).join(''))
      .join('')

  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const d = e.key === 'ArrowLeft' ? -1 : 1
    setHover(Math.min(points.length - 1, Math.max(0, (hover ?? points.length - 1) + d)))
  }
  const hp = hover != null ? points[hover] : null

  return (
    <div className="chart" ref={ref} style={{ height }} data-reveal={reveal}>
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
          {/* Recorte que abre da esquerda para a direita na animação (a série "evolui" no tempo). */}
          <defs>
            <clipPath id={`${uid}-wipe`}>
              <rect className="rv-clip" x={0} y={0} width={width} height={height} />
            </clipPath>
          </defs>
          {spans.map((s) => (
            <g key={s.from} className="span rv-late">
              <rect x={x(s.from)} y={m.top} width={Math.max(2, x(s.to) - x(s.from))} height={innerH} />
            </g>
          ))}
          {ticks.map((v) => (
            <g key={v}>
              <line className={v === 0 ? 'baseline' : 'gridline'} x1={m.left} x2={m.left + innerW} y1={y(v)} y2={y(v)} />
              <text className="tick" x={m.left - 10} y={y(v)} dy="0.32em" textAnchor="end">
                {axisFormat(v)}
              </text>
            </g>
          ))}
          {timeTicks(from, to, Math.max(3, Math.floor(innerW / 90))).map((t) => (
            <text key={t} className="tick" x={x(t)} y={height - 6} textAnchor="middle">
              {formatTime(t)}
            </text>
          ))}
          {references.map((r) => (
            <g key={r.label} className={`reference rv-late tone-${r.tone ?? 'bad'}`}>
              <line x1={m.left} x2={m.left + innerW} y1={y(r.value)} y2={y(r.value)} />
              <text x={m.left + innerW - 4} y={y(r.value) - 6} textAnchor="end">
                {r.label}
              </text>
            </g>
          ))}
          {levels.map((l) => {
            const x0 = x(Math.max(from, l.from))
            const x1 = x(Math.min(to, l.to))
            const fits = textW(l.label) < x1 - x0 - 8
            return (
              <g key={l.from} className={`level rv-later ${l.tone ?? ''}`}>
                <line x1={x0} x2={x1} y1={y(l.value)} y2={y(l.value)} />
                {fits && (
                  <text x={x0 + 6} y={y(l.value) - 6}>
                    {l.label}
                  </text>
                )}
              </g>
            )
          })}
          <g clipPath={`url(#${uid}-wipe)`}>
            {series.map((s) => (
              <path key={s.key} d={line(s.key)} className="series-line" style={{ stroke: s.color }} />
            ))}
          </g>
          {notes.map((a) => {
            // O rótulo fica na faixa de cima, ao lado da sua linha; perto da borda, vira para a esquerda.
            const w = textW(a.label)
            const left = x(a.t) + 6 + w > m.left + innerW
            return (
              <g key={a.t} className="annotation rv-mark" style={{ '--at': x(a.t) / width }}>
                <line x1={x(a.t)} x2={x(a.t)} y1={4} y2={baseY} />
                <text x={left ? x(a.t) - 6 : x(a.t) + 6} y={14} textAnchor={left ? 'end' : 'start'}>
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
        <ChartTooltip x={x(hp.t)} y={m.top + 8} width={width}>
          <div className="tooltip-time">{formatTime(hp.t)}</div>
          {[...series].reverse().map((s) => (
            <TooltipRow key={s.key} color={s.color} name={s.name} value={hp[s.key] == null ? 'sem dados' : format(hp[s.key])} />
          ))}
        </ChartTooltip>
      )}
    </div>
  )
}
