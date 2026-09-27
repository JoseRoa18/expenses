'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { Leyenda } from '@/componentes/graficos/Leyenda'
import { EjeMontos } from '@/componentes/graficos/EjeMontos'
import { escalaBonita, porcentaje } from '@/lib/graficos'
import { formatearUsd, formatearUsdConSigno } from '@/lib/formato'
import { etiquetaMes } from '@/lib/periodos'

type Mes = { mes: string; recibido: number; gastado: number }

/** Alto del área de las barras, sin contar las etiquetas de los meses. */
const ALTO = 176

/**
 * Lo que entró y lo que salió, mes a mes: dos columnas por mes, una al lado
 * de la otra, para comparar las dos alturas sin hacer cuentas.
 *
 * Está hecho con cajas de HTML y no con un dibujo SVG: así el texto es texto
 * de verdad (no se estira con la pantalla) y las columnas se ajustan solas
 * al ancho del teléfono. Con más de un año de meses, el gráfico se desplaza
 * de lado y el eje de los montos se queda quieto.
 *
 * Tocar un mes (o llegar a él con el teclado) muestra sus cifras arriba.
 * Todo lo que se ve al tocar está también en la tabla de abajo: el toque
 * ayuda, no es la única forma de leer un número.
 */
export function GraficoMeses({ meses }: { meses: Mes[] }) {
  const [elegido, setElegido] = useState(meses.length - 1)

  // Con muchos meses el gráfico se desplaza de lado, y lo que interesa es lo
  // reciente: arranca mostrando el final, donde está el mes elegido.
  const desplazable = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const caja = desplazable.current
    if (caja) caja.scrollLeft = caja.scrollWidth
  }, [meses.length])
  const escala = escalaBonita(0, Math.max(...meses.map((m) => Math.max(m.recibido, m.gastado))))
  const actual = meses[Math.min(elegido, meses.length - 1)]
  const variosAnios = meses[0].mes.slice(0, 4) !== meses.at(-1)!.mes.slice(0, 4)

  return (
    <figure>
      <div className="mb-3 flex items-start justify-between gap-3">
        <Leyenda series={['recibido', 'gastado']} />
      </div>

      {/* La lectura del mes elegido. `aria-live` para que quien usa lector
          de pantalla oiga las cifras al moverse entre meses. */}
      <div aria-live="polite" className="mb-3 rounded-xl bg-slate-50 px-3 py-2">
        <p className="text-xs font-medium text-slate-500 capitalize">{etiquetaMes(actual.mes, true)}</p>
        <dl className="cifras mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
          <div className="flex items-baseline gap-1.5">
            <dt className="flex items-center gap-1 text-slate-500">
              <span aria-hidden className="inline-block h-0.5 w-3 rounded-full bg-recibido" />
              Recibido
            </dt>
            <dd className="font-semibold text-slate-900">{formatearUsd(actual.recibido)}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="flex items-center gap-1 text-slate-500">
              <span aria-hidden className="inline-block h-0.5 w-3 rounded-full bg-gastado" />
              Gastado
            </dt>
            <dd className="font-semibold text-slate-900">{formatearUsd(actual.gastado)}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-slate-500">Diferencia</dt>
            <dd className="font-semibold text-slate-900">
              {formatearUsdConSigno(actual.recibido - actual.gastado)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex">
        {/* Eje de montos: fuera de la zona que se desplaza, para que no se
            pierda al mirar los meses del final. */}
        <EjeMontos escala={escala} alto={ALTO} />

        <div ref={desplazable} className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:thin]">
          <div className="relative" style={{ minWidth: meses.length * 40 }}>
            {/* Líneas de guía: finas y grises, para que no compitan con las barras. */}
            <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: ALTO }} aria-hidden>
              {escala.marcas.map((marca) => (
                <span
                  key={marca}
                  className={`absolute inset-x-0 h-px ${marca === 0 ? 'bg-slate-300' : 'bg-slate-100'}`}
                  style={{ bottom: `${porcentaje(marca, escala.min, escala.max)}%` }}
                />
              ))}
            </div>

            <div className="relative flex" role="group" aria-label="Meses">
              {meses.map((m, i) => {
                const activo = i === elegido
                const mostrarAnio = variosAnios && (i === 0 || m.mes.endsWith('-01'))
                return (
                  <button
                    key={m.mes}
                    type="button"
                    onClick={() => setElegido(i)}
                    onPointerEnter={(e) => {
                      // Con ratón, pasar por encima basta. En el teléfono no
                      // existe "pasar por encima": ahí manda el toque.
                      if (e.pointerType === 'mouse') setElegido(i)
                    }}
                    onFocus={() => setElegido(i)}
                    aria-pressed={activo}
                    aria-label={`${etiquetaMes(m.mes, true)}: recibido ${formatearUsd(m.recibido)}, gastado ${formatearUsd(m.gastado)}`}
                    className="group flex min-w-10 flex-1 flex-col items-center focus-visible:outline-none"
                  >
                    <span
                      className={`flex w-full items-end justify-center gap-0.5 rounded-t-lg px-1.5 transition-colors group-focus-visible:ring-2 group-focus-visible:ring-slate-900 group-focus-visible:ring-inset ${
                        activo ? 'bg-slate-100' : ''
                      }`}
                      style={{ height: ALTO }}
                    >
                      <Barra valor={m.recibido} max={escala.max} clase="bg-recibido" />
                      <Barra valor={m.gastado} max={escala.max} clase="bg-gastado" />
                    </span>
                    <span
                      className={`mt-1.5 text-[11px] leading-tight ${activo ? 'font-semibold text-slate-900' : 'text-slate-500'}`}
                    >
                      {etiquetaMes(m.mes)}
                      {mostrarAnio && <span className="block text-[10px] text-slate-400">{m.mes.slice(0, 4)}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <details className="mt-3 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-slate-600 underline underline-offset-2">
          Ver como tabla
        </summary>
        <table className="cifras mt-2 w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-1 font-medium">Mes</th>
              <th className="py-1 text-right font-medium">Recibido</th>
              <th className="py-1 text-right font-medium">Gastado</th>
              <th className="py-1 text-right font-medium">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m.mes} className="border-t border-slate-100">
                <td className="py-1.5 capitalize">{etiquetaMes(m.mes, true)}</td>
                <td className="py-1.5 text-right">{formatearUsd(m.recibido)}</td>
                <td className="py-1.5 text-right">{formatearUsd(m.gastado)}</td>
                <td className="py-1.5 text-right">{formatearUsdConSigno(m.recibido - m.gastado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

/**
 * Una columna: 4 px redondeados arriba, recta abajo -- crece desde la línea
 * del cero, no flota. Nunca más ancha que 24 px: el resto del espacio del
 * mes queda como aire, que es lo que separa un mes del siguiente.
 */
function Barra({ valor, max, clase }: { valor: number; max: number; clase: string }) {
  const alto = porcentaje(valor, 0, max)
  return (
    <span
      className={`block w-full max-w-6 rounded-t-[4px] ${clase}`}
      // Un monto chiquito sigue siendo visible: medio píxel no se ve, y
      // "gastó algo" no es lo mismo que "no gastó nada".
      style={{ height: valor > 0 ? `max(${alto}%, 2px)` : 0 }}
    />
  )
}
