import { MiniBars, PeakBars, StackedBars } from './charts/bars.jsx'
import { DotMeter, HalfDonut, HeatLegend, Heatmap, LatencyLadder } from './charts/shapes.jsx'
import { RANGES, ROUTES, SCRAPE_INTERVAL_S, SLO_MS } from './engine.js'
import {
  LINKS,
  fmtCount,
  fmtInt,
  fmtMs,
  fmtPct,
  fmtPctAxis,
  fmtRps,
  formatRange,
  formatTime,
  num,
  stepLabel,
  timeColumns,
} from './format.js'
import {
  IconActivity,
  IconAlert,
  IconChart,
  IconChevronRight,
  IconCode,
  IconDownload,
  IconExternal,
  IconFlame,
  IconGauge,
  IconLayers,
  IconRocket,
  IconRoute,
  IconServer,
  IconTimer,
} from './icons.jsx'
import { PROMQL } from './queries.js'
import { Card, CardLabel, Delta, Legend, LinkButton, Segmented } from './ui.jsx'

const STATUS = [
  { key: 'r2xx', name: '2xx', color: 'var(--mark-1)' },
  { key: 'r4xx', name: '4xx', color: 'var(--mark-3)' },
  { key: 'r5xx', name: '5xx', color: 'var(--error-mark)' },
]
const ROUTE_COLORS = ['var(--mark-1)', 'var(--mark-2)', 'var(--mark-3)']

const shareBelowSlo = (bands) => bands.filter((b) => b.hi <= SLO_MS).reduce((s, b) => s + b.share, 0) * 100

function InspectButton({ onClick, title }) {
  return (
    <button type="button" className="icon-btn" aria-label={`Ver PromQL e dados: ${title}`} title="Ver PromQL e dados" onClick={onClick}>
      <IconCode size={16} />
    </button>
  )
}

function KpiCard({ icon, title, value, delta, bars, barsLabel }) {
  return (
    <Card className="kpi">
      <div>
        <CardLabel icon={icon} title={title} />
        <p className="kpi-value">{value}</p>
        {delta}
      </div>
      <MiniBars values={bars} label={barsLabel} />
    </Card>
  )
}

function DataPath({ onShowQueries }) {
  const nodes = [
    { Icon: IconServer, name: 'Balcão Aceso' },
    { Icon: IconFlame, name: 'Prometheus' },
    { Icon: IconChart, name: 'Grafana' },
  ]
  return (
    <div className="data-path">
      <div className="avatars" aria-hidden="true">
        {nodes.map(({ Icon, name }) => (
          <span key={name} className="avatar" title={name}>
            <Icon size={20} />
          </span>
        ))}
      </div>
      <p className="data-path-title">API, Prometheus e Grafana</p>
      <p className="muted">
        A API expõe as métricas em /actuator/prometheus. O Prometheus coleta a cada {SCRAPE_INTERVAL_S} s e
        o Grafana consulta o histórico.
      </p>
      <button type="button" className="btn btn-outline btn-sm" onClick={onShowQueries}>
        <IconCode size={14} />
        Ver consultas PromQL
      </button>
    </div>
  )
}

function OverviewHead({ range, data, source, rangeId, onRange }) {
  return (
    <div className="page-head">
      <div>
        <h1>Balcão Aceso</h1>
        <p className="page-lead">Tráfego, tempo de resposta e erros das rotas /produtos, /pedidos e /usuarios.</p>
        <p className="muted small">
          {range.label} · {formatRange(data.from, data.to)} · 1 ponto a cada {stepLabel(data.stepSeconds)} ·{' '}
          {source === 'prometheus' ? 'Prometheus ao vivo' : 'dados simulados'}
        </p>
      </div>
      <div className="page-actions">
        <Segmented label="Período" options={RANGES} value={rangeId} onChange={onRange} />
        <LinkButton icon={IconExternal} href={`${LINKS.grafana}/d/api-spring-boot`}>
          Abrir no Grafana
        </LinkButton>
      </div>
    </div>
  )
}

