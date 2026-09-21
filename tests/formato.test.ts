import { describe, it, expect } from 'vitest'
import {
  formatearUsd,
  formatearBs,
  formatearFecha,
  formatearPeso,
  tituloBalance,
} from '@/lib/formato'
import { calcularBalance } from '@/lib/balance'

describe('formatearUsd', () => {
  it('usa coma decimal y siempre dos decimales', () => {
    expect(formatearUsd(157.5)).toBe('$157,50')
  })

  it('usa punto para los miles', () => {
    expect(formatearUsd(1234.56)).toBe('$1.234,56')
  })

  it('muestra el cero con decimales', () => {
    expect(formatearUsd(0)).toBe('$0,00')
  })
})

describe('formatearBs', () => {
  it('pone el sufijo Bs', () => {
    expect(formatearBs(1500)).toBe('1.500,00 Bs')
  })
})

describe('formatearFecha', () => {
  it('muestra día, mes abreviado y año', () => {
    expect(formatearFecha('2026-09-20')).toBe('20 sep 2026')
  })
})

describe('TITULOS_BALANCE', () => {
  it('cuando sobra dinero, dice que está disponible', () => {
    expect(tituloBalance(calcularBalance([500], [342.5]).estado, 'Alix')).toBe('Disponible')
  })

  it('cuando la persona puso de lo suyo, lo dice con su nombre', () => {
    // Antes este rótulo decía "A favor de Jose" siempre, porque solo existía
    // su bolsa. Ahora hay una por persona y el nombre no se puede fijar.
    expect(tituloBalance(calcularBalance([500], [642.5]).estado, 'Alix')).toBe('A favor de Alix')
  })

  it('el mismo estado con otra persona dice el otro nombre', () => {
    expect(tituloBalance(calcularBalance([500], [642.5]).estado, 'Jose')).toBe('A favor de Jose')
  })

  it('cuando cuadra, dice que está al día', () => {
    expect(tituloBalance(calcularBalance([100], [100]).estado, 'Alix')).toBe('Al día')
  })
})

describe('formatearPeso', () => {
  it('muestra los bytes sueltos tal cual', () => {
    expect(formatearPeso(512)).toBe('512 B')
  })

  it('muestra los kilobytes sin decimales', () => {
    // A este tamaño el decimal no le dice nada a nadie.
    expect(formatearPeso(780 * 1024)).toBe('780 KB')
  })

  it('muestra los megabytes con un decimal, a la venezolana', () => {
    expect(formatearPeso(4.2 * 1024 * 1024)).toBe('4,2 MB')
  })

  it('un mega exacto se escribe con su decimal', () => {
    // '1 MB' y '1,0 MB' mezclados en la misma lista se ven descuidados.
    expect(formatearPeso(1024 * 1024)).toBe('1,0 MB')
  })

  it('justo por debajo del mega sigue siendo KB', () => {
    expect(formatearPeso(1024 * 1024 - 1)).toBe('1024 KB')
  })

  it('un archivo vacío no rompe', () => {
    expect(formatearPeso(0)).toBe('0 B')
  })
})
