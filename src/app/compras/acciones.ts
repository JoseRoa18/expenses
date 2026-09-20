'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor, obtenerPerfil } from '@/lib/supabase/servidor'
import { parsearMonto } from '@/lib/montos'

type Resultado = { error: string | null; advertencia?: string }

// Techo defensivo: ningún gasto real de esta casa se acerca a esto. Sirve
// para atrapar un error de escritura (un cero de más) con un mensaje en
// español, en vez de dejar que lo atrape el overflow de `numeric(14,2)` en
// la base de datos con un error genérico. El límite de la columna es mucho
// más alto que esto; este es un límite de sentido común, no técnico.
const MONTO_MAXIMO = 10_000_000

export async function registrarCompra(datos: FormData): Promise<Resultado> {
  const perfil = await obtenerPerfil()
  if (!perfil) return { error: 'No hay sesión' }
  if (perfil.rol !== 'comprador') return { error: 'Solo Jose registra compras' }

  const solicitudId = String(datos.get('solicitud_id') ?? '') || null
  const descripcion = String(datos.get('descripcion') ?? '').trim()
  const notas = String(datos.get('notas') ?? '').trim()
  const fechaCompra = String(datos.get('fecha_compra') ?? '')

  // El navegador no es de fiar: esta acción es el último punto en el que se
  // puede rechazar un monto mal escrito antes de que se convierta en una
  // fila. `parsearMonto` entiende "1.500" (mil quinientos) y "12,50" (doce
  // con cincuenta) a la venezolana; si no puede leer el texto, no adivina.
  const montoBs = parsearMonto(String(datos.get('monto_bs') ?? ''))
  const montoUsd = parsearMonto(String(datos.get('monto_usd') ?? ''))

  if (!descripcion) return { error: 'Escribe qué compraste' }
  if (montoBs === null || montoBs < 0) {
    return { error: 'El monto en Bs no se entiende. Escríbelo así: 1.500,00' }
  }
  if (montoUsd === null || montoUsd <= 0) {
    return { error: 'El monto en dólares no se entiende. Escríbelo así: 12,50' }
  }
  if (montoBs > MONTO_MAXIMO || montoUsd > MONTO_MAXIMO) {
    return { error: 'Ese monto es demasiado alto. Revisa que no tenga un cero de más.' }
  }

  const supabase = await crearClienteServidor()

  // Critical 1 (revisión final, opción b del reviewer): antes se insertaba
  // la compra primero y, si la solicitud no lograba pasar a "comprada", se
  // intentaba borrarla para compensar. Esa compensación nunca funcionaba:
  // no existe (ni debe existir, "nada se borra") una política DELETE sobre
  // `compras`, así que el DELETE afectaba cero filas sin devolver ningún
  // error, la compra huérfana quedaba contando en el balance de Yenny para
  // siempre, y a Jose se le decía "no se guardó nada" -- lo contrario de lo
  // que había pasado. El caso real: Alix cancela la solicitud mientras Jose
  // tiene el formulario de "Comprar" abierto; Jose envía; sin este cambio,
  // el INSERT en `compras` no está restringido por el estado de la
  // solicitud y hubiera entrado igual.
  //
  // Se invierte el orden: primero se intenta el cambio de estado. Si la
  // solicitud ya no está pendiente (cancelada, rechazada, o ya comprada por
  // otra vía), el trigger `validar_transicion_solicitud` de 0001 la
  // rechaza, o el UPDATE simplemente no toca ninguna fila (RLS) -- en
  // cualquier caso, se corta aquí, antes de que exista ninguna fila en
  // `compras` que compensar. Una operación que no puede fallar a medias le
  // gana a una que se disculpa bien.
  if (solicitudId) {
    const { data: solicitudActualizada, error: errorEstado } = await supabase
      .from('solicitudes')
      .update({ estado: 'comprada' })
      .eq('id', solicitudId)
      .select('id')

    if (errorEstado || !solicitudActualizada || solicitudActualizada.length === 0) {
      return {
        error:
          'Esta solicitud ya no está pendiente (puede que se haya cancelado, rechazado, o que ya esté comprada). No se guardó ningún gasto nuevo: revisa la lista de solicitudes.',
      }
    }
  }

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

  if (error || !compra) {
    // Caso residual, mucho más raro que el que se acaba de eliminar: si
    // `solicitudId` estaba presente, el paso de arriba ya la dejó en
    // "comprada" y este fallo (constraint, corte de conexión) impide que
    // exista ninguna compra detrás. El trigger de 0001 no permite volver de
    // "comprada" a "pendiente" -- por diseño, no hay marcha atrás salvo
    // hacia el siguiente estado legítimo ("entregada") -- así que esto
    // necesita una corrección administrativa manual. Se avisa en vez de
    // dejar que Jose reintente y el gasto quede contado dos veces.
    return {
      error: solicitudId
        ? 'La solicitud se marcó como comprada, pero el gasto no se pudo guardar. No reintentes: avisa para revisar esta solicitud manualmente antes de tocar nada más.'
        : 'No se pudo guardar la compra',
    }
  }

  // Facturas: se suben al bucket privado bajo la carpeta de esta compra.
  const archivos = datos.getAll('facturas').filter((f): f is File => f instanceof File && f.size > 0)

  // La compra ya es legítima y ya está guardada: deshacerla porque una foto
  // no subió dejaría a Jose sin registrar un gasto real que ya hizo, parado
  // en una tienda con el papel en la mano. Se cuentan los fallos para
  // avisarle, en vez de fallar todo el envío.
  let facturasFallidas = 0

  for (const archivo of archivos) {
    const extension = archivo.name.split('.').pop() ?? 'jpg'
    const ruta = `${compra.id}/${crypto.randomUUID()}.${extension}`

    const { error: errorSubida } = await supabase.storage
      .from('facturas')
      .upload(ruta, archivo, { contentType: archivo.type })

    if (errorSubida) {
      facturasFallidas++
      continue
    }

    const { error: errorFactura } = await supabase
      .from('facturas')
      .insert({ compra_id: compra.id, storage_path: ruta })

    // La imagen ya quedó en el bucket, pero sin la fila que la asocia a esta
    // compra: para Jose y para Yenny es exactamente como si no existiera.
    if (errorFactura) facturasFallidas++
  }

  revalidatePath('/compras')
  revalidatePath('/solicitudes')
  revalidatePath('/dinero')

  if (facturasFallidas > 0) {
    const advertencia =
      facturasFallidas === archivos.length
        ? archivos.length === 1
          ? 'La compra se guardó, pero la foto de la factura no se pudo subir. Guarda el papel: el sistema no tiene evidencia de esta compra.'
          : `La compra se guardó, pero ninguna de las ${archivos.length} fotos se pudo subir. Guarda esos papeles: el sistema no tiene evidencia de esta compra.`
        : `La compra se guardó, pero ${facturasFallidas} de ${archivos.length} foto(s) de factura no se pudieron subir. Guarda esos papeles.`
    return { error: null, advertencia }
  }

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
    const { data: solicitudActualizada, error: errorEstado } = await supabase
      .from('solicitudes')
      .update({ estado: 'entregada' })
      .eq('id', compra.solicitud_id)
      .select('id')

    // Igual que en registrarCompra: si la solicitud no quedó "entregada"
    // (error, o RLS la dejó invisible sin devolver error), no se deja la
    // compra diciendo lo contrario. Se deshace la marca de entrega para que
    // las dos tablas sigan de acuerdo.
    if (errorEstado || !solicitudActualizada || solicitudActualizada.length === 0) {
      await supabase.from('compras').update({ fecha_entrega: null }).eq('id', compraId)
      return { error: 'No se pudo actualizar la solicitud. La entrega no quedó marcada.' }
    }
  }

  revalidatePath('/compras')
  revalidatePath('/solicitudes')
  return { error: null }
}

export async function rechazarSolicitud(id: string, motivo: string): Promise<Resultado> {
  const perfil = await obtenerPerfil()
  if (!perfil) return { error: 'No hay sesión' }
  if (perfil.rol !== 'comprador') return { error: 'Solo Jose puede rechazar solicitudes' }

  const limpio = motivo.trim()
  if (!limpio) return { error: 'Escribe el motivo del rechazo' }

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('solicitudes')
    .update({ estado: 'rechazada', motivo_rechazo: limpio })
    .eq('id', id)
    .select('id')

  if (error) return { error: 'No se pudo rechazar' }

  // Sin este chequeo, un update que RLS deja en cero filas (por ejemplo
  // porque ya no está pendiente) igual devuelve { error: null } y Jose ve
  // "rechazado" en algo que en realidad no cambió.
  if (!data || data.length === 0) {
    return { error: 'Ya no se puede rechazar: puede que ya esté comprada o cancelada.' }
  }

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
