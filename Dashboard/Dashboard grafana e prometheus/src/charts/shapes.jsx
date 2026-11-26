import { useId, useState } from 'react'
import { useWidth } from '../hooks.js'
import { formatTime, num } from '../format.js'
import { ChartTooltip, TooltipRow } from '../ui.jsx'

/**
 * Histograma de latência com escada cumulativa.
 * - Barras fatiadas: % das requisições em cada faixa (bucket do histograma).
 *   A faixa acima do SLO fica em vermelho.
 * - Escada: % acumulada até o fim de cada faixa. No limite do SLO, o selo mostra
 *   o mesmo número do título do cartão ("X% em até 300 ms").
 * As duas medidas são "% das requisições", então dividem a mesma escala.
 * bands: [{ label, lo, hi, share }]
 */
export function LatencyLadder({ bands, total, highlight, slo, formatCount, height = 300 }) {
  const uid = useId()
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)

  const n = bands.length
  const colW = width / n
  const plotTop = 74 // abaixo da contagem de cada coluna
  const plotBottom = height - 40 // acima dos rótulos das faixas
  const y = (pct) => plotBottom - (pct / 100) * (plotBottom - plotTop)
  const cx = (i) => colW * i + colW / 2
  const bw = Math.min(44, colW * 0.38)
  const cum = bands.map((_, i) => bands.slice(0, i + 1).reduce((s, b) => s + b.share * 100, 0))
  const sloIndex = bands.findIndex((b) => b.lo === slo)
  const sloX = colW * sloIndex
  const sloPct = sloIndex > 0 ? cum[sloIndex - 1] : null
  const sloLabel = sloPct == null ? '' : `${num.format(sloPct)}%`
  const pillW = sloLabel.length * 7.2 + 18

  // Degraus: horizontal em cada coluna, subida na fronteira entre colunas.
  const ladder = cum.map((c, i) => `${i ? 'V' : `M0,`}${y(c).toFixed(1)}H${(colW * (i + 1)).toFixed(1)}`).join('')

  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    setHover((h) => Math.min(n - 1, Math.max(0, (h ?? 0) + (e.key === 'ArrowLeft' ? -1 : 1))))
  }

  return (
    <div className="chart latency-ladder" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Distribuição de latência por faixa. ${sloLabel} das requisições em até ${slo} ms. Use as setas para ver cada faixa.`}
          tabIndex={0}
          onFocus={() => setHover((h) => h ?? 0)}
          onBlur={() => setHover(null)}
          onKeyDown={onKey}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            {[
              ['ok', 'var(--mark-3)'],
              ['hi', 'var(--mark-2)'],
              ['bad', 'var(--error-mark)'],
            ].map(([k, color]) => (
              <pattern key={k} id={`${uid}-${k}`} width="8" height="6" patternUnits="userSpaceOnUse" patternTransform={`translate(0 ${plotBottom % 6})`}>
                <rect width="8" height="4" style={{ fill: color }} />
              </pattern>
            ))}
          </defs>

          {/* Coluna em destaque (hover/teclado). */}
          {hover != null && <rect x={colW * hover} y={0} width={colW} height={height} className="ladder-hover" />}

          {/* Grade a cada 25%; os valores ficam nos próprios degraus. */}
          {[0, 25, 50, 75, 100].map((v) => (
            <line key={v} className="grid-dotted" x1={0} x2={width} y1={y(v)} y2={y(v)} />
          ))}

          {bands.slice(1).map((b, i) => (
            <line key={b.label} className="col-sep" x1={colW * (i + 1)} x2={colW * (i + 1)} y1={0} y2={height} />
          ))}

          {/* Barras: % de requisições em cada faixa. */}
          {bands.map((b, i) => {
            const h = Math.max(b.share > 0 ? 2 : 0, plotBottom - y(b.share * 100))
            const kind = i >= sloIndex && sloIndex >= 0 ? 'bad' : i === highlight ? 'hi' : 'ok'
            return (
              <rect
                key={b.label}
                x={cx(i) - bw / 2}
                y={plotBottom - h}
                width={bw}
                height={h}
                style={{ fill: `url(#${uid}-${kind})` }}
              />
            )
          })}

          {/* Limite do SLO. */}
          {sloIndex > 0 && (
            <g className="ladder-slo">
              <line x1={sloX} x2={sloX} y1={plotTop - 14} y2={plotBottom} />
              <text x={sloX + 6} y={plotBottom - 8}>
                SLO {slo} ms
              </text>
            </g>
          )}

          {/* Escada cumulativa. */}
          <path d={ladder} className="ladder-line" />
          {cum.map((c, i) => (
            <g key={i}>
              <circle cx={cx(i)} cy={y(c)} r="3.5" className="ladder-dot" />
              {i !== sloIndex - 1 && (
                <text className="ladder-cum" x={cx(i)} y={y(c) - 9} textAnchor="middle">
                  {num.format(c)}%
                </text>
              )}
            </g>
          ))}

          {/* Selo no limite do SLO: o número do título do cartão. */}
          {sloPct != null && (
            <g className="ladder-pill">
              <rect x={sloX - pillW - 6} y={y(sloPct) - 22} width={pillW} height={20} rx="3" />
              <text x={sloX - 6 - pillW / 2} y={y(sloPct) - 8} textAnchor="middle">
                {sloLabel}
              </text>
            </g>
          )}

          {/* Áreas de hover do tamanho da coluna inteira. */}
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
          <li key={b.label} className={i === highlight ? 'highlight' : ''}>
            <span className="ladder-count">
              <strong>{formatCount(b.share * total)}</strong>
              <span className="muted">{num.format(b.share * 100)}%</span>
            </span>
            <span className="shape-label">
              {b.label}
              {i === highlight && <em> · p95</em>}
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

