import { redirect } from 'next/navigation'
import { crearClienteServidor, obtenerPerfil } from '@/lib/supabase/servidor'
import { ResumenBalance } from '@/componentes/ResumenBalance'
import { FormularioAporte } from '@/componentes/FormularioAporte'
import { BotonSalir } from '@/componentes/BotonSalir'
import { calcularBalance } from '@/lib/balance'
import { formatearUsd, formatearFecha } from '@/lib/formato'
import type { Aporte } from '@/lib/tipos'

export const dynamic = 'force-dynamic'

export default async function Dinero() {
  const perfil = await obtenerPerfil()
  if (!perfil) redirect('/entrar')
  // Alix (solicitante) nunca ve dinero: esta pantalla no existe para ella.
  if (perfil.rol === 'solicitante') redirect('/solicitudes')

  const supabase = await crearClienteServidor()

  const [{ data: totales }, { data: datosAportes }, { count: pendientes }] = await Promise.all([
    supabase.rpc('obtener_balance'),
    supabase.from('aportes').select('*').order('fecha', { ascending: false }),
    supabase
      .from('solicitudes')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'pendiente'),
  ])

  // La RPC devuelve los totales ya sumados por Postgres. Se pasan a
  // calcularBalance como listas de un elemento para que la clasificación
  // (disponible / a favor / al día) salga de un solo sitio.
  const fila = totales?.[0] ?? { total_aportes: 0, total_gastos: 0 }
  const balance = calcularBalance([Number(fila.total_aportes)], [Number(fila.total_gastos)])

  const aportes = (datosAportes as Aporte[]) ?? []

  return (
    <main className="mx-auto max-w-md px-4 py-6 pb-24">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Balance</h1>
        <BotonSalir nombre={perfil.nombre} />
      </header>

      <ResumenBalance balance={balance} />

      {(pendientes ?? 0) > 0 && (
        <a
          href="/solicitudes"
          className="mt-3 block rounded-2xl bg-amber-100 p-4 text-amber-900"
        >
          <strong>{pendientes}</strong>{' '}
          {pendientes === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}
        </a>
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
          {aportes.map((aporte) => (
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
          {aportes.length === 0 && (
            <p className="py-8 text-center text-slate-400">Todavía no hay aportes.</p>
          )}
        </div>
      </section>
    </main>
  )
}
