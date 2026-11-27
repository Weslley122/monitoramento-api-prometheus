import { useState } from 'react'
import LineChart from './charts/LineChart.jsx'
import { DEPLOY_WINDOWS, SLO_MS } from './engine.js'
import { LINKS, fmtInt, fmtMs, fmtPct, fmtPctAxis, fmtRps, formatRange, formatTime, int, num, timeColumns } from './format.js'
import { IconCode, IconExternal } from './icons.jsx'
import { PROMQL } from './queries.js'
import { Card, Delta, Legend, LinkButton, MetricTabs, PageHead, SectionHead, Segmented } from './ui.jsx'

const pctChange = (a, b) => ((b - a) / a) * 100
const duration = (ms) => (ms < 60000 ? `${Math.round(ms / 1000)} s` : `${num.format(ms / 60000)} min`)

function Reproduce() {
  return (
    <section className="section" aria-labelledby="reproduzir">
      <SectionHead id="reproduzir" title="Como reproduzir com a stack real" meta="o deploy é detectado pelo rótulo version" />
      <Card className="steps-strip">
        <ol>
          <li>
            <strong>Suba a versão antiga</strong>
            <span>
              No <code>.env</code>, use <code>APP_VERSION=v1.3.0</code> e <code>PEDIDOS_CONSULTA_OTIMIZADA=false</code> e
              rode <code>docker compose up -d</code>.
            </span>
          </li>
          <li>
            <strong>Deixe formar o antes</strong>
            <span>Espere uns 15 minutos com o gerador de carga ligado. É essa janela que vira a referência.</span>
          </li>
          <li>
            <strong>Publique a v1.4.0</strong>
            <span>
              Troque para <code>v1.4.0</code> e <code>true</code> e rode <code>docker compose up -d api</code>. A linha do
              deploy aparece sozinha.
            </span>
          </li>
        </ol>
      </Card>
    </section>
  )
}

function WindowPicker({ windowId, onWindow, onChange }) {
  return (
    <>
      <Segmented
        label="Janela"
        options={DEPLOY_WINDOWS}
        value={windowId}
        onChange={(id) => {
          onChange?.()
          onWindow(id)
        }}
      />
      <LinkButton icon={IconExternal} href={`${LINKS.grafana}/d/deploy-pedidos`}>
        Abrir no Grafana
      </LinkButton>
    </>
  )
}

