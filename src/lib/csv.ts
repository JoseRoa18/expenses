/**
 * Archivos CSV para abrir en Excel o Google Sheets.
 *
 * Tres decisiones, todas pensadas para que el archivo se abra bien con doble
 * clic en una computadora en español:
 *
 * - Separador punto y coma. En español la coma es el separador decimal, y
 *   Excel en español espera `;` entre columnas. Con comas, abre todo en una
 *   sola columna.
 * - Decimales con coma y sin separador de millares: "1500,50". Excel lo lee
 *   como número y se puede sumar; "1.500,50" lo leería como texto.
 * - Marca BOM al principio. Sin ella, Excel adivina la codificación y
 *   "Azúcar" sale como "AzÃºcar".
 *
 * Y una de seguridad: una celda que empieza por `=`, `+`, `-` o `@` Excel la
 * ejecuta como fórmula. Las descripciones las escribe cualquiera de la casa,
 * así que esas celdas se escriben con un apóstrofo delante, que las deja
 * como texto.
 */

export type Celda = string | number | null

const BOM = '﻿'

export function aCsv(filas: Celda[][]): string {
  return BOM + filas.map((fila) => fila.map(celda).join(';')).join('\r\n') + '\r\n'
}

function celda(valor: Celda): string {
  if (valor === null) return ''
  if (typeof valor === 'number') return numero(valor)

  let texto = valor
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`
  if (/[;"\r\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`
  return texto
}

function numero(valor: number): string {
  if (!Number.isFinite(valor)) return ''
  // Un monto negativo no es texto que alguien escribió: no lleva apóstrofo.
  return (Math.round(valor * 100) / 100).toString().replace('.', ',')
}
