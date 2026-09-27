export type Rol = 'solicitante' | 'comprador' | 'financista'
export type Urgencia = 'normal' | 'urgente'
export type EstadoSolicitud =
  | 'pendiente'
  | 'comprada'
  | 'entregada'
  | 'rechazada'
  | 'cancelada'

export type Perfil = {
  id: string
  nombre: string
  rol: Rol
}

export type Solicitud = {
  id: string
  creada_por: string
  titulo: string
  cantidad: string
  urgencia: Urgencia
  notas: string
  estado: EstadoSolicitud
  motivo_rechazo: string | null
  created_at: string
  updated_at: string
}

export type Compra = {
  id: string
  solicitud_id: string | null
  registrada_por: string
  descripcion: string
  monto_bs: number
  monto_usd: number
  notas: string
  fecha_compra: string
  fecha_entrega: string | null
  created_at: string
}

/**
 * Una compra con lo que hace falta para mostrarla y filtrarla sin volver a
 * preguntarle a la base: las rutas de sus facturas y, si fue un encargo,
 * quién lo pidió. Sale de una sola consulta (ver `src/lib/datos.ts`).
 */
export type CompraDetallada = Compra & {
  facturas: { storage_path: string }[]
  solicitud: { creada_por: string } | null
}

export type Factura = {
  id: string
  compra_id: string
  storage_path: string
  created_at: string
}

export type Aporte = {
  id: string
  registrada_por: string
  monto_usd: number
  fecha: string
  metodo: string
  notas: string
  created_at: string
}
