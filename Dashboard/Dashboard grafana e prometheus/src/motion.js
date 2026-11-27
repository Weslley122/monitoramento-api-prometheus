// Preferência de animação dos gráficos, salva no navegador.
//   auto       segue o sistema: animação completa, ou só um esmaecer se o
//              sistema pedir menos movimento (ex.: animações do Windows desligadas)
//   completa   sempre a animação completa
//   desligada  sem animação
export const MOTION_OPTIONS = [
  { id: 'auto', label: 'Animação: seguir o sistema' },
  { id: 'completa', label: 'Animação: completa' },
  { id: 'desligada', label: 'Animação: desligada' },
]

const KEY = 'animacao'
const subscribers = new Set()

function read() {
  try {
    const v = localStorage.getItem(KEY)
    return MOTION_OPTIONS.some((o) => o.id === v) ? v : 'auto'
  } catch {
    return 'auto'
  }
}

let current = read()

export const getMotion = () => current

export function setMotion(value) {
  current = value
  try {
    localStorage.setItem(KEY, value)
  } catch {
    /* sem localStorage: vale só nesta aba */
  }
  subscribers.forEach((fn) => fn())
}

export function subscribeMotion(fn) {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

/** Nível efetivo: 'full', 'soft' (só esmaecer) ou 'off'. */
export function motionLevel(pref) {
  if (typeof IntersectionObserver === 'undefined' || pref === 'desligada') return 'off'
  if (pref === 'completa') return 'full'
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'soft' : 'full'
}
