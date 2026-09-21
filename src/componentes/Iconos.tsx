/**
 * Los íconos de la app, dibujados a mano en SVG en vez de traer una
 * librería entera: son seis, y cada kilobyte cuenta en un teléfono con
 * datos móviles.
 *
 * Todos heredan el color del texto (`currentColor`) y el tamaño de la
 * clase que reciban, y ninguno se anuncia a un lector de pantalla: siempre
 * van acompañados de su palabra, así que leerlos dos veces sobraría.
 */

type Props = { className?: string }

const COMUNES = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function IconoCamara({ className = 'h-5 w-5' }: Props) {
  return (
    <svg {...COMUNES} className={className}>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2a1 1 0 0 0 .83-.45l.94-1.4A1 1 0 0 1 9.3 4.7h5.4a1 1 0 0 1 .83.45l.94 1.4A1 1 0 0 0 17.3 7h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="13" r="3.25" />
    </svg>
  )
}

export function IconoArchivo({ className = 'h-5 w-5' }: Props) {
  return (
    <svg {...COMUNES} className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  )
}

export function IconoQuitar({ className = 'h-5 w-5' }: Props) {
  return (
    <svg {...COMUNES} className={className}>
      <path d="m7 7 10 10M17 7 7 17" />
    </svg>
  )
}

export function IconoBalance({ className = 'h-6 w-6' }: Props) {
  return (
    <svg {...COMUNES} className={className}>
      <path d="M12 4v16" />
      <path d="M5 8h14" />
      <path d="M5 8 2.5 14h5zM19 8l-2.5 6h5z" />
    </svg>
  )
}

export function IconoSolicitudes({ className = 'h-6 w-6' }: Props) {
  return (
    <svg {...COMUNES} className={className}>
      <path d="M8 4h8a2 2 0 0 1 2 2v14l-6-3-6 3V6a2 2 0 0 1 2-2z" />
      <path d="M9.5 10h5" />
    </svg>
  )
}

export function IconoGastos({ className = 'h-6 w-6' }: Props) {
  return (
    <svg {...COMUNES} className={className}>
      <path d="M6 3h9l4 4v12.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5V4a1 1 0 0 1 1-1z" />
      <path d="M9 11h6M9 15h4" />
    </svg>
  )
}

export function IconoVacio({ className = 'h-7 w-7' }: Props) {
  return (
    <svg {...COMUNES} className={className}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M8.75 12h6.5" />
    </svg>
  )
}
