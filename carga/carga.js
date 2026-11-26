// Gerador de tráfego para a API (k6).
// Mantém um tráfego base e, a cada 15 minutos, dobra a carga por ~3 minutos
// para que o dashboard mostre picos, lentidão e erros por saturação.
import http from 'k6/http'

const BASE_URL = __ENV.BASE_URL || 'http://api:8080'
const RPS_BASE = Number(__ENV.RPS_BASE || 60)
const CICLOS = 96 // 96 × 15 min = 24 h; depois o container reinicia sozinho

function ciclo() {
  return [
    { target: RPS_BASE, duration: '12m' },
    { target: RPS_BASE * 2, duration: '1m' }, // sobe
    { target: RPS_BASE * 2, duration: '1m' }, // pico
    { target: RPS_BASE, duration: '1m' }, // desce
  ]
}

const stages = [{ target: RPS_BASE, duration: '30s' }]
for (let i = 0; i < CICLOS; i++) stages.push(...ciclo())

export const options = {
  scenarios: {
    trafego: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 500,
      stages,
    },
  },
  // Re-resolve o nome "api" e alterna entre as réplicas.
  dns: { ttl: '30s', select: 'roundRobin' },
  discardResponseBodies: true,
  summaryTrendStats: ['avg', 'p(95)'],
}

// Mistura de rotas parecida com a de uma loja: mais produtos, depois pedidos.
export default function () {
  const r = Math.random()
  if (r < 0.52) {
    // ~10% das buscas usam uma categoria que não existe (HTTP 400).
    const categoria = Math.random() < 0.1 ? '?categoria=inexistente' : ''
    http.get(`${BASE_URL}/produtos${categoria}`, { tags: { name: '/produtos' } })
  } else if (r < 0.82) {
    http.get(`${BASE_URL}/pedidos`)
  } else {
    http.get(`${BASE_URL}/usuarios`)
  }
}
