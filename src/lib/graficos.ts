/**
 * La escala del eje vertical de los gráficos.
 *
 * Las marcas del eje caen en números redondos (0, 50, 100, 150) y no en
 * "0, 37,4, 74,8": un eje con números raros obliga a hacer cuentas para
 * leer una barra, y justamente para no hacer cuentas está el gráfico.
 *
 * El cero siempre queda dentro. Una barra que no arranca de cero miente
 * sobre cuánto más grande es una que otra.
 */

export type Escala = { min: number; max: number; marcas: number[] }

export function escalaBonita(minimo: number, maximo: number, cuantas = 4): Escala {
  let min = Math.min(0, minimo)
  let max = Math.max(0, maximo)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, marcas: [0, 1] }
  if (max === min) max = min + 1

  const paso = pasoBonito((max - min) / cuantas)
  min = Math.floor(min / paso) * paso
  max = Math.ceil(max / paso) * paso

  const marcas: number[] = []
  // Redondear cada marca evita que 0,1 + 0,2 deje "0,30000000000000004"
  // escrito en el eje.
  for (let v = min; v <= max + paso / 2; v += paso) marcas.push(Math.round(v * 100) / 100)
  return { min, max, marcas }
}

/** El número 1, 2 o 5 × 10ⁿ más cercano por arriba. */
function pasoBonito(bruto: number): number {
  const magnitud = 10 ** Math.floor(Math.log10(bruto))
  const resto = bruto / magnitud
  const factor = resto > 5 ? 10 : resto > 2 ? 5 : resto > 1 ? 2 : 1
  return factor * magnitud
}

/** Dónde cae `valor` entre `min` y `max`, de 0 a 100. */
export function porcentaje(valor: number, min: number, max: number): number {
  if (max === min) return 0
  return ((valor - min) / (max - min)) * 100
}
