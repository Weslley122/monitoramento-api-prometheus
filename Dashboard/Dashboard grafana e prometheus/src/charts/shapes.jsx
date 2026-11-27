import { useRef, useState } from 'react'
import { barPath, useReveal, useWidth } from '../hooks.js'
import { formatTime, num } from '../format.js'
import { ChartTooltip, TooltipRow } from '../ui.jsx'

/**
 * Histograma de latência com a escada cumulativa por cima.
 * - Colunas: % das requisições em cada faixa (bucket do histograma do Micrometer).
 *   As faixas acima do SLO ficam em vermelho; a faixa do p95 em tom mais forte.
 * - Escada (teal): % acumulada até o fim de cada faixa. No limite do SLO, a
 *   etiqueta mostra o mesmo número do título ("X% em até 300 ms").
 * As duas medidas são "% das requisições", então dividem a mesma escala.
 * bands: [{ label, lo, hi, share }]
 */
export function LatencyLadder({ bands, total, highlight, slo, formatCount, height = 340 }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const reveal = useReveal(ref)

  const n = bands.length
  const colW = width / n
  const plotTop = 88 // abaixo da contagem de cada coluna
  const plotBottom = height - 36 // acima dos nomes das faixas
  const y = (pct) => plotBottom - (pct / 100) * (plotBottom - plotTop)
  const cx = (i) => colW * i + colW / 2
  const bw = Math.min(40, colW * 0.34)
  const cum = bands.map((_, i) => bands.slice(0, i + 1).reduce((s, b) => s + b.share * 100, 0))
  const sloIndex = bands.findIndex((b) => b.lo === slo)
  const sloX = colW * sloIndex
  const sloPct = sloIndex > 0 ? cum[sloIndex - 1] : null
  const sloLabel = sloPct == null ? '' : `${num.format(sloPct)}% em até ${slo} ms`
  const tagW = sloLabel.length * 6.6 + 16

  // Degraus: horizontal em cada coluna, subida na fronteira entre colunas.
  const ladder = cum.map((c, i) => `${i ? 'V' : `M0,`}${y(c).toFixed(1)}H${(colW * (i + 1)).toFixed(1)}`).join('')

  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    setHover((h) => Math.min(n - 1, Math.max(0, (h ?? 0) + (e.key === 'ArrowLeft' ? -1 : 1))))
  }

  return (
    <div className="chart latency-ladder" ref={ref} style={{ height }} data-reveal={reveal}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Distribuição de latência por faixa. ${sloLabel} das requisições. Use as setas para ver cada faixa.`}
          tabIndex={0}
          onFocus={() => setHover((h) => h ?? 0)}
          onBlur={() => setHover(null)}
          onKeyDown={onKey}
          onPointerLeave={() => setHover(null)}
        >
          {hover != null && <rect x={colW * hover} y={0} width={colW} height={height} className="ladder-hover" />}

          {[25, 50, 75, 100].map((v) => (
            <line key={v} className="gridline" x1={0} x2={width} y1={y(v)} y2={y(v)} />
          ))}
          <line className="baseline" x1={0} x2={width} y1={plotBottom} y2={plotBottom} />

          {bands.map((b, i) => {
            const h = Math.max(b.share > 0 ? 2 : 0, plotBottom - y(b.share * 100))
            const kind = i >= sloIndex && sloIndex >= 0 ? 'bad' : i === highlight ? 'hi' : 'ok'
            return h > 0 ? (
              <path
                key={b.label}
                className={`ladder-bar rv-bar ${kind}`}
                style={{ '--i': i * 5 }}
                d={barPath(cx(i) - bw / 2, plotBottom - h, bw, h)}
              />
            ) : null
          })}

          {sloIndex > 0 && (
            <g className="reference tone-bad rv-late">
              <line x1={sloX} x2={sloX} y1={plotTop - 10} y2={plotBottom} />
            </g>
          )}

          <path d={ladder} className="ladder-line rv-draw" pathLength="1" />
          {cum.map((c, i) => (
            <g key={i} className="rv-step" style={{ '--i': i }}>
              <circle cx={cx(i)} cy={y(c)} r="3.5" className="ladder-dot" />
              {i !== sloIndex - 1 && (
                <text className="ladder-cum" x={cx(i)} y={y(c) - 10} textAnchor="middle">
                  {num.format(c)}%
                </text>
              )}
            </g>
          ))}

          {sloPct != null && (
            <g className="ladder-tag rv-last">
              <rect x={sloX - tagW - 8} y={y(sloPct) + 8} width={tagW} height={20} rx="3" />
              <text x={sloX - 8 - tagW / 2} y={y(sloPct) + 22} textAnchor="middle">
                {sloLabel}
              </text>
            </g>
          )}

          {bands.map((b, i) => (
            <rect
              key={`hit-${b.label}`}
              x={colW * i}
              y={0}
              width={colW}
              height={height}
              fill="transparent"
              onPointerEnter={() => setHover(i)}
            />
          ))}
        </svg>
      )}

      <ol className="ladder-cols" aria-hidden="true">
        {bands.map((b, i) => (
          <li key={b.label} className={i === highlight ? 'highlight' : ''} style={{ '--i': i }}>
            <span className="ladder-count">
              <strong>{formatCount(b.share * total)}</strong>
              <span>{num.format(b.share * 100)}%</span>
            </span>
            <span className="ladder-name">
              {b.label}
              {i === highlight && ' · p95'}
            </span>
          </li>
        ))}
      </ol>

      {hover != null && (
        <ChartTooltip x={cx(hover)} y={plotTop} width={width}>
          <div className="tooltip-time">{bands[hover].label}</div>
          <TooltipRow name="Requisições" value={formatCount(bands[hover].share * total)} />
          <TooltipRow name="Nesta faixa" value={`${num.format(bands[hover].share * 100)}%`} />
          <TooltipRow name="Acumulado" value={`${num.format(cum[hover])}%`} />
        </ChartTooltip>
      )}
    </div>
  )
}

/** Barra de 100% dividida em partes, com frestas de 2px entre elas. */
export function ShareBar({ items, label }) {
  const ref = useRef(null)
  const reveal = useReveal(ref)
  const total = items.reduce((s, it) => s + it.value, 0) || 1
  return (
    // O observador olha a caixa de fora; o recorte da animação fica na de dentro.
    <div ref={ref} data-reveal={reveal}>
      <div className="share-bar" role="img" aria-label={label}>
      {items
        .filter((it) => it.value > 0)
        .map((it) => (
          <span key={it.name} style={{ flexGrow: it.value / total, background: it.color }} />
        ))}
      </div>
    </div>
  )
}

// Degraus da faixa de latência: até 120, 160, 220 e 300 ms; acima de 300 é o SLO estourado.
const HEAT_STEPS = [0, 120, 160, 220, 300]
const HEAT_LABELS = ['até 120 ms', '120 a 160 ms', '160 a 220 ms', '220 a 300 ms', 'acima de 300 ms']
const heatLevel = (v) => (v == null ? 'none' : HEAT_STEPS.filter((s) => v >= s).length - 1)

/**
 * Uma linha de células, uma por hora, com a cor pela latência p95.
 * marker: { t, label } desenha uma linha fina no horário do deploy.
 */
export function HeatStrip({ values, hours, format, marker, label, row = 0 }) {
  const span = hours.length > 1 ? hours[1] - hours[0] : 3600000
  const start = hours[0]
  const end = hours[hours.length - 1] + span
  const markerPct = marker && marker.t >= start && marker.t <= end ? ((marker.t - start) / (end - start)) * 100 : null
  const known = values.filter((v) => v != null)
  return (
    <div className="heat-strip" style={{ '--row': row }} role="img" aria-label={`${label}: de ${known.length ? format(Math.min(...known)) : 'sem dados'} a ${known.length ? format(Math.max(...known)) : 'sem dados'}`}>
      {values.map((v, i) => (
        <span
          key={hours[i]}
          className={`heat heat-${heatLevel(v)}`}
          style={{ '--i': i }}
          title={`${formatTime(hours[i])}: ${v == null ? 'sem dados' : format(v)}`}
        />
      ))}
      {markerPct != null && <i className="heat-marker" style={{ left: `${markerPct}%` }} title={marker.label} />}
    </div>
  )
}

/** Horas embaixo da faixa (a cada 6 h). */
export function HeatHours({ hours }) {
  const span = hours.length > 1 ? hours[1] - hours[0] : 3600000
  const start = hours[0]
  const end = hours[hours.length - 1] + span
  return (
    <div className="heat-hours" aria-hidden="true">
      {hours
        .filter((h) => new Date(h).getHours() % 6 === 0)
        .map((h) => (
          <span key={h} style={{ left: `${((h - start) / (end - start)) * 100}%` }}>
            {formatTime(h).slice(0, 2)}h
          </span>
        ))}
    </div>
  )
}

/** Legenda das faixas de cor da latência por hora. */
export function HeatLegend() {
  return (
    <ul className="heat-legend">
      {HEAT_LABELS.map((l, i) => (
        <li key={l}>
          <i className={`heat heat-${i}`} />
          {l}
        </li>
      ))}
    </ul>
  )
}
