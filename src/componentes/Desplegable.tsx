import type { ReactNode } from 'react'
import { IconoMas } from '@/componentes/Iconos'

/**
 * Un formulario guardado detrás de un botón.
 *
 * Las pantallas ahora son, sobre todo, listas que se filtran, y un
 * formulario abierto arriba ocupaba casi toda la pantalla del teléfono antes
 * de que apareciera la primera fila. Se abre con un toque, y el propio
 * `<details>` del navegador se encarga de abrir y cerrar: no hace falta
 * JavaScript, y sigue abierto mientras se filtra la lista de abajo.
 */
export function Desplegable({
  titulo,
  abierto = false,
  children,
}: {
  titulo: string
  /** Para cuando la lista está vacía: no hay nada que ver, solo algo que hacer. */
  abierto?: boolean
  children: ReactNode
}) {
  return (
    <details open={abierto} className="group mb-5">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 font-medium text-white transition-colors select-none active:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 group-open:border group-open:border-slate-300 group-open:bg-white group-open:text-slate-800 group-open:active:bg-slate-100 [&::-webkit-details-marker]:hidden">
        <IconoMas className="h-5 w-5 transition-transform group-open:rotate-45" />
        <span className="group-open:hidden">{titulo}</span>
        <span className="hidden group-open:inline">Cerrar</span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}
