import { redirect } from 'next/navigation'
import { crearClienteServidor, obtenerPerfilObligatorio } from '@/lib/supabase/servidor'
import { ResumenBalance } from '@/componentes/ResumenBalance'
import { FormularioAporte } from '@/componentes/FormularioAporte'
import { BotonSalir } from '@/componentes/BotonSalir'
import { calcularBalance } from '@/lib/balance'
import { formatearUsd, formatearFecha } from '@/lib/formato'
import type { Aporte } from '@/lib/tipos'

export const dynamic = 'force-dynamic'

export default async function Dinero() {
  const perfil = await obtenerPerfilObligatorio()
  if (!perfil) redirect('/entrar')
  // Alix (solicitante) nunca ve dinero: esta pantalla no existe para ella.
  if (perfil.rol === 'solicitante') redirect('/solicitudes')

  const supabase = await crearClienteServidor()

  const [
    { data: totales, error: errorBalance },
    { data: datosAportes, error: errorAportes },
    { count: pendientes, error: errorPendientes },
  ] = await Promise.all([
    supabase.rpc('obtener_balance'),
    supabase.from('aportes').select('*').order('fecha', { ascending: false }),
    supabase
      .from('solicitudes')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'pendiente'),
  ])

  // La RPC devuelve los totales ya sumados por Postgres. Se pasan a
  // calcularBalance como listas de un elemento para que la clasificación
  // (disponible / a favor / al día) salga de un solo sitio. Si la RPC falla,
  // NO se sustituye por un balance en cero: esta es la única pantalla donde
  // Jose y Yenny deciden con un número, y "$0,00 · Al día" es indistinguible
  // de un balance real que sí cuadra.
  const fila = totales?.[0]
  const balance =
    !errorBalance && fila
      ? calcularBalance([Number(fila.total_aportes)], [Number(fila.total_gastos)])
      : null

  // Mismo criterio para el historial de aportes: si la consulta falla, no se
  // debe mostrar "Todavía no hay aportes" (una lista vacía también sería
  // indistinguible de un fallo real).
  const aportes = errorAportes ? null : ((datosAportes as Aporte[]) ?? [])

  return (
    <main className="mx-auto max-w-md px-4 py-6 pb-24">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Balance</h1>
        <BotonSalir nombre={perfil.nombre} />
      </header>

      {balance ? (
        <ResumenBalance balance={balance} />
      ) : (
        <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
          No se pudo calcular el balance. Vuelve a intentarlo.
        </p>
      )}

      {errorPendientes ? (
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
      )}

      {perfil.rol === 'comprador' && (
        <section className="mt-6">
          <h2 className="mb-2 font-medium">Registrar dinero recibido</h2>
          <FormularioAporte />
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 font-medium">Dinero recibido</h2>
        <div className="flex flex-col gap-2">
          {aportes === null && (
            <p className="py-8 text-center text-red-600">
              No se pudo cargar el historial de aportes.
            </p>
          )}
          {aportes?.map((aporte) => (
            <article
              key={aporte.id}
              className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm"
            >
              <div>
                <p className="font-medium">{formatearUsd(aporte.monto_usd)}</p>
                <p className="text-xs text-slate-500">
                  {formatearFecha(aporte.fecha)}
                  {aporte.metodo && ` · ${aporte.metodo}`}
                </p>
                {aporte.notas && (
                  <p className="mt-1 text-sm text-slate-600">{aporte.notas}</p>
                )}
              </div>
            </article>
          ))}
          {aportes !== null && aportes.length === 0 && (
            <p className="py-8 text-center text-slate-400">Todavía no hay aportes.</p>
          )}
        </div>
      </section>
    </main>
  )
}
