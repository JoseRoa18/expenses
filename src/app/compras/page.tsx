import { redirect } from 'next/navigation'
import { crearClienteServidor, obtenerPerfilObligatorio } from '@/lib/supabase/servidor'
import { FormularioCompra } from '@/componentes/FormularioCompra'
import { VisorFacturas } from '@/componentes/VisorFacturas'
import { BotonMarcarEntregada } from '@/componentes/BotonMarcarEntregada'
import { obtenerEnlacesFacturas } from '@/app/compras/acciones'
import { Encabezado } from '@/componentes/Encabezado'
import { Vacio } from '@/componentes/Vacio'
import { formatearUsd, formatearBs, formatearFecha } from '@/lib/formato'
import { tasaImplicita } from '@/lib/balance'
import type { Compra, Perfil } from '@/lib/tipos'

export const dynamic = 'force-dynamic'

export default async function Compras() {
  const perfil = await obtenerPerfilObligatorio()
  if (!perfil) redirect('/entrar')

  // Jose y Yenny ven los gastos de todos; los demás, los suyos. Quien filtra
  // es la base de datos (política "leer compras"), no esta consulta: esto
  // solo decide si la pantalla escribe de quién es cada gasto.
  const veTodo = perfil.rol === 'comprador' || perfil.rol === 'financista'

  const supabase = await crearClienteServidor()
  const [{ data, error: errorCompras }, { data: perfiles }] = await Promise.all([
    supabase
      .from('compras')
      .select(
        'id, solicitud_id, registrada_por, descripcion, monto_bs, monto_usd, notas, fecha_compra, fecha_entrega',
      )
      .order('fecha_compra', { ascending: false }),
    supabase.from('profiles').select('id, nombre, rol'),
  ])

  const nombrePorId = new Map(((perfiles as Perfil[]) ?? []).map((p) => [p.id, p.nombre]))

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
    <main className="con-barra mx-auto max-w-md px-4 py-6">
      <Encabezado titulo="Gastos" nombre={perfil.nombre} />

      <section className="mb-6">
        <h2 className="mb-2 font-semibold text-slate-900">
          {veTodo ? 'Registrar gasto suelto' : 'Registrar un gasto tuyo'}
        </h2>
        <FormularioCompra />
      </section>

      <div className="flex flex-col gap-3">
        {compras === null && (
          <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
            No se pudo cargar la lista de gastos. Vuelve a intentarlo.
          </p>
        )}

        {compras?.map((compra) => {
          const tasa = tasaImplicita(compra.monto_bs, compra.monto_usd)
          return (
            <article
              key={compra.id}
              className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 truncate font-medium">{compra.descripcion}</h3>
                <span className="cifras shrink-0 font-semibold">
                  {formatearUsd(compra.monto_usd)}
                </span>
              </div>

              <p className="cifras mt-1 text-sm text-slate-600">
                {/* De quién es solo se dice cuando hay gastos de varias
                    personas a la vista: para Alix, todos son suyos. */}
                {veTodo && `${nombrePorId.get(compra.registrada_por) ?? '—'} · `}
                {formatearBs(compra.monto_bs)}
                {tasa !== null && ` · tasa ${formatearBs(tasa)}/$`}
              </p>

              {compra.notas && <p className="mt-2 text-sm text-slate-600">{compra.notas}</p>}

              <div className="mt-3">
                <VisorFacturas enlaces={enlacesPorCompra.get(compra.id) ?? null} />
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
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
          <Vacio
            titulo="Todavía no hay gastos"
            ayuda={
              perfil.rol === 'financista'
                ? 'Cuando alguien registre una compra, la verás aquí con su factura.'
                : 'Registra arriba lo que compres y sube su factura.'
            }
          />
        )}
      </div>
    </main>
  )
}