export default function DeployDashboard({ deploy, windowId, onWindow, onInspect }) {
  const [hover, setHover] = useState(null)
  const [metric, setMetric] = useState('p95')
  const { info, data, cmp } = deploy

  // Ainda não houve troca de versão nas últimas 24 h (modo Prometheus).
  if (!info) {
    return (
      <>
        <PageHead title="Antes e depois do deploy" lead="Nenhuma troca de versão da API nas últimas 24 horas.">
          <WindowPicker windowId={windowId} onWindow={onWindow} />
        </PageHead>
        <Card className="empty-state">
          <h2>Nenhum deploy encontrado</h2>
          <p className="muted">
            Esta tela compara a rota /pedidos antes e depois de uma versão nova. Ela aparece quando o Prometheus vê um
            valor novo no rótulo <code>version</code> das métricas da API.
          </p>
        </Card>
        <Reproduce />
      </>
    )
  }

  const rolloutEnd = info.t + info.rolloutMs
  const p95Change = pctChange(cmp.before.p95, cmp.after.p95)
  const rpsChange = pctChange(cmp.before.rps, cmp.after.rps)
  const stableTraffic = Math.abs(rpsChange) < 5

  const lead = !cmp.hasAfter
    ? `A ${info.version} entrou no ar às ${formatTime(info.t)}. Ainda coletando dados depois do deploy.`
    : `Na rota /pedidos, o p95 ${p95Change < 0 ? 'caiu' : 'subiu'} de ${fmtMs(cmp.before.p95)} para ${fmtMs(cmp.after.p95)} (${
        p95Change < 0 ? '−' : '+'
      }${num.format(Math.abs(p95Change))}%)${stableTraffic ? ', com o tráfego estável' : ''}.`

  const verdict = !cmp.hasAfter
    ? 'Ainda coletando dados depois do deploy.'
    : p95Change < -5
      ? `Sim. A rota ficou ${num.format(-p95Change)}% mais rápida.`
      : p95Change > 5
        ? `Sim. A rota ficou ${num.format(p95Change)}% mais lenta.`
        : 'Não mudou de forma relevante.'
  const traffic = stableTraffic
    ? 'O tráfego ficou estável, então a diferença vem da versão nova, não da carga.'
    : rpsChange > 0
      ? `O tráfego subiu ${num.format(rpsChange)}%, então a melhora não vem de menos carga.`
      : `O tráfego caiu ${num.format(-rpsChange)}%, o que pode explicar parte da diferença.`

  const levelsFor = (before, after, format) =>
    cmp.hasAfter
      ? [
          { from: data.from, to: info.t, value: before, label: `antes ${format(before)}` },
          { from: rolloutEnd, to: data.to, value: after, label: `depois ${format(after)}`, tone: 'accent' },
        ]
      : []

  const charts = {
    p95: {
      title: 'Tempo de resposta de /pedidos (p50 e p95)',
      series: [
        { key: 'pedP50', name: 'p50', color: 'var(--mark-2)' },
        { key: 'pedP95', name: 'p95', color: 'var(--accent)' },
      ],
      format: fmtMs,
      axisFormat: fmtInt,
      references: [{ value: SLO_MS, label: `SLO ${SLO_MS} ms` }],
      levels: levelsFor(cmp.before.p95, cmp.after.p95, fmtMs),
      queries: [PROMQL.pedP50, PROMQL.pedP95, PROMQL.deploys],
    },
    err: {
      title: 'Erros 5xx em /pedidos',
      series: [{ key: 'pedErr', name: 'Erros 5xx', color: 'var(--bad)' }],
      format: fmtPct,
      axisFormat: fmtPctAxis,
      references: [],
      levels: levelsFor(cmp.before.errorPct, cmp.after.errorPct, fmtPct),
      queries: [PROMQL.pedErr],
    },
    rps: {
      title: 'Tráfego de /pedidos (o controle)',
      series: [{ key: 'rPedidos', name: 'Tráfego', color: 'var(--mark-1)' }],
      format: fmtRps,
      axisFormat: fmtInt,
      references: [],
      levels: levelsFor(cmp.before.rps, cmp.after.rps, fmtRps),
      queries: [PROMQL.routes],
    },
    instances: {
      title: 'Instâncias respondendo durante o rollout',
      series: [{ key: 'instances', name: 'Instâncias', color: 'var(--accent)' }],
      format: (v) => num.format(v),
      axisFormat: fmtInt,
      references: [],
      levels: [],
      queries: [PROMQL.instances],
    },
  }
  const c = charts[metric]

  const tabs = [
    {
      id: 'p95',
      label: 'p95 de /pedidos',
      value: int.format(cmp.after.p95 ?? 0),
      unit: 'ms',
      foot: <Delta current={cmp.after.p95} previous={cmp.before.p95} better="down" stable={5} suffix={`vs ${fmtMs(cmp.before.p95)} antes`} />,
    },
    {
      id: 'err',
      label: 'Erros 5xx em /pedidos',
      value: num.format(cmp.after.errorPct),
      unit: '%',
      foot: <Delta current={cmp.after.errorPct} previous={cmp.before.errorPct} better="down" stable={5} suffix={`vs ${fmtPct(cmp.before.errorPct)} antes`} />,
    },
    {
      id: 'rps',
      label: 'Tráfego de /pedidos',
      value: num.format(cmp.after.rps),
      unit: 'req/s',
      foot: <Delta current={cmp.after.rps} previous={cmp.before.rps} better={null} stable={5} suffix={`vs ${num.format(cmp.before.rps)} antes`} />,
    },
    {
      id: 'instances',
      label: 'Mínimo no rollout',
      value: `${cmp.minInstances ?? data.instancesTotal}`,
      unit: `de ${data.instancesTotal}`,
      foot: (
        <p className="delta muted">
          {duration(info.rolloutMs)}, das {formatTime(info.t)} às {formatTime(rolloutEnd)}
        </p>
      ),
    },
  ]

  return (
    <>
      <PageHead
        title={`Deploy ${info.version}`}
        lead={lead}
        meta={`Antes: ${info.previous} · publicado às ${formatTime(info.t)} · janela ${formatRange(data.from, data.to)}`}
      >
        <WindowPicker windowId={windowId} onWindow={onWindow} onChange={() => setHover(null)} />
      </PageHead>

      <Card className="board" aria-label="Rota /pedidos antes e depois do deploy">
        <MetricTabs label="Escolha o número para ver no gráfico" items={tabs} value={metric} onChange={setMetric} />
        <div className="board-body">
          <div className="board-main">
            <div className="chart-head">
              <h3>{c.title}</h3>
              <Legend
                items={[
                  ...c.series.map((s) => ({ ...s, kind: 'line' })),
                  ...(c.levels.length ? [{ key: 'lv', name: 'média antes e depois', color: 'var(--mark-2)', kind: 'dash' }] : []),
                  { key: 'ro', name: 'rollout', color: 'var(--mark-3)', kind: 'span' },
                ]}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={`Ver PromQL e dados: ${c.title}`}
                title="Ver PromQL e dados"
                onClick={() =>
                  onInspect({
                    title: c.title,
                    queries: c.queries,
                    table: { columns: timeColumns(c.series, c.format), rows: data.points },
                  })
                }
              >
                <IconCode size={16} />
              </button>
            </div>
            <LineChart
              key={`${metric}-${windowId}`}
              points={data.points}
              from={data.from}
              to={data.to}
              series={c.series}
              format={c.format}
              axisFormat={c.axisFormat}
              references={c.references}
              levels={c.levels}
              spans={[{ from: info.t, to: rolloutEnd }]}
              annotations={[{ t: info.t, label: `deploy ${info.version}` }]}
              hover={hover}
              onHover={setHover}
              height={268}
              label={c.title}
            />
          </div>

          <aside className="board-side verdict" aria-labelledby="veredito">
            <h3 id="veredito">O comportamento mudou?</h3>
            <p className="verdict-answer">{verdict}</p>
            {cmp.hasAfter && (
              <p className="muted">
                O p95 foi de {fmtMs(cmp.before.p95)} para {fmtMs(cmp.after.p95)} e os erros 5xx de{' '}
                {fmtPct(cmp.before.errorPct)} para {fmtPct(cmp.after.errorPct)}. {traffic}
              </p>
            )}
            <ul className="events">
              <li className="event">
                <span className="event-time">{formatTime(info.t)}</span>
                <span className="event-text">
                  A {info.version} começa a responder no lugar da {info.previous}.
                </span>
              </li>
              <li className="event bad">
                <span className="event-time">
                  {formatTime(info.t)} às {formatTime(rolloutEnd)}
                </span>
                <span className="event-text">
                  Rollout com {cmp.minInstances ?? data.instancesTotal} de {data.instancesTotal} instâncias no mínimo e
                  pico de {fmtPct(cmp.rolloutPeakError)} de erros.
                </span>
              </li>
              <li className="event good">
                <span className="event-time">{formatTime(rolloutEnd)}</span>
                <span className="event-text">
                  Rollout concluído{cmp.hasAfter ? `; p95 perto de ${fmtMs(cmp.after.p95)}.` : '.'}
                </span>
              </li>
            </ul>
            <p className="side-foot">As médias deixam de fora os {duration(info.rolloutMs)} de rollout.</p>
          </aside>
        </div>
      </Card>

      <Reproduce />
    </>
  )
}
