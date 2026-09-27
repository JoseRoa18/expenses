'use client'

import { useState, type PointerEvent } from 'react'
import { escalaBonita, porcentaje } from '@/lib/graficos'
import { formatearFecha, formatearSaldo, formatearUsdCorto } from '@/lib/formato'

type Punto = { fecha: string; saldo: number }

const ALTO = 160

/** Días desde 1970, para poner las fechas a escala en el eje horizontal. */
const dia = (fecha: string) => Date.UTC(+fecha.slice(0, 4), +fecha.slice(5, 7) - 1, +fecha.slice(8, 10)) / 86_400_000

/**
 * Cuánto dinero había en las bolsas cada día.
 *
 * Es una línea en escalera y no una curva: el saldo no sube de a poco entre
 * un aporte y el siguiente, salta el día que llega el dinero y se queda ahí.
 * Una curva suave inventaría saldos que nunca existieron.
 *
 * El trazo es un SVG que se estira al ancho de la pantalla; el texto y el
 * punto van encima, en HTML, para que no se deformen al estirarse.
 *
 * Tocar o arrastrar sobre el gráfico muestra el saldo del día más cercano;
 * con el teclado, las flechas lo mueven. La tabla de abajo tiene lo mismo.
 */
export function GraficoSaldo({ puntos }: { puntos: Punto[] }) {
  const [elegido, setElegido] = useState(puntos.length - 1)

  const x0 = dia(puntos[0].fecha)
  const x1 = dia(puntos.at(-1)!.fecha)
  const escala = escalaBonita(
    Math.min(...puntos.map((p) => p.saldo)),
    Math.max(...puntos.map((p) => p.saldo)),
  )
  const x = (fecha: string) => porcentaje(dia(fecha), x0, x1 === x0 ? x0 + 1 : x1)
  // En el SVG, y crece hacia abajo.
  const y = (saldo: number) => 100 - porcentaje(saldo, escala.min, escala.max)
  const cero = y(0)

  // Escalera: de cada punto se sigue en horizontal hasta la fecha del
  // siguiente, y ahí se sube o se baja.
  let trazo = `M ${x(puntos[0].fecha)} ${y(puntos[0].saldo)}`
  for (let i = 1; i < puntos.length; i++) {
    trazo += ` H ${x(puntos[i].fecha)} V ${y(puntos[i].saldo)}`
  }
  const area = `${trazo} V ${cero} H ${x(puntos[0].fecha)} Z`

  const actual = puntos[Math.min(elegido, puntos.length - 1)]

  function apuntar(e: PointerEvent<HTMLDivElement>) {
    const caja = e.currentTarget.getBoundingClientRect()
    const fraccion = Math.min(1, Math.max(0, (e.clientX - caja.left) / caja.width))
    const objetivo = x0 + fraccion * (x1 - x0)
    // El saldo de un día es el del último cambio en o antes de ese día.
    let i = 0
    while (i + 1 < puntos.length && dia(puntos[i + 1].fecha) <= objetivo) i++
    setElegido(i)
  }

  return (
    <figure>
      <div aria-live="polite" className="mb-3 rounded-xl bg-slate-50 px-3 py-2">
        <p className="text-xs font-medium text-slate-500">
          {elegido === puntos.length - 1 ? `Al ${formatearFecha(actual.fecha)}` : formatearFecha(actual.fecha)}
        </p>
        <p className="cifras mt-0.5 text-sm">
          <span className="text-slate-500">Saldo </span>
          <span className="font-semibold text-slate-900">{formatearSaldo(actual.saldo)}</span>
        </p>
      </div>

      <div className="flex">
        <div className="relative w-14 shrink-0" style={{ height: ALTO }} aria-hidden>
          {escala.marcas.map((marca) => (
            <span
              key={marca}
              className="cifras absolute right-2 translate-y-1/2 text-[11px] whitespace-nowrap text-slate-500"
              style={{ bottom: `${porcentaje(marca, escala.min, escala.max)}%` }}
            >
              {formatearUsdCorto(marca)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div
            role="slider"
            tabIndex={0}
            aria-label="Saldo por día"
            aria-valuemin={0}
            aria-valuemax={puntos.length - 1}
            aria-valuenow={elegido}
            aria-valuetext={`${formatearFecha(actual.fecha)}: ${formatearSaldo(actual.saldo)}`}
            onPointerDown={apuntar}
            onPointerMove={(e) => {
              // Con el dedo, solo mientras se arrastra; con ratón, basta pasar.
              if (e.pointerType === 'mouse' || e.buttons > 0) apuntar(e)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') setElegido((i) => Math.max(0, i - 1))
              else if (e.key === 'ArrowRight') setElegido((i) => Math.min(puntos.length - 1, i + 1))
              else return
              e.preventDefault()
            }}
            className="relative touch-pan-y rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900"
            style={{ height: ALTO }}
          >
            {escala.marcas.map((marca) => (
              <span
                key={marca}
                aria-hidden
                className={`pointer-events-none absolute inset-x-0 h-px ${marca === 0 ? 'bg-slate-400' : 'bg-slate-100'}`}
                style={{ bottom: `${porcentaje(marca, escala.min, escala.max)}%` }}
              />
            ))}

            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              aria-hidden
            >
              <path d={area} className="fill-saldo" fillOpacity={0.08} />
              <path
                d={trazo}
                fill="none"
                className="stroke-saldo"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* La línea vertical que sigue al dedo, y el punto del día elegido. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-px bg-slate-300"
              style={{ left: `${x(actual.fecha)}%` }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-saldo ring-2 ring-white"
              style={{ left: `${x(actual.fecha)}%`, bottom: `${100 - y(actual.saldo)}%` }}
            />
          </div>

          <div className="cifras mt-1.5 flex justify-between text-[11px] text-slate-500" aria-hidden>
            <span>{formatearFecha(puntos[0].fecha)}</span>
            {x1 > x0 && <span>{formatearFecha(puntos.at(-1)!.fecha)}</span>}
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
              <th className="py-1 font-medium">Día</th>
              <th className="py-1 text-right font-medium">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {puntos.map((p) => (
              <tr key={p.fecha} className="border-t border-slate-100">
                <td className="py-1.5">{formatearFecha(p.fecha)}</td>
                <td className="py-1.5 text-right">{formatearSaldo(p.saldo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
