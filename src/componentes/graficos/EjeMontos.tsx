import { porcentaje, type Escala } from '@/lib/graficos'
import { formatearUsdCorto } from '@/lib/formato'

/**
 * La columna de montos a la izquierda de un gráfico.
 *
 * Su ancho lo da la etiqueta más larga, no un número fijo. Antes medía 56 px
 * a mano, y una etiqueta más larga -- un saldo negativo ("−$1,5 mil"), un
 * monto de cinco cifras ("$12,5 mil") -- se salía de la tarjeta por la
 * izquierda. Ahora las etiquetas se escriben dos veces: una invisible y en
 * fila, que es la que ensancha la columna, y otra encima, cada una a la
 * altura de su línea de guía.
 */
export function EjeMontos({ escala, alto }: { escala: Escala; alto: number }) {
  const etiquetas = escala.marcas.map((marca) => ({ marca, texto: formatearUsdCorto(marca) }))

  return (
    <div className="relative shrink-0 pr-2" style={{ height: alto }} aria-hidden>
      <span className="invisible flex h-0 flex-col overflow-hidden">
        {etiquetas.map(({ marca, texto }) => (
          <span key={marca} className="cifras text-[11px] whitespace-nowrap">
            {texto}
          </span>
        ))}
      </span>
      {etiquetas.map(({ marca, texto }) => (
        <span
          key={marca}
          className="cifras absolute right-2 translate-y-1/2 text-[11px] whitespace-nowrap text-slate-500"
          style={{ bottom: `${porcentaje(marca, escala.min, escala.max)}%` }}
        >
          {texto}
        </span>
      ))}
    </div>
  )
}
