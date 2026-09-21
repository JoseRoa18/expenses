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
