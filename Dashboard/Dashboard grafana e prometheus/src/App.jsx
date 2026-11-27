import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import DeployDashboard from './DeployDashboard.jsx'
import OverviewDashboard from './OverviewDashboard.jsx'
import { PrivacyPage, SiteFooter, TermsPage } from './Legal.jsx'
import { CommandPalette, Dialog, InspectDrawer } from './Overlays.jsx'
import { BACKGROUNDS } from './backgrounds.js'
import { MOTION_OPTIONS, getMotion, setMotion, subscribeMotion } from './motion.js'
import { Sidebar, TopBar } from './Shell.jsx'
import { DEPLOY_WINDOWS, RANGES, SCRAPE_INTERVAL_S, toCsv } from './engine.js'
import { LINKS, downloadText, fmtMs, fmtPct } from './format.js'
import {
  IconActivity,
  IconChart,
  IconClock,
  IconDocument,
  IconDownload,
  IconFlame,
  IconGrid,
  IconHelp,
  IconRocket,
} from './icons.jsx'
import { Card, PageHead } from './ui.jsx'
import { useMetrics } from './useMetrics.js'
import './App.css'

const EXTERNAL = [
  { title: 'Abrir o Grafana', short: 'Grafana', href: LINKS.grafana, Icon: IconChart },
  { title: 'Abrir o Prometheus', short: 'Prometheus', href: LINKS.prometheus, Icon: IconFlame },
]

// Páginas fora da navegação principal (abertas pelo rodapé e pela busca).
const LEGAL = [
  { id: 'privacidade', title: 'Política de privacidade', Icon: IconDocument },
  { id: 'termos', title: 'Termos de uso', Icon: IconDocument },
]

