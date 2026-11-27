import { useState } from 'react'
import LineChart from './charts/LineChart.jsx'
import { StackedBars } from './charts/bars.jsx'
import { HeatHours, HeatLegend, HeatStrip, LatencyLadder, ShareBar } from './charts/shapes.jsx'
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
  int,
  num,
  stepLabel,
  timeColumns,
} from './format.js'
import { IconArrowRight, IconCode, IconDownload, IconExternal } from './icons.jsx'
import { PROMQL } from './queries.js'
import { Button, Card, Delta, Legend, LinkButton, MetricTabs, PageHead, Reveal, SectionHead, Segmented } from './ui.jsx'

const STATUS = [
  { key: 'r2xx', name: '2xx', color: 'var(--mark-2)' },
  { key: 'r4xx', name: '4xx', color: 'var(--mark-3)' },
  { key: 'r5xx', name: '5xx', color: 'var(--bad)' },
]

const ERROR_LIMIT = 1 // % de 5xx que dispara o alerta (mesma regra do engine)

const shareBelowSlo = (bands) => bands.filter((b) => b.hi <= SLO_MS).reduce((s, b) => s + b.share, 0) * 100

function InspectButton({ onClick, title }) {
  return (
    <button type="button" className="icon-btn" aria-label={`Ver PromQL e dados: ${title}`} title="Ver PromQL e dados" onClick={onClick}>
      <IconCode size={16} />
    </button>
  )
}

/** A frase do topo: o que mais pede atenção no período. */
function finding(data, range) {
  const latency = data.alerts.find((a) => a.id === 'latency')
  const errors = data.alerts.find((a) => a.id === 'errors')
  const down = data.alerts.find((a) => a.id === 'instances')
  const when = (a) => (a.from === a.to ? `às ${formatTime(a.to)}` : `das ${formatTime(a.from)} às ${formatTime(a.to)}`)
  if (latency) return `A latência p95 passou de ${SLO_MS} ms ${when(latency)}, com pico de ${fmtMs(latency.peak)}.`
  if (errors) return `Os erros 5xx passaram de ${ERROR_LIMIT}% ${when(errors)}, com pico de ${fmtPct(errors.peak)}.`
  if (down) return `Uma instância saiu do ar ${when(down)}; ficaram ${down.peak} de ${data.instancesTotal}.`
  return `Nenhum alerta em ${range.label.toLowerCase()}: p95 médio de ${fmtMs(data.means.p95 ?? 0)} e ${fmtPct(data.means.err5xx)} de erros 5xx.`
}

const formatAlert = (a) =>
  a.id === 'latency' ? `pico de ${fmtMs(a.peak)}` : a.id === 'errors' ? `pico de ${fmtPct(a.peak)}` : `mínimo de ${a.peak} instâncias`

function OverviewHead({ data, source, rangeId, onRange, onExport, lead }) {
  return (
    <PageHead
      title="Visão geral"
      lead={lead}
      meta={`${formatRange(data.from, data.to)} · 1 ponto a cada ${stepLabel(data.stepSeconds)} · ${
        source === 'prometheus' ? 'Prometheus ao vivo' : 'dados simulados'
      }`}
    >
      <Segmented label="Período" options={RANGES} value={rangeId} onChange={onRange} />
      {onExport && (
        <Button variant="ghost" icon={IconDownload} onClick={onExport}>
          CSV
        </Button>
      )}
      <LinkButton icon={IconExternal} href={`${LINKS.grafana}/d/api-spring-boot`}>
        Abrir no Grafana
      </LinkButton>
    </PageHead>
  )
}

