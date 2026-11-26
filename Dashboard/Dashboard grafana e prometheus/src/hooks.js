import { useEffect, useRef, useState } from 'react'

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
