import { formatearUsd, TITULOS_BALANCE } from '@/lib/formato'
import type { Balance, EstadoBalance } from '@/lib/balance'

// Solo el color. El texto sale de TITULOS_BALANCE, para que no haya dos
// versiones del mismo rótulo que puedan quedar distintas.
const FONDOS: Record<EstadoBalance, string> = {
  disponible: 'bg-emerald-600',
  a_favor_de_jose: 'bg-amber-600',
  al_dia: 'bg-slate-700',
}

export function ResumenBalance({ balance }: { balance: Balance }) {
  return (
    <section className={`rounded-2xl ${FONDOS[balance.estado]} p-5 text-white shadow-sm`}>
      <p className="text-sm opacity-80">{TITULOS_BALANCE[balance.estado]}</p>
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
