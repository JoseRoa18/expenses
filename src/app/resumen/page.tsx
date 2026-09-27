import { redirect } from 'next/navigation'
import { crearClienteServidor, obtenerPerfilObligatorio } from '@/lib/supabase/servidor'
import { Encabezado } from '@/componentes/Encabezado'
import { Vacio } from '@/componentes/Vacio'
import { BarraFiltros } from '@/componentes/BarraFiltros'
import { Resultados, ZonaFiltrada } from '@/componentes/ZonaFiltrada'
import { PanelResumen } from '@/componentes/PanelResumen'
import { leerAportes, leerCompras, leerPerfiles } from '@/lib/datos'
import { conParametros, leerFiltrosResumen, rangoDeFiltro, type Parametros } from '@/lib/filtros'
import { describirRango } from '@/lib/periodos'
import { resumir } from '@/lib/resumen'
import { hoyVenezuela } from '@/lib/formato'

export const dynamic = 'force-dynamic'

/**
 * Gastos contra ingresos en un período, con gráficos.
 *
 * No hay aquí ninguna consulta nueva ni ningún permiso nuevo: se leen las
 * mismas filas que las pantallas de gastos y de balance, con la sesión de
 * quien mira, y se suman aquí. A Alix la base solo le entrega lo suyo, así
 * que su resumen es el de su bolsa y no puede ser otro.
 */
export default async function Resumen({ searchParams }: { searchParams: Promise<Parametros> }) {
  const perfil = await obtenerPerfilObligatorio()
  if (!perfil) redirect('/entrar')
  const params = await searchParams

  const veTodo = perfil.rol === 'comprador' || perfil.rol === 'financista'

  const supabase = await crearClienteServidor()
  const [compras, aportes, perfiles] = await Promise.all([
    leerCompras(supabase),
    leerAportes(supabase),
    leerPerfiles(supabase),
  ])

  const nombrePorId = new Map(perfiles.map((p) => [p.id, p.nombre]))
  const conBolsa = perfiles.filter((p) => p.rol !== 'financista')
  const hoy = hoyVenezuela()
  const filtros = leerFiltrosResumen(params)
  const rango = rangoDeFiltro(filtros, hoy)

  // Solo cuentan las bolsas: lo mismo que suma "Total" en la
  // pantalla de balance, para que los dos números cuadren. Y, si se eligió
  // una persona, solo lo suyo.
  const deQuien = (id: string) =>
    conBolsa.some((p) => p.id === id) && (!filtros.persona || id === filtros.persona)

  const resumen =
    compras && aportes
      ? resumir(
          compras.filter((c) => deQuien(c.registrada_por)),
          aportes.filter((a) => deQuien(a.registrada_por)),
          rango,
          hoy,
        )
      : null

  const sinMovimientos = resumen !== null && resumen.cantidadGastos === 0 && resumen.cantidadAportes === 0
  // Los enlaces a la lista de gastos y a las descargas llevan el mismo
  // período y la misma persona, para que al tocar "3 sin factura" se vean
  // esos tres. El período va siempre escrito: el resumen arranca en seis
  // meses y la lista de gastos en "todo", así que callarlo cambiaría la cuenta.
  const mismoCorte = {
    periodo: filtros.periodo,
    desde: filtros.desde,
    hasta: filtros.hasta,
    persona: filtros.persona,
  }
  const aGastos = (extra: Record<string, string>) => conParametros('/compras', {}, { ...mismoCorte, ...extra })
  const aDescarga = (tipo: 'gastos' | 'dinero') => conParametros('/exportar', {}, { ...mismoCorte, tipo })

  return (
    <main className="con-barra mx-auto max-w-md px-4 py-6">
      <Encabezado titulo="Resumen" nombre={perfil.nombre} />

      <ZonaFiltrada>
        <BarraFiltros
          periodo={{ valor: filtros.periodo, desde: filtros.desde, hasta: filtros.hasta, porDefecto: '6m' }}
          chips={
            veTodo
              ? [
                  {
                    clave: 'persona',
                    etiqueta: 'Bolsillo',
                    valor: filtros.persona ?? '',
                    porDefecto: '',
                    opciones: [
                      { valor: '', etiqueta: 'Todos' },
                      ...conBolsa.map((p) => ({ valor: p.id, etiqueta: p.nombre })),
                    ],
                  },
                ]
              : []
          }
        />

        <Resultados>
          <p className="cifras mb-4 px-1 text-xs text-slate-500">
            {veTodo
              ? filtros.persona
                ? `Bolsillo de ${nombrePorId.get(filtros.persona) ?? '—'}`
                : 'Todos los bolsillos'
              : 'Tu bolsillo'}
            {' · '}
            {describirRango(rango)}
          </p>

          {resumen === null && (
            <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
              No se pudo cargar el resumen. Vuelve a intentarlo.
            </p>
          )}

          {sinMovimientos && (
            <Vacio
              titulo="No hay movimientos en este período"
              ayuda="Prueba con un período más largo, o con “Todo”."
            />
          )}

          {resumen && !sinMovimientos && (
            <PanelResumen
              resumen={resumen}
              rango={rango}
              hoy={hoy}
              veTodo={veTodo}
              porBolsa={veTodo && !filtros.persona}
              nombrePorId={nombrePorId}
              aGastos={aGastos}
              aDescarga={aDescarga}
            />
          )}
        </Resultados>
      </ZonaFiltrada>
    </main>
  )
}
