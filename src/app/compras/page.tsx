import { redirect } from 'next/navigation'
import { crearClienteServidor, obtenerPerfilObligatorio } from '@/lib/supabase/servidor'
import { FormularioCompra } from '@/componentes/FormularioCompra'
import { VisorFacturas } from '@/componentes/VisorFacturas'
import { BotonMarcarEntregada } from '@/componentes/BotonMarcarEntregada'
import { obtenerEnlacesFacturas } from '@/app/compras/acciones'
import { BotonSalir } from '@/componentes/BotonSalir'
import { formatearUsd, formatearBs, formatearFecha } from '@/lib/formato'
import { tasaImplicita } from '@/lib/balance'
import type { Compra } from '@/lib/tipos'

export const dynamic = 'force-dynamic'

export default async function Compras() {
  const perfil = await obtenerPerfilObligatorio()
  if (!perfil) redirect('/entrar')
  if (perfil.rol === 'solicitante') redirect('/solicitudes')

  const supabase = await crearClienteServidor()
  const { data, error: errorCompras } = await supabase
    .from('compras')
    .select('id, solicitud_id, descripcion, monto_bs, monto_usd, notas, fecha_compra, fecha_entrega')
    .order('fecha_compra', { ascending: false })

  // Igual que en /dinero (commit edbb1c4): si la consulta falla, no se debe
  // mostrar "Todavía no hay gastos" -- una lista vacía real y un fallo de
  // red se ven exactamente igual para quien lee la pantalla, y esta es la
  // que audita Yenny.
  const compras = errorCompras ? null : ((data as Compra[]) ?? [])
  const enlacesPorCompra = new Map(
    compras
      ? await Promise.all(
          compras.map(async (c) => [c.id, await obtenerEnlacesFacturas(c.id)] as const),
        )
      : [],
  )

  return (
    <main className="mx-auto max-w-md px-4 py-6 pb-24">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Gastos</h1>
        <BotonSalir nombre={perfil.nombre} />
      </header>

      {perfil.rol === 'comprador' && (
        <section className="mb-6">
          <h2 className="mb-2 font-medium">Registrar gasto suelto</h2>
          <FormularioCompra />
        </section>
      )}

      <div className="flex flex-col gap-3">
        {compras === null && (
          <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
            No se pudo cargar la lista de gastos. Vuelve a intentarlo.
          </p>
        )}

        {compras?.map((compra) => {
          const tasa = tasaImplicita(compra.monto_bs, compra.monto_usd)
          return (
            <article key={compra.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 truncate font-medium">{compra.descripcion}</h3>
                <span className="shrink-0 font-semibold">{formatearUsd(compra.monto_usd)}</span>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                {formatearBs(compra.monto_bs)}
                {tasa !== null && ` · tasa ${formatearBs(tasa)}/$`}
              </p>

              {compra.notas && <p className="mt-2 text-sm text-slate-600">{compra.notas}</p>}

              <div className="mt-3">
                <VisorFacturas enlaces={enlacesPorCompra.get(compra.id) ?? null} />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Comprado {formatearFecha(compra.fecha_compra)}
                  {compra.fecha_entrega && ` · entregado ${formatearFecha(compra.fecha_entrega)}`}
                </span>

                {perfil.rol === 'comprador' && !compra.fecha_entrega && (
                  <BotonMarcarEntregada compraId={compra.id} />
                )}
              </div>
            </article>
          )
        })}

        {compras !== null && compras.length === 0 && (
          <p className="py-12 text-center text-slate-400">Todavía no hay gastos.</p>
        )}
      </div>
    </main>
  )
}