/** O gráfico grande, conforme o número escolhido na faixa de cima. */
function MainChart({ metric, data, deployInfo, onInspect }) {
  const notes = deployInfo ? [{ t: deployInfo.t, label: `deploy ${deployInfo.version}` }] : []
  const common = { points: data.points, from: data.from, to: data.to, annotations: notes, height: 268 }
  const charts = {
    rps: {
      title: 'Requisições por segundo, por classe de status',
      legend: STATUS,
      inspect: () => ({
        title: 'Tráfego HTTP por status',
        queries: PROMQL.byStatus,
        table: { columns: timeColumns(STATUS, fmtRps), rows: data.bars },
      }),
      body: (
        <StackedBars
          bars={data.bars}
          series={STATUS}
          format={fmtRps}
          axisFormat={fmtInt}
          height={268}
          label="Tráfego HTTP empilhado por classe de status"
        />
      ),
    },
    p95: {
      title: 'Tempo de resposta (p50 e p95)',
      legend: [
        { key: 'p50', name: 'p50', color: 'var(--mark-2)', kind: 'line' },
        { key: 'p95', name: 'p95', color: 'var(--accent)', kind: 'line' },
        { key: 'slo', name: `SLO ${SLO_MS} ms`, color: 'var(--bad)', kind: 'dash' },
      ],
      inspect: () => ({
        title: 'Latência p50 e p95',
        queries: [PROMQL.p95],
        table: {
          columns: timeColumns(
            [
              { key: 'p50', name: 'p50' },
              { key: 'p95', name: 'p95' },
            ],
            fmtMs,
          ),
          rows: data.points,
        },
      }),
      body: (
        <LineChart
          {...common}
          series={[
            { key: 'p50', name: 'p50', color: 'var(--mark-2)' },
            { key: 'p95', name: 'p95', color: 'var(--accent)' },
          ]}
          references={[{ value: SLO_MS, label: `SLO ${SLO_MS} ms` }]}
          format={fmtMs}
          axisFormat={fmtInt}
          label="Latência p50 e p95 no período"
        />
      ),
    },
    err5xx: {
      title: 'Erros 5xx, em % das requisições',
      legend: [
        { key: 'err', name: 'Erros 5xx', color: 'var(--bad)', kind: 'line' },
        { key: 'lim', name: `Alerta acima de ${ERROR_LIMIT}%`, color: 'var(--bad)', kind: 'dash' },
      ],
      inspect: () => ({
        title: 'Erros HTTP 5xx',
        queries: [PROMQL.err5xx],
        table: { columns: timeColumns([{ key: 'err5xx', name: 'Erros 5xx' }], fmtPct), rows: data.points },
      }),
      body: (
        <LineChart
          {...common}
          series={[{ key: 'err5xx', name: 'Erros 5xx', color: 'var(--bad)' }]}
          references={[{ value: ERROR_LIMIT, label: `alerta ${ERROR_LIMIT}%` }]}
          format={fmtPct}
          axisFormat={fmtPctAxis}
          label="Taxa de erros 5xx no período"
        />
      ),
    },
    instances: {
      title: 'Instâncias respondendo à coleta',
      legend: null,
      inspect: () => ({
        title: 'Instâncias ativas',
        queries: [PROMQL.instances],
        table: { columns: timeColumns([{ key: 'instances', name: 'Instâncias' }], (v) => num.format(v)), rows: data.points },
      }),
      body: (
        <LineChart
          {...common}
          series={[{ key: 'instances', name: 'Instâncias', color: 'var(--accent)' }]}
          format={(v) => num.format(v)}
          axisFormat={fmtInt}
          label="Instâncias ativas no período"
        />
      ),
    },
  }
  const c = charts[metric]
  return (
    <div className="board-main">
      <div className="chart-head">
        <h3>{c.title}</h3>
        {c.legend && <Legend items={c.legend} />}
        <InspectButton title={c.title} onClick={() => onInspect(c.inspect())} />
      </div>
      {c.body}
    </div>
  )
}

