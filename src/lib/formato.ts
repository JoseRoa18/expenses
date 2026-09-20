import type { EstadoBalance } from '@/lib/balance'

/**
 * El nombre de cada situación del balance. Vive aquí y solo aquí: la pantalla
 * lo lee de esta tabla en vez de repetir los textos.
 */
export const TITULOS_BALANCE: Record<EstadoBalance, string> = {
  disponible: 'Disponible',
  a_favor_de_jose: 'A favor de Jose',
  al_dia: 'Al día',
}

const numero = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

export function formatearUsd(monto: number): string {
  return `$${numero.format(monto)}`
}

export function formatearBs(monto: number): string {
  return `${numero.format(monto)} Bs`
}

/**
 * Recibe una fecha en formato ISO corto (`2026-09-20`) tal como la devuelve
 * Postgres para una columna `date`. Se parte a mano en vez de usar `new Date()`
 * porque construir una fecha desde ISO la interpreta en UTC y, en una zona
 * horaria negativa como la de Venezuela, mostraría el día anterior.
 */
export function formatearFecha(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split('-')
  return `${Number(dia)} ${MESES[Number(mes) - 1]} ${anio}`
}
