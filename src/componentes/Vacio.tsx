import { IconoVacio } from '@/componentes/Iconos'

/**
 * Lo que se ve cuando una lista está vacía.
 *
 * Antes era una línea gris clarita ("Todavía no hay solicitudes.") que
 * parecía un error de carga. Una pantalla vacía es una invitación a hacer
 * algo, así que lleva dos líneas: qué pasa, y qué hacer al respecto.
 */
export function Vacio({ titulo, ayuda }: { titulo: string; ayuda: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center">
      <IconoVacio className="h-7 w-7 text-slate-400" />
      <p className="font-medium text-slate-700">{titulo}</p>
      <p className="max-w-56 text-sm text-slate-500">{ayuda}</p>
    </div>
  )
}
