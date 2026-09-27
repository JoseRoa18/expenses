import { describe, it, expect } from 'vitest'
import { aCsv } from '@/lib/csv'

const sinBom = (texto: string) => texto.replace(/^﻿/, '')

describe('aCsv', () => {
  it('empieza con la marca BOM para que Excel lea bien las tildes', () => {
    expect(aCsv([['a']]).startsWith('﻿')).toBe(true)
  })

  it('separa con punto y coma y escribe los decimales con coma', () => {
    expect(sinBom(aCsv([['Azúcar', 1500.5, null]]))).toBe('Azúcar;1500,5;\r\n')
  })

  it('pone entre comillas lo que trae punto y coma, comillas o saltos de línea', () => {
    expect(sinBom(aCsv([['uno; dos', 'dice "hola"', 'a\nb']]))).toBe(
      '"uno; dos";"dice ""hola""";"a\nb"\r\n',
    )
  })

  it('no deja que una descripción se ejecute como fórmula', () => {
    expect(sinBom(aCsv([['=HYPERLINK("x")', '+1', '-2', '@SUM(A1)']]))).toBe(
      `"'=HYPERLINK(""x"")";'+1;'-2;'@SUM(A1)\r\n`,
    )
  })

  it('un número negativo sigue siendo un número', () => {
    expect(sinBom(aCsv([[-12.5]]))).toBe('-12,5\r\n')
  })
})