/** Meia rosca com segmentos separados por um pequeno espaço. */
export function HalfDonut({ items, center, sub, size = 220 }) {
  const total = items.reduce((s, it) => s + it.value, 0)
  const r = size / 2 - 18
  const cx = size / 2
  const cy = size / 2
  const gapDeg = 1.6
  const arc = (a0, a1) => {
    const p = (a) => [cx + r * Math.cos((a * Math.PI) / 180), cy - r * Math.sin((a * Math.PI) / 180)]
    const [x0, y0] = p(a0)
    const [x1, y1] = p(a1)
    return `M${x0},${y0} A${r},${r} 0 ${a0 - a1 > 180 ? 1 : 0} 1 ${x1},${y1}`
  }
  return (
    <svg className="half-donut" width={size} height={size / 2 + 12} viewBox={`0 0 ${size} ${size / 2 + 12}`} role="img" aria-label={sub}>
      <path d={arc(180, 0)} className="donut-track" />
      {items.map((it, i) => {
        const start = 180 - (items.slice(0, i).reduce((s, x) => s + x.value, 0) / total) * 180
        const sweep = (it.value / total) * 180
        const d = arc(start - gapDeg / 2, start - sweep + gapDeg / 2)
        return <path key={it.name} d={d} className="donut-seg" style={{ stroke: it.color }} />
      })}
      <text x={cx} y={cy - 14} textAnchor="middle" className="donut-value">
        {center}
      </text>
      <text x={cx} y={cy + 6} textAnchor="middle" className="donut-sub">
        {sub}
      </text>
    </svg>
  )
}

/** Barra pontilhada: pontos escuros até a proporção, claros depois. */
export function DotMeter({ ratio, marker }) {
  const [ref, width] = useWidth()
  const w = Math.max(0, width)
  const filled = Math.min(1, Math.max(0, ratio)) * w
  return (
    <div className="dot-meter" ref={ref}>
      {w > 0 && (
        <svg width={w} height={8} aria-hidden="true">
          <line x1={2} x2={w - 2} y1={4} y2={4} className="dots-track" />
          <line x1={2} x2={Math.max(2, filled - 2)} y1={4} y2={4} className="dots-fill" />
          {marker != null && <line x1={marker * w} x2={marker * w} y1={0} y2={8} className="dots-marker" />}
        </svg>
      )}
    </div>
  )
}

