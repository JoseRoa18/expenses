import { VisorFacturas } from '@/componentes/VisorFacturas'
import { BotonMarcarEntregada } from '@/componentes/BotonMarcarEntregada'
import { formatearBs, formatearFecha, formatearUsd } from '@/lib/formato'
import { tasaImplicita } from '@/lib/balance'
import type { CompraDetallada } from '@/lib/tipos'

/** Un gasto de la lista, con sus facturas. */
export function TarjetaCompra({
  compra,
  enlaces,
  quien,
  pedidoPor,
  puedeEntregar,
}: {
  compra: CompraDetallada
  enlaces: (string | null)[]
  /** De quién es el gasto; `null` cuando todos los de la lista son de quien mira. */
  quien: string | null
  /** Si fue un encargo, quién lo pidió. */
  pedidoPor: string | null
  puedeEntregar: boolean
}) {
  // Sin bolívares no hay tasa que mostrar: 0 / 12 daría "tasa 0,00", que es
  // un número falso con cara de dato.
  const conBs = compra.monto_bs > 0
  const tasa = conBs ? tasaImplicita(compra.monto_bs, compra.monto_usd) : null
  const detalle = [
    quien,
    conBs ? formatearBs(compra.monto_bs) : null,
    tasa !== null ? `tasa ${formatearBs(tasa)}/$` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 font-medium break-words">{compra.descripcion}</h3>
        <span className="cifras shrink-0 font-semibold">{formatearUsd(compra.monto_usd)}</span>
      </div>

      {detalle && <p className="cifras mt-1 text-sm text-slate-600">{detalle}</p>}

      {compra.solicitud_id && (
        <p className="mt-2">
          <span className="inline-block rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">
            {pedidoPor ? `Encargo de ${pedidoPor}` : 'Encargo'}
          </span>
        </p>
      )}

      {compra.notas && <p className="mt-2 text-sm text-slate-600">{compra.notas}</p>}

      <div className="mt-3">
        <VisorFacturas enlaces={enlaces} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
        <span className="cifras">
          Comprado {formatearFecha(compra.fecha_compra)}
          {compra.fecha_entrega && ` · entregado ${formatearFecha(compra.fecha_entrega)}`}
        </span>

        {puedeEntregar && !compra.fecha_entrega && <BotonMarcarEntregada compraId={compra.id} />}
      </div>
    </article>
  )
}
