import { describe, it, expect } from 'vitest'
import {
  describirRango,
  enRango,
  esFechaValida,
  etiquetaMes,
  mesesEntre,
  rangoDelPeriodo,
  sumarMeses,
} from '@/lib/periodos'

const HOY = '2026-09-27'

describe('rangoDelPeriodo', () => {
  it('"este mes" va del día 1 hasta hoy', () => {
    expect(rangoDelPeriodo('mes', HOY)).toEqual({ desde: '2026-09-01', hasta: HOY })
  })

  it('"mes pasado" es el mes anterior completo', () => {
    expect(rangoDelPeriodo('mes_pasado', HOY)).toEqual({ desde: '2026-08-01', hasta: '2026-08-31' })
  })

  it('"mes pasado" en enero cae en diciembre del año anterior', () => {
    expect(rangoDelPeriodo('mes_pasado', '2027-01-10')).toEqual({
      desde: '2026-12-01',
      hasta: '2026-12-31',
    })
  })

  it('"mes pasado" sabe cuántos días tiene febrero', () => {
    expect(rangoDelPeriodo('mes_pasado', '2028-03-05').hasta).toBe('2028-02-29')
    expect(rangoDelPeriodo('mes_pasado', '2027-03-05').hasta).toBe('2027-02-28')
  })

  it('"3 meses" son meses completos: este y los dos anteriores', () => {
    expect(rangoDelPeriodo('3m', HOY)).toEqual({ desde: '2026-07-01', hasta: HOY })
  })

  it('"6 meses" cruza el cambio de año', () => {
    expect(rangoDelPeriodo('6m', '2027-02-15')).toEqual({ desde: '2026-09-01', hasta: '2027-02-15' })
  })

  it('"este año" empieza el 1 de enero', () => {
    expect(rangoDelPeriodo('anio', HOY)).toEqual({ desde: '2026-01-01', hasta: HOY })
  })

  it('"todo" no tiene límites', () => {
    expect(rangoDelPeriodo('todo', HOY)).toEqual({ desde: null, hasta: null })
  })

  it('un rango a mano con las fechas al revés se voltea', () => {
    expect(rangoDelPeriodo('rango', HOY, '2026-09-10', '2026-09-01')).toEqual({
      desde: '2026-09-01',
      hasta: '2026-09-10',
    })
  })

  it('una fecha que no existe se ignora, no rompe', () => {
    expect(rangoDelPeriodo('rango', HOY, '2026-02-30', '2026-09-01')).toEqual({
      desde: null,
      hasta: '2026-09-01',
    })
  })
})

describe('esFechaValida', () => {
  it('acepta fechas reales y rechaza las que no existen', () => {
    expect(esFechaValida('2026-09-27')).toBe(true)
    expect(esFechaValida('2028-02-29')).toBe(true)
    expect(esFechaValida('2027-02-29')).toBe(false)
    expect(esFechaValida('2026-13-01')).toBe(false)
    expect(esFechaValida('27/09/2026')).toBe(false)
    expect(esFechaValida('')).toBe(false)
  })
})

describe('enRango', () => {
  it('incluye los dos extremos', () => {
    const rango = { desde: '2026-09-01', hasta: '2026-09-30' }
    expect(enRango('2026-09-01', rango)).toBe(true)
    expect(enRango('2026-09-30', rango)).toBe(true)
    expect(enRango('2026-08-31', rango)).toBe(false)
    expect(enRango('2026-10-01', rango)).toBe(false)
  })

  it('un lado en null no limita', () => {
    expect(enRango('1999-01-01', { desde: null, hasta: '2026-01-01' })).toBe(true)
  })
})

describe('meses', () => {
  it('sumarMeses cruza años en los dos sentidos', () => {
    expect(sumarMeses('2026-12', 1)).toBe('2027-01')
    expect(sumarMeses('2026-01', -1)).toBe('2025-12')
    expect(sumarMeses('2026-09', -5)).toBe('2026-04')
  })

  it('mesesEntre incluye el primero y el último', () => {
    expect(mesesEntre('2026-11-15', '2027-02-03')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
  })

  it('mesesEntre de un solo mes', () => {
    expect(mesesEntre('2026-09-01', '2026-09-27')).toEqual(['2026-09'])
  })

  it('mesesEntre al revés no devuelve nada', () => {
    expect(mesesEntre('2026-10-01', '2026-09-01')).toEqual([])
  })

  it('etiquetaMes con y sin año', () => {
    expect(etiquetaMes('2026-09')).toBe('sep')
    expect(etiquetaMes('2026-09', true)).toBe('sep 2026')
  })
})

describe('describirRango', () => {
  it('dice el rango en palabras', () => {
    expect(describirRango({ desde: '2026-09-01', hasta: '2026-09-27' })).toBe('1 sep 2026 – 27 sep 2026')
    expect(describirRango({ desde: null, hasta: null })).toBe('todo el historial')
    expect(describirRango({ desde: '2026-09-01', hasta: null })).toBe('desde el 1 sep 2026')
  })
})
