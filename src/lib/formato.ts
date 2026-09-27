import type { EstadoBalance } from '@/lib/balance'

/**
 * El rótulo de una bolsa. Vive aquí y solo aquí: la pantalla lo pide en vez
 * de repetir los textos.
 *
 * Lleva el nombre de la persona porque hay una bolsa por cada una, y el
 * único caso en que el rótulo dice de quién es -- haber puesto de lo suyo --
 * sería falso escrito en fijo. Antes era una tabla con "A favor de Jose"
 * dentro, de cuando solo existía su bolsa.
 */
export function tituloBalance(estado: EstadoBalance, nombre: string): string {
  if (estado === 'disponible') return 'Disponible'
  if (estado === 'a_favor') return `A favor de ${nombre}`
  return 'Al día'
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
 * Para montos que pueden ser negativos o que son una diferencia: "+$12,50",
 * "−$12,50" (con el signo menos de verdad, no un guion). `formatearUsd` a
 * secas dejaría "$-12,50", que se lee mal y se confunde con un guion.
 */
export function formatearUsdConSigno(monto: number): string {
  const centavos = Math.round(monto * 100)
  if (centavos === 0) return formatearUsd(0)
  return `${centavos > 0 ? '+' : '−'}${formatearUsd(Math.abs(centavos) / 100)}`
}

/** Como `formatearUsdConSigno`, pero sin el "+": para un saldo, no para una diferencia. */
export function formatearSaldo(monto: number): string {
  const centavos = Math.round(monto * 100)
  return centavos < 0 ? `−${formatearUsd(Math.abs(centavos) / 100)}` : formatearUsd(centavos / 100)
}

const hastaUnDecimal = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 1 })

/**
 * Montos cortos para los ejes de los gráficos: "$500", "$1,5 mil", "$2 M".
 * Se escribe a mano porque la notación compacta de `Intl` para es-VE mezcla
 * "K" y "k" según el tamaño, y en un eje eso parece un error.
 */
export function formatearUsdCorto(monto: number): string {
  const signo = monto < 0 ? '−' : ''
  const valor = Math.abs(monto)
  if (valor >= 1_000_000) return `${signo}$${hastaUnDecimal.format(valor / 1_000_000)} M`
  if (valor >= 1_000) return `${signo}$${hastaUnDecimal.format(valor / 1_000)} mil`
  return `${signo}$${hastaUnDecimal.format(valor)}`
}

/**
 * Recibe una fecha en formato ISO corto (`2026-09-20`) tal como la devuelve
 * Postgres para una columna `date`. Se parte a mano en vez de usar `new Date()`
 * porque construir una fecha desde ISO la interpreta en UTC y, en una zona
 * horaria negativa como la de Venezuela, mostraría el día anterior.
 *
 * Ojo: esto es para columnas `date` de verdad (`fecha_compra`, `fecha`,
 * `fecha_entrega`). Para una columna `timestamptz` (`created_at`,
 * `updated_at`) usar `formatearMarcaDeTiempo`: un `timestamptz` sí trae hora,
 * y tomar los primeros 10 caracteres de su ISO es tomar el día en UTC, no en
 * Venezuela.
 */
export function formatearFecha(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split('-')
  return `${Number(dia)} ${MESES[Number(mes) - 1]} ${anio}`
}

/**
 * Como `formatearFecha`, pero para una columna `timestamptz` (por ejemplo
 * `solicitud.created_at`). `iso.slice(0, 10)` sobre un timestamptz da la
 * fecha en UTC: en Venezuela (UTC-4, sin horario de verano) cualquier fila
 * creada después de las 20:00 hora local cae ya en el día siguiente en UTC,
 * y se mostraría un día adelantada. `Intl.DateTimeFormat` con
 * `timeZone: 'America/Caracas'` hace la conversión de verdad.
 */
export function formatearMarcaDeTiempo(iso: string): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
  const [anio, mes, dia] = partes.split('-')
  return `${Number(dia)} ${MESES[Number(mes) - 1]} ${anio}`
}

/**
 * El día de "hoy" en la zona horaria de Venezuela, en formato `date` de
 * Postgres (`YYYY-MM-DD`) -- no el día del servidor. Un servidor de Vercel
 * corre en UTC; `new Date().toISOString().slice(0, 10)` da el día en UTC, que
 * después de las 20:00 hora de Venezuela ya es el día siguiente ahí. Se usa
 * como valor por defecto en los formularios que registran dinero (compra,
 * entrega, aporte): esos valores por defecto deben reflejar el día de Jose,
 * no el del centro de datos.
 */
export function hoyVenezuela(): string {
  // Opciones explícitas (no solo `timeZone`): sin `month`/`day` en '2-digit',
  // 'en-CA' no garantiza el cero a la izquierda ("2026-9-20" en vez de
  // "2026-09-20"), y esto se usa tal cual como valor de una columna `date`.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

const unDecimal = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/**
 * El peso de un archivo, para que Jose vea qué le pasó a su foto al
 * comprimirla ("4,2 MB → 780 KB").
 *
 * En megas lleva un decimal y en kilos ninguno: a 780 KB, el decimal no le
 * dice nada a nadie, y en megas es justo lo que deja ver la diferencia.
 */
export function formatearPeso(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${unDecimal.format(bytes / (1024 * 1024))} MB`
}
