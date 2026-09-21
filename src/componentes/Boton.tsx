import type { ButtonHTMLAttributes } from 'react'

/**
 * El botón de toda la app.
 *
 * Existe porque las mismas clases estaban copiadas en seis formularios, y
 * cada copia se había desviado un poco: alturas distintas, ningún estado de
 * foco, y un "disabled" que en unos sitios se veía y en otros no.
 *
 * Lo que impone, y que importa en un teléfono:
 * - 48 px de alto mínimo, que es el tamaño de un pulgar.
 * - Un anillo de foco visible al navegar con teclado, que antes no existía.
 * - Un estado `active:` de verdad, porque en el teléfono no hay `hover` y
 *   sin él no hay forma de saber si el toque entró.
 */

type Variante = 'primario' | 'secundario' | 'texto'

const BASE =
  'inline-flex items-center justify-center gap-2 font-medium transition-colors ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-slate-900 disabled:opacity-50'

const VARIANTES: Record<Variante, string> = {
  primario: 'min-h-12 rounded-xl bg-slate-900 px-4 text-white active:bg-slate-700',
  secundario:
    'min-h-12 rounded-xl border border-slate-300 bg-white px-4 text-slate-800 active:bg-slate-100',
  // Para las acciones de segunda fila (Editar, Cancelar, Salir). Sigue
  // teniendo 44 px de zona tocable aunque el texto sea chico.
  texto: 'min-h-11 rounded-lg px-2 text-sm text-slate-600 underline underline-offset-2 active:text-slate-900',
}

export function Boton({
  variante = 'primario',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return <button {...props} className={`${BASE} ${VARIANTES[variante]} ${className}`} />
}
