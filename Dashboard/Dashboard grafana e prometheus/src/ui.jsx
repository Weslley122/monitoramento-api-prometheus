import { IconArrowDown, IconArrowUp } from './icons.jsx'
import { num } from './format.js'

/** Cartão com borda fina e marcas nos cantos. */
export function Card({ as: Tag = 'section', className = '', children, ...rest }) {
  return (
    <Tag className={`card ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

/** Rótulo pequeno no topo do cartão: ícone + título à esquerda, detalhe à direita. */
export function CardLabel({ icon: Icon, title, meta, action }) {
  return (
    <header className="card-label">
      <h2>
        {Icon && <Icon size={14} />}
        {title}
      </h2>
      {meta && <span className="card-meta">{meta}</span>}
      {action}
    </header>
  )
}

/**
 * Variação em relação ao período anterior.
 * better: 'down' quando cair é bom (latência, erros), 'up' quando subir é bom,
 * ou null para só mostrar a variação sem julgar.
 */
export function Delta({ current, previous, better = 'up', suffix = 'vs período anterior', stable = 2 }) {
  if (previous == null || previous === 0) return <p className="delta muted">sem período anterior</p>
  const change = ((current - previous) / previous) * 100
  const flat = Math.abs(change) < stable
  const good = better === null || flat ? null : (change > 0) === (better === 'up')
  const tone = good === null ? 'neutral' : good ? 'good' : 'bad'
  const Arrow = change >= 0 ? IconArrowUp : IconArrowDown
  return (
    <p className="delta">
      <span className={`delta-value tone-${tone}`}>
        {!flat && <Arrow size={12} />}
        {flat ? 'estável' : `${num.format(Math.abs(change))}%`}
      </span>
      {suffix && <span className="muted"> {suffix}</span>}
      <span className="visually-hidden">
        {flat ? '' : change > 0 ? ', subiu' : ', caiu'}
        {good === null ? '' : good ? ', melhorou' : ', piorou'}
      </span>
    </p>
  )
}

/** Grupo de botões com um selecionado (períodos). */
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
          {o.short}
        </button>
      ))}
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
      {Icon && <Icon size={15} />}
      {children}
    </a>
  )
}

/** Legenda com marcador redondo. */
export function Legend({ items }) {
  return (
    <ul className="legend">
      {items.map((it) => (
        <li key={it.key ?? it.name}>
          <span className="legend-dot" style={{ background: it.color }} />
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
