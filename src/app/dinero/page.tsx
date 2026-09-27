import Link from 'next/link'
import { redirect } from 'next/navigation'
import { crearClienteServidor, obtenerPerfilObligatorio } from '@/lib/supabase/servidor'
import { ResumenBalance } from '@/componentes/ResumenBalance'
import { FormularioAporte } from '@/componentes/FormularioAporte'
import { Encabezado } from '@/componentes/Encabezado'
import { Vacio } from '@/componentes/Vacio'
import { Desplegable } from '@/componentes/Desplegable'
import { VerMas } from '@/componentes/VerMas'
import { BarraFiltros } from '@/componentes/BarraFiltros'
import { Resultados, ZonaFiltrada } from '@/componentes/ZonaFiltrada'
import { IconoDescargar, IconoResumen } from '@/componentes/Iconos'
import { calcularBalance, sumarUsd } from '@/lib/balance'
import { leerAportes, leerPerfiles } from '@/lib/datos'
import {
  conParametros,
  contarActivos,
  filtrarAportes,
  leerCuantos,
  leerFiltrosDinero,
  metodosDistintos,
  type Parametros,
} from '@/lib/filtros'
import { formatearUsd, formatearFecha, hoyVenezuela } from '@/lib/formato'

export const dynamic = 'force-dynamic'

const PASO = 30

/** Una fila de `obtener_balances()`: los dos totales de una persona. */
type FilaBalance = {
  persona_id: string
  nombre: string
  total_aportes: number
  total_gastos: number
}

