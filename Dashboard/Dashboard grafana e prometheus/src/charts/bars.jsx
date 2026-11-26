import { useId, useState } from 'react'
import { nearest, niceScale, useWidth } from '../hooks.js'
import { formatTime } from '../format.js'
import { ChartTooltip, TooltipRow } from '../ui.jsx'

/** Padrão de "fatias" horizontais, alinhado à linha de base do gráfico. */
function Slats({ id, color, slat = 4, gap = 2, baseY = 0 }) {
  return (
    <pattern
      id={id}
      width="8"
      height={slat + gap}
      patternUnits="userSpaceOnUse"
      patternTransform={`translate(0 ${baseY % (slat + gap)})`}
    >
      <rect width="8" height={slat} style={{ fill: color }} />
    </pattern>
  )
}

/** Mini barras fatiadas dos cartões de KPI; a última (agora) fica escura. */
export function MiniBars({ values, label }) {
  const uid = useId()
  const w = 66
  const h = 42
  const n = values.length
  const bw = 4
  const gap = (w - n * bw) / (n - 1)
  const known = values.map((v) => v ?? 0)
  const min = Math.min(...known)
  const max = Math.max(...known)
  // Escala a partir de 70% do mínimo: mostra a tendência sem exagerar o ruído.
  const lo = min * 0.7
  const y = (v) => (max === lo ? h * 0.5 : h * 0.12 + ((v - lo) / (max - lo)) * h * 0.88)
  return (
    <svg className="mini-bars" width={w} height={h} role="img" aria-label={label}>
      <defs>
        <Slats id={`${uid}-a`} color="var(--mark-3)" slat={2} gap={1.5} baseY={h} />
        <Slats id={`${uid}-b`} color="var(--mark-1)" slat={2} gap={1.5} baseY={h} />
      </defs>
      {values.map((v, i) => (
        <rect
          key={i}
          x={i * (bw + gap)}
          y={h - y(v)}
          width={bw}
          height={y(v)}
          style={{ fill: `url(#${uid}-${i === n - 1 ? 'b' : 'a'})` }}
        />
      ))}
    </svg>
  )
}

/**
 * Barras empilhadas e fatiadas (tráfego por status).
 * series: [{ key, name, color }] de baixo para cima.
 */