// Intensidade do mapa de calor por faixa de latência.
const HEAT_STEPS = [0, 120, 160, 220, 300]
const heatLevel = (v) => (v == null ? 'none' : HEAT_STEPS.filter((s) => v >= s).length - 1)

/** Mapa de calor: rotas × horas, com a cor pela latência p95. */
export function Heatmap({ rows, hours, format, marker }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const labelW = 72
  const gap = 3
  const cols = hours.length
  const cell = Math.max(6, (width - labelW - gap * (cols - 1)) / cols)
  const rowH = 26
  const top = 18
  const height = top + rows.length * (rowH + gap) + 20
  const x = (i) => labelW + i * (cell + gap)
  const markerCol = marker ? hours.findIndex((h, i) => marker.t >= h && marker.t < (hours[i + 1] ?? Infinity)) : -1

  return (
    <div className="chart heatmap" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Latência p95 por rota e hora nas últimas 24 horas">
          {markerCol >= 0 && (
            <g className="heat-marker">
              <path d={`M${x(markerCol) + cell / 2 - 4},4 L${x(markerCol) + cell / 2 + 4},4 L${x(markerCol) + cell / 2},10 Z`} />
              {x(markerCol) + cell / 2 + 8 + marker.label.length * 6 > width ? (
                <text x={x(markerCol) + cell / 2 - 8} y={10} textAnchor="end">
                  {marker.label}
                </text>
              ) : (
                <text x={x(markerCol) + cell / 2 + 8} y={10}>
                  {marker.label}
                </text>
              )}
            </g>
          )}
          {rows.map((r, ri) => (
            <g key={r.path}>
              <text className="tick" x={0} y={top + ri * (rowH + gap) + rowH / 2} dy="0.32em">
                {r.path}
              </text>
              {r.values.map((v, ci) => (
                <rect
                  key={ci}
                  x={x(ci)}
                  y={top + ri * (rowH + gap)}
                  width={cell}
                  height={rowH}
                  rx="2"
                  className={`heat heat-${heatLevel(v)}${hover && hover.r === ri && hover.c === ci ? ' active' : ''}`}
                  tabIndex={0}
                  aria-label={`${r.path}, ${formatTime(hours[ci])}: ${v == null ? 'sem dados' : format(v)}`}
                  onPointerEnter={() => setHover({ r: ri, c: ci })}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover({ r: ri, c: ci })}
                  onBlur={() => setHover(null)}
                />
              ))}
            </g>
          ))}
          {hours.map((h, i) =>
            new Date(h).getHours() % 6 === 0 ? (
              <text key={h} className="tick" x={x(i)} y={height - 4}>
                {formatTime(h).slice(0, 2)}h
              </text>
            ) : null,
          )}
        </svg>
      )}
      {hover && (
        <ChartTooltip x={x(hover.c) + cell / 2} y={top + hover.r * (rowH + gap) + rowH + 6} width={width}>
          <div className="tooltip-time">
            {rows[hover.r].path} · {formatTime(hours[hover.c])}
          </div>
          <TooltipRow
            name="p95 médio"
            value={rows[hover.r].values[hover.c] == null ? 'sem dados' : format(rows[hover.r].values[hover.c])}
          />
        </ChartTooltip>
      )}
    </div>
  )
}

/** Legenda do mapa de calor: de "Menor" a "Maior". */
export function HeatLegend() {
  return (
    <div className="heat-legend" aria-hidden="true">
      <span>Menor</span>
      {HEAT_STEPS.map((s, i) => (
        <i key={s} className={`heat-${i}`} />
      ))}
      <span>Maior</span>
    </div>
  )
}
