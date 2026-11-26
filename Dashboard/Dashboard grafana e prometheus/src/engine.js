// Transforma coletas (pontos no tempo) nos números que as telas mostram.
// Serve tanto para os dados simulados quanto para os vindos do Prometheus.

export const SCRAPE_INTERVAL_S = 15
export const SLO_MS = 300 // limite de latência considerado "lento"

export const ROUTES = [
  { id: 'produtos', path: '/produtos', rps: 'rProdutos', p50: 'prodP50', p95: 'prodP95' },
  { id: 'pedidos', path: '/pedidos', rps: 'rPedidos', p50: 'pedP50', p95: 'pedP95' },
  { id: 'usuarios', path: '/usuarios', rps: 'rUsuarios', p50: 'usuP50', p95: 'usuP95' },
]

// Faixas de latência, iguais aos buckets exatos configurados na API (le).
export const LATENCY_BANDS = [
  { label: 'até 50 ms', lo: 0, hi: 50 },
  { label: '50 a 100 ms', lo: 50, hi: 100 },
  { label: '100 a 200 ms', lo: 100, hi: 200 },
  { label: '200 a 300 ms', lo: 200, hi: 300 },
  { label: 'acima de 300 ms', lo: 300, hi: Infinity },
]

export const RANGES = [
  { id: '15m', short: '15M', label: 'Últimos 15 minutos', ms: 15 * 60 * 1000 },
  { id: '1h', short: '1H', label: 'Última hora', ms: 60 * 60 * 1000 },
  { id: '6h', short: '6H', label: 'Últimas 6 horas', ms: 6 * 60 * 60 * 1000 },
  { id: '24h', short: '24H', label: 'Últimas 24 horas', ms: 24 * 60 * 60 * 1000 },
]

export const DEPLOY_WINDOWS = [
  { id: '30m', short: '±30M', label: '30 min antes e depois', ms: 30 * 60 * 1000 },
  { id: '1h', short: '±1H', label: '1 hora antes e depois', ms: 60 * 60 * 1000 },
  { id: '3h', short: '±3H', label: '3 horas antes e depois', ms: 3 * 60 * 60 * 1000 },
]

// Campos de cada ponto (além de t).
export const FIELDS = [
  'rps',
  'p50',
  'p95',
  'err5xx',
  'r2xx',
  'r4xx',
  'r5xx',
  'rProdutos',
  'rPedidos',
  'rUsuarios',
  'prodP50',
  'prodP95',
  'pedP50',
  'pedP95',
  'usuP50',
  'usuP95',
  'pedErr',
  'instances',
]

// Campos que não existem sem tráfego/coleta (diferente de "zero").
const NULLABLE = new Set(['p50', 'p95', 'prodP50', 'prodP95', 'pedP50', 'pedP95', 'usuP50', 'usuP95', 'instances'])

// Média ignorando valores ausentes (ex.: quantil sem tráfego).
function mean(raw, k) {
  let sum = 0
  let n = 0
  for (const p of raw) {
    if (Number.isFinite(p[k])) {
      sum += p[k]
      n++
    }
  }
  return n ? sum / n : NULLABLE.has(k) ? null : 0
}

export function means(raw) {
  const m = {}
  for (const k of FIELDS) m[k] = mean(raw, k)
  // Taxas de erro ponderadas pelo volume, como o PromQL faz com sum()/sum().
  const total = raw.reduce((s, p) => s + p.rps, 0)
  m.err5xx = total ? (100 * raw.reduce((s, p) => s + p.r5xx, 0)) / total : 0
  const ped = raw.reduce((s, p) => s + p.rPedidos, 0)
  m.pedErr = ped ? raw.reduce((s, p) => s + p.rPedidos * p.pedErr, 0) / ped : 0
  return m
}

/** Agrupa os pontos em até `count` baldes, como o "step" de uma consulta range. */
export function bucketize(raw, count) {
  const size = Math.max(1, Math.ceil(raw.length / count))
  const out = []
  for (let i = 0; i < raw.length; i += size) {
    const slice = raw.slice(i, i + size)
    out.push({ t: slice[slice.length - 1].t, from: slice[0].t, ...means(slice) })
  }
  return out
}

