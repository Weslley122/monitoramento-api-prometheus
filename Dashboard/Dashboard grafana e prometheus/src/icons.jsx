// Ícones de traço fino (24×24) que herdam a cor do texto.
function Icon({ size = 16, children, strokeWidth = 1.75, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconGrid = (p) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </Icon>
)

export const IconRocket = (p) => (
  <Icon {...p}>
    <path d="M12 15l-3-3a13 13 0 0 1 8.5-8.5c1.2-.3 2.5-.3 3 .2s.5 1.8.2 3A13 13 0 0 1 12 15z" />
    <path d="M9 12H5l2.5-3.5H11M12 15v4l3.5-2.5V13" />
    <path d="M6 16c-1.5 1-2 3.5-2 4 .5 0 3-.5 4-2" />
  </Icon>
)

export const IconActivity = (p) => (
  <Icon {...p}>
    <path d="M3 12h4l2.5-7 5 14 2.5-7h4" />
  </Icon>
)

export const IconTimer = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="13" r="7.5" />
    <path d="M12 9.5V13l2.5 1.5M9.5 2.5h5" />
  </Icon>
)

export const IconAlert = (p) => (
  <Icon {...p}>
    <path d="M10.3 4.2 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" />
    <path d="M12 9.5v4M12 17h.01" />
  </Icon>
)

export const IconServer = (p) => (
  <Icon {...p}>
    <rect x="3.5" y="4" width="17" height="6.5" rx="1.5" />
    <rect x="3.5" y="13.5" width="17" height="6.5" rx="1.5" />
    <path d="M7 7.25h.01M7 16.75h.01" />
  </Icon>
)

export const IconRoute = (p) => (
  <Icon {...p}>
    <circle cx="6" cy="19" r="2.5" />
    <circle cx="18" cy="5" r="2.5" />
    <path d="M8.5 19H17a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.5" />
  </Icon>
)

export const IconLayers = (p) => (
  <Icon {...p}>
    <path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z" />
    <path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" />
  </Icon>
)

export const IconSearch = (p) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Icon>
)

export const IconBell = (p) => (
  <Icon {...p}>
    <path d="M6 9a6 6 0 0 1 12 0c0 6.5 2.5 8 2.5 8h-17S6 15.5 6 9" />
    <path d="M10.3 20.5a2 2 0 0 0 3.4 0" />
  </Icon>
)

export const IconChart = (p) => (
  <Icon {...p}>
    <path d="M3.5 3.5v17h17" />
    <path d="m7.5 14.5 3.5-4 3 3 5-6" />
  </Icon>
)

export const IconFlame = (p) => (
  <Icon {...p}>
    <path d="M12 21.5c4 0 7-2.6 7-6.6 0-3.4-2.4-5.9-4.2-8.2-.4 2.2-1.6 3.4-2.8 3.9.2-3.1-1.4-6.3-4.5-8.1.4 3.4-3.5 6.4-3.5 11 0 4.4 3.5 8 8 8z" />
  </Icon>
)

export const IconHelp = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 9.2a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.2-2.4 3.6M12 17h.01" />
  </Icon>
)

export const IconSun = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </Icon>
)

export const IconMoon = (p) => (
  <Icon {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </Icon>
)

export const IconCode = (p) => (
  <Icon {...p}>
    <path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4" />
  </Icon>
)

export const IconExternal = (p) => (
  <Icon {...p}>
    <path d="M14 4.5h5.5V10M19.5 4.5 11 13" />
    <path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </Icon>
)

export const IconDownload = (p) => (
  <Icon {...p}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15" />
  </Icon>
)

export const IconChevronRight = (p) => (
  <Icon {...p}>
    <path d="m9.5 6 6 6-6 6" />
  </Icon>
)

export const IconArrowRight = (p) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
)

export const IconArrowUp = (p) => (
  <Icon strokeWidth={2.2} {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Icon>
)

export const IconArrowDown = (p) => (
  <Icon strokeWidth={2.2} {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Icon>
)

export const IconClose = (p) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)

export const IconCheck = (p) => (
  <Icon strokeWidth={2.2} {...p}>
    <path d="M5 12.5 9.5 17 19 7.5" />
  </Icon>
)

export const IconDatabase = (p) => (
  <Icon {...p}>
    <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
    <path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" />
  </Icon>
)

export const IconGauge = (p) => (
  <Icon {...p}>
    <path d="M4 17a8.5 8.5 0 1 1 16 0" />
    <path d="m12 14 4-5" />
    <circle cx="12" cy="14" r="1.2" />
  </Icon>
)

export const IconClock = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
)

export const IconMonitor = (p) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="12.5" rx="2" />
    <path d="M8.5 20.5h7M12 16.5v4" />
  </Icon>
)

export const IconDocument = (p) => (
  <Icon {...p}>
    <path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" />
    <path d="M14 3.5V8h4.5M9 12.5h6M9 16h6" />
  </Icon>
)
