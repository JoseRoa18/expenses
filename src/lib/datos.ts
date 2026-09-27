import type { SupabaseClient } from '@supabase/supabase-js'
import { leerPorTrozos } from '@/lib/paginado'
import type { Aporte, CompraDetallada, Perfil, Solicitud } from '@/lib/tipos'

/**
 * Las lecturas que comparten varias pantallas (gastos, balance, resumen y la
 * descarga en CSV).
 *
 * Todas reciben el cliente con la sesión de quien mira, nunca el de la llave
 * de servicio: lo que devuelven ya pasó por las políticas de la base, y eso
 * es lo que hace que el resumen de Alix sume solo lo suyo.
 *
 * Devuelven `null` si la consulta falla, no una lista vacía. En esta app una
 * lista vacía y un fallo de red no pueden verse igual (ver /dinero).
 */

/**
 * Las facturas y la solicitud vienen incrustadas en la misma consulta. Antes
 * la lista de gastos preguntaba por las facturas de cada compra por
 * separado: con cien gastos eran cien consultas más, cada una comprobando la
 * sesión de nuevo.
 */
const COLUMNAS_COMPRA =
  'id, solicitud_id, registrada_por, descripcion, monto_bs, monto_usd, notas, fecha_compra, fecha_entrega, created_at, ' +
  'facturas(storage_path), solicitud:solicitudes(creada_por)'

export async function leerCompras(supabase: SupabaseClient): Promise<CompraDetallada[] | null> {
  const filas = await leerPorTrozos<CompraDetallada>((desde, hasta) =>
    supabase
      .from('compras')
      .select(COLUMNAS_COMPRA, { count: 'exact' })
      .order('fecha_compra', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id')
      .range(desde, hasta)
      .overrideTypes<CompraDetallada[], { merge: false }>(),
  )

  return (
    filas?.map((c) => ({
      ...c,
      // `numeric` puede llegar como texto si el número es muy grande; todo
      // lo que viene después suma, así que se asegura aquí una sola vez.
      monto_bs: Number(c.monto_bs),
      monto_usd: Number(c.monto_usd),
      facturas: c.facturas ?? [],
      solicitud: c.solicitud ?? null,
    })) ?? null
  )
}

export async function leerAportes(supabase: SupabaseClient): Promise<Aporte[] | null> {
  const filas = await leerPorTrozos<Aporte>((desde, hasta) =>
    supabase
      .from('aportes')
      .select('id, registrada_por, monto_usd, fecha, metodo, notas, created_at', { count: 'exact' })
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id')
      .range(desde, hasta)
      .overrideTypes<Aporte[], { merge: false }>(),
  )

  return filas?.map((a) => ({ ...a, monto_usd: Number(a.monto_usd) })) ?? null
}

/**
 * Fix 6: columnas nombradas una por una, no `select('*')`. Hoy `solicitudes`
 * no tiene ninguna columna de dinero, así que Alix nunca la ve -- pero eso
 * hoy es una coincidencia del esquema, no una garantía. Cada fila se pasa
 * entera como prop a <TarjetaSolicitud>, un componente de cliente: React
 * serializa TODAS sus props al payload RSC que llega al navegador de Alix,
 * sin importar qué se renderice condicionalmente adentro. Con `select('*')`,
 * una futura migración que agregue, por ejemplo, `monto_estimado` se filtra
 * a su payload sin ningún cambio de código. Nombrando las columnas, esa
 * migración simplemente no aparece aquí hasta que alguien decida agregarla
 * a esta lista a propósito.
 */
const COLUMNAS_SOLICITUD =
  'id, creada_por, titulo, cantidad, urgencia, notas, estado, motivo_rechazo, created_at, updated_at'

export async function leerSolicitudes(supabase: SupabaseClient): Promise<Solicitud[] | null> {
  return leerPorTrozos<Solicitud>((desde, hasta) =>
    supabase
      .from('solicitudes')
      .select(COLUMNAS_SOLICITUD, { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id')
      .range(desde, hasta)
      .overrideTypes<Solicitud[], { merge: false }>(),
  )
}

export async function leerPerfiles(supabase: SupabaseClient): Promise<Perfil[]> {
  const { data } = await supabase.from('profiles').select('id, nombre, rol').order('nombre')
  return (data as Perfil[] | null) ?? []
}

/**
 * Enlaces temporales (1 hora) para ver las fotos del bucket privado, todos
 * en una sola petición.
 *
 * El cliente tiene que ser el de la sesión: el bucket solo firma lo que esa
 * persona puede leer. El "arreglo" obvio el día que un enlace se comporte
 * raro es pasarle el cliente de la llave de servicio -- y eso repartiría las
 * facturas de todos a cualquiera. Reemplazó a la acción de servidor
 * `obtenerEnlacesFacturas`, que además quedaba expuesta al navegador.
 *
 * Una ruta cuyo enlace no se pudo firmar queda en `null` -- no desaparece.
 * Si desapareciera, una compra con su factura se vería "Sin factura" por un
 * fallo de red, y eso es justo lo que Yenny viene a auditar.
 */
export async function firmarFacturas(
  supabase: SupabaseClient,
  rutas: string[],
): Promise<Map<string, string | null>> {
  const enlaces = new Map<string, string | null>(rutas.map((ruta) => [ruta, null]))
  if (rutas.length === 0) return enlaces

  try {
    const { data, error } = await supabase.storage.from('facturas').createSignedUrls(rutas, 3600)
    if (error || !data) return enlaces
    for (const { path, signedUrl, error: errorRuta } of data) {
      if (path && signedUrl && !errorRuta) enlaces.set(path, signedUrl)
    }
  } catch {
    // Sin red: todas quedan en null, y la pantalla dice que no se pudieron abrir.
  }
  return enlaces
}
