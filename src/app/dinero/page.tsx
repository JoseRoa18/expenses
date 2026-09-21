import { redirect } from 'next/navigation'
import { crearClienteServidor, obtenerPerfilObligatorio } from '@/lib/supabase/servidor'
import { ResumenBalance } from '@/componentes/ResumenBalance'
import { FormularioAporte } from '@/componentes/FormularioAporte'
import { Encabezado } from '@/componentes/Encabezado'
import { Vacio } from '@/componentes/Vacio'
import { calcularBalance } from '@/lib/balance'
import { formatearUsd, formatearFecha } from '@/lib/formato'
import type { Aporte, Perfil } from '@/lib/tipos'

export const dynamic = 'force-dynamic'

/** Una fila de `obtener_balances()`: los dos totales de una persona. */
type FilaBalance = {
  persona_id: string
  nombre: string
  total_aportes: number
  total_gastos: number
}

export default async function Dinero() {
  const perfil = await obtenerPerfilObligatorio()
  if (!perfil) redirect('/entrar')

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
    { data: datosAportes, error: errorAportes },
    { data: perfiles },
    { count: pendientes, error: errorPendientes },
  ] = await Promise.all([
    // Devuelve una fila por persona, y es la base la que decide cuántas: a
    // Alix le llega solo la suya. La pantalla nunca tiene en la mano un
    // balance que no le toca ver.
    supabase.rpc('obtener_balances'),
    supabase
      .from('aportes')
      .select('id, registrada_por, monto_usd, fecha, metodo, notas')
      .order('fecha', { ascending: false }),
    supabase.from('profiles').select('id, nombre, rol'),
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
  // sería indistinguible de un fallo real).
  const aportes = errorAportes ? null : ((datosAportes as Aporte[]) ?? [])
  const nombrePorId = new Map(((perfiles as Perfil[]) ?? []).map((p) => [p.id, p.nombre]))

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
            {tieneBolsa ? 'La otra bolsa' : 'Las bolsas de la casa'}
          </h2>
          <div className="flex flex-col gap-2">
            {ajenos.map(({ id, nombre, balance }) => (
              <ResumenBalance key={id} balance={balance} nombre={nombre} variante="fila" />
            ))}
          </div>
          <p className="cifras mt-2 flex justify-between px-1 text-sm text-slate-600">
            <span>Total de la casa</span>
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
            <a
              href="/solicitudes"
              className="mt-3 block rounded-2xl bg-amber-100 p-4 text-amber-900"
            >
              <strong>{pendientes}</strong>{' '}
              {pendientes === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}
            </a>
          )
        ))}

      {tieneBolsa && (
        <section className="mt-6">
          <h2 className="mb-2 font-semibold text-slate-900">Registrar dinero recibido</h2>
          <FormularioAporte />
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 font-semibold text-slate-900">
          {veTodo ? 'Dinero recibido' : 'Tu dinero recibido'}
        </h2>
        <div className="flex flex-col gap-2">
          {aportes === null && (
            <p className="py-8 text-center text-red-600">
              No se pudo cargar el historial de aportes.
            </p>
          )}
          {aportes?.map((aporte) => (
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
        </div>
      </section>
    </main>
  )
}
