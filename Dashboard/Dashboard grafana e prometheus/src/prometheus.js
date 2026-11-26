// Fonte de dados REAL: consulta a API HTTP do Prometheus.
// O Vite encaminha /prometheus para o Prometheus (ver vite.config.js), então
// não há problema de CORS e o endereço pode ser trocado sem mexer no código.
import { FIELDS, LATENCY_BANDS, ROUTES, SCRAPE_INTERVAL_S, buildWindow, compareDeploy } from './engine.js'

export const PROMETHEUS_BASE = '/prometheus'

const JOB = 'job="api-spring-boot"'
const F = `${JOB}, uri!~"/actuator.*"`
const COUNT = `http_server_requests_seconds_count{${F}}`
const BUCKET = `http_server_requests_seconds_bucket{${F}}`

async function api(path, params, signal) {
  const res = await fetch(`${PROMETHEUS_BASE}/api/v1/${path}?${new URLSearchParams(params)}`, { signal })
  if (!res.ok && res.status !== 400 && res.status !== 422) throw new Error(`Prometheus respondeu HTTP ${res.status}`)
  const body = await res.json().catch(() => null)
  if (!body) throw new Error('Resposta inválida (o Prometheus está no ar?)')
  if (body.status !== 'success') throw new Error(body.error || 'Erro na consulta PromQL')
  return body.data
}

const rangeQuery = (query, start, end, step, signal) =>
  api('query_range', { query, start: start / 1000, end: end / 1000, step }, signal).then((d) => d.result)

const instantQuery = (query, time, signal) =>
  api('query', { query, time: time / 1000 }, signal).then((d) => d.result)

/** Testa a conexão; devolve a versão do Prometheus. */
export async function ping(signal) {
  const data = await api('status/buildinfo', {}, signal)
  return data.version
}

// Janela do rate(): parecida com o $__rate_interval do Grafana.
const rateWindow = (step) => `${Math.max(60, step + SCRAPE_INTERVAL_S)}s`
const stepFor = (spanMs) => Math.max(SCRAPE_INTERVAL_S, Math.ceil(spanMs / 1000 / 240 / SCRAPE_INTERVAL_S) * SCRAPE_INTERVAL_S)
const routeByUri = Object.fromEntries(ROUTES.map((r) => [r.path, r]))

/**
 * Busca todas as séries de [start, end] e monta pontos alinhados por horário,
 * no mesmo formato dos pontos simulados.
 */
async function fetchPoints(start, end, step, signal) {
  const w = rateWindow(step)
  const q = (query) => rangeQuery(query, start, end, step, signal)
  const [byUriStatus, p50, p95, uriP50, uriP95, up] = await Promise.all([
    q(`sum by (uri, status) (rate(${COUNT}[${w}]))`),
    q(`histogram_quantile(0.5, sum by (le) (rate(${BUCKET}[${w}])))`),
    q(`histogram_quantile(0.95, sum by (le) (rate(${BUCKET}[${w}])))`),
    q(`histogram_quantile(0.5, sum by (le, uri) (rate(${BUCKET}[${w}])))`),
    q(`histogram_quantile(0.95, sum by (le, uri) (rate(${BUCKET}[${w}])))`),
    q(`count(up{${JOB}} == 1)`),
  ])

  const points = new Map()
  for (let t = start; t <= end; t += step * 1000) {
    const p = { t }
    for (const k of FIELDS) p[k] = 0
    p.ped5xx = 0
    for (const k of ['p50', 'p95', 'prodP50', 'prodP95', 'pedP50', 'pedP95', 'usuP50', 'usuP95', 'instances']) p[k] = null
    points.set(t, p)
  }
  const each = (series, fn) => {
    for (const s of series) {
      for (const [ts, v] of s.values) {
        const p = points.get(Math.round(ts * 1000))
        const n = Number(v)
        if (p && Number.isFinite(n)) fn(p, n, s.metric)
      }
    }
  }

  // Volume: total, por classe de status e por rota.
  each(byUriStatus, (p, v, m) => {
    p.rps += v
    const cls = String(m.status ?? '')[0]
    if (cls === '2') p.r2xx += v
    if (cls === '4') p.r4xx += v
    if (cls === '5') p.r5xx += v
    const route = routeByUri[m.uri]
    if (route) {
      p[route.rps] += v
      if (route.id === 'pedidos' && cls === '5') p.ped5xx += v
    }
  })
  // Quantis em ms.
  each(p50, (p, v) => (p.p50 = v * 1000))
  each(p95, (p, v) => (p.p95 = v * 1000))
  each(uriP50, (p, v, m) => routeByUri[m.uri] && (p[routeByUri[m.uri].p50] = v * 1000))
  each(uriP95, (p, v, m) => routeByUri[m.uri] && (p[routeByUri[m.uri].p95] = v * 1000))
  each(up, (p, v) => (p.instances = v))

  const list = [...points.values()]
  const last = {}
  for (const p of list) {
    p.err5xx = p.rps ? (100 * p.r5xx) / p.rps : 0
    p.pedErr = p.rPedidos ? (100 * p.ped5xx) / p.rPedidos : 0
    delete p.ped5xx
    // Sem tráfego, o quantil não existe: repete o último valor conhecido.
    for (const k of ['p50', 'p95', 'prodP50', 'prodP95', 'pedP50', 'pedP95', 'usuP50', 'usuP95']) {
      if (p[k] == null) p[k] = last[k] ?? null
      else last[k] = p[k]
    }
  }
  return list
}

