import { describe, it, expect } from 'vitest'
import { leerPorTrozos, TAMANO_TROZO } from '@/lib/paginado'

/** Una "tabla" de `total` filas que nunca devuelve más de `tope` por consulta. */
function tabla(total: number, tope = TAMANO_TROZO) {
  const filas = Array.from({ length: total }, (_, i) => i)
  const pedidos: [number, number][] = []
  const pedir = async (desde: number, hasta: number) => {
    pedidos.push([desde, hasta])
    return { data: filas.slice(desde, Math.min(hasta + 1, desde + tope)), error: null, count: total }
  }
  return { pedir, pedidos }
}

describe('leerPorTrozos', () => {
  it('lee de una vez una tabla chica', async () => {
    const { pedir, pedidos } = tabla(12)
    expect(await leerPorTrozos(pedir)).toHaveLength(12)
    expect(pedidos).toHaveLength(1)
  })

  it('sigue pidiendo hasta tener todas las filas, pasadas las mil', async () => {
    const { pedir } = tabla(2345)
    const filas = await leerPorTrozos(pedir)
    expect(filas).toHaveLength(2345)
    expect(filas?.at(-1)).toBe(2344)
  })

  it('funciona aunque la base corte antes de lo pedido', async () => {
    // Un proyecto con el tope en 300: pedir 1.000 y avanzar 1.000 se saltaría filas.
    const { pedir } = tabla(700, 300)
    const filas = await leerPorTrozos(pedir)
    expect(filas).toEqual(Array.from({ length: 700 }, (_, i) => i))
  })

  it('una tabla vacía da una lista vacía, no un fallo', async () => {
    const { pedir } = tabla(0)
    expect(await leerPorTrozos(pedir)).toEqual([])
  })

  it('si un trozo falla, falla todo: media lista no es la lista', async () => {
    let vuelta = 0
    const pedir = async (desde: number, hasta: number) => {
      vuelta++
      if (vuelta === 2) return { data: null, error: new Error('se cayó'), count: null }
      return { data: Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i), error: null, count: 3000 }
    }
    expect(await leerPorTrozos(pedir)).toBeNull()
  })
})
