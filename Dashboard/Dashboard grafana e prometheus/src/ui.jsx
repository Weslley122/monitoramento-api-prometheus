import { useRef } from 'react'
import { num } from './format.js'
import { useReveal } from './hooks.js'

/** Painel: um degrau acima do fundo, com borda de 1px. */
export function Card({ as: Tag = 'section', className = '', children, ...rest }) {
  return (
    <Tag className={`panel ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

/** Bloco que anima o que tem dentro quando entra na tela rolando para baixo. */
export function Reveal({ as: Tag = 'div', children, ...rest }) {
  const ref = useRef(null)
  const reveal = useReveal(ref)
  return (
    <Tag ref={ref} data-reveal={reveal} {...rest}>
      {children}
    </Tag>
  )
}

/** Título da tela: o nome, a frase com o achado principal e as ações à direita. */
export function PageHead({ title, lead, meta, children }) {
  return (
    <div className="page-head">
      <div className="page-title">
        <h1>{title}</h1>
        {lead && <p className="page-lead">{lead}</p>}
        {meta && <p className="page-meta">{meta}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  )
}

/** Cabeçalho de seção: título à esquerda, detalhe e ação à direita. */
export function SectionHead({ id, title, meta, children }) {
  return (
    <header className="section-head">
      <h2 id={id}>{title}</h2>
      {meta && <span className="section-meta">{meta}</span>}
      {children && <div className="section-tools">{children}</div>}
    </header>
  )
}

/**
 * Variação contra uma referência, com o sinal no texto ("+11,3%").
 * better: 'down' quando cair é bom (latência, erros), 'up' quando subir é bom,
 * ou null para só mostrar a variação, sem julgar (tráfego).
 */
export function Delta({ current, previous, better = 'up', suffix = 'vs período anterior', stable = 2 }) {
  if (previous == null || previous === 0 || current == null) {
    return <p className="delta muted">sem referência anterior</p>
  }
  const change = ((current - previous) / previous) * 100
  const flat = Math.abs(change) < stable
  const good = better === null || flat ? null : (change > 0) === (better === 'up')
  const tone = good === null ? 'neutral' : good ? 'good' : 'bad'
  const sign = change > 0 ? '+' : '−'
  return (
    <p className="delta">
      <span className={`delta-value tone-${tone}`}>{flat ? 'estável' : `${sign}${num.format(Math.abs(change))}%`}</span>
      {suffix && <span className="muted"> {suffix}</span>}
      {good !== null && <span className="visually-hidden">{good ? ', melhorou' : ', piorou'}</span>}
    </p>
  )
}

/** Opções com uma selecionada; a selecionada ganha a linha de 1px por baixo. */
export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          title={o.label}
          className={o.id === value ? 'active' : ''}
          onClick={() => onChange(o.id)}
        >
          <span>{o.short}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * Faixa de números que também escolhe o gráfico de baixo.
 * items: [{ id, label, value, unit, foot }]
 */
export function MetricTabs({ items, value, onChange, label }) {
  const onKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const i = items.findIndex((it) => it.id === value)
    const next = items[(i + (e.key === 'ArrowLeft' ? items.length - 1 : 1)) % items.length]
    onChange(next.id)
    e.currentTarget.parentElement.querySelector(`[data-id="${next.id}"]`)?.focus()
  }
  return (
    <div className="metric-tabs" role="tablist" aria-label={label}>
      {items.map((it) => {
        const on = it.id === value
        return (
          <button
            key={it.id}
            data-id={it.id}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            className={on ? 'metric active' : 'metric'}
            onClick={() => onChange(it.id)}
            onKeyDown={onKey}
          >
            <span className="metric-label">{it.label}</span>
            <span className="metric-value">
              {it.value}
              {it.unit && <span className="unit">{it.unit}</span>}
            </span>
            {it.foot}
          </button>
        )
      })}
    </div>
  )
}

export function Button({ icon: Icon, children, variant = 'outline', className = '', ...rest }) {
  return (
    <button type="button" className={`btn btn-${variant} ${className}`} {...rest}>
      {Icon && <Icon size={15} />}
      {children}
    </button>
  )
}

export function LinkButton({ icon: Icon, children, className = '', ...rest }) {
  return (
    <a className={`btn btn-outline ${className}`} target="_blank" rel="noreferrer" {...rest}>
      {children}
      {Icon && <Icon size={14} />}
    </a>
  )
}

/** Legenda: cada amostra é a própria marca do gráfico, em miniatura. */
export function Legend({ items }) {
  return (
    <ul className="legend">
      {items.map((it) => (
        <li key={it.key ?? it.name}>
          <span className={`legend-key ${it.kind ?? 'bar'}`} style={{ '--key': it.color }} />
          {it.name}
        </li>
      ))}
    </ul>
  )
}

/** Tooltip posicionado sobre um gráfico; vira para a esquerda perto da borda. */
export function ChartTooltip({ x, y = 8, width, children }) {
  const flip = x > width - 190
  return (
    <div
      className="tooltip"
      style={{ left: x, top: y, transform: flip ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)' }}
    >
      {children}
    </div>
  )
}

export function TooltipRow({ color, name, value }) {
  return (
    <div className="tooltip-row">
      {color && <span className="line-key" style={{ background: color }} />}
      <span className="muted">{name}</span>
      <strong>{value}</strong>
    </div>
  )
}