/** Distribuição por faixa a partir dos buckets cumulativos (le) do histograma. */
async function fetchLatency(time, spanMs, signal, offsetMs = 0) {
  const span = `${Math.round(spanMs / 1000)}s`
  const offset = offsetMs ? ` offset ${Math.round(offsetMs / 1000)}s` : ''
  const res = await instantQuery(`sum by (le) (increase(${BUCKET}[${span}]${offset}))`, time, signal)
  const cumulative = res
    .map((s) => ({ le: s.metric.le === '+Inf' ? Infinity : Number(s.metric.le) * 1000, v: Number(s.value[1]) }))
    .sort((a, b) => a.le - b.le)
  const total = cumulative.find((c) => c.le === Infinity)?.v ?? 0
  if (!total) return null
  // Contagem acumulada até `ms`: o maior bucket com le <= ms (a API tem buckets exatos nas faixas).
  const upTo = (ms) => {
    if (ms === Infinity) return total
    let v = 0
    for (const c of cumulative) if (c.le <= ms * 1.001) v = c.v
    return v
  }
  return LATENCY_BANDS.map((b) => ({ ...b, share: (upTo(b.hi) - upTo(b.lo)) / total }))
}

async function instancesTotal(time, signal) {
  const res = await instantQuery(`count(up{${JOB}})`, time, signal)
  return Number(res[0]?.value[1] ?? 0)
}

/** Janela [from, to] com o período anterior, igual à fonte simulada. */
async function windowOf(from, to, signal) {
  const span = to - from
  const step = stepFor(span)
  const alignedTo = Math.floor(to / (step * 1000)) * step * 1000
  const alignedFrom = alignedTo - span
  const [all, latency, previousLatency, total] = await Promise.all([
    fetchPoints(alignedFrom - span, alignedTo, step, signal),
    fetchLatency(alignedTo, span, signal),
    fetchLatency(alignedTo, span, signal, span),
    instancesTotal(alignedTo, signal),
  ])
  const raw = all.filter((p) => p.t > alignedFrom)
  const previousRaw = all.filter((p) => p.t <= alignedFrom && p.rps > 0)
  return {
    window: buildWindow({
      from: alignedFrom,
      to: alignedTo,
      raw,
      previousRaw,
      rawStepS: step,
      latency: latency ?? LATENCY_BANDS.map((b) => ({ ...b, share: 0 })),
      previousLatency,
      instancesTotal: Math.max(total, ...raw.map((p) => p.instances ?? 0)),
    }),
    raw,
  }
}

/**
 * Procura o deploy mais recente: o momento em que uma versão nova começou a
 * aparecer no rótulo "version" das métricas (o mesmo critério da anotação do Grafana).
 */
async function findDeploy(now, signal) {
  const start = now - 24 * 3600 * 1000
  const step = 30
  const series = await rangeQuery(`count by (version) (process_start_time_seconds{${JOB}})`, start, now, step, signal)
  const versions = series
    .map((s) => ({
      version: s.metric.version,
      first: s.values[0][0] * 1000,
      last: s.values[s.values.length - 1][0] * 1000,
    }))
    .sort((a, b) => a.first - b.first)
  // Uma versão que já existia no começo da janela não é um deploy visível.
  const deployed = versions.filter((v) => v.first > start + step * 1000)
  const latest = deployed[deployed.length - 1]
  if (!latest) return null
  const previous = versions.filter((v) => v.version !== latest.version && v.first < latest.first).pop()
  if (!previous) return null
  // Rollout: enquanto as duas versões respondem juntas (no mínimo uma coleta).
  const rolloutMs = Math.max(SCRAPE_INTERVAL_S * 1000, previous.last - latest.first)
  return { t: latest.first, version: latest.version, previous: previous.version, rolloutMs }
}

export const prometheus = {
  async overview(rangeMs, signal) {
    const now = Date.now()
    return (await windowOf(now - rangeMs, now, signal)).window
  },

  async heatmap(signal) {
    const end = Math.floor(Date.now() / 60000) * 60000 // até agora (a última hora ainda está em andamento)
    const start = end - 23 * 3600000
    const res = await rangeQuery(
      `histogram_quantile(0.95, sum by (le, uri) (rate(${BUCKET}[1h])))`,
      start,
      end,
      3600,
      signal,
    )
    const hours = Array.from({ length: 24 }, (_, i) => start + i * 3600000)
    return {
      // Cada valor cobre a hora que termina no horário da coleta.
      hours: hours.map((h) => h - 3600000),
      rows: ROUTES.map((r) => {
        const s = res.find((x) => x.metric.uri === r.path)
        const byT = new Map((s?.values ?? []).map(([ts, v]) => [Math.round(ts * 1000), Number(v) * 1000]))
        return { ...r, values: hours.map((h) => (Number.isFinite(byT.get(h)) ? byT.get(h) : null)) }
      }),
    }
  },

  async deploy(windowMs, signal) {
    const now = Date.now()
    const info = await findDeploy(now, signal)
    if (!info) return { info: null, data: null, cmp: null }
    const { window, raw } = await windowOf(info.t - windowMs, Math.min(now, info.t + windowMs), signal)
    return { info, data: window, cmp: compareDeploy(raw, info) }
  },
}