export default function OverviewDashboard({ data, heatmap, deployInfo, source, rangeId, onRange, onInspect, onNavigate, onExport }) {
  const { means, previous, bars, latency } = data
  const range = RANGES.find((r) => r.id === rangeId)
  const headProps = { range, data, source, rangeId, onRange }

  // Prometheus no ar, mas nenhuma requisição no período (ex.: gerador de carga parado).
  if (!(means.rps > 0)) {
    return (
      <>
        <OverviewHead {...headProps} />
        <Card className="empty-state">
          <IconActivity size={22} />
          <h2>Nenhuma requisição neste período</h2>
          <p className="muted">
            O Prometheus respondeu, mas não há tráfego da API em {range.label.toLowerCase()}. Confira se a API e o
            gerador de carga (k6) estão rodando, ou escolha um período maior.
          </p>
        </Card>
      </>
    )
  }
  // 12 barras cobrindo o período inteiro (média de cada fatia).
  const spark = (k) =>
    Array.from({ length: 12 }, (_, i) => {
      const slice = bars.slice(Math.floor((i * bars.length) / 12), Math.floor(((i + 1) * bars.length) / 12))
      return slice.reduce((s, b) => s + b[k], 0) / slice.length
    })
  const dip = data.minInstances
  const minInstances = dip?.instances ?? data.instancesTotal

  const peak = data.peakBars.reduce((a, b) => (b.p95 > a.p95 ? b : a))
  const slo = shareBelowSlo(latency)
  const sloPrev = data.previousLatency ? shareBelowSlo(data.previousLatency) : null
  const p95Band = latency.findIndex((b) => means.p95 < b.hi)

  const routes = ROUTES.map((r, i) => ({
    ...r,
    name: r.path,
    value: means[r.rps],
    p95: means[r.p95],
    color: ROUTE_COLORS[i],
  }))
  const totalRps = routes.reduce((s, r) => s + r.value, 0)
  const top = routes.reduce((a, b) => (b.value > a.value ? b : a))

  const heatValues = (heatmap?.rows ?? []).flatMap((r) => r.values.map((v, i) => ({ v, r, i }))).filter((x) => x.v != null)
  const heatPeak = heatValues.length ? heatValues.reduce((a, b) => (b.v > a.v ? b : a)) : null
  const heatAvg = heatValues.length ? heatValues.reduce((s, x) => s + x.v, 0) / heatValues.length : 0

  const allQueries = [
    PROMQL.rps,
    PROMQL.p95,
    PROMQL.err5xx,
    PROMQL.instances,
    ...PROMQL.byStatus,
    PROMQL.routes,
    PROMQL.routeP95,
    PROMQL.buckets,
    PROMQL.slo,
    PROMQL.deploys,
  ]

  return (
    <>
      <OverviewHead {...headProps} />

      <div className="grid kpis">
        <KpiCard
          icon={IconActivity}
          title="Requisições/s"
          value={num.format(means.rps)}
          delta={<Delta current={means.rps} previous={previous?.rps} better={null} />}
          bars={spark('rps')}
          barsLabel="Requisições por segundo ao longo do período"
        />
        <KpiCard
          icon={IconTimer}
          title="Latência p95"
          value={fmtMs(means.p95)}
          delta={<Delta current={means.p95} previous={previous?.p95} better="down" />}
          bars={spark('p95')}
          barsLabel="Latência p95 ao longo do período"
        />
        <KpiCard
          icon={IconAlert}
          title="Erros 5xx"
          value={fmtPct(means.err5xx)}
          delta={<Delta current={means.err5xx} previous={previous?.err5xx} better="down" />}
          bars={spark('err5xx')}
          barsLabel="Taxa de erros 5xx ao longo do período"
        />
        <KpiCard
          icon={IconServer}
          title="Instâncias ativas"
          value={`${data.latest.instances ?? 0} / ${data.instancesTotal}`}
          delta={
            <p className="delta">
              {minInstances < data.instancesTotal ? (
                <>
                  <span className="delta-value tone-bad">mín. {minInstances}</span>
                  <span className="muted"> às {formatTime(dip.t)}</span>
                </>
              ) : (
                <>
                  <span className="delta-value tone-good">todas no ar</span>
                  <span className="muted"> no período</span>
                </>
              )}
            </p>
          }
          bars={spark('instances')}
          barsLabel="Instâncias ativas ao longo do período"
        />
      </div>

      <div className="grid row-main">
        <Card className="chart-card">
          <div className="chart-head">
            <div>
              <p className="headline">{fmtCount(data.totalRequests)}</p>
              <p className="muted">Requisições no período · média de {fmtRps(means.rps)}</p>
              <Legend items={STATUS} />
            </div>
            <div className="chart-head-side">
              <InspectButton
                title="Tráfego HTTP"
                onClick={() =>
                  onInspect({
                    title: 'Tráfego HTTP por status',
                    queries: PROMQL.byStatus,
                    table: { columns: timeColumns(STATUS, fmtRps), rows: data.bars },
                  })
                }
              />
              <Delta current={means.rps} previous={previous?.rps} better={null} />
            </div>
          </div>
          <StackedBars
            bars={bars}
            series={STATUS}
            format={fmtRps}
            axisFormat={fmtInt}
            label="Tráfego HTTP empilhado por classe de status"
          />
        </Card>

        <Card className="chart-card">
          <div className="chart-head">
            <div>
              <p className="headline">{fmtMs(peak.p95)}</p>
              <p className="muted">
                Pico de latência p95{' '}
                {peak.from === peak.t
                  ? `às ${formatTime(peak.t)}`
                  : `entre ${formatTime(peak.from)} e ${formatTime(peak.t)}`}
              </p>
            </div>
            <div className="chart-head-side">
              <InspectButton
                title="Latência p95"
                onClick={() =>
                  onInspect({
                    title: 'Latência p95',
                    queries: [PROMQL.p95],
                    table: { columns: timeColumns([{ key: 'p95', name: 'p95' }], fmtMs), rows: data.peakBars },
                  })
                }
              />
              <Delta current={means.p95} previous={previous?.p95} better="down" suffix="" />
            </div>
          </div>
          <PeakBars
            bars={data.peakBars}
            valueKey="p95"
            format={fmtMs}
            threshold={SLO_MS}
            label="Latência p95 por intervalo, com o pico destacado"
          />
        </Card>
      </div>

      <div className="grid row-two">
        <Card className="chart-card flush">
          <div className="chart-head padded">
            <div>
              <p className="headline">{fmtPct(slo)}</p>
              <p className="muted">
                Requisições respondidas em até {SLO_MS} ms · histograma do Micrometer · {range.label.toLowerCase()}
              </p>
            </div>
            <div className="chart-head-side">
              <InspectButton
                title="Distribuição de latência"
                onClick={() =>
                  onInspect({
                    title: 'Distribuição de latência',
                    queries: [PROMQL.buckets, PROMQL.slo],
                    table: {
                      columns: [
                        { key: 'label', name: 'Faixa', format: (v) => v },
                        { key: 'share', name: 'Requisições', format: (v) => fmtPctAxis(v * 100) },
                      ],
                      rows: latency,
                    },
                  })
                }
              />
              <Delta current={slo} previous={sloPrev} better="up" stable={0.1} />
            </div>
          </div>
          <LatencyLadder bands={latency} total={data.totalRequests} highlight={p95Band} slo={SLO_MS} formatCount={fmtCount} />
        </Card>

        <Card className="chart-card flush">
          <div className="chart-head padded">
            <div>
              <p className="headline">{num.format((top.value / totalRps) * 100)}%</p>
              <p className="muted">do tráfego vai para {top.path} · média no período</p>
            </div>
            <div className="chart-head-side">
              <InspectButton
                title="Rotas por tráfego"
                onClick={() =>
                  onInspect({
                    title: 'Rotas por tráfego',
                    queries: [PROMQL.routes],
                    table: {
                      columns: [
                        { key: 'path', name: 'Rota', format: (v) => v },
                        { key: 'value', name: 'Média', format: fmtRps },
                      ],
                      rows: routes,
                    },
                  })
                }
              />
            </div>
          </div>
          <div className="routes-body">
            <HalfDonut items={routes} center={fmtInt(totalRps)} sub="req/s no total" />
            <ul className="route-legend">
              {routes.map((r) => (
                <li key={r.path}>
                  <span className="legend-square" style={{ background: r.color }} />
                  <span className="route-name">{r.path}</span>
                  <span className="muted">{num.format((r.value / totalRps) * 100)}%</span>
                  <span>{fmtRps(r.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div className="grid row-four">
        <Card>
          <CardLabel icon={IconRoute} title="Latência p95 por rota" meta={`SLO ${SLO_MS} ms`} />
          <ul className="meter-list">
            {routes.map((r) => (
              <li key={r.path}>
                <div className="meter-row">
                  <span>{r.path}</span>
                  <span className={r.p95 > SLO_MS ? 'tone-bad' : 'muted'}>{fmtMs(r.p95)}</span>
                </div>
                <DotMeter ratio={r.p95 / 400} marker={SLO_MS / 400} />
              </li>
            ))}
          </ul>
          <p className="muted small">A marca vertical indica o SLO de {SLO_MS} ms.</p>
        </Card>

        <Card>
          <CardLabel icon={IconLayers} title="Caminho dos dados" />
          <DataPath onShowQueries={() => onInspect({ title: 'Consultas PromQL do dashboard', queries: allQueries })} />
        </Card>

        <Card>
          <CardLabel icon={IconGauge} title="Latência por hora" meta="Últimas 24 h" />
          <div className="heat-head">
            <div>
              <p className="headline sm">{heatPeak ? fmtMs(heatPeak.v) : 'Sem dados'}</p>
              <p className="muted small">
                {heatPeak
                  ? `Pico · ${heatPeak.r.path} às ${formatTime(heatmap.hours[heatPeak.i]).slice(0, 2)}h`
                  : 'Sem dados ainda'}
              </p>
            </div>
            <div className="align-end">
              <p className="headline xs">{heatPeak ? fmtMs(heatAvg) : 'Sem dados'}</p>
              <p className="muted small">Média</p>
            </div>
          </div>
          {heatmap && (
            <Heatmap
              rows={heatmap.rows}
              hours={heatmap.hours}
              format={fmtMs}
              marker={deployInfo ? { t: deployInfo.t, label: `deploy ${deployInfo.version}` } : null}
            />
          )}
          <HeatLegend />
        </Card>

        <Card>
          <CardLabel icon={IconRocket} title="Atalhos" />
          <ul className="actions">
            <li>
              <button type="button" onClick={() => onNavigate('deploy')}>
                <IconRocket size={16} />
                <span>
                  <strong>Antes e depois do deploy</strong>
                  <span className="muted">
                    {deployInfo
                      ? `Comparar a ${deployInfo.version} com a ${deployInfo.previous}.`
                      : 'Comparar a versão nova com a anterior.'}
                  </span>
                </span>
                <IconChevronRight size={16} />
              </button>
            </li>
            <li>
              <a href={LINKS.grafana} target="_blank" rel="noreferrer">
                <IconChart size={16} />
                <span>
                  <strong>Abrir o Grafana</strong>
                  <span className="muted">Dashboards reais em localhost:3000.</span>
                </span>
                <IconExternal size={16} />
              </a>
            </li>
            <li>
              <a href={LINKS.prometheus} target="_blank" rel="noreferrer">
                <IconFlame size={16} />
                <span>
                  <strong>Abrir o Prometheus</strong>
                  <span className="muted">Consultar métricas em localhost:9090.</span>
                </span>
                <IconExternal size={16} />
              </a>
            </li>
            <li>
              <button type="button" onClick={onExport}>
                <IconDownload size={16} />
                <span>
                  <strong>Exportar CSV</strong>
                  <span className="muted">Dados do período selecionado.</span>
                </span>
                <IconChevronRight size={16} />
              </button>
            </li>
          </ul>
        </Card>
      </div>
    </>
  )
}
