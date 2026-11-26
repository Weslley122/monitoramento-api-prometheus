export const formatTime = (t) =>
  new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

// Intervalo "14:00 às 15:00"; com data quando atravessa dias.
export function formatRange(from, to) {
  const sameDay = new Date(from).toDateString() === new Date(to).toDateString()
  const day = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return sameDay
    ? `${formatTime(from)} às ${formatTime(to)}`
    : `${day(from)} ${formatTime(from)} a ${day(to)} ${formatTime(to)}`
}

export const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
export const int = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
const num2 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

export const fmtRps = (v) => `${num.format(v)} req/s`
export const fmtMs = (v) => `${int.format(v)} ms`
export const fmtPct = (v) => `${num.format(v)}%`
export const fmtPctAxis = (v) => `${num2.format(v)}%`
export const fmtCount = (v) => compact.format(v)
export const fmtInt = (v) => int.format(v)

export const stepLabel = (s) => (s >= 60 ? `${num.format(s / 60)} min` : `${s}s`)

// Endereços públicos do Grafana e do Prometheus. Em produção, defina no .env.local:
//   VITE_GRAFANA_URL=https://grafana.seudominio.com.br
//   VITE_PROMETHEUS_URL=https://prometheus.seudominio.com.br
// Sem isso, valem os endereços locais da stack do docker compose.
export const LINKS = {
  grafana: import.meta.env.VITE_GRAFANA_URL || 'http://localhost:3000',
  prometheus: import.meta.env.VITE_PROMETHEUS_URL || 'http://localhost:9090',
}

// Quem responde por esta instalação (aparece na política de privacidade e nos termos).
export const OWNER = {
  name: import.meta.env.VITE_RESPONSAVEL || '',
  contact: import.meta.env.VITE_CONTATO || '',
}

/** Colunas da aba "Dados" para séries no tempo. */
export function timeColumns(series, format) {
  return [
    { key: 't', name: 'Horário', format: formatTime },
    ...series.map((s) => ({ key: s.key, name: s.name, format })),
  ]
}

/** Baixa um texto como arquivo. */
export function downloadText(filename, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
