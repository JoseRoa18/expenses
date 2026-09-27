import Link from 'next/link'
import type { ReactNode } from 'react'
import { IconoDescargar } from '@/componentes/Iconos'
import { GraficoMeses } from '@/componentes/graficos/GraficoMeses'
import { GraficoSaldo } from '@/componentes/graficos/GraficoSaldo'
import { Barras } from '@/componentes/graficos/Barras'
import { Leyenda } from '@/componentes/graficos/Leyenda'
import type { Rango } from '@/lib/periodos'
import type { Resumen } from '@/lib/resumen'
import {
  formatearBs,
  formatearFecha,
  formatearSaldo,
  formatearUsd,
  formatearUsdConSigno,
} from '@/lib/formato'

/**
 * El cuerpo de la pantalla de resumen: las cifras, los gráficos y los
 * avisos de un período que ya se sumó.
 *
 * Vive aparte de la página para que la página se ocupe solo de leer y
 * sumar, y esto solo de mostrar: recibe el resumen hecho y no pregunta nada
 * a la base.
 */
export function PanelResumen({
  resumen,
  rango,
  hoy,
  veTodo,
  porBolsa,
  nombrePorId,
  aGastos,
  aDescarga,
}: {
  resumen: Resumen
  rango: Rango
  hoy: string
  /** Si hay gastos de más de una persona a la vista (Jose y Yenny). */
  veTodo: boolean
  /** Si se muestra el reparto entre bolsillos (todos, no una persona). */
  porBolsa: boolean
  nombrePorId: Map<string, string>
  aGastos: (filtros: Record<string, string>) => string
  aDescarga: (tipo: 'gastos' | 'dinero') => string
}) {
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-2">
        <Cifra
          etiqueta="Recibido"
          muestra="recibido"
          valor={formatearUsd(resumen.recibido)}
          pie={`${resumen.cantidadAportes} ${resumen.cantidadAportes === 1 ? 'ingreso' : 'ingresos'}`}
        />
        <Cifra
          etiqueta="Gastado"
          muestra="gastado"
          valor={formatearUsd(resumen.gastado)}
          pie={`${resumen.cantidadGastos} ${resumen.cantidadGastos === 1 ? 'gasto' : 'gastos'}`}
        />
        <Cifra
          etiqueta="Diferencia"
          valor={formatearUsdConSigno(resumen.diferencia)}
          pie={resumen.diferencia >= 0 ? 'Entró más de lo que salió' : 'Salió más de lo que entró'}
        />
        <Cifra
          etiqueta={rango.hasta && rango.hasta < hoy ? 'Saldo al cierre' : 'Saldo hoy'}
          valor={formatearSaldo(resumen.saldoFinal)}
          pie={rango.desde ? `Empezó en ${formatearSaldo(resumen.saldoInicial)}` : 'Desde el principio'}
        />
      </dl>

      {resumen.meses.length >= 2 && (
        <Tarjeta titulo="Mes a mes">
          <GraficoMeses meses={resumen.meses} />
        </Tarjeta>
      )}

      {resumen.saldo.length >= 2 && (
        <Tarjeta
          titulo="Cómo fue cambiando el saldo"
          ayuda="Lo que quedaba en el bolsillo cada día. Por debajo de la línea del cero, alguien puso de su propio dinero."
        >
          <GraficoSaldo puntos={resumen.saldo} />
        </Tarjeta>
      )}

      {(resumen.sinFactura.cantidad > 0 || resumen.porEntregar.cantidad > 0) && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-medium text-slate-600">Para revisar</h2>
          <div className="flex flex-col gap-2">
            {resumen.sinFactura.cantidad > 0 && (
              <Aviso
                href={aGastos({ factura: 'sin' })}
                titulo={`${resumen.sinFactura.cantidad} ${resumen.sinFactura.cantidad === 1 ? 'gasto' : 'gastos'} sin factura`}
                monto={resumen.sinFactura.monto}
              />
            )}
            {resumen.porEntregar.cantidad > 0 && (
              <Aviso
                href={aGastos({ origen: 'encargo', entrega: 'por_entregar' })}
                titulo={`${resumen.porEntregar.cantidad} ${resumen.porEntregar.cantidad === 1 ? 'encargo comprado' : 'encargos comprados'} sin entregar`}
                monto={resumen.porEntregar.monto}
              />
            )}
          </div>
        </section>
      )}

      {porBolsa && resumen.personas.length > 1 && (
        <Tarjeta titulo="Por bolsillo" extra={<Leyenda series={['recibido', 'gastado']} />}>
          <Barras
            filas={resumen.personas
              .map((p) => ({ ...p, nombre: nombrePorId.get(p.id) ?? '—' }))
              .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
              .map((p) => ({
                clave: p.id,
                etiqueta: p.nombre,
                detalle: `Diferencia ${formatearUsdConSigno(p.recibido - p.gastado)}`,
                valores: [
                  { serie: 'recibido' as const, monto: p.recibido },
                  { serie: 'gastado' as const, monto: p.gastado },
                ],
              }))}
          />
        </Tarjeta>
      )}

      {resumen.cantidadGastos > 0 && (
        <Tarjeta titulo="En qué se fue el dinero">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Dato
              etiqueta="Encargos"
              valor={formatearUsd(resumen.encargos.monto)}
              pie={`${resumen.encargos.cantidad} ${resumen.encargos.cantidad === 1 ? 'compra' : 'compras'}`}
            />
            <Dato
              etiqueta="Gastos sueltos"
              valor={formatearUsd(resumen.sueltos.monto)}
              pie={`${resumen.sueltos.cantidad} ${resumen.sueltos.cantidad === 1 ? 'compra' : 'compras'}`}
            />
            {resumen.promedioMensual !== null && resumen.meses.length > 1 && (
              <Dato etiqueta="Promedio por mes" valor={formatearUsd(resumen.promedioMensual)} />
            )}
            {resumen.tasaPromedio !== null && (
              <Dato
                etiqueta="Tasa promedio"
                valor={`${formatearBs(resumen.tasaPromedio)}/$`}
                pie="De las compras con monto en Bs"
              />
            )}
          </dl>

          <h3 className="mt-5 mb-2 text-xs font-medium text-slate-600">Los gastos más grandes</h3>
          <ol className="flex flex-col">
            {resumen.mayores.map((c) => (
              <li
                key={c.id}
                className="flex items-start justify-between gap-3 border-t border-slate-100 py-2 first:border-t-0"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-slate-800">{c.descripcion}</span>
                  <span className="cifras block text-xs text-slate-500">
                    {veTodo && `${nombrePorId.get(c.registrada_por) ?? '—'} · `}
                    {formatearFecha(c.fecha_compra)}
                  </span>
                </span>
                <span className="cifras shrink-0 text-sm font-semibold text-slate-900">
                  {formatearUsd(c.monto_usd)}
                </span>
              </li>
            ))}
          </ol>
        </Tarjeta>
      )}

      {resumen.metodos.length > 0 && (
        <Tarjeta titulo="Por dónde llegó el dinero">
          <Barras
            filas={resumen.metodos.map((m) => ({
              clave: m.clave || 'otros',
              etiqueta: m.etiqueta,
              detalle: `${m.cantidad} ${m.cantidad === 1 ? 'vez' : 'veces'}`,
              valores: [{ serie: 'recibido' as const, monto: m.monto }],
            }))}
          />
        </Tarjeta>
      )}

      <div className="flex flex-wrap justify-center gap-x-5 px-1">
        <a
          href={aDescarga('gastos')}
          download
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-slate-600 underline underline-offset-2 active:text-slate-900"
        >
          <IconoDescargar className="h-4 w-4" />
          Descargar gastos
        </a>
        <a
          href={aDescarga('dinero')}
          download
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-slate-600 underline underline-offset-2 active:text-slate-900"
        >
          <IconoDescargar className="h-4 w-4" />
          Descargar ingresos
        </a>
      </div>
    </div>
  )
}

