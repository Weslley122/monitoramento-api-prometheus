// Fonte de dados SIMULADA: imita o histórico que o Prometheus guardaria.
// Usada quando o Prometheus não está no ar (ou quando o usuário escolhe "Simulado").
import { LATENCY_BANDS, ROUTES, SCRAPE_INTERVAL_S, buildWindow, bucketize, compareDeploy } from './engine.js'

const HISTORY_HOURS = 48 // 24 h visíveis + 24 h para comparar com o período anterior
const INSTANCES_TOTAL = 3

// "Agora" da simulação: hoje às 15:00, para que o pico das 14:35 caia na última hora.
const NOW = (() => {
  const d = new Date()
  d.setHours(15, 0, 0, 0)
  return d.getTime()
})()

const SURGE_START = (() => {
  const d = new Date(NOW)
  d.setHours(14, 33, 0, 0)
  return d.getTime()
})()
const SURGE_END = SURGE_START + 4 * 60 * 1000
const SURGE_PEAK = (SURGE_START + SURGE_END) / 2 // 14:35

// Deploy da v1.4.0, que otimiza a consulta usada pela rota /pedidos.
const DEPLOY = (() => {
  const d = new Date(NOW)
  d.setHours(11, 20, 0, 0)
  return { t: d.getTime(), version: 'v1.4.0', previous: 'v1.3.0', rolloutMs: 2 * 60 * 1000 }
})()

const SHARES = { rProdutos: 0.516, rPedidos: 0.298, rUsuarios: 0.186 }

function deployProgress(t) {
  if (t < DEPLOY.t) return 0
  if (t >= DEPLOY.t + DEPLOY.rolloutMs) return 1
  return (t - DEPLOY.t) / DEPLOY.rolloutMs
}

// PRNG determinístico: o gráfico é o mesmo a cada recarga.
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function surgeFactor(t) {
  const sigma = (SURGE_END - SURGE_START) / 3
  return 1 + Math.exp(-((t - SURGE_PEAK) ** 2) / (2 * sigma ** 2))
}

function generate() {
  const rand = mulberry32(42)
  const noise = (amp) => 1 + (rand() + rand() + rand() - 1.5) * amp
  const count = (HISTORY_HOURS * 3600) / SCRAPE_INTERVAL_S
  const points = []

  for (let i = 0; i < count; i++) {
    const t = NOW - (count - 1 - i) * SCRAPE_INTERVAL_S * 1000
    const d = new Date(t)
    const hour = d.getHours() + d.getMinutes() / 60
    const daily = 0.5 - 0.5 * Math.cos((2 * Math.PI * (hour - 4)) / 24) // vale às 4h
    const surge = surgeFactor(t)
    const progress = deployProgress(t)
    const slowQuery = 1 - progress // custo da consulta antiga de /pedidos
    const rollingOut = progress > 0 && progress < 1

    const load = (20 + 60 * daily) * surge * noise(0.05)
    const over = Math.max(0, load - 110)

    const rProdutos = load * 1.55 * SHARES.rProdutos * noise(0.08)
    const rPedidos = load * 1.55 * SHARES.rPedidos * noise(0.08)
    const rUsuarios = load * 1.55 * SHARES.rUsuarios * noise(0.08)
    const rps = rProdutos + rPedidos + rUsuarios

    const pedP50 = (40 + load * 0.2 + slowQuery * 55) * noise(0.06)
    const pedP95 = (110 + load * 0.6 + over * 5 + slowQuery * 230) * noise(0.08)
    const prodP95 = (130 + load * 0.6 + over * 5) * noise(0.08)
    const usuP95 = (90 + load * 0.4 + over * 3) * noise(0.08)
    const prodP50 = prodP95 / 2.4
    const usuP50 = usuP95 / 2.4
    const p95 = (prodP95 * rProdutos + pedP95 * rPedidos + usuP95 * rUsuarios) / rps
    const p50 = (prodP50 * rProdutos + pedP50 * rPedidos + usuP50 * rUsuarios) / rps

    const saturated = surge > 1.6
    const pedErr = (saturated ? 3 : rollingOut ? 2.4 : slowQuery > 0 ? 0.8 : 0.3) * noise(0.4)
    const otherErr = (saturated ? 2.5 : 0.25) * noise(0.4)
    const err5xx = (pedErr * rPedidos + otherErr * (rProdutos + rUsuarios)) / rps

    const r5xx = (rps * err5xx) / 100
    const r4xx = rps * 0.065 * noise(0.15)
    const r2xx = rps - r4xx - r5xx

    points.push({
      t,
      rps,
      p50,
      p95,
      err5xx,
      r2xx,
      r4xx,
      r5xx,
      rProdutos,
      rPedidos,
      rUsuarios,
      prodP50,
      prodP95,
      pedP50,
      pedP95,
      usuP50,
      usuP95,
      pedErr,
      instances: rollingOut ? INSTANCES_TOTAL - 1 : INSTANCES_TOTAL,
    })
  }
  return points
}

const HISTORY = generate()
const between = (from, to) => HISTORY.filter((p) => p.t > from && p.t <= to)

// ---------- Distribuição de latência (aproximação log-normal por rota) ----------

function phi(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}

function shareBelow(ms, p50, p95) {
  if (ms === Infinity) return 1
  if (ms <= 0) return 0
  const sigma = Math.log(p95 / p50) / 1.645
  return phi((Math.log(ms) - Math.log(p50)) / sigma)
}

function latencyDistribution(raw) {
  const totals = LATENCY_BANDS.map(() => 0)
  let all = 0
  for (const p of raw) {
    for (const r of ROUTES) {
      const w = p[r.rps]
      all += w
      LATENCY_BANDS.forEach((b, i) => {
        totals[i] += w * (shareBelow(b.hi, p[r.p50], p[r.p95]) - shareBelow(b.lo, p[r.p50], p[r.p95]))
      })
    }
  }
  return LATENCY_BANDS.map((b, i) => ({ ...b, share: totals[i] / all }))
}

function windowOf(from, to) {
  const raw = between(from, to)
  const previousRaw = between(from - (to - from), from)
  return buildWindow({
    from,
    to,
    raw,
    previousRaw,
    rawStepS: SCRAPE_INTERVAL_S,
    latency: latencyDistribution(raw),
    previousLatency: previousRaw.length ? latencyDistribution(previousRaw) : null,
    instancesTotal: INSTANCES_TOTAL,
  })
}

/** Mesma interface da fonte do Prometheus (ver prometheus.js). */
export const simulated = {
  overview: (rangeMs) => windowOf(NOW - rangeMs, NOW),

  heatmap() {
    const hours = bucketize(between(NOW - 24 * 3600 * 1000, NOW), 24)
    return {
      hours: hours.map((h) => h.from),
      rows: ROUTES.map((r) => ({ ...r, values: hours.map((h) => h[r.p95]) })),
    }
  },

  deploy(windowMs) {
    const data = windowOf(DEPLOY.t - windowMs, DEPLOY.t + windowMs)
    return { info: DEPLOY, data, cmp: compareDeploy(between(DEPLOY.t - windowMs, DEPLOY.t + windowMs), DEPLOY) }
  },
}
