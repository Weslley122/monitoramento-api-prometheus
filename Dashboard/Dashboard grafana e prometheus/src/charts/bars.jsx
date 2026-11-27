import { useState } from 'react'
import { barPath, nearest, niceScale, useReveal, useWidth } from '../hooks.js'
import { formatTime } from '../format.js'
import { ChartTooltip, TooltipRow } from '../ui.jsx'

/**
 * Colunas empilhadas no tempo (tráfego por classe de status).
 * series: [{ key, name, color }] de baixo para cima. Entre os segmentos fica
 * uma fresta de 2px na cor do painel.
 */
export function StackedBars({ bars, series, format, axisFormat = format, label, height = 260 }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const reveal = useReveal(ref)

  const m = { top: 8, right: 0, bottom: 26, left: 40 }
  const innerW = Math.max(10, width - m.left - m.right)
  const innerH = height - m.top - m.bottom
  const baseY = m.top + innerH
  const totals = bars.map((b) => series.reduce((s, se) => s + b[se.key], 0))
  const { max, ticks } = niceScale(Math.max(...totals) * 1.05)
  const y = (v) => (v / max) * innerH
  const band = innerW / bars.length
  const bw = Math.max(2, Math.min(16, band - 4))
  const cx = (i) => m.left + band * i + band / 2
  const xs = bars.map((_, i) => cx(i))
  const labelEvery = Math.max(1, Math.ceil(bars.length / Math.max(3, Math.floor(innerW / 96))))

  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const d = e.key === 'ArrowLeft' ? -1 : 1
    setHover((h) => Math.min(bars.length - 1, Math.max(0, (h ?? bars.length - 1) + d)))
  }
  const hb = hover != null ? bars[hover] : null

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
          onFocus={() => setHover(bars.length - 1)}
          onBlur={() => setHover(null)}
          onKeyDown={onKey}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line className={v === 0 ? 'baseline' : 'gridline'} x1={m.left} x2={m.left + innerW} y1={baseY - y(v)} y2={baseY - y(v)} />
              <text className="tick" x={m.left - 10} y={baseY - y(v)} dy="0.32em" textAnchor="end">
                {axisFormat(v)}
              </text>
            </g>
          ))}
          {bars.map((b, i) => {
            const segs = []
            series.reduce((acc, s) => {
              const h = y(b[s.key])
              segs.push({ s, top: baseY - y(acc) - h, h })
              return acc + b[s.key]
            }, 0)
            const visible = segs.filter((g) => g.h > 0.5)
            return (
              <g key={b.t} className={hover != null && hover !== i ? 'dim' : ''}>
                <g className="rv-bar" style={{ '--i': i }}>
                {visible.map((g, j) => {
                  const last = j === visible.length - 1
                  // Fresta de 2px entre segmentos (a base fica colada na linha).
                  const h = Math.max(0.5, g.h - (j > 0 ? 2 : 0))
                  return last ? (
                    <path key={g.s.key} d={barPath(cx(i) - bw / 2, g.top, bw, h)} style={{ fill: g.s.color }} />
                  ) : (
                    <rect key={g.s.key} x={cx(i) - bw / 2} y={g.top} width={bw} height={h} style={{ fill: g.s.color }} />
                  )
                })}
                </g>
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
