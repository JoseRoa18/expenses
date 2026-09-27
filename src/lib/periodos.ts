import { formatearFecha } from '@/lib/formato'

/**
 * Los períodos por los que se filtran gastos, dinero y el resumen.
 *
 * Son meses del calendario y no "los últimos 30 días": la gente de esta casa
 * piensa en "lo que se gastó en septiembre", y un gráfico mes a mes con el
 * primer mes cortado a la mitad engaña -- parece que ese mes se gastó poco.
 *
 * Todas las fechas son `YYYY-MM-DD`, como las columnas `date` de Postgres, y
 * se comparan como texto: en ese formato, el orden alfabético es el orden
 * del calendario. "Hoy" lo pone quien llama (con `hoyVenezuela()`), para que
 * estas funciones no dependan del reloj y se puedan probar.
 */

// "Todo" va primero: es con lo que abren las listas de gastos y de dinero,
// y el botón elegido no debe quedar escondido al final de la fila.
export const PERIODOS = ['todo', 'mes', 'mes_pasado', '3m', '6m', 'anio', 'rango'] as const
export type Periodo = (typeof PERIODOS)[number]

export const ETIQUETAS_PERIODO: Record<Periodo, string> = {
  mes: 'Este mes',
  mes_pasado: 'Mes pasado',
  '3m': '3 meses',
  '6m': '6 meses',
  anio: 'Este año',
  todo: 'Todo',
  rango: 'Fechas…',
}

/** Desde y hasta, ambos incluidos. `null` = sin límite por ese lado. */
export type Rango = { desde: string | null; hasta: string | null }

export function esPeriodo(valor: string): valor is Periodo {
  return (PERIODOS as readonly string[]).includes(valor)
}

/** Si el texto es una fecha `YYYY-MM-DD` que existe en el calendario. */
export function esFechaValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false
  const [anio, mes, dia] = texto.split('-').map(Number)
  if (mes < 1 || mes > 12 || dia < 1) return false
  return dia <= diasDelMes(anio, mes)
}

function diasDelMes(anio: number, mes: number): number {
  // El día 0 del mes siguiente es el último de este. Se usa UTC para que la
  // zona horaria de quien corre esto no mueva el día.
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate()
}

const dosCifras = (n: number) => String(n).padStart(2, '0')

/** El mes `YYYY-MM` movido `n` meses (negativo = hacia atrás). */
export function sumarMeses(mes: string, n: number): string {
  const [anio, m] = mes.split('-').map(Number)
  const indice = anio * 12 + (m - 1) + n
  return `${Math.floor(indice / 12)}-${dosCifras((indice % 12) + 1)}`
}

/** El primer día de un mes `YYYY-MM`. */
function primerDia(mes: string): string {
  return `${mes}-01`
}

/** El último día de un mes `YYYY-MM`. */
function ultimoDia(mes: string): string {
  const [anio, m] = mes.split('-').map(Number)
  return `${mes}-${dosCifras(diasDelMes(anio, m))}`
}

/**
 * El rango de fechas que cubre un período, visto desde `hoy`.
 *
 * "3 meses" son este mes y los dos anteriores completos; "6 meses", este y
 * los cinco anteriores. `desde` y `hasta` solo se usan con `rango`: si
 * vienen al revés se voltean, y si alguna no es una fecha real se ignora --
 * un filtro que no se entiende se queda sin ese límite en vez de romper la
 * pantalla.
 */
export function rangoDelPeriodo(
  periodo: Periodo,
  hoy: string,
  desde: string | null = null,
  hasta: string | null = null,
): Rango {
  const esteMes = hoy.slice(0, 7)

  switch (periodo) {
    case 'mes':
      return { desde: primerDia(esteMes), hasta: hoy }
    case 'mes_pasado': {
      const pasado = sumarMeses(esteMes, -1)
      return { desde: primerDia(pasado), hasta: ultimoDia(pasado) }
    }
    case '3m':
      return { desde: primerDia(sumarMeses(esteMes, -2)), hasta: hoy }
    case '6m':
      return { desde: primerDia(sumarMeses(esteMes, -5)), hasta: hoy }
    case 'anio':
      return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy }
    case 'todo':
      return { desde: null, hasta: null }
    case 'rango': {
      const d = desde && esFechaValida(desde) ? desde : null
      const h = hasta && esFechaValida(hasta) ? hasta : null
      if (d && h && d > h) return { desde: h, hasta: d }
      return { desde: d, hasta: h }
    }
  }
}

export function enRango(fecha: string, rango: Rango): boolean {
  const dia = fecha.slice(0, 10)
  if (rango.desde && dia < rango.desde) return false
  if (rango.hasta && dia > rango.hasta) return false
  return true
}

/** Todos los meses `YYYY-MM` de `desde` a `hasta`, ambos incluidos. */
export function mesesEntre(desde: string, hasta: string): string[] {
  const inicio = desde.slice(0, 7)
  const fin = hasta.slice(0, 7)
  if (inicio > fin) return []

  const meses: string[] = []
  // Tope defensivo: un rango absurdo (año 0001) no debe colgar la página.
  for (let mes = inicio; mes <= fin && meses.length < 600; mes = sumarMeses(mes, 1)) {
    meses.push(mes)
  }
  return meses
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "sep" o, con año, "sep 2026". */
export function etiquetaMes(mes: string, conAnio = false): string {
  const [anio, m] = mes.split('-')
  const nombre = MESES_CORTOS[Number(m) - 1]
  return conAnio ? `${nombre} ${anio}` : nombre
}

/** El rango dicho en palabras, para el pie de los totales. */
export function describirRango(rango: Rango): string {
  if (rango.desde && rango.hasta) {
    if (rango.desde === rango.hasta) return formatearFecha(rango.desde)
    return `${formatearFecha(rango.desde)} – ${formatearFecha(rango.hasta)}`
  }
  if (rango.desde) return `desde el ${formatearFecha(rango.desde)}`
  if (rango.hasta) return `hasta el ${formatearFecha(rango.hasta)}`
  return 'todo el historial'
}
