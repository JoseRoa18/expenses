import { formatearUsd } from '@/lib/formato'

/**
 * Barras acostadas, una por fila, con el nombre arriba y el monto al final.
 * Acostadas porque los nombres ("Pago móvil", "Efectivo") no caben debajo
 * de una columna en un teléfono sin partirse o inclinarse.
 *
 * Cada fila puede tener una o dos barras (recibido y gastado de una misma
 * persona). Todas las filas comparten el mismo máximo, así que dos barras
 * del mismo largo son el mismo monto, estén en la fila que estén.
 */

export type FilaBarras = {
  clave: string
  etiqueta: string
  detalle?: string
  valores: { serie: 'recibido' | 'gastado'; monto: number }[]
}

export function Barras({ filas }: { filas: FilaBarras[] }) {
  const max = Math.max(0, ...filas.flatMap((f) => f.valores.map((v) => v.monto)))

  return (
    <ul className="flex flex-col gap-4">
      {filas.map((fila) => (
        <li key={fila.clave}>
          <p className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-slate-800">{fila.etiqueta}</span>
            {fila.detalle && <span className="cifras shrink-0 text-xs text-slate-500">{fila.detalle}</span>}
          </p>
          <div className="flex flex-col gap-1">
            {fila.valores.map((v) => (
              <div key={v.serie} className="flex items-center gap-2">
                <span className="h-2.5 min-w-0 flex-1">
                  <span
                    className={`block h-full rounded-r-[4px] ${v.serie === 'recibido' ? 'bg-recibido' : 'bg-gastado'}`}
                    style={{ width: v.monto > 0 ? `max(${max > 0 ? (v.monto / max) * 100 : 0}%, 2px)` : 0 }}
                  />
                </span>
                <span className="cifras w-24 shrink-0 text-right text-sm text-slate-900">
                  {fila.valores.length > 1 && (
                    <span className="sr-only">{v.serie === 'recibido' ? 'Recibido: ' : 'Gastado: '}</span>
                  )}
                  {formatearUsd(v.monto)}
                </span>
              </div>
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}