/** Coluna ao lado do gráfico: o que disparou no período e o último deploy. */
function Occurrences({ alerts, range, deployInfo, onNavigate }) {
  return (
    <aside className="board-side" aria-labelledby="ocorrencias">
      <h3 id="ocorrencias">Ocorrências</h3>
      {alerts.length === 0 ? (
        <p className="muted">Nenhuma regra disparou em {range.label.toLowerCase()}.</p>
      ) : (
        <ul className="events">
          {alerts.map((a) => (
            <li key={`${a.id}-${a.from}`} className="event bad">
              <span className="event-time">
                {formatTime(a.from)}
                {a.from !== a.to && <> às {formatTime(a.to)}</>}
              </span>
              <span className="event-text">
                {a.title}
                <span className="muted"> · {formatAlert(a)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {deployInfo && (
        <div className="deploy-note">
          <p className="event-time">Último deploy · {formatTime(deployInfo.t)}</p>
          <p>
            {deployInfo.previous} para {deployInfo.version}
          </p>
          <button type="button" className="text-btn" onClick={() => onNavigate('deploy')}>
            Comparar antes e depois
            <IconArrowRight size={14} />
          </button>
        </div>
      )}
      <p className="side-foot">
        Regras: p95 acima de {SLO_MS} ms, erros 5xx acima de {ERROR_LIMIT}% e instância fora do ar.
      </p>
    </aside>
  )
}

export default function OverviewDashboard({ data, heatmap, deployInfo, source, rangeId, onRange, onInspect, onNavigate, onExport }) {
  const [metric, setMetric] = useState('rps')
  const { means, previous, latency } = data
  const range = RANGES.find((r) => r.id === rangeId)
  const headProps = { data, source, rangeId, onRange }

  // Prometheus no ar, mas nenhuma requisição no período (ex.: gerador de carga parado).
  if (!(means.rps > 0)) {
    return (
      <>
        <OverviewHead {...headProps} lead="Nenhuma requisição chegou à API neste período." />
        <Card className="empty-state">
          <h2>Sem tráfego em {range.label.toLowerCase()}</h2>
          <p className="muted">
            O Prometheus respondeu, mas não há requisições da API neste período. Confira se a API e o gerador de carga
            (k6) estão rodando, ou escolha um período maior.
          </p>
        </Card>
      </>
    )
  }

  const dip = data.minInstances
  const minInstances = dip?.instances ?? data.instancesTotal
  const slo = shareBelowSlo(latency)
  const sloPrev = data.previousLatency ? shareBelowSlo(data.previousLatency) : null
  const p95Band = latency.findIndex((b) => means.p95 < b.hi)
  const totalRps = ROUTES.reduce((s, r) => s + means[r.rps], 0)
  const statusTotal = STATUS.reduce((s, st) => s + means[st.key], 0)

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

  const metrics = [
    {
      id: 'rps',
      label: 'Requisições/s',
      value: num.format(means.rps),
      foot: <Delta current={means.rps} previous={previous?.rps} better={null} />,
    },
    {
      id: 'p95',
      label: 'Latência p95',
      value: int.format(means.p95 ?? 0),
      unit: 'ms',
      foot: <Delta current={means.p95} previous={previous?.p95} better="down" />,
    },
    {
      id: 'err5xx',
      label: 'Erros 5xx',
      value: num.format(means.err5xx),
      unit: '%',
      foot: <Delta current={means.err5xx} previous={previous?.err5xx} better="down" />,
    },
    {
      id: 'instances',
      label: 'Instâncias ativas',
      value: `${data.latest.instances ?? 0}`,
      unit: `de ${data.instancesTotal}`,
      foot:
        minInstances < data.instancesTotal ? (
          <p className="delta">
            <span className="delta-value tone-bad">mínimo de {minInstances}</span>
            <span className="muted"> às {formatTime(dip.t)}</span>
          </p>
        ) : (
          <p className="delta muted">todas no ar no período</p>
        ),
    },
  ]

  return (
    <>
      <OverviewHead {...headProps} onExport={onExport} lead={finding(data, range)} />

      <Card className="board" aria-label="Saúde da API no período">
        <MetricTabs label="Escolha o número para ver no gráfico" items={metrics} value={metric} onChange={setMetric} />
        <div className="board-body">
          <MainChart key={`${metric}-${rangeId}`} metric={metric} data={data} deployInfo={deployInfo} onInspect={onInspect} />
          <Occurrences alerts={data.alerts} range={range} deployInfo={deployInfo} onNavigate={onNavigate} />
        </div>
      </Card>

      <section className="section" aria-labelledby="rotas">
        <SectionHead id="rotas" title="Rotas" meta={`média em ${range.label.toLowerCase()} · SLO ${SLO_MS} ms`}>
          <InspectButton
            title="Rotas"
            onClick={() =>
              onInspect({
                title: 'Tráfego e latência por rota',
                queries: [PROMQL.routes, PROMQL.routeP95],
                table: {
                  columns: [
                    { key: 'path', name: 'Rota', format: (v) => v },
                    { key: 'rps', name: 'Tráfego', format: fmtRps },
                    { key: 'p95', name: 'p95', format: fmtMs },
                  ],
                  rows: ROUTES.map((r) => ({ path: r.path, rps: means[r.rps], p95: means[r.p95] ?? 0 })),
                },
              })
            }
          />
        </SectionHead>
        <Card className="routes">
          <Reveal className="routes-table" role="table" aria-label="Tráfego e latência por rota">
            <div className="rt-row rt-head" role="row">
              <span role="columnheader">Rota</span>
              <span role="columnheader" className="num">
                Tráfego
              </span>
              <span role="columnheader">Parte do tráfego</span>
              <span role="columnheader" className="num">
                p50
              </span>
              <span role="columnheader" className="num">
                p95
              </span>
              <span role="columnheader">p95 por hora, últimas 24 h</span>
            </div>
            {ROUTES.map((r, ri) => {
              const share = totalRps ? (means[r.rps] / totalRps) * 100 : 0
              const p95 = means[r.p95]
              const row = heatmap?.rows.find((h) => h.path === r.path)
              return (
                <div className="rt-row" role="row" key={r.path}>
                  <span role="cell" className="rt-route">
                    {r.path}
                  </span>
                  <span role="cell" className="num">
                    {num.format(means[r.rps])}
                    <span className="unit">req/s</span>
                  </span>
                  <span role="cell" className="rt-share">
                    <span className="share-track">
                      <span style={{ width: `${share}%`, '--row': ri }} />
                    </span>
                    <span className="num">{num.format(share)}%</span>
                  </span>
                  <span role="cell" className="num">
                    {means[r.p50] == null ? <span className="dash">–</span> : fmtMs(means[r.p50])}
                  </span>
                  <span role="cell" className={p95 > SLO_MS ? 'num tone-bad' : 'num'}>
                    {p95 == null ? <span className="dash">–</span> : fmtMs(p95)}
                  </span>
                  <span role="cell" className="rt-heat">
                    {row ? (
                      <HeatStrip
                        values={row.values}
                        hours={heatmap.hours}
                        format={fmtMs}
                        label={`p95 de ${r.path} por hora`}
                        row={ri}
                        marker={deployInfo ? { t: deployInfo.t, label: `deploy ${deployInfo.version}` } : null}
                      />
                    ) : (
                      <span className="dash">–</span>
                    )}
                  </span>
                </div>
              )
            })}
            {heatmap && (
              <div className="rt-row rt-foot" role="row">
                <span role="cell" className="rt-legend">
                  <HeatLegend />
                  {deployInfo && (
                    <span className="deploy-key">
                      <i />
                      deploy {deployInfo.version} às {formatTime(deployInfo.t)}
                    </span>
                  )}
                </span>
                <span role="cell" className="rt-heat">
                  <HeatHours hours={heatmap.hours} />
                </span>
              </div>
            )}
          </Reveal>
        </Card>
      </section>

      <section className="section" aria-labelledby="tempo">
        <SectionHead id="tempo" title="Tempo de resposta" meta={`histograma do Micrometer · ${range.label.toLowerCase()}`} />
        <div className="split">
          <Card className="ladder-card">
            <div className="figure-head">
              <p className="figure">
                {num.format(slo)}
                <span className="unit">%</span>
              </p>
              <div>
                <p>das requisições responderam em até {SLO_MS} ms</p>
                <Delta current={slo} previous={sloPrev} better="up" stable={0.1} />
              </div>
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
            </div>
            <LatencyLadder key={rangeId} bands={latency} total={data.totalRequests} highlight={p95Band} slo={SLO_MS} formatCount={fmtCount} />
          </Card>

          <Card className="side-card">
            <h3>Respostas por status</h3>
            <ShareBar items={STATUS.map((s) => ({ name: s.name, value: means[s.key], color: s.color }))} label="Parte das respostas por classe de status" />
            <ul className="kv">
              {STATUS.map((s) => (
                <li key={s.key}>
                  <span className="legend-key bar" style={{ '--key': s.color }} />
                  <span>{s.name}</span>
                  <span className="num muted">{fmtCount(data.totalRequests * (statusTotal ? means[s.key] / statusTotal : 0))}</span>
                  <span className="num">{fmtPctAxis(statusTotal ? (means[s.key] / statusTotal) * 100 : 0)}</span>
                </li>
              ))}
            </ul>

            <h3 className="side-sub">De onde vêm os números</h3>
            <ul className="pipeline">
              <li>
                <strong>API</strong>
                <span className="muted">
                  {data.instancesTotal} réplicas expõem /actuator/prometheus
                </span>
              </li>
              <li>
                <strong>Prometheus</strong>
                <span className="muted">coleta a cada {SCRAPE_INTERVAL_S} s e guarda o histórico</span>
              </li>
              <li>
                <strong>Grafana e este painel</strong>
                <span className="muted">consultam com PromQL</span>
              </li>
            </ul>
            <button type="button" className="text-btn" onClick={() => onInspect({ title: 'Consultas PromQL do painel', queries: allQueries })}>
              Ver as {allQueries.length} consultas PromQL
              <IconArrowRight size={14} />
            </button>
          </Card>
        </div>
      </section>
    </>
  )
}
