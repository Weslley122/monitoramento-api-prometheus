import { useEffect, useMemo, useState } from 'react'
import { simulated } from './data.js'
import { ping, prometheus } from './prometheus.js'

export const REFRESH_MS = 15000 // igual ao intervalo de coleta do Prometheus
const HEATMAP_REFRESH_MS = 5 * 60 * 1000

/**
 * Escolhe a fonte de dados e mantém os números atualizados.
 * mode: 'auto' (Prometheus se estiver no ar, senão simulado) | 'prometheus' | 'simulado'
 */
export function useMetrics({ mode, view, rangeMs, windowMs }) {
  const [connState, setConn] = useState({ state: 'connecting' })
  const [real, setReal] = useState({ overview: null, heatmap: null, deploy: null })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  const wantsReal = mode !== 'simulado'
  const conn = wantsReal ? connState : { state: 'off' }
  const live = wantsReal && conn.state === 'live'
  const useSimulated = mode === 'simulado' || (mode === 'auto' && conn.state === 'offline')

  // Testa a conexão e continua testando (heartbeat): percebe se o Prometheus cair ou voltar.
  useEffect(() => {
    if (!wantsReal) return
    const ctrl = new AbortController()
    let timer
    const check = async () => {
      try {
        const version = await ping(ctrl.signal)
        setConn((c) => (c.state === 'live' && c.version === version ? c : { state: 'live', version }))
      } catch (e) {
        if (ctrl.signal.aborted) return
        setConn({ state: 'offline', message: e.message })
      }
      timer = setTimeout(check, REFRESH_MS)
    }
    check()
    return () => {
      ctrl.abort()
      clearTimeout(timer)
    }
  }, [wantsReal])

  // Atualiza a cada REFRESH_MS enquanto conectado.
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => setTick((t) => t + 1), REFRESH_MS)
    return () => clearInterval(id)
  }, [live])

  // Busca os dados da tela atual.
  useEffect(() => {
    if (!live) return
    const ctrl = new AbortController()
    const run = async () => {
      setLoading(true)
      try {
        if (view === 'overview') {
          const needHeatmap = !real.heatmap || Date.now() - real.heatmap.fetchedAt > HEATMAP_REFRESH_MS
          const [overview, heatmap] = await Promise.all([
            prometheus.overview(rangeMs, ctrl.signal),
            needHeatmap ? prometheus.heatmap(ctrl.signal) : null,
          ])
          setReal((r) => ({
            ...r,
            overview: { ...overview, rangeMs, fetchedAt: Date.now() },
            heatmap: heatmap ? { ...heatmap, fetchedAt: Date.now() } : r.heatmap,
          }))
        } else {
          const deploy = await prometheus.deploy(windowMs, ctrl.signal)
          setReal((r) => ({ ...r, deploy: { ...deploy, windowMs, fetchedAt: Date.now() } }))
        }
        setError(null)
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e.message)
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }
    run()
    return () => ctrl.abort()
    // real.heatmap só decide se o mapa de calor precisa ser buscado de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, view, rangeMs, windowMs, tick])

  const sim = useMemo(
    () => (useSimulated ? { overview: simulated.overview(rangeMs), heatmap: simulated.heatmap(), deploy: simulated.deploy(windowMs) } : null),
    [useSimulated, rangeMs, windowMs],
  )

  if (sim) {
    return { source: 'simulado', conn, loading: false, error: null, ...sim, updatedAt: null }
  }
  // Enquanto a primeira resposta não chega, a tela mostra "carregando".
  const fresh = (d, key, value) => (d && d[key] === value ? d : null)
  return {
    source: 'prometheus',
    conn,
    loading,
    error,
    overview: fresh(real.overview, 'rangeMs', rangeMs) ?? real.overview,
    overviewStale: !fresh(real.overview, 'rangeMs', rangeMs),
    heatmap: real.heatmap,
    deploy: fresh(real.deploy, 'windowMs', windowMs) ?? real.deploy,
    updatedAt: view === 'overview' ? real.overview?.fetchedAt : real.deploy?.fetchedAt,
  }
}
