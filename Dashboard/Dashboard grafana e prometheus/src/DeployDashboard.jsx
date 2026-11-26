import { useState } from 'react'
import LineChart from './charts/LineChart.jsx'
import { MiniBars } from './charts/bars.jsx'
import { DEPLOY_WINDOWS } from './engine.js'
import { LINKS, fmtMs, fmtPct, fmtPctAxis, fmtRps, formatRange, formatTime, num, timeColumns } from './format.js'
import { IconActivity, IconAlert, IconCode, IconExternal, IconRocket, IconServer, IconTimer } from './icons.jsx'
import { PROMQL } from './queries.js'
import { Card, CardLabel, Delta, Legend, LinkButton, Segmented } from './ui.jsx'

const LATENCY = [
  { key: 'pedP50', name: 'p50', color: 'var(--mark-2)' },
  { key: 'pedP95', name: 'p95', color: 'var(--mark-1)' },
]
const ERRORS = [{ key: 'pedErr', name: 'Erros 5xx', color: 'var(--error-mark)' }]
const pctChange = (a, b) => ((b - a) / a) * 100
const minutes = (ms) => (ms < 60000 ? `${Math.round(ms / 1000)} s` : `${num.format(ms / 60000)} min`)

function CompareCard({ icon, title, before, after, format, better, bars, barsLabel }) {
  return (
    <Card className="kpi">
      <div>
        <CardLabel icon={icon} title={title} />
        <p className="kpi-value">
          {format(after)}
          <span className="kpi-before"> antes {format(before)}</span>
        </p>
        <Delta current={after} previous={before} better={better} suffix="vs antes do deploy" stable={5} />
      </div>
      <MiniBars values={bars} label={barsLabel} />
    </Card>
  )
}

function ReproduceCard() {
  return (
    <Card>
      <CardLabel icon={IconCode} title="Como reproduzir com a stack real" />
      <ol className="steps">
        <li>
          No <code>.env</code>, use <code>APP_VERSION=v1.3.0</code> e <code>PEDIDOS_CONSULTA_OTIMIZADA=false</code>,
          depois <code>docker compose up -d</code>.
        </li>
        <li>Espere uns 15 minutos para formar o "antes".</li>
        <li>
          Troque para <code>v1.4.0</code> e <code>true</code> e rode <code>docker compose up -d api</code>.
        </li>
      </ol>
      <p className="muted small">
        O deploy é detectado sozinho quando uma versão nova aparece no rótulo <code>version</code> das métricas.
      </p>
    </Card>
  )
}

function WindowPicker({ windowId, onWindow, onChange }) {
  return (
    <div className="page-actions">
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
    </div>
  )
}

