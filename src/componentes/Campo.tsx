import type { ReactNode } from 'react'

/**
 * Las clases de un campo de texto, en un solo sitio.
 *
 * `text-base` no es un capricho: iOS hace zoom automático al enfocar un
 * campo con letra de menos de 16 px, y ese zoom deja la pantalla corrida y
 * sin forma evidente de volver. Con 16 px no hace falta prohibir el zoom
 * desde el viewport -- que es lo que hacía esta app -- y así quien necesite
 * acercarse a un monto puede seguir haciéndolo con los dedos.
 */
export const CLASE_ENTRADA =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 ' +
  'placeholder:text-slate-400 focus:border-slate-900 focus:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-slate-900/15'

/**
 * Etiqueta + campo + una línea debajo para la ayuda o el error.
 *
 * La línea de abajo reserva su alto siempre (`min-h-4`): sin eso, el
 * formulario entero daba un salto en cuanto aparecía "Se guardará: ..." y
 * el botón se movía bajo el pulgar.
 */
export function Campo({
  etiqueta,
  pie,
  children,
  className = '',
}: {
  etiqueta: string
  pie?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{etiqueta}</span>
      {children}
      {pie !== undefined && <p className="mt-1 min-h-4 text-xs">{pie}</p>}
    </label>
  )
}
