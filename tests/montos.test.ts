import { describe, it, expect } from 'vitest'
import { parsearMonto } from '@/lib/montos'

describe('parsearMonto', () => {
  it('lee el punto de millares venezolano', () => {
    expect(parsearMonto('1.500')).toBe(1500)
  })

  it('lee punto de millares y coma decimal juntos', () => {
    expect(parsearMonto('1.500,50')).toBe(1500.5)
  })

  it('lee una coma sola como separador decimal', () => {
    expect(parsearMonto('12,50')).toBe(12.5)
  })

  it('lee decimales menores a uno', () => {
    expect(parsearMonto('0,99')).toBe(0.99)
  })

  it('acepta un número plano sin separadores', () => {
    expect(parsearMonto('1500')).toBe(1500)
  })

  it('acepta la notación en inglés con punto decimal', () => {
    expect(parsearMonto('1500.50')).toBe(1500.5)
  })

  it('varios puntos son varios grupos de millares', () => {
    // Decisión: sin coma, todo punto es separador de millares. "1.500.000"
    // son mil quinientos mil, no un número con dos puntos decimales.
    expect(parsearMonto('1.500.000')).toBe(1500000)
  })

  it('rechaza una coma seguida de tres dígitos como ambigua', () => {
    // Decisión: una coma sola solo se lee como decimal si la siguen 1 o 2
    // dígitos (como los centavos de un monto). "1,500" podría significar
    // "1,50" (coma decimal con un cero de más) o "mil quinientos" (coma de
    // millares, estilo estadounidense) y no hay forma de saber cuál sin
    // preguntar. En vez de adivinar en un libro de cuentas, se rechaza y se
    // le pide a la persona que lo escriba sin ambigüedad: "1.500" o "1500,00".
    expect(parsearMonto('1,500')).toBeNull()
  })

  it('rechaza una coma seguida de tres decimales', () => {
    // "1.500,555" tiene punto de millares (válido) pero tres dígitos
    // después de la coma. Esta app nunca maneja montos con tres decimales
    // -- los guarda en `numeric(12,2)`/`numeric(14,2)` -- así que esto debe
    // rechazarse en vez de truncar en silencio a "1.500,55" (perdiendo el
    // último dígito) o dejar que el redondeo de la columna decida. Caso
    // elegido a propósito porque calza directo con la precisión real de la
    // columna, no solo con la forma del texto.
    expect(parsearMonto('1.500,555')).toBeNull()
  })

  it('rechaza el texto vacío', () => {
    expect(parsearMonto('')).toBeNull()
  })

  it('rechaza texto que no es un número', () => {
    expect(parsearMonto('abc')).toBeNull()
  })

  it('rechaza dos comas', () => {
    expect(parsearMonto('1,2,3')).toBeNull()
  })

  it('rechaza números negativos', () => {
    expect(parsearMonto('-5')).toBeNull()
  })

  it('rechaza espacios internos', () => {
    expect(parsearMonto('1 500')).toBeNull()
  })

  it('un punto con dos dígitos detrás se lee como decimal en inglés', () => {
    expect(parsearMonto('1.50')).toBe(1.5)
  })

  it('rechaza un punto con un grupo de millares incompleto', () => {
    // Ni decimal (más de 2 dígitos tras el punto) ni millares (el grupo no
    // tiene exactamente 3 dígitos): no se reconoce.
    expect(parsearMonto('1.5000')).toBeNull()
  })

  it('rechaza un grupo de millares con más de tres dígitos', () => {
    expect(parsearMonto('12.34.5678')).toBeNull()
  })

  it('acepta espacios al inicio o al final', () => {
    expect(parsearMonto('  1.500,50  ')).toBe(1500.5)
  })
})
