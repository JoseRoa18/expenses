import { formatearUsd, tituloBalance } from '@/lib/formato'
import type { Balance, EstadoBalance } from '@/lib/balance'

// Solo el color. El texto sale de `tituloBalance`, para que no haya dos
// versiones del mismo rótulo que puedan quedar distintas.
const FONDOS: Record<EstadoBalance, string> = {
  disponible: 'bg-emerald-600',
  a_favor: 'bg-amber-600',
  al_dia: 'bg-slate-700',
}

const TEXTOS: Record<EstadoBalance, string> = {
  disponible: 'text-emerald-700',
  a_favor: 'text-amber-700',
  al_dia: 'text-slate-700',
}

/**
 * La bolsa de una persona.
 *
 * `principal` es la bolsa de quien está mirando: va grande, arriba, porque
 * es el número por el que abrió la pantalla. Las de los demás -- que solo
 * ven Jose y Yenny -- van en fila, para que tres bolsas quepan en un
 * teléfono sin tener que desplazar.
 */
export function ResumenBalance({
  balance,
  nombre,
  variante = 'principal',
}: {
  balance: Balance
  nombre: string
  variante?: 'principal' | 'fila'
}) {
  if (variante === 'fila') {
    return (
      <article className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{nombre}</p>
          <p className="text-xs text-slate-500">{tituloBalance(balance.estado, nombre)}</p>
        </div>
        <p className={`cifras shrink-0 text-lg font-semibold ${TEXTOS[balance.estado]}`}>
          {formatearUsd(balance.monto)}
        </p>
      </article>
    )
  }

  return (
    <section className={`rounded-2xl ${FONDOS[balance.estado]} p-5 text-white shadow-sm`}>
      <p className="text-sm opacity-80">{tituloBalance(balance.estado, nombre)}</p>
      <p className="cifras mt-1 text-4xl font-semibold tracking-tight">
        {formatearUsd(balance.monto)}
      </p>

      <dl className="mt-4 flex justify-between border-t border-white/20 pt-3 text-sm">
        <div>
          <dt className="opacity-80">Recibido</dt>
          <dd className="cifras font-medium">{formatearUsd(balance.totalAportes)}</dd>
        </div>
        <div className="text-right">
          <dt className="opacity-80">Gastado</dt>
          <dd className="cifras font-medium">{formatearUsd(balance.totalGastos)}</dd>
        </div>
      </dl>
    </section>
  )
}