export function StackedBars({ bars, series, format, axisFormat = format, label, height = 300 }) {
  const uid = useId()
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)

  const m = { top: 10, right: 2, bottom: 26, left: 38 }
  const innerW = Math.max(10, width - m.left - m.right)
  const innerH = height - m.top - m.bottom
  const baseY = m.top + innerH
  const totals = bars.map((b) => series.reduce((s, se) => s + b[se.key], 0))
  const { max, ticks } = niceScale(Math.max(...totals) * 1.05)
  const y = (v) => (v / max) * innerH
  const band = innerW / bars.length
  const bw = Math.min(18, band * 0.66)
  const cx = (i) => m.left + band * i + band / 2
  const xs = bars.map((_, i) => cx(i))
  const labelEvery = Math.max(1, Math.ceil(bars.length / Math.max(3, Math.floor(innerW / 90))))

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    setHover(nearest(xs, e.clientX - r.left))
  }
  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const d = e.key === 'ArrowLeft' ? -1 : 1
    setHover((h) => Math.min(bars.length - 1, Math.max(0, (h ?? bars.length - 1) + d)))
  }
  const hb = hover != null ? bars[hover] : null

  return (
    <div className="chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${label}. Use as setas para percorrer os valores.`}
          tabIndex={0}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover(bars.length - 1)}
          onBlur={() => setHover(null)}
          onKeyDown={onKey}
        >
          <defs>
            {series.map((s) => (
              <Slats key={s.key} id={`${uid}-${s.key}`} color={s.color} baseY={baseY} />
            ))}
          </defs>
          {ticks.map((v) => (
            <g key={v}>
              <line className="grid-dotted" x1={m.left} x2={m.left + innerW} y1={baseY - y(v)} y2={baseY - y(v)} />
              <text className="tick" x={m.left - 10} y={baseY - y(v)} dy="0.32em" textAnchor="end">
                {axisFormat(v)}
              </text>
            </g>
          ))}
          {bars.map((b, i) => {
            let acc = 0
            return (
              <g key={b.t} className={hover != null && hover !== i ? 'dim' : ''}>
                <line className="grid-dotted faint" x1={cx(i)} x2={cx(i)} y1={m.top} y2={baseY} />
                {series.map((s) => {
                  const h = y(b[s.key])
                  const top = baseY - y(acc) - h
                  acc += b[s.key]
                  return h > 0.5 ? (
                    <rect
                      key={s.key}
                      x={cx(i) - bw / 2}
                      y={top}
                      width={bw}
                      height={h}
                      style={{ fill: `url(#${uid}-${s.key})` }}
                    />
                  ) : null
                })}
                {i % labelEvery === 0 && (
                  <text className="tick" x={cx(i)} y={height - 6} textAnchor="middle">
                    {formatTime(b.from)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}
      {hb && (
        <ChartTooltip x={cx(hover)} width={width}>
          <div className="tooltip-time">
            {formatTime(hb.from)} às {formatTime(hb.t)}
          </div>
          {[...series].reverse().map((s) => (
            <TooltipRow key={s.key} color={s.color} name={s.name} value={format(hb[s.key])} />
          ))}
          <TooltipRow name="Total" value={format(totals[hover])} />
        </ChartTooltip>
      )}
    </div>
  )
}

/**
 * Barras finas tracejadas com o maior valor destacado (latência p95).
 * threshold: linha de referência (SLO).
 */
export function PeakBars({ bars, valueKey, format, axisFormat = format, threshold, label, height = 300 }) {
  const uid = useId()
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)

  const m = { top: 26, right: 2, bottom: 26, left: 2 }
  const innerW = Math.max(10, width - m.left - m.right)
  const innerH = height - m.top - m.bottom
  const baseY = m.top + innerH
  const values = bars.map((b) => b[valueKey] ?? 0)
  const peak = values.indexOf(Math.max(...values))
  const { max, ticks } = niceScale(Math.max(...values, threshold ?? 0) * 1.05)
  const y = (v) => (v / max) * innerH
  const band = innerW / bars.length
  const cx = (i) => m.left + band * i + band / 2
  const xs = bars.map((_, i) => cx(i))
  const labelEvery = Math.max(1, Math.ceil(bars.length / Math.max(3, Math.floor(innerW / 64))))
  const active = hover ?? peak

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    setHover(nearest(xs, e.clientX - r.left))
  }
  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const d = e.key === 'ArrowLeft' ? -1 : 1
    setHover((h) => Math.min(bars.length - 1, Math.max(0, (h ?? peak) + d)))
  }

  return (
    <div className="chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${label}. Use as setas para percorrer os valores.`}
          tabIndex={0}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover(peak)}
          onBlur={() => setHover(null)}
          onKeyDown={onKey}
        >
          <defs>
            <Slats id={`${uid}-hi`} color="var(--mark-1)" baseY={baseY} />
          </defs>
          {ticks.map((v) => (
            <line key={v} className="grid-dotted" x1={m.left} x2={m.left + innerW} y1={baseY - y(v)} y2={baseY - y(v)} />
          ))}
          {threshold != null && (
            <g className="threshold">
              <line x1={m.left} x2={m.left + innerW} y1={baseY - y(threshold)} y2={baseY - y(threshold)} />
              <text x={m.left} y={baseY - y(threshold) - 6}>
                SLO {axisFormat(threshold)}
              </text>
            </g>
          )}
          {bars.map((b, i) =>
            i === active ? (
              <g key={b.t}>
                <rect
                  x={cx(i) - Math.min(9, band * 0.4)}
                  y={baseY - y(b[valueKey])}
                  width={Math.min(18, band * 0.8)}
                  height={y(b[valueKey])}
                  style={{ fill: `url(#${uid}-hi)` }}
                />
                <text className="peak-label" x={cx(i)} y={baseY - y(b[valueKey]) - 8} textAnchor="middle">
                  {b[valueKey] != null && format(b[valueKey])}
                </text>
              </g>
            ) : (
              <line
                key={b.t}
                className="dash-bar"
                x1={cx(i)}
                x2={cx(i)}
                y1={baseY}
                y2={baseY - y(b[valueKey])}
              />
            ),
          )}
          {bars.map((b, i) =>
            i % labelEvery === 0 ? (
              <text key={`l${b.t}`} className="tick" x={cx(i)} y={height - 6} textAnchor="middle">
                {formatTime(b.from)}
              </text>
            ) : null,
          )}
        </svg>
      )}
      {hover != null && (
        <ChartTooltip x={cx(hover)} y={40} width={width}>
          <div className="tooltip-time">
            {formatTime(bars[hover].from)} às {formatTime(bars[hover].t)}
          </div>
          <TooltipRow
            color="var(--mark-1)"
            name="Latência p95"
            value={bars[hover][valueKey] == null ? 'sem dados' : format(bars[hover][valueKey])}
          />
        </ChartTooltip>
      )}
    </div>
  )
}
