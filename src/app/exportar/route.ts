import type { NextRequest } from 'next/server'
import { crearClienteServidor, obtenerPerfil } from '@/lib/supabase/servidor'
import { leerAportes, leerCompras, leerPerfiles } from '@/lib/datos'
import { filtrarAportes, filtrarGastos, leerFiltrosDinero, leerFiltrosGastos, type Parametros } from '@/lib/filtros'
import { aCsv, type Celda } from '@/lib/csv'
import { hoyVenezuela } from '@/lib/formato'
import { tasaImplicita } from '@/lib/balance'

/**
 * La lista de gastos o de dinero recibido, en CSV, con los mismos filtros
 * que la pantalla desde la que se pidió.
 *
 * Lee con la sesión de quien descarga, igual que las pantallas: el archivo
 * de Alix trae lo suyo y nada más, porque la base no le entrega otra cosa.
 * Las facturas no van como enlace -- los enlaces firmados caducan en una
 * hora, y un archivo guardado con enlaces muertos engaña -- sino como
 * cantidad, que es lo que sirve para auditar.
 */
export async function GET(request: NextRequest) {
  const perfil = await obtenerPerfil()
  if (!perfil) return new Response('No hay sesión', { status: 401 })

  const params: Parametros = Object.fromEntries(request.nextUrl.searchParams)
  const tipo = params.tipo === 'dinero' ? 'dinero' : 'gastos'
  const hoy = hoyVenezuela()

  const supabase = await crearClienteServidor()
  const perfiles = await leerPerfiles(supabase)
  const nombre = (id: string) => perfiles.find((p) => p.id === id)?.nombre ?? ''

  let filas: Celda[][]

  if (tipo === 'gastos') {
    const compras = await leerCompras(supabase)
    if (!compras) return new Response('No se pudieron leer los gastos. Intenta de nuevo.', { status: 502 })

    filas = [
      [
        'Fecha',
        'Descripción',
        'Quién',
        'Monto USD',
        'Monto Bs',
        'Tasa Bs/$',
        'Tipo',
        'Pedido por',
        'Entregado',
        'Facturas',
        'Notas',
      ],
      ...filtrarGastos(compras, leerFiltrosGastos(params), hoy).map((c) => [
        c.fecha_compra,
        c.descripcion,
        nombre(c.registrada_por),
        c.monto_usd,
        c.monto_bs > 0 ? c.monto_bs : null,
        c.monto_bs > 0 ? tasaImplicita(c.monto_bs, c.monto_usd) : null,
        c.solicitud_id ? 'Encargo' : 'Suelto',
        c.solicitud ? nombre(c.solicitud.creada_por) : null,
        c.fecha_entrega,
        c.facturas.length,
        c.notas || null,
      ]),
    ]
  } else {
    const aportes = await leerAportes(supabase)
    if (!aportes) return new Response('No se pudo leer el dinero recibido. Intenta de nuevo.', { status: 502 })

    filas = [
      ['Fecha', 'Quién recibió', 'Monto USD', 'Por dónde', 'Notas'],
      ...filtrarAportes(aportes, leerFiltrosDinero(params), hoy).map((a) => [
        a.fecha,
        nombre(a.registrada_por),
        a.monto_usd,
        a.metodo || null,
        a.notas || null,
      ]),
    ]
  }

  return new Response(aCsv(filas), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${tipo === 'gastos' ? 'gastos' : 'ingresos'}-${hoy}.csv"`,
      // Son cuentas de una casa: que no las guarde ningún intermediario.
      'Cache-Control': 'private, no-store',
    },
  })
}
