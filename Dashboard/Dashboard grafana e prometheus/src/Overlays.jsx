import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconClose, IconSearch } from './icons.jsx'

/** Base de diálogo modal: fundo escurecido, Esc fecha, foco volta ao gatilho. */
function Modal({ onClose, className, labelledBy, children }) {
  const prev = useRef(document.activeElement)
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const trigger = prev.current
    return () => {
      document.removeEventListener('keydown', onKey)
      trigger?.focus?.()
    }
  }, [onClose])
  return createPortal(
    <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={className} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/**
 * Paleta de comandos (Ctrl/⌘ + K).
 * items: [{ id, group, label, hint, icon, run }]
 */
export function CommandPalette({ items, onClose }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const titleId = useId()
  const listId = useId()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? items.filter((it) => `${it.label} ${it.group} ${it.hint ?? ''}`.toLowerCase().includes(q)) : items
  }, [items, query])

  const run = (it) => {
    onClose()
    it.run()
  }
  const onKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const d = e.key === 'ArrowDown' ? 1 : -1
      setActive((a) => (a + d + filtered.length) % Math.max(1, filtered.length))
    } else if (e.key === 'Enter' && filtered[active]) {
      e.preventDefault()
      run(filtered[active])
    }
  }

  const isFirstOfGroup = (i) => i === 0 || filtered[i - 1].group !== filtered[i].group
  return (
    <Modal onClose={onClose} className="palette" labelledBy={titleId}>
      <h2 id={titleId} className="visually-hidden">
        Buscar
      </h2>
      <div className="palette-input">
        <IconSearch size={16} />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={filtered[active] ? `${listId}-${filtered[active].id}` : undefined}
          placeholder="Buscar painéis, períodos e atalhos…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKey}
        />
        <kbd>Esc</kbd>
      </div>
      <ul className="palette-list" id={listId} role="listbox" aria-label="Resultados">
        {filtered.length === 0 && <li className="palette-empty">Nada encontrado.</li>}
        {filtered.map((it, i) => {
          const header = isFirstOfGroup(i) ? it.group : null
          return (
            <li key={it.id} role="presentation">
              {header && <p className="palette-group">{header}</p>}
              <button
                type="button"
                id={`${listId}-${it.id}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'active' : ''}
                onPointerMove={() => setActive(i)}
                onClick={() => run(it)}
              >
                {it.icon && <it.icon size={16} />}
                <span>{it.label}</span>
                {it.hint && <span className="palette-hint">{it.hint}</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}

/**
 * Gaveta lateral para inspecionar um painel: consultas PromQL e dados.
 * queries: [{ name, expr }]; table: { columns: [{ key, name, format }], rows }
 */
export function InspectDrawer({ title, queries, table, onClose }) {
  const [tab, setTab] = useState(queries?.length ? 'query' : 'data')
  const titleId = useId()
  return (
    <Modal onClose={onClose} className="drawer" labelledBy={titleId}>
      <header className="drawer-head">
        <div>
          <p className="eyebrow">Inspecionar</p>
          <h2 id={titleId}>{title}</h2>
        </div>
        <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose} autoFocus>
          <IconClose size={18} />
        </button>
      </header>
      <div className="tabs" role="tablist">
        {queries?.length > 0 && (
          <button type="button" role="tab" aria-selected={tab === 'query'} onClick={() => setTab('query')}>
            Consulta PromQL
          </button>
        )}
        {table && (
          <button type="button" role="tab" aria-selected={tab === 'data'} onClick={() => setTab('data')}>
            Dados
          </button>
        )}
      </div>
      <div className="drawer-body">
        {tab === 'query' ? (
          <>
            <p className="muted">É isto que o Grafana envia ao Prometheus para montar este painel:</p>
            {queries.map((q) => (
              <figure key={q.name} className="query">
                <figcaption>{q.name}</figcaption>
                <pre>
                  <code>{q.expr}</code>
                </pre>
              </figure>
            ))}
          </>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {table.columns.map((c) => (
                    <th key={c.key} scope="col">
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={r.t ?? i}>
                    {table.columns.map((c) => (
                      <td key={c.key}>{c.format(r[c.key])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  )
}

/** Diálogo simples com título e conteúdo. */
export function Dialog({ title, onClose, children }) {
  const titleId = useId()
  return (
    <Modal onClose={onClose} className="dialog" labelledBy={titleId}>
      <header className="drawer-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose} autoFocus>
          <IconClose size={18} />
        </button>
      </header>
      <div className="dialog-body">{children}</div>
    </Modal>
  )
}
