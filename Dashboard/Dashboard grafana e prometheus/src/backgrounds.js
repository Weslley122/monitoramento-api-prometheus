import { IconMonitor, IconMoon, IconSun } from './icons.jsx'

// Opções de fundo da tela. "system" segue o tema do sistema operacional.
export const BACKGROUNDS = [
  { id: 'light', label: 'Branco', Icon: IconSun },
  { id: 'dark', label: 'Preto', Icon: IconMoon },
  { id: 'system', label: 'Automático', short: 'Auto', Icon: IconMonitor, hint: 'Segue o tema do sistema' },
]