export default function DeployDashboard({ deploy, windowId, onWindow, onInspect }) {
  const [hover, setHover] = useState(null)
  const { info, data, cmp } = deploy

  // Ainda não houve troca de versão nas últimas 24 h (modo Prometheus).
  if (!info) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Antes e depois do deploy</h1>
            <p className="muted">Nenhuma troca de versão da API nas últimas 24 horas.</p>
          </div>
          <WindowPicker windowId={windowId} onWindow={onWindow} />
        </div>
        <div className="grid row-main">
          <Card className="empty-state">
            <IconRocket size={22} />
            <h2>Nenhum deploy encontrado</h2>
            <p className="muted">
              Esta tela compara a rota /pedidos antes e depois de uma versão nova. Ela aparece quando o Prometheus vê
              um valor novo no rótulo <code>version</code> das métricas da API.
            </p>
          </Card>
          <ReproduceCard />
        </div>
      </>
    )
  }

  const rolloutEnd = info.t + info.rolloutMs
  const p95Change = pctChange(cmp.before.p95, cmp.after.p95)
  const rpsChange = pctChange(cmp.before.rps, cmp.after.rps)
  const spark = (k) => data.bars.filter((_, i) => i % 2 === 0).map((b) => b[k])
  const faster = p95Change < -5
  const slower = p95Change > 5
  const verdict = !cmp.hasAfter
    ? 'Ainda coletando dados depois do deploy.'
    : faster
      ? `Sim, ficou ${num.format(-p95Change)}% mais rápida.`
      : slower
        ? `Sim, ficou ${num.format(p95Change)}% mais lenta.`
        : 'Não mudou de forma relevante.'
  const traffic =
    Math.abs(rpsChange) < 5
      ? 'O tráfego ficou estável, então a diferença vem da nova versão, não da carga.'
      : rpsChange > 0
        ? `O tráfego subiu ${num.format(rpsChange)}%, então a melhora não vem de menos carga.`
        : `O tráfego caiu ${num.format(-rpsChange)}%, o que pode explicar parte da diferença.`

  const chartProps = {
    points: data.points,
    from: data.from,
    to: data.to,
    annotations: [{ t: info.t, label: `deploy ${info.version}` }],
    hover,
    onHover: setHover,
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Deploy {info.version} · /pedidos</h1>
          <p className="muted">
            Antes: {info.previous} · publicado às {formatTime(info.t)} · {formatRange(data.from, data.to)}
          </p>
        </div>
        <WindowPicker windowId={windowId} onWindow={onWindow} onChange={() => setHover(null)} />
      </div>

      <div className="grid kpis">
        <CompareCard
          icon={IconTimer}
          title="Latência p95 /pedidos"
          before={cmp.before.p95}
          after={cmp.after.p95}
          format={fmtMs}
          better="down"
          bars={spark('pedP95')}
          barsLabel="p95 de /pedidos ao longo da janela"
        />
        <CompareCard
          icon={IconAlert}
          title="Erros 5xx /pedidos"
          before={cmp.before.errorPct}
          after={cmp.after.errorPct}
          format={fmtPct}
          better="down"
          bars={spark('pedErr')}
          barsLabel="Erros 5xx de /pedidos ao longo da janela"
        />
        <CompareCard
          icon={IconActivity}
          title="Tráfego /pedidos (controle)"
          before={cmp.before.rps}
          after={cmp.after.rps}
          format={fmtRps}
          better={null}
          bars={spark('rPedidos')}
          barsLabel="Tráfego de /pedidos ao longo da janela"
        />
        <Card className="kpi">
          <div>
            <CardLabel icon={IconServer} title="Instâncias no rollout" />
            <p className="kpi-value">
              {cmp.minInstances ?? data.instancesTotal} / {data.instancesTotal}
            </p>
            <p className="delta">
              <span className="delta-value tone-neutral">{minutes(info.rolloutMs)}</span>
              <span className="muted">
                {' '}
                das {formatTime(info.t)} às {formatTime(rolloutEnd)}
              </span>
            </p>
          </div>
          <MiniBars values={spark('instances')} label="Instâncias ativas ao longo da janela" />
        </Card>
      </div>

      <div className="grid row-main">
        <Card className="chart-card">
          <div className="chart-head">
            <div>
              <p className="headline">{fmtMs(cmp.after.p95)}</p>
              <p className="muted">p95 de /pedidos depois do deploy (antes: {fmtMs(cmp.before.p95)})</p>
              <Legend items={LATENCY} />
            </div>
            <div className="chart-head-side">
              <button
                type="button"
                className="icon-btn"
                aria-label="Ver PromQL e dados: tempo de resposta"
                title="Ver PromQL e dados"
                onClick={() =>
                  onInspect({
                    title: 'Tempo de resposta /pedidos',
                    queries: [PROMQL.pedP50, PROMQL.pedP95, PROMQL.deploys],
                    table: { columns: timeColumns(LATENCY, fmtMs), rows: data.points },
                  })
                }
              >
                <IconCode size={16} />
              </button>
              <Delta current={cmp.after.p95} previous={cmp.before.p95} better="down" suffix="vs antes" />
            </div>
          </div>
          <LineChart {...chartProps} label="Tempo de resposta de /pedidos" series={LATENCY} format={fmtMs} height={280} />
        </Card>

        <Card className="verdict">
          <CardLabel icon={IconRocket} title="O comportamento mudou?" />
          <p className="verdict-answer">{verdict}</p>
          {cmp.hasAfter && (
            <p className="muted">
              Na rota /pedidos, o p95 foi de {fmtMs(cmp.before.p95)} para {fmtMs(cmp.after.p95)} e os erros 5xx de{' '}
              {fmtPct(cmp.before.errorPct)} para {fmtPct(cmp.after.errorPct)}. {traffic}
            </p>
          )}
          <ol className="timeline">
            <li>
              <span className="tl-time">{formatTime(info.t)}</span>
              <span>A {info.version} começa a responder no lugar da {info.previous}.</span>
            </li>
            <li className="bad">
              <span className="tl-time">
                {formatTime(info.t)} às {formatTime(rolloutEnd)}
              </span>
              <span>
                Rollout: {cmp.minInstances ?? data.instancesTotal} de {data.instancesTotal} instâncias, pico de{' '}
                {fmtPct(cmp.rolloutPeakError)} de erros.
              </span>
            </li>
            <li className="good">
              <span className="tl-time">{formatTime(rolloutEnd)}</span>
              <span>
                Rollout concluído
                {cmp.hasAfter ? `; p95 perto de ${fmtMs(cmp.after.p95)}.` : '.'}
              </span>
            </li>
          </ol>
          <p className="muted small">As médias ignoram os {minutes(info.rolloutMs)} de rollout.</p>
        </Card>
      </div>

      <div className="grid row-main">
        <Card className="chart-card">
          <div className="chart-head">
            <div>
              <p className="headline">{fmtPct(cmp.after.errorPct)}</p>
              <p className="muted">Erros 5xx em /pedidos depois do deploy (antes: {fmtPct(cmp.before.errorPct)})</p>
            </div>
            <div className="chart-head-side">
              <button
                type="button"
                className="icon-btn"
                aria-label="Ver PromQL e dados: erros 5xx"
                title="Ver PromQL e dados"
                onClick={() =>
                  onInspect({
                    title: 'Erros HTTP 5xx /pedidos',
                    queries: [PROMQL.pedErr],
                    table: { columns: timeColumns(ERRORS, fmtPct), rows: data.points },
                  })
                }
              >
                <IconCode size={16} />
              </button>
              <Delta current={cmp.after.errorPct} previous={cmp.before.errorPct} better="down" suffix="vs antes" />
            </div>
          </div>
          <LineChart
            {...chartProps}
            label="Taxa de erros 5xx de /pedidos"
            series={ERRORS}
            format={fmtPct}
            axisFormat={fmtPctAxis}
            height={220}
          />
        </Card>

        <ReproduceCard />
      </div>
    </>
  )
}