/**
 * Una cifra de la fila de arriba. La cifra va en letra de proporción normal
 * y no en `cifras` (ancho fijo): sola y grande, el ancho fijo la deja
 * desgarbada; el ancho fijo es para columnas que se alinean.
 */
function Cifra({
  etiqueta,
  valor,
  pie,
  muestra,
}: {
  etiqueta: string
  valor: string
  pie: string
  muestra?: 'recibido' | 'gastado'
}) {
  return (
    <div className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-900/5">
      <dt className="flex items-center gap-1.5 text-xs text-slate-600">
        {muestra && (
          <span
            aria-hidden
            className={`inline-block h-2.5 w-2.5 rounded-[2px] ${muestra === 'recibido' ? 'bg-recibido' : 'bg-gastado'}`}
          />
        )}
        {etiqueta}
      </dt>
      <dd className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{valor}</dd>
      <dd className="mt-0.5 text-xs text-slate-500">{pie}</dd>
    </div>
  )
}

function Dato({ etiqueta, valor, pie }: { etiqueta: string; valor: string; pie?: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{etiqueta}</dt>
      <dd className="font-semibold text-slate-900">{valor}</dd>
      {pie && <dd className="text-xs text-slate-500">{pie}</dd>}
    </div>
  )
}

function Tarjeta({
  titulo,
  ayuda,
  extra,
  children,
}: {
  titulo: string
  ayuda?: string
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-semibold text-slate-900">{titulo}</h2>
        {extra}
      </div>
      {ayuda && <p className="-mt-1 mb-3 text-xs text-slate-500">{ayuda}</p>}
      {children}
    </section>
  )
}

/**
 * Algo que conviene mirar. Ámbar como las solicitudes pendientes del
 * balance, que es el aviso que ya existía en la app, y siempre con texto:
 * el color solo acompaña.
 */
function Aviso({ href, titulo, monto }: { href: string; titulo: string; monto: number }) {
  return (
    <Link
      href={href}
      className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-amber-100 px-4 py-3 text-amber-900 active:bg-amber-200"
    >
      <span className="text-sm font-medium">{titulo}</span>
      <span className="cifras flex shrink-0 items-center gap-2 text-sm">
        {formatearUsd(monto)}
        <span aria-hidden>→</span>
      </span>
    </Link>
  )
}
