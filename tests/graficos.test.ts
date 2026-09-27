import { describe, it, expect } from 'vitest'
import { escalaBonita, porcentaje } from '@/lib/graficos'

describe('escalaBonita', () => {
  it('pone las marcas en números redondos y arranca en cero', () => {
    expect(escalaBonita(0, 374)).toEqual({ min: 0, max: 400, marcas: [0, 100, 200, 300, 400] })
  })

  it('siempre incluye el cero, aunque todo sea positivo', () => {
    expect(escalaBonita(120, 180).min).toBe(0)
  })

  it('con negativos, el cero queda en medio', () => {
    const escala = escalaBonita(-42, 130)
    expect(escala.min).toBeLessThan(0)
    expect(escala.marcas).toContain(0)
    expect(escala.max).toBeGreaterThanOrEqual(130)
  })

  it('no escribe decimales sucios en el eje', () => {
    expect(escalaBonita(0, 0.7).marcas).toEqual([0, 0.2, 0.4, 0.6, 0.8])
  })

  it('todo en cero no rompe', () => {
    expect(escalaBonita(0, 0).max).toBeGreaterThan(0)
  })
})

describe('porcentaje', () => {
  it('ubica un valor entre el mínimo y el máximo', () => {
    expect(porcentaje(50, 0, 200)).toBe(25)
    expect(porcentaje(0, -100, 100)).toBe(50)
  })
})
