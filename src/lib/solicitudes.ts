import type { EstadoSolicitud } from '@/lib/tipos'

/**
 * Reglas de qué se puede hacer con una solicitud según su estado.
 *
 * Estas funciones deciden qué botones se muestran. La base de datos impone las
 * mismas reglas con triggers; esto es la capa amable, no la que protege.
 */

export function puedeEditar(estado: EstadoSolicitud, esAutor: boolean): boolean {
  return esAutor && estado === 'pendiente'
}

export function puedeCancelar(estado: EstadoSolicitud, esAutor: boolean): boolean {
  return esAutor && estado === 'pendiente'
}

export function puedeComprar(estado: EstadoSolicitud): boolean {
  return estado === 'pendiente'
}

export function puedeRechazar(estado: EstadoSolicitud): boolean {
  return estado === 'pendiente'
}

export function puedeEntregar(estado: EstadoSolicitud): boolean {
  return estado === 'comprada'
}

export const ETIQUETAS_ESTADO: Record<EstadoSolicitud, string> = {
  pendiente: 'Pendiente',
  comprada: 'Comprada',
  entregada: 'Entregada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
}