const hostOf = (url) => url.replace(/^https?:\/\//, '')

/** Aviso fixo quando os números exibidos não vêm de uma API real. */
function SimulatedNotice({ mode, conn }) {
  return (
    <div className="notice" role="note">
      <span className="notice-dot" aria-hidden="true" />
      <p>
      <strong>Dados simulados.</strong>{' '}
      {mode === 'auto' && conn.state === 'offline'
        ? `O Prometheus (${hostOf(LINKS.prometheus)}) não respondeu, então os números abaixo são de um cenário de exemplo, não da sua API. `
        : 'Os números abaixo são de um cenário de exemplo, não da sua API. '}
      Para ver dados reais, suba a stack com <code>docker compose up -d</code> na raiz do projeto.
      </p>
    </div>
  )
}

const formatAlert = (a) =>
  a.id === 'latency' ? `pico de ${fmtMs(a.peak)}` : a.id === 'errors' ? `pico de ${fmtPct(a.peak)}` : `${a.peak} instâncias`

// Preferências salvas no navegador: valores desconhecidos são ignorados.
function saved(key, allowed) {
  try {
    const v = localStorage.getItem(key)
    return allowed.includes(v) ? v : null
  } catch {
    return null
  }
}

// Fundo: 'light' (branco), 'dark' (preto, o padrão) ou 'system' (segue o sistema).
const initialTheme = () => saved('tema', ['light', 'dark', 'system']) ?? 'dark'

/** Tela de espera/erro enquanto os dados reais não chegam. */
function Waiting({ title, conn, error }) {
  const offline = conn.state === 'offline'
  return (
    <>
      <PageHead title={title} lead={offline ? 'O Prometheus não respondeu.' : 'Buscando os dados no Prometheus.'} />
      <Card className="empty-state">
      <h2>{offline ? 'Sem conexão com o Prometheus' : error ? 'Erro ao consultar o Prometheus' : 'Consultando o Prometheus…'}</h2>
      <p className="muted">
        {offline
          ? `Não foi possível falar com ${LINKS.prometheus} (${conn.message}). Suba a stack com "docker compose up -d" na raiz do projeto ou escolha "Simulado" no seletor de fonte, no topo.`
          : error || 'Buscando as séries das últimas horas.'}
      </p>
    </Card>
    </>
  )
}

// Cada tela tem o seu endereço (#deploy, #privacidade…), para dar para compartilhar o link.
const VIEW_IDS = ['overview', 'deploy', 'privacidade', 'termos']
const viewFromHash = () => {
  const id = location.hash.slice(1)
  return VIEW_IDS.includes(id) ? id : 'overview'
}

export default function App() {
  const [viewId, setView] = useState(viewFromHash)
  const setViewId = useCallback((id) => {
    history.pushState(null, '', id === 'overview' ? location.pathname + location.search : `#${id}`)
    setView(id)
  }, [])

  useEffect(() => {
    const onPop = () => setView(viewFromHash())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const [rangeId, setRangeId] = useState('1h')
  const [windowId, setWindowId] = useState('1h')
  const [mode, setMode] = useState(() => saved('fonte', ['auto', 'prometheus', 'simulado']) ?? 'auto')
  const [theme, setTheme] = useState(initialTheme)
  const [palette, setPalette] = useState(false)
  const [help, setHelp] = useState(false)
  const [inspect, setInspect] = useState(null)
  const motion = useSyncExternalStore(subscribeMotion, getMotion)

  const range = RANGES.find((r) => r.id === rangeId)
  const win = DEPLOY_WINDOWS.find((w) => w.id === windowId)
  const isDashboard = viewId === 'overview' || viewId === 'deploy'
  const metrics = useMetrics({ mode, view: viewId === 'deploy' ? 'deploy' : 'overview', rangeMs: range.ms, windowMs: win.ms })
  const deployInfo = metrics.deploy?.info ?? null

  const views = [
    { id: 'overview', title: 'Visão geral', Icon: IconGrid },
    { id: 'deploy', title: deployInfo ? `Deploy ${deployInfo.version}` : 'Antes e depois do deploy', short: 'Deploy', Icon: IconRocket },
  ]
  const view = [...views, ...LEGAL].find((v) => v.id === viewId)
  const current = viewId === 'deploy' ? metrics.deploy?.data : metrics.overview

  useEffect(() => {
    // Sem atributo, o CSS segue o tema do sistema (prefers-color-scheme).
    if (theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
  }, [theme])

  // Ao trocar de tela, começa do topo (o rodapé fica no fim da página anterior).
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [viewId])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => !p)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const changeTheme = (next) => {
    localStorage.setItem('tema', next)
    setTheme(next)
  }

  const changeMode = (next) => {
    localStorage.setItem('fonte', next)
    setMode(next)
  }

  const exportCsv = useCallback(() => {
    if (metrics.overview) downloadText(`balcao-aceso-${rangeId}.csv`, toCsv(metrics.overview.points))
  }, [metrics.overview, rangeId])

  const commands = [
    ...views.map((v) => ({ id: `v-${v.id}`, group: 'Painéis', label: v.title, icon: v.Icon, run: () => setViewId(v.id) })),
    ...RANGES.map((r) => ({
      id: `r-${r.id}`,
      group: 'Período',
      label: r.label,
      hint: r.short,
      icon: IconClock,
      run: () => {
        setViewId('overview')
        setRangeId(r.id)
      },
    })),
    ...[
      ['auto', 'Fonte: automática'],
      ['prometheus', 'Fonte: Prometheus'],
      ['simulado', 'Fonte: dados simulados'],
    ].map(([id, label]) => ({ id: `f-${id}`, group: 'Fonte de dados', label, icon: IconFlame, run: () => changeMode(id) })),
    ...BACKGROUNDS.map((b) => ({
      id: `bg-${b.id}`,
      group: 'Fundo',
      label: `Fundo ${b.label.toLowerCase()}`,
      hint: b.id === theme ? 'atual' : undefined,
      icon: b.Icon,
      run: () => changeTheme(b.id),
    })),
    ...MOTION_OPTIONS.map((o) => ({
      id: `mo-${o.id}`,
      group: 'Animação dos gráficos',
      label: o.label,
      hint: o.id === motion ? 'atual' : undefined,
      icon: IconActivity,
      run: () => setMotion(o.id),
    })),
    ...EXTERNAL.map((l) => ({
      id: l.href,
      group: 'Links',
      label: l.title,
      hint: hostOf(l.href),
      icon: l.Icon,
      run: () => window.open(l.href, '_blank', 'noreferrer'),
    })),
    { id: 'csv', group: 'Ações', label: 'Exportar CSV do período', icon: IconDownload, run: exportCsv },
    { id: 'help', group: 'Ações', label: 'Como funciona', icon: IconHelp, run: () => setHelp(true) },
    ...LEGAL.map((l) => ({ id: l.id, group: 'Informações', label: l.title, icon: l.Icon, run: () => setViewId(l.id) })),
  ]

  // Enquanto atualiza, mantém o desenho anterior esmaecido (sem piscar a tela).
  const stale = metrics.loading && (viewId === 'overview' ? metrics.overviewStale : false)

  return (
    <div className="app">
      <Sidebar
        views={views}
        current={viewId}
        onSelect={setViewId}
        links={EXTERNAL}
        onHelp={() => setHelp(true)}
      />
      <div className="main">
        <TopBar
          view={view}
          onSearch={() => setPalette(true)}
          alerts={current?.alerts ?? []}
          formatAlert={formatAlert}
          source={{ mode, onMode: changeMode, metrics }}
          background={{ value: theme, onChange: changeTheme }}
        />
        <main className={stale ? 'content refreshing' : 'content'}>
          {isDashboard && metrics.source === 'simulado' && <SimulatedNotice mode={mode} conn={metrics.conn} />}
          {viewId === 'privacidade' ? (
            <PrivacyPage />
          ) : viewId === 'termos' ? (
            <TermsPage />
          ) : viewId === 'overview' ? (
            metrics.overview ? (
              <OverviewDashboard
                data={metrics.overview}
                heatmap={metrics.heatmap}
                deployInfo={deployInfo}
                source={metrics.source}
                rangeId={rangeId}
                onRange={setRangeId}
                onInspect={setInspect}
                onNavigate={setViewId}
                onExport={exportCsv}
              />
            ) : (
              <Waiting title={view.title} conn={metrics.conn} error={metrics.error} />
            )
          ) : metrics.deploy ? (
            <DeployDashboard deploy={metrics.deploy} windowId={windowId} onWindow={setWindowId} onInspect={setInspect} />
          ) : (
            <Waiting title={view.title} conn={metrics.conn} error={metrics.error} />
          )}
          <SiteFooter source={metrics.source} onNavigate={setViewId} />
        </main>
      </div>

      {palette && <CommandPalette items={commands} onClose={() => setPalette(false)} />}
      {inspect && <InspectDrawer {...inspect} onClose={() => setInspect(null)} />}
      {help && (
        <Dialog title="Como funciona" onClose={() => setHelp(false)}>
          <ol className="steps">
            <li>
              <strong>O Balcão Aceso registra o tráfego.</strong> O Micrometer conta as requisições, mede o tempo de
              resposta e anota o status de cada uma. Os números ficam em <code>/actuator/prometheus</code>.
            </li>
            <li>
              <strong>O Prometheus coleta e guarda.</strong> A cada {SCRAPE_INTERVAL_S} s ele lê esse endereço em
              cada instância e guarda o histórico.
            </li>
            <li>
              <strong>Esta tela e o Grafana consultam.</strong> Cada painel é uma consulta PromQL ao Prometheus. Use o
              botão <code>&lt;/&gt;</code> de um painel para ver a consulta.
            </li>
          </ol>
          <p className="muted">
            Com a stack no ar (<code>docker compose up -d</code> na raiz do projeto), esta tela lê o Prometheus em{' '}
            {LINKS.prometheus} a cada {SCRAPE_INTERVAL_S} s. Sem ele, mostra dados simulados.
          </p>
        </Dialog>
      )}
    </div>
  )
}
