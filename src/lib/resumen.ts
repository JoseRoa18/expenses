import { claveMetodo } from '@/lib/filtros'
import { enRango, mesesEntre, type Rango } from '@/lib/periodos'
import type { Aporte, CompraDetallada } from '@/lib/tipos'

/**
 * Las cuentas de la pantalla de resumen: cuánto entró y cuánto salió en un
 * período, mes a mes, y cómo fue cambiando el saldo.
 *
 * Igual que `balance.ts`, todo se suma en centavos enteros y se devuelve en
 * dólares al final. El resumen suma cientos de movimientos, y es justo donde
 * 0,1 + 0,2 dejaría de cuadrar con la pantalla de balance.
 *
 * Recibe filas que la base ya filtró por sus políticas: a Alix le llegan solo
 * las suyas, así que su resumen no puede contar dinero ajeno aunque esta
 * función no sepa quién mira.
 */

const aCentavos = (usd: number) => Math.round(usd * 100)
const aDolares = (centavos: number) => centavos / 100

export type Suma = { cantidad: number; monto: number }

export type Resumen = {
  recibido: number
  gastado: number
  /** Recibido menos gastado dentro del período. */
  diferencia: number
  /** Lo que había en las bolsas el día antes de empezar el período. */
  saldoInicial: number
  /** Lo que quedó al terminar el período. */
  saldoFinal: number
  cantidadGastos: number
  cantidadAportes: number
  meses: { mes: string; recibido: number; gastado: number }[]
  /** Un punto por cada día en que el saldo cambió, más el principio y el final. */
  saldo: { fecha: string; saldo: number }[]
  personas: { id: string; recibido: number; gastado: number }[]
  metodos: { clave: string; etiqueta: string; monto: number; cantidad: number }[]
  mayores: CompraDetallada[]
  sinFactura: Suma
  /** Encargos comprados que todavía no se entregan. */
  porEntregar: Suma
  encargos: Suma
  sueltos: Suma
  /** Bolívares por dólar, ponderada por monto. `null` si ninguna compra trae bolívares. */
  tasaPromedio: number | null
  promedioMensual: number | null
}

/** Cuántos métodos se muestran por nombre; el resto se junta en "Otros". */
const METODOS_VISIBLES = 5

export function resumir(
  compras: CompraDetallada[],
  aportes: Aporte[],
  rango: Rango,
  hoy: string,
): Resumen {
  const comprasEnRango = compras.filter((c) => enRango(c.fecha_compra, rango))
  const aportesEnRango = aportes.filter((a) => enRango(a.fecha, rango))

  const recibido = sumar(aportesEnRango.map((a) => a.monto_usd))
  const gastado = sumar(comprasEnRango.map((c) => c.monto_usd))

  // Lo de antes del período no se ve en las barras, pero sí cuenta para el
  // saldo: sin esto, la línea de "septiembre" arrancaría en cero aunque la
  // bolsa llegara al mes con $300 dentro.
  const antes = (fecha: string) => rango.desde !== null && fecha.slice(0, 10) < rango.desde
  const saldoInicial =
    sumar(aportes.filter((a) => antes(a.fecha)).map((a) => a.monto_usd)) -
    sumar(compras.filter((c) => antes(c.fecha_compra)).map((c) => c.monto_usd))

  const fechas = [
    ...comprasEnRango.map((c) => c.fecha_compra),
    ...aportesEnRango.map((a) => a.fecha),
  ].sort()
  const primera = fechas[0] ?? null
  const ultima = fechas.at(-1) ?? null

  // El período termina hoy aunque diga "hasta fin de año": el resto todavía
  // no ha pasado. Si alguien anotó una compra con fecha futura, se estira
  // hasta ella para que no quede fuera del gráfico.
  const tope = ultima && ultima > hoy ? ultima : hoy
  const fin = rango.hasta && rango.hasta < tope ? rango.hasta : tope
  const inicio = rango.desde ?? primera

  const meses =
    inicio && inicio <= fin
      ? mesesEntre(inicio, fin).map((mes) => ({
          mes,
          recibido: aDolares(sumar(aportesEnRango.filter((a) => a.fecha.startsWith(mes)).map((a) => a.monto_usd))),
          gastado: aDolares(sumar(comprasEnRango.filter((c) => c.fecha_compra.startsWith(mes)).map((c) => c.monto_usd))),
        }))
      : []

  return {
    recibido: aDolares(recibido),
    gastado: aDolares(gastado),
    diferencia: aDolares(recibido - gastado),
    saldoInicial: aDolares(saldoInicial),
    saldoFinal: aDolares(saldoInicial + recibido - gastado),
    cantidadGastos: comprasEnRango.length,
    cantidadAportes: aportesEnRango.length,
    meses,
    saldo: serieDeSaldo(comprasEnRango, aportesEnRango, saldoInicial, rango.desde, inicio, fin),
    personas: porPersona(comprasEnRango, aportesEnRango),
    metodos: porMetodo(aportesEnRango),
    mayores: [...comprasEnRango]
      .sort((a, b) => b.monto_usd - a.monto_usd || b.fecha_compra.localeCompare(a.fecha_compra))
      .slice(0, 5),
    sinFactura: contar(comprasEnRango.filter((c) => c.facturas.length === 0)),
    porEntregar: contar(comprasEnRango.filter((c) => c.solicitud_id && !c.fecha_entrega)),
    encargos: contar(comprasEnRango.filter((c) => c.solicitud_id)),
    sueltos: contar(comprasEnRango.filter((c) => !c.solicitud_id)),
    tasaPromedio: tasaPonderada(comprasEnRango),
    promedioMensual: meses.length > 0 ? Math.round(gastado / meses.length) / 100 : null,
  }
}

