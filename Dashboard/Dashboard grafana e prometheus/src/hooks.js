import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getMotion, motionLevel, subscribeMotion } from './motion.js'

/**
 * Anima um gráfico quando ele entra na tela rolando para baixo.
 * Estados (vão no atributo data-reveal):
 *   armed  esperando, no quadro inicial da animação
 *   play   animando
 *   done   parado no desenho final (atualizações de dados não reanimam)
 *   idle   sem animação (preferência "desligada")
 * Com o sistema pedindo menos movimento, os estados ganham o sufixo "-soft"
 * e o CSS só esmaece o gráfico, sem crescer nem desenhar.
 * Quando o gráfico sai pela parte de baixo da tela, volta para "armed",
 * então anima de novo na próxima vez que você descer até ele.
 */
export function useReveal(ref, { duration = 2200 } = {}) {
  const level = motionLevel(useSyncExternalStore(subscribeMotion, getMotion))
  const [state, setState] = useState('armed')
  const enabled = level !== 'off'

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    const io = new IntersectionObserver(
      ([e]) => {
        const bottom = e.rootBounds?.bottom ?? window.innerHeight
        if (e.intersectionRatio >= 0.35) setState((s) => (s === 'armed' ? 'play' : s))
        else if (!e.isIntersecting && e.boundingClientRect.top >= bottom) setState('armed')
      },
      // Só conta quando o gráfico já subiu um pouco: os 10% de baixo da tela não valem.
      { threshold: [0, 0.35], rootMargin: '0px 0px -10% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, enabled])

  useEffect(() => {
    if (state !== 'play') return
    const t = setTimeout(() => setState('done'), duration)
    return () => clearTimeout(t)
  }, [state, duration])

  if (!enabled) return 'idle'
  return level === 'soft' ? `${state}-soft` : state
}

/** Largura atual de um elemento (para os gráficos SVG responsivos). */
export function useWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

/** Fecha um popover ao clicar fora dele ou apertar Esc. */
export function useDismiss(open, onClose) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) onClose()
    }
    document.addEventListener('pointerdown', handler)
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('pointerdown', handler)
      document.removeEventListener('keydown', handler)
    }
  }, [open, onClose])
  return ref
}

/** Índice do item mais próximo de `x` numa lista de posições ordenadas. */
export function nearest(xs, x) {
  let best = 0
  for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i
  return best
}

// Escala "redonda" para o eixo Y (1, 2, 2,5, 5 × 10^n).
export function niceScale(max, target = 4) {
  if (!(max > 0)) return { max: 1, ticks: [0, 1] }
  const raw = max / target
  const exp = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / exp
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp
  const count = Math.ceil(max / step)
  return { max: step * count, ticks: Array.from({ length: count + 1 }, (_, i) => i * step) }
}

/** Caminho de uma barra com o topo levemente arredondado e a base reta. */
export function barPath(x, y, w, h, r = 2) {
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}
