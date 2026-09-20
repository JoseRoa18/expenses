/**
 * Convierte lo que una persona escribe en un campo de monto a un número.
 *
 * En Venezuela los montos se escriben con punto de millares y coma decimal
 * (1.500,50). Esta pantalla también acepta la notación en inglés (1500.50)
 * porque a veces el número se copia y pega de una calculadora. Nunca
 * adivina: si el texto no calza limpiamente con uno de los formatos
 * reconocidos, devuelve `null` en vez de arriesgarse a guardar el número
 * equivocado en un libro de cuentas.
 *
 * Decisiones sobre los casos ambiguos:
 *
 * - Un solo punto seguido de 1 o 2 dígitos se lee como punto decimal en
 *   inglés: "1500.50" y "1.50" son 1500,5 y 1,5.
 * - Un solo punto seguido de exactamente 3 dígitos se lee como separador de
 *   millares: "1.500" son mil quinientos, no uno coma cinco. Esta app nunca
 *   maneja montos con 3 decimales, así que no hay ambigüedad real entre
 *   "millares" y "decimal de 3 cifras".
 * - Varios puntos sin ninguna coma son varios grupos de millares:
 *   "1.500.000" son un millón quinientos mil.
 * - Una coma sola, seguida de 1 o 2 dígitos, es el separador decimal
 *   venezolano: "12,50" son doce con cincuenta centavos.
 * - Una coma sola seguida de exactamente 3 dígitos ("1,500") es realmente
 *   ambigua: podría ser "1,50" con un cero de más, o "mil quinientos" al
 *   estilo estadounidense (coma de millares). No hay forma de adivinar cuál
 *   quiso decir la persona, así que se rechaza en vez de arriesgar el
 *   número: quien quiera decir mil quinientos escribe "1.500" o "1500,00".
 * - Punto de millares y coma decimal combinados ("1.500,50") se leen juntos
 *   de la forma esperada.
 */
export function parsearMonto(texto: string): number | null {
  const limpio = texto.trim()
  if (!limpio) return null
  if (!/^[0-9.,]+$/.test(limpio)) return null

  const comas = (limpio.match(/,/g) ?? []).length
  const puntos = (limpio.match(/\./g) ?? []).length

  if (comas > 1) return null

  if (comas === 1) {
    const [parteEntera, decimales] = limpio.split(',')
    if (!/^\d{1,2}$/.test(decimales)) return null

    if (puntos === 0) {
      if (!/^\d+$/.test(parteEntera)) return null
      return Number(`${parteEntera}.${decimales}`)
    }

    const grupos = parteEntera.split('.')
    if (!gruposDeMillaresValidos(grupos)) return null
    return Number(`${grupos.join('')}.${decimales}`)
  }

  // Sin ninguna coma a partir de aquí.
  if (puntos === 0) {
    if (!/^\d+$/.test(limpio)) return null
    return Number(limpio)
  }

  if (puntos === 1) {
    const [entero, resto] = limpio.split('.')
    if (/^\d+$/.test(entero) && /^\d{1,2}$/.test(resto)) {
      // Un punto con 1 o 2 dígitos detrás: decimal en inglés.
      return Number(limpio)
    }
    const grupos = limpio.split('.')
    if (!gruposDeMillaresValidos(grupos)) return null
    return Number(grupos.join(''))
  }

  // Más de un punto, sin coma: varios grupos de millares.
  const grupos = limpio.split('.')
  if (!gruposDeMillaresValidos(grupos)) return null
  return Number(grupos.join(''))
}

function gruposDeMillaresValidos(grupos: string[]): boolean {
  if (grupos.length < 2) return false
  if (!/^\d{1,3}$/.test(grupos[0])) return false
  return grupos.slice(1).every((grupo) => /^\d{3}$/.test(grupo))
}
