// As mesmas consultas dos dashboards em grafana/dashboards/*.json.
const JOB = 'job="api-spring-boot"'
const F = `${JOB}, uri!~"/actuator.*"`
const P = `${JOB}, uri="/pedidos"`
const RI = '[$__rate_interval]'
const count = (filter) => `http_server_requests_seconds_count{${filter}}`
const bucket = (filter) => `http_server_requests_seconds_bucket{${filter}}`
const quantile = (q, filter) => `histogram_quantile(${q}, sum by (le) (rate(${bucket(filter)}${RI})))`

export const PROMQL = {
  rps: { name: 'Requisições/s', expr: `sum(rate(${count(F)}${RI}))` },
  p95: { name: 'Latência p95', expr: quantile(0.95, F) },
  err5xx: {
    name: 'Erros 5xx (%)',
    expr: `100 * (sum(rate(${count(`${F}, status=~"5.."`)}${RI})) or vector(0))\n  / sum(rate(${count(F)}${RI}))`,
  },
  instances: { name: 'Instâncias ativas', expr: `count(up{${JOB}} == 1)` },
  byStatus: [2, 4, 5].map((c) => ({
    name: `${c}xx`,
    expr: `sum(rate(${count(`${F}, status=~"${c}.."`)}${RI}))`,
  })),
  routes: { name: 'Rotas por tráfego', expr: `sort_desc(sum by (uri) (rate(${count(F)}${RI})))` },
  routeP95: {
    name: 'p95 por rota',
    expr: `histogram_quantile(0.95, sum by (le, uri) (rate(${bucket(F)}${RI})))`,
  },
  buckets: {
    name: 'Requisições por faixa de latência (buckets do histograma)',
    expr: `sum by (le) (increase(${bucket(F)}[$__range]))`,
  },
  slo: {
    name: 'Requisições abaixo de 300 ms (%)',
    expr: `100 * sum(rate(${bucket(`${F}, le="0.3"`)}${RI}))\n  / sum(rate(${count(F)}${RI}))`,
  },
  pedP50: { name: 'p50 /pedidos', expr: quantile(0.5, P) },
  pedP95: { name: 'p95 /pedidos', expr: quantile(0.95, P) },
  pedErr: {
    name: 'Erros 5xx /pedidos (%)',
    expr: `100 * (sum(rate(${count(`${P}, status=~"5.."`)}${RI})) or vector(0))\n  / sum(rate(${count(P)}${RI}))`,
  },
  deploys: {
    name: 'Anotação de deploy (versão nova aparecendo)',
    expr: `count by (version) (process_start_time_seconds{${JOB}})\n  unless count by (version) (process_start_time_seconds{${JOB}} offset 1m)`,
  },
}
