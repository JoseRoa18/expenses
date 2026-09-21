import { describe, it, expect } from 'vitest'
import { calcularBalance, tasaImplicita } from '@/lib/balance'

describe('calcularBalance', () => {
  it('cuando Yenny mandó más de lo gastado, queda dinero disponible', () => {
    const b = calcularBalance([200, 200, 150], [342.5])
    expect(b.totalAportes).toBe(550)
    expect(b.totalGastos).toBe(342.5)
    expect(b.neto).toBe(207.5)
    expect(b.estado).toBe('disponible')
    expect(b.monto).toBe(207.5)
  })

  it('cuando Jose gastó más de lo recibido, el saldo queda a su favor', () => {
    const b = calcularBalance([500], [642.5])
    expect(b.neto).toBe(-142.5)
    expect(b.estado).toBe('a_favor')
    expect(b.monto).toBe(142.5)
  })

  it('cuando coinciden exactamente, está al día', () => {
    const b = calcularBalance([100, 50], [150])
    expect(b.neto).toBe(0)
    expect(b.estado).toBe('al_dia')
    expect(b.monto).toBe(0)
  })

  it('sin movimientos, está al día en cero', () => {
    const b = calcularBalance([], [])
    expect(b.totalAportes).toBe(0)
    expect(b.totalGastos).toBe(0)
    expect(b.neto).toBe(0)
    expect(b.estado).toBe('al_dia')
  })

  it('no arrastra errores de decimales', () => {
    // Sumado como números sueltos, 0.1 + 0.2 da 0.30000000000000004
    const b = calcularBalance([0.1, 0.2], [0.3])
    expect(b.neto).toBe(0)
    expect(b.estado).toBe('al_dia')
  })

  it('acumula muchos movimientos pequeños sin desviarse', () => {
    const centavos = Array.from({ length: 300 }, () => 0.01)
    const b = calcularBalance(centavos, [])
    expect(b.totalAportes).toBe(3)
  })
})

describe('tasaImplicita', () => {
  it('divide bolívares entre dólares', () => {
    expect(tasaImplicita(1500, 12.5)).toBe(120)
  })

  it('redondea a dos decimales', () => {
    expect(tasaImplicita(1000, 3)).toBe(333.33)
  })

  it('devuelve null si el monto en dólares es cero', () => {
    expect(tasaImplicita(1500, 0)).toBeNull()
  })

  it('devuelve null si el monto en dólares es negativo', () => {
    expect(tasaImplicita(1500, -5)).toBeNull()
  })
})