/** La suma en centavos. */
function sumar(montos: number[]): number {
  return montos.reduce((total, monto) => total + aCentavos(monto), 0)
}

function contar(compras: CompraDetallada[]): Suma {
  return { cantidad: compras.length, monto: aDolares(sumar(compras.map((c) => c.monto_usd))) }
}

function serieDeSaldo(
  compras: CompraDetallada[],
  aportes: Aporte[],
  saldoInicial: number,
  desde: string | null,
  inicio: string | null,
  fin: string,
): { fecha: string; saldo: number }[] {
  if (!inicio || inicio > fin) return []

  const cambios = new Map<string, number>()
  for (const a of aportes) cambios.set(a.fecha, (cambios.get(a.fecha) ?? 0) + aCentavos(a.monto_usd))
  for (const c of compras) {
    cambios.set(c.fecha_compra, (cambios.get(c.fecha_compra) ?? 0) - aCentavos(c.monto_usd))
  }

  const puntos: { fecha: string; saldo: number }[] = []
  let saldo = saldoInicial

  // Con un período que empieza en una fecha, la línea arranca ahí con lo que
  // ya había. Con "todo", arranca en el primer movimiento.
  if (desde && !cambios.has(desde)) puntos.push({ fecha: desde, saldo: aDolares(saldo) })

  for (const fecha of [...cambios.keys()].sort()) {
    saldo += cambios.get(fecha)!
    puntos.push({ fecha, saldo: aDolares(saldo) })
  }

  // Y llega hasta el final del período, para que "hoy" se vea en el eje
  // aunque hoy no se haya movido nada.
  if (puntos.length > 0 && puntos.at(-1)!.fecha < fin) puntos.push({ fecha: fin, saldo: aDolares(saldo) })
  return puntos
}

function porPersona(compras: CompraDetallada[], aportes: Aporte[]): Resumen['personas'] {
  const cuentas = new Map<string, { recibido: number; gastado: number }>()
  const de = (id: string) => {
    if (!cuentas.has(id)) cuentas.set(id, { recibido: 0, gastado: 0 })
    return cuentas.get(id)!
  }
  for (const a of aportes) de(a.registrada_por).recibido += aCentavos(a.monto_usd)
  for (const c of compras) de(c.registrada_por).gastado += aCentavos(c.monto_usd)

  return [...cuentas].map(([id, { recibido, gastado }]) => ({
    id,
    recibido: aDolares(recibido),
    gastado: aDolares(gastado),
  }))
}

function porMetodo(aportes: Aporte[]): Resumen['metodos'] {
  const grupos = new Map<string, { etiqueta: string; centavos: number; cantidad: number }>()
  for (const a of aportes) {
    const clave = claveMetodo(a.metodo)
    const grupo = grupos.get(clave) ?? {
      etiqueta: a.metodo.trim() || 'Sin especificar',
      centavos: 0,
      cantidad: 0,
    }
    grupo.centavos += aCentavos(a.monto_usd)
    grupo.cantidad++
    grupos.set(clave, grupo)
  }

  const ordenados = [...grupos]
    .map(([clave, g]) => ({ clave, etiqueta: g.etiqueta, centavos: g.centavos, cantidad: g.cantidad }))
    .sort((a, b) => b.centavos - a.centavos)

  // Más de cinco barras con nombre no se leen en un teléfono. El resto se
  // junta en una sola, que se queda al final aunque pese más que alguna.
  const visibles = ordenados.length > METODOS_VISIBLES + 1 ? ordenados.slice(0, METODOS_VISIBLES) : ordenados
  const resto = ordenados.slice(visibles.length)
  const filas = visibles.map((m) => ({ ...m }))
  if (resto.length > 0) {
    filas.push({
      clave: '',
      etiqueta: 'Otros',
      centavos: resto.reduce((t, m) => t + m.centavos, 0),
      cantidad: resto.reduce((t, m) => t + m.cantidad, 0),
    })
  }

  return filas.map(({ clave, etiqueta, centavos, cantidad }) => ({
    clave,
    etiqueta,
    monto: aDolares(centavos),
    cantidad,
  }))
}

function tasaPonderada(compras: CompraDetallada[]): number | null {
  const conBs = compras.filter((c) => c.monto_bs > 0 && c.monto_usd > 0)
  if (conBs.length === 0) return null
  const bs = sumar(conBs.map((c) => c.monto_bs))
  const usd = sumar(conBs.map((c) => c.monto_usd))
  return Math.round((bs / usd) * 100) / 100
}
