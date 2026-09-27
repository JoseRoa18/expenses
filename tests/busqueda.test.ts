import { describe, it, expect } from 'vitest'
import { coincideBusqueda, normalizarTexto } from '@/lib/busqueda'

describe('normalizarTexto', () => {
  it('quita tildes y pasa a minúsculas', () => {
    expect(normalizarTexto('Azúcar MORENA')).toBe('azucar morena')
  })

  it('la ñ se vuelve n: en el teléfono, "nino" es como se escribe "niño" con prisa', () => {
    expect(normalizarTexto('Ñame')).toBe('name')
  })

  it('colapsa los espacios de más', () => {
    expect(normalizarTexto('  dos   cajas ')).toBe('dos cajas')
  })
})

describe('coincideBusqueda', () => {
  it('encuentra sin tildes lo que se escribió con tildes', () => {
    expect(coincideBusqueda('azucar', 'Azúcar')).toBe(true)
  })

  it('y al revés', () => {
    expect(coincideBusqueda('Azúcar', 'azucar refinada')).toBe(true)
  })

  it('pide todas las palabras, en cualquier orden', () => {
    expect(coincideBusqueda('leche caja', 'Dos cajas de leche')).toBe(true)
    expect(coincideBusqueda('leche pan', 'Dos cajas de leche')).toBe(false)
  })

  it('busca en todos los campos a la vez', () => {
    expect(coincideBusqueda('farmatodo', 'Acetaminofén', 'Comprado en Farmatodo')).toBe(true)
  })

  it('una búsqueda vacía lo encuentra todo', () => {
    expect(coincideBusqueda('', 'lo que sea')).toBe(true)
    expect(coincideBusqueda('   ', 'lo que sea')).toBe(true)
  })

  it('ignora los campos vacíos o nulos', () => {
    expect(coincideBusqueda('pan', null, undefined, 'Pan')).toBe(true)
  })
})
