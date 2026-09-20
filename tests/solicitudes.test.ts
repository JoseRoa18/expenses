import { describe, it, expect } from 'vitest'
import {
  puedeEditar,
  puedeCancelar,
  puedeComprar,
  puedeRechazar,
  puedeEntregar,
  ETIQUETAS_ESTADO,
} from '@/lib/solicitudes'
import type { EstadoSolicitud } from '@/lib/tipos'

const TODOS: EstadoSolicitud[] = [
  'pendiente',
  'comprada',
  'entregada',
  'rechazada',
  'cancelada',
]

describe('puedeEditar', () => {
  it('el autor puede editar mientras está pendiente', () => {
    expect(puedeEditar('pendiente', true)).toBe(true)
  })

  it('quien no es el autor no puede editar, ni estando pendiente', () => {
    expect(puedeEditar('pendiente', false)).toBe(false)
  })

  it('nadie puede editar una vez comprada', () => {
    expect(puedeEditar('comprada', true)).toBe(false)
  })

  it('ningún estado cerrado admite edición', () => {
    for (const estado of ['comprada', 'entregada', 'rechazada', 'cancelada'] as const) {
      expect(puedeEditar(estado, true)).toBe(false)
    }
  })
})

describe('puedeCancelar', () => {
  it('el autor puede cancelar mientras está pendiente', () => {
    expect(puedeCancelar('pendiente', true)).toBe(true)
  })

  it('quien no es el autor no puede cancelar', () => {
    expect(puedeCancelar('pendiente', false)).toBe(false)
  })

  it('no se puede cancelar algo ya comprado', () => {
    expect(puedeCancelar('comprada', true)).toBe(false)
  })
})

describe('puedeComprar', () => {
  it('solo desde pendiente', () => {
    expect(puedeComprar('pendiente')).toBe(true)
    for (const estado of TODOS.filter((e) => e !== 'pendiente')) {
      expect(puedeComprar(estado)).toBe(false)
    }
  })
})

describe('puedeRechazar', () => {
  it('solo desde pendiente', () => {
    expect(puedeRechazar('pendiente')).toBe(true)
    for (const estado of TODOS.filter((e) => e !== 'pendiente')) {
      expect(puedeRechazar(estado)).toBe(false)
    }
  })
})

describe('puedeEntregar', () => {
  it('solo desde comprada', () => {
    expect(puedeEntregar('comprada')).toBe(true)
    for (const estado of TODOS.filter((e) => e !== 'comprada')) {
      expect(puedeEntregar(estado)).toBe(false)
    }
  })
})

describe('ETIQUETAS_ESTADO', () => {
  it('tiene un texto en español para cada estado', () => {
    for (const estado of TODOS) {
      expect(ETIQUETAS_ESTADO[estado]).toBeTruthy()
    }
  })
})
