'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor, obtenerPerfil } from '@/lib/supabase/servidor'

type Resultado = { error: string | null }

export async function registrarCompra(datos: FormData): Promise<Resultado> {
  const perfil = await obtenerPerfil()
  if (!perfil) return { error: 'No hay sesión' }
  if (perfil.rol !== 'comprador') return { error: 'Solo Jose registra compras' }

  const solicitudId = String(datos.get('solicitud_id') ?? '') || null
  const descripcion = String(datos.get('descripcion') ?? '').trim()
  const montoBs = Number(datos.get('monto_bs'))
  const montoUsd = Number(datos.get('monto_usd'))
  const notas = String(datos.get('notas') ?? '').trim()
  const fechaCompra = String(datos.get('fecha_compra') ?? '')

  if (!descripcion) return { error: 'Escribe qué compraste' }
  if (!Number.isFinite(montoBs) || montoBs < 0) return { error: 'Monto en Bs no válido' }
  if (!Number.isFinite(montoUsd) || montoUsd <= 0) return { error: 'Monto en dólares no válido' }

  const supabase = await crearClienteServidor()

  const { data: compra, error } = await supabase
    .from('compras')
    .insert({
      solicitud_id: solicitudId,
      registrada_por: perfil.id,
      descripcion,
      monto_bs: montoBs,
      monto_usd: montoUsd,
      notas,
      fecha_compra: fechaCompra || new Date().toISOString().slice(0, 10),
    })
    .select()
    .single()

  if (error || !compra) return { error: 'No se pudo guardar la compra' }

  // Si venía de una solicitud, esta pasa a "comprada".
  if (solicitudId) {
    const { error: errorEstado } = await supabase
      .from('solicitudes')
      .update({ estado: 'comprada' })
      .eq('id', solicitudId)

    if (errorEstado) {
      // La compra quedó guardada pero la solicitud no cambió: se deshace la
      // compra para que no queden las dos cosas diciendo lo contrario.
      await supabase.from('compras').delete().eq('id', compra.id)
      return { error: 'No se pudo actualizar la solicitud. No se guardó nada.' }
    }
  }

  // Facturas: se suben al bucket privado bajo la carpeta de esta compra.
  const archivos = datos.getAll('facturas').filter((f): f is File => f instanceof File && f.size > 0)

  for (const archivo of archivos) {
    const extension = archivo.name.split('.').pop() ?? 'jpg'
    const ruta = `${compra.id}/${crypto.randomUUID()}.${extension}`

    const { error: errorSubida } = await supabase.storage
      .from('facturas')
      .upload(ruta, archivo, { contentType: archivo.type })

    if (errorSubida) continue

    await supabase.from('facturas').insert({ compra_id: compra.id, storage_path: ruta })
  }

  revalidatePath('/compras')
  revalidatePath('/solicitudes')
  revalidatePath('/dinero')
  return { error: null }
}

export async function marcarEntregada(compraId: string): Promise<Resultado> {
  const supabase = await crearClienteServidor()
  const hoy = new Date().toISOString().slice(0, 10)

  const { data: compra, error } = await supabase
    .from('compras')
    .update({ fecha_entrega: hoy })
    .eq('id', compraId)
    .select('solicitud_id')
    .single()

  if (error || !compra) return { error: 'No se pudo marcar como entregada' }

  if (compra.solicitud_id) {
    await supabase
      .from('solicitudes')
      .update({ estado: 'entregada' })
      .eq('id', compra.solicitud_id)
  }

  revalidatePath('/compras')
  revalidatePath('/solicitudes')
  return { error: null }
}

export async function rechazarSolicitud(id: string, motivo: string): Promise<Resultado> {
  const limpio = motivo.trim()
  if (!limpio) return { error: 'Escribe el motivo del rechazo' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('solicitudes')
    .update({ estado: 'rechazada', motivo_rechazo: limpio })
    .eq('id', id)

  if (error) return { error: 'No se pudo rechazar' }

  revalidatePath('/solicitudes')
  return { error: null }
}

/** URLs temporales (1 hora) para ver las fotos del bucket privado. */
export async function obtenerEnlacesFacturas(compraId: string): Promise<string[]> {
  const supabase = await crearClienteServidor()

  const { data: facturas } = await supabase
    .from('facturas')
    .select('storage_path')
    .eq('compra_id', compraId)

  if (!facturas?.length) return []

  const enlaces = await Promise.all(
    facturas.map(async ({ storage_path }) => {
      const { data } = await supabase.storage
        .from('facturas')
        .createSignedUrl(storage_path, 3600)
      return data?.signedUrl ?? null
    }),
  )

  return enlaces.filter((u): u is string => u !== null)
}
