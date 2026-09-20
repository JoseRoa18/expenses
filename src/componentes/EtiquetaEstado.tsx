import { ETIQUETAS_ESTADO } from '@/lib/solicitudes'
import type { EstadoSolicitud } from '@/lib/tipos'

const COLORES: Record<EstadoSolicitud, string> = {
  pendiente: 'bg-amber-100 text-amber-800',
  comprada: 'bg-blue-100 text-blue-800',
  entregada: 'bg-emerald-100 text-emerald-800',
  rechazada: 'bg-red-100 text-red-800',
  cancelada: 'bg-slate-200 text-slate-600',
}

export function EtiquetaEstado({ estado }: { estado: EstadoSolicitud }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${COLORES[estado]}`}>
      {ETIQUETAS_ESTADO[estado]}
    </span>
  )
}
