import { useState } from 'react'
import { useDismiss } from './hooks.js'
import { LINKS, formatTime } from './format.js'
import { BACKGROUNDS } from './backgrounds.js'
import { IconAlert, IconBell, IconCheck, IconHelp, IconSearch } from './icons.jsx'

/** Barra lateral só com ícones; o nome aparece ao passar o mouse. */
export function Sidebar({ views, current, onSelect, links, onHelp }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src="/balcao-aceso.svg" alt="Balcão Aceso" width="22" height="22" />
      </div>
      <nav className="sidebar-nav" aria-label="Painéis">
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            className={v.id === current ? 'side-btn active' : 'side-btn'}
            aria-current={v.id === current ? 'page' : undefined}
            aria-label={v.title}
            data-tip={v.title}
            onClick={() => onSelect(v.id)}
          >
            <v.Icon size={18} />
            <span className="side-label">{v.short ?? v.title}</span>
          </button>
        ))}
        <span className="side-sep" />
        {links.map((l) => (
          <a
            key={l.href}
            className="side-btn"
            href={l.href}
            target="_blank"
            rel="noreferrer"
            aria-label={`${l.title} (abre em nova aba)`}
            data-tip={l.title}
          >
            <l.Icon size={18} />
            <span className="side-label">{l.short ?? l.title}</span>
          </a>
        ))}
      </nav>
      <div className="sidebar-foot">
        <button type="button" className="side-btn" aria-label="Como funciona" data-tip="Como funciona" onClick={onHelp}>
          <IconHelp size={18} />
          <span className="side-label">Ajuda</span>
        </button>
      </div>
    </aside>
  )
}

function AlertsButton({ alerts, format }) {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  return (
    <div className="popover-wrap" ref={ref}>
      <button
        type="button"
        className="icon-btn bordered"
        aria-label={`Alertas: ${alerts.length}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <IconBell size={16} />
        {alerts.length > 0 && <span className="badge-dot" />}
      </button>
      {open && (
        <div className="popover alerts" role="dialog" aria-label="Alertas no período">
          <p className="popover-title">
            Alertas no período <span className="muted">{alerts.length}</span>
          </p>
          {alerts.length === 0 ? (
            <p className="muted">Nenhuma regra disparou neste período.</p>
          ) : (
            <ul>
              {alerts.map((a) => (
                <li key={`${a.id}-${a.from}`}>
                  <IconAlert size={15} className="alert-icon" />
                  <div>
                    <p>{a.title}</p>
                    <p className="muted small">
                      {formatTime(a.from)} às {formatTime(a.to)} · {format(a)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

const MODES = [
  { id: 'auto', label: 'Automática', hint: 'Prometheus quando estiver no ar; senão, simulado' },
  { id: 'prometheus', label: 'Prometheus', hint: LINKS.prometheus.replace(/^https?:\/\//, '') },
  { id: 'simulado', label: 'Simulado', hint: 'Cenário fixo: pico às 14:35 e deploy às 11:20' },
]

/** Seletor da fonte de dados, com o estado da conexão. */
function SourceMenu({ mode, onMode, metrics }) {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  const { source, conn, loading, error, updatedAt } = metrics
  const state =
    source === 'simulado'
      ? { tone: 'idle', label: 'Dados simulados' }
      : conn.state === 'offline'
        ? { tone: 'bad', label: 'Sem conexão' }
        : error
          ? { tone: 'bad', label: 'Erro na consulta' }
          : conn.state === 'live'
            ? { tone: 'live', label: 'Prometheus ao vivo' }
            : { tone: 'idle', label: 'Conectando…' }

  return (
    <div className="popover-wrap" ref={ref}>
      <button
        type="button"
        className="sim-chip"
        aria-expanded={open}
        aria-label={`Fonte de dados: ${state.label}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`sim-dot dot-${state.tone}${loading ? ' pulsing' : ''}`} />
        {state.label}
      </button>
      {open && (
        <div className="popover source-menu" role="dialog" aria-label="Fonte de dados">
          <p className="popover-title">Fonte de dados</p>
          <ul role="radiogroup" aria-label="Fonte de dados">
            {MODES.map((m) => (
              <li key={m.id}>
                <button type="button" role="radio" aria-checked={m.id === mode} onClick={() => onMode(m.id)}>
                  <span className="check">{m.id === mode && <IconCheck size={14} />}</span>
                  <span>
                    <strong>{m.label}</strong>
                    <span className="muted small">{m.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="source-status muted small">
            {source === 'simulado' && mode === 'auto' && conn.state === 'offline'
              ? `Prometheus fora do ar (${conn.message}). Tentando de novo a cada 15 s.`
              : source === 'simulado'
                ? 'Os números são simulados.'
                : error
                  ? error
                  : conn.state === 'live'
                    ? `Prometheus ${conn.version}${updatedAt ? ` · atualizado às ${new Date(updatedAt).toLocaleTimeString('pt-BR')}` : ''}`
                    : conn.state === 'offline'
                      ? `Sem resposta de ${LINKS.prometheus}: ${conn.message}`
                      : 'Conectando…'}
          </p>
        </div>
      )}
    </div>
  )
}


/** Escolha do fundo: branco, preto ou o mesmo do sistema operacional. */
function BackgroundSwitch({ value, onChange }) {
  return (
    <div className="bg-switch" role="radiogroup" aria-label="Fundo da tela">
      {BACKGROUNDS.map((b) => (
        <button
          key={b.id}
          type="button"
          role="radio"
          aria-checked={b.id === value}
          className={b.id === value ? 'active' : ''}
          title={b.hint ?? `Fundo ${b.label.toLowerCase()}`}
          onClick={() => onChange(b.id)}
        >
          <b.Icon size={14} />
          <span>{b.short ?? b.label}</span>
        </button>
      ))}
    </div>
  )
}

export function TopBar({ view, onSearch, alerts, formatAlert, source, background }) {
  const mac = /Mac|iPhone|iPad/.test(navigator.platform)
  return (
    <header className="topbar">
      <p className="crumb">
        <span className="crumb-product">Balcão Aceso</span>
        <span className="crumb-sep" aria-hidden="true">
          /
        </span>
        <span>{view.title}</span>
      </p>
      <div className="topbar-tools">
        <button type="button" className="search-btn" onClick={onSearch} aria-label="Buscar (Ctrl+K)">
          <IconSearch size={15} />
          <kbd>{mac ? '⌘' : 'Ctrl'}</kbd>
          <kbd>K</kbd>
        </button>
        <AlertsButton alerts={alerts} format={formatAlert} />
        <BackgroundSwitch {...background} />
        <SourceMenu {...source} />
      </div>
    </header>
  )
}