export default async function Dinero({ searchParams }: { searchParams: Promise<Parametros> }) {
  const perfil = await obtenerPerfilObligatorio()
  if (!perfil) redirect('/entrar')
  const params = await searchParams

  // Yenny audita pero no compra para la casa, así que las pendientes son
  // trabajo de Jose y solo a él se le cuentan.
  const esComprador = perfil.rol === 'comprador'
  const veTodo = esComprador || perfil.rol === 'financista'
  // Yenny pone el dinero y no tiene bolsa: no hay balance propio que
  // enseñarle, ni formulario para registrar en una bolsa que no existe.
  const tieneBolsa = perfil.rol !== 'financista'

  const supabase = await crearClienteServidor()

  const [
    { data: filas, error: errorBalance },
    aportes,
    perfiles,
    { count: pendientes, error: errorPendientes },
  ] = await Promise.all([
    // Devuelve una fila por persona, y es la base la que decide cuántas: a
    // Alix le llega solo la suya. La pantalla nunca tiene en la mano un
    // balance que no le toca ver.
    supabase.rpc('obtener_balances'),
    leerAportes(supabase),
    leerPerfiles(supabase),
    supabase
      .from('solicitudes')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'pendiente'),
  ])

  // Si la consulta falla NO se sustituye por un balance en cero: esta es la
  // pantalla donde se decide con un número, y "$0,00 · Al día" es
  // indistinguible de un balance real que sí cuadra.
  const balances =
    errorBalance || !filas
      ? null
      : (filas as FilaBalance[]).map((fila) => ({
          id: fila.persona_id,
          nombre: fila.nombre,
          // Los totales llegan ya sumados por Postgres; se pasan como listas
          // de un elemento para que la clasificación (disponible / a favor /
          // al día) salga de un solo sitio.
          balance: calcularBalance([Number(fila.total_aportes)], [Number(fila.total_gastos)]),
        }))

  const propio = balances?.find((b) => b.id === perfil.id) ?? null
  const ajenos = balances?.filter((b) => b.id !== perfil.id) ?? []
  const totalCasa = balances?.reduce((suma, b) => suma + b.balance.neto, 0) ?? 0

  // Mismo criterio que con el balance: si la consulta falla, no se debe
  // mostrar "Todavía no hay dinero registrado" (una lista vacía también
  // sería indistinguible de un fallo real). `leerAportes` devuelve null.
  const filtros = leerFiltrosDinero(params)
  const filtrados = aportes ? filtrarAportes(aportes, filtros, hoyVenezuela()) : null
  const cuantos = leerCuantos(params, PASO)
  const visibles = filtrados?.slice(0, cuantos) ?? []
  const nombrePorId = new Map(perfiles.map((p) => [p.id, p.nombre]))
  const metodos = aportes ? metodosDistintos(aportes) : []
  const hayFiltros = contarActivos(filtros, leerFiltrosDinero({})) > 0

  return (
    <main className="con-barra mx-auto max-w-md px-4 py-6">
      <Encabezado titulo="Balance" nombre={perfil.nombre} />

      {tieneBolsa &&
        (propio ? (
          <ResumenBalance balance={propio.balance} nombre={perfil.nombre} />
        ) : (
          <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
            No se pudo calcular tu balance. Vuelve a intentarlo.
          </p>
        ))}

      {ajenos.length > 0 && (
        <section className={tieneBolsa ? 'mt-4' : ''}>
          <h2 className="mb-2 text-xs font-medium text-slate-600">
            {tieneBolsa ? 'El otro bolsillo' : 'Todos los bolsillos'}
          </h2>
          <div className="flex flex-col gap-2">
            {ajenos.map(({ id, nombre, balance }) => (
              <ResumenBalance key={id} balance={balance} nombre={nombre} variante="fila" />
            ))}
          </div>
          <p className="cifras mt-2 flex justify-between px-1 text-sm text-slate-600">
            <span>Total</span>
            <span className="font-semibold text-slate-900">{formatearUsd(totalCasa)}</span>
          </p>
        </section>
      )}

      {esComprador &&
        (errorPendientes ? (
          <p className="mt-3 text-sm text-red-600">
            No se pudo comprobar si hay solicitudes pendientes.
          </p>
        ) : (
          (pendientes ?? 0) > 0 && (
            <Link
              href="/solicitudes?estado=pendiente"
              className="mt-3 block rounded-2xl bg-amber-100 p-4 text-amber-900 active:bg-amber-200"
            >
              <strong>{pendientes}</strong>{' '}
              {pendientes === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}
            </Link>
          )
        ))}

      <Link
        href="/resumen"
        className="mt-3 flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-slate-800 shadow-sm ring-1 ring-slate-900/5 active:bg-slate-50"
      >
        <span className="flex items-center gap-3">
          <IconoResumen className="h-5 w-5 text-slate-500" />
          <span>
            <span className="block font-medium">Ver el resumen</span>
            <span className="block text-xs text-slate-500">Gastos contra ingresos, mes a mes</span>
          </span>
        </span>
        <span aria-hidden className="text-slate-400">
          →
        </span>
      </Link>

      {tieneBolsa && (
        <div className="mt-6">
          <Desplegable titulo="Registrar dinero recibido" abierto={aportes?.length === 0}>
            <FormularioAporte />
          </Desplegable>
        </div>
      )}

      <section className={tieneBolsa ? '' : 'mt-6'}>
        <h2 className="mb-3 font-semibold text-slate-900">
          {veTodo ? 'Dinero recibido' : 'Tu dinero recibido'}
        </h2>

        <ZonaFiltrada>
          <BarraFiltros
            busqueda={{ valor: filtros.q, placeholder: 'Buscar en método o notas' }}
            periodo={{ valor: filtros.periodo, desde: filtros.desde, hasta: filtros.hasta, porDefecto: 'todo' }}
            selects={[
              ...(veTodo
                ? [
                    {
                      clave: 'persona',
                      etiqueta: 'Quién recibió',
                      valor: filtros.persona ?? '',
                      porDefecto: '',
                      opciones: [
                        { valor: '', etiqueta: 'Todos' },
                        ...perfiles
                          .filter((p) => p.rol !== 'financista')
                          .map((p) => ({ valor: p.id, etiqueta: p.nombre })),
                      ],
                    },
                  ]
                : []),
              {
                clave: 'metodo',
                etiqueta: 'Por dónde',
                valor: filtros.metodo ?? '',
                porDefecto: '',
                opciones: [{ valor: '', etiqueta: 'Todos' }, ...metodos],
              },
            ]}
            activos={[
              ...(filtros.persona
                ? [{ etiqueta: nombrePorId.get(filtros.persona) ?? 'Otra persona', quitar: ['persona'] }]
                : []),
              ...(filtros.metodo
                ? [
                    {
                      etiqueta: metodos.find((m) => m.valor === filtros.metodo)?.etiqueta ?? filtros.metodo,
                      quitar: ['metodo'],
                    },
                  ]
                : []),
            ]}
          />

          <Resultados>
            {filtrados && filtrados.length > 0 && (
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <p className="cifras text-sm text-slate-600">
                  {filtrados.length} {filtrados.length === 1 ? 'ingreso' : 'ingresos'} ·{' '}
                  <span className="font-semibold text-slate-900">
                    {formatearUsd(sumarUsd(filtrados.map((a) => a.monto_usd)))}
                  </span>
                </p>
                <a
                  href={conParametros('/exportar', params, { tipo: 'dinero', ver: null })}
                  download
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 px-1 text-sm text-slate-600 underline underline-offset-2 active:text-slate-900"
                >
                  <IconoDescargar className="h-4 w-4" />
                  Descargar
                </a>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {filtrados === null && (
                <p className="py-8 text-center text-red-600">
                  No se pudo cargar el historial de aportes.
                </p>
              )}
              {visibles.map((aporte) => (
                <article
                  key={aporte.id}
                  className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5"
                >
                  <div className="min-w-0">
                    <p className="cifras font-semibold">{formatearUsd(aporte.monto_usd)}</p>
                    <p className="cifras text-xs text-slate-500">
                      {/* Solo se dice de quién es cuando hay más de una bolsa a
                          la vista: para Alix, todas son suyas. */}
                      {veTodo && `${nombrePorId.get(aporte.registrada_por) ?? '—'} · `}
                      {formatearFecha(aporte.fecha)}
                      {aporte.metodo && ` · ${aporte.metodo}`}
                    </p>
                    {aporte.notas && <p className="mt-1 text-sm text-slate-600">{aporte.notas}</p>}
                  </div>
                </article>
              ))}

              {filtrados !== null && (
                <VerMas
                  href={conParametros('/dinero', params, { ver: String(cuantos + PASO) })}
                  restantes={filtrados.length - visibles.length}
                  paso={PASO}
                />
              )}

              {aportes !== null && aportes.length === 0 && (
                <Vacio
                  titulo="Todavía no hay dinero registrado"
                  ayuda={
                    tieneBolsa
                      ? 'Cuando recibas dinero, regístralo arriba para que tu balance cuadre.'
                      : 'Cuando Alix o Jose registren el dinero que les envíes, aparecerá aquí.'
                  }
                />
              )}

              {aportes !== null && aportes.length > 0 && filtrados?.length === 0 && (
                <Vacio
                  titulo="Ningún ingreso coincide"
                  ayuda={
                    hayFiltros
                      ? 'Prueba con otra búsqueda, otro período, o quita los filtros.'
                      : 'No hay ingresos que mostrar.'
                  }
                />
              )}
            </div>
          </Resultados>
        </ZonaFiltrada>
      </section>
    </main>
  )
}