/** Regras de alerta parecidas com as que se escreveriam no Prometheus. */
export function detectAlerts(points, instancesTotal) {
  const rules = [
    { id: 'latency', test: (p) => p.p95 > SLO_MS, key: 'p95', title: `Latência p95 acima de ${SLO_MS} ms` },
    { id: 'errors', test: (p) => p.err5xx > 1, key: 'err5xx', title: 'Erros 5xx acima de 1%' },
    {
      id: 'instances',
      test: (p) => p.instances != null && p.instances < instancesTotal - 0.5,
      key: 'instances',
      title: 'Instância fora do ar',
    },
  ]
  const alerts = []
  for (const rule of rules) {
    let run = null
    for (const p of points) {
      if (rule.test(p)) {
        run ??= { ...rule, from: p.from ?? p.t, to: p.t, peak: p[rule.key] }
        run.to = p.t
        run.peak = rule.id === 'instances' ? Math.min(run.peak, p[rule.key]) : Math.max(run.peak, p[rule.key])
      } else if (run) {
        alerts.push(run)
        run = null
      }
    }
    if (run) alerts.push(run)
  }
  return alerts.sort((a, b) => b.from - a.from)
}

const MAX_POINTS = 240

/**
 * Monta a "janela" que as telas usam a partir dos pontos brutos.
 * raw/previousRaw: pontos com intervalo `rawStepS` segundos entre si.
 */
export function buildWindow({ from, to, raw, previousRaw = [], rawStepS, latency, previousLatency, instancesTotal }) {
  const perAlert = Math.max(1, Math.round(60 / rawStepS)) // alertas em janelas de ~1 min
  return {
    from,
    to,
    stepSeconds: Math.max(1, Math.ceil(raw.length / MAX_POINTS)) * rawStepS,
    points: bucketize(raw, MAX_POINTS),
    bars: bucketize(raw, 32),
    peakBars: bucketize(raw, 16),
    latest: raw.findLast((p) => p.instances != null) ?? raw[raw.length - 1],
    // Mínimo nas coletas brutas (as médias por balde escondem a queda).
    minInstances: raw.filter((p) => p.instances != null).reduce((m, p) => (!m || p.instances < m.instances ? p : m), null),
    instancesTotal,
    means: means(raw),
    previous: previousRaw.length ? means(previousRaw) : null,
    totalRequests: raw.reduce((s, p) => s + p.rps * rawStepS, 0),
    latency,
    previousLatency,
    alerts: detectAlerts(bucketize(raw, Math.ceil(raw.length / perAlert)), instancesTotal),
  }
}

// Médias da rota /pedidos; a taxa de erro é ponderada pelo volume.
function summarizePedidos(raw) {
  const m = means(raw)
  return { rps: m.rPedidos, p95: m.pedP95, errorPct: m.pedErr }
}

/** Compara a janela antes do deploy com a janela depois, sem o rollout. */
export function compareDeploy(raw, deploy) {
  const rolloutEnd = deploy.t + deploy.rolloutMs
  const rollout = raw.filter((p) => p.t > deploy.t && p.t <= rolloutEnd)
  // Só pontos com tráfego: períodos com a API fora do ar não entram nas médias.
  const before = raw.filter((p) => p.t <= deploy.t && p.rps > 0)
  const after = raw.filter((p) => p.t > rolloutEnd && p.rps > 0)
  return {
    before: summarizePedidos(before),
    after: summarizePedidos(after),
    hasAfter: after.length > 0,
    rolloutPeakError: rollout.length ? Math.max(...rollout.map((p) => p.pedErr)) : 0,
    minInstances: rollout.some((p) => p.instances != null)
      ? Math.min(...rollout.filter((p) => p.instances != null).map((p) => p.instances))
      : null,
  }
}

/** Gera o CSV da janela atual (botão "Exportar CSV"). */
export function toCsv(points) {
  const cols = ['t', 'rps', 'p50', 'p95', 'err5xx', 'r2xx', 'r4xx', 'r5xx', 'rProdutos', 'rPedidos', 'rUsuarios', 'instances']
  const head = ['horario', ...cols.slice(1)].join(';')
  const rows = points.map((p) =>
    cols.map((c) => (c === 't' ? new Date(p.t).toISOString() : (p[c] ?? 0).toFixed(3).replace('.', ','))).join(';'),
  )
  return [head, ...rows].join('\n')
}
