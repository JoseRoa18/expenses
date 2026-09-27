import { describe, it, expect } from 'vitest'
import { resumir } from '@/lib/resumen'
import type { Aporte, CompraDetallada } from '@/lib/tipos'

const HOY = '2026-09-27'
const ALIX = 'alix'
const JOSE = 'jose'

function compra(parcial: Partial<CompraDetallada>): CompraDetallada {
  return {
    id: crypto.randomUUID(),
    solicitud_id: null,
    registrada_por: JOSE,
    descripcion: 'Algo',
    monto_bs: 0,
    monto_usd: 10,
    notas: '',
    fecha_compra: '2026-09-10',
    fecha_entrega: null,
    created_at: '2026-09-10T12:00:00Z',
    facturas: [],
    solicitud: null,
    ...parcial,
  }
}

function aporte(parcial: Partial<Aporte>): Aporte {
  return {
    id: crypto.randomUUID(),
    registrada_por: JOSE,
    monto_usd: 100,
    fecha: '2026-09-01',
    metodo: 'Zelle',
    notas: '',
    created_at: '2026-09-01T12:00:00Z',
    ...parcial,
  }
}

const SEPTIEMBRE = { desde: '2026-09-01', hasta: HOY }

describe('resumir', () => {
  it('suma lo recibido y lo gastado solo dentro del período', () => {
    const r = resumir(
      [compra({ monto_usd: 30 }), compra({ monto_usd: 999, fecha_compra: '2026-08-31' })],
      [aporte({ monto_usd: 100 }), aporte({ monto_usd: 500, fecha: '2026-08-15' })],
      SEPTIEMBRE,
      HOY,
    )
    expect(r.recibido).toBe(100)
    expect(r.gastado).toBe(30)
    expect(r.diferencia).toBe(70)
    expect(r.cantidadGastos).toBe(1)
    expect(r.cantidadAportes).toBe(1)
  })

  it('el saldo arranca con lo que quedó de antes del período', () => {
    const r = resumir(
      [compra({ monto_usd: 30 }), compra({ monto_usd: 200, fecha_compra: '2026-08-20' })],
      [aporte({ monto_usd: 100 }), aporte({ monto_usd: 500, fecha: '2026-08-15' })],
      SEPTIEMBRE,
      HOY,
    )
    expect(r.saldoInicial).toBe(300)
    expect(r.saldoFinal).toBe(370)
    expect(r.saldo[0]).toEqual({ fecha: '2026-09-01', saldo: 400 })
  })

  it('la línea del saldo cambia una vez por día, y llega hasta hoy', () => {
    const r = resumir(
      [compra({ monto_usd: 10, fecha_compra: '2026-09-10' }), compra({ monto_usd: 5, fecha_compra: '2026-09-10' })],
      [aporte({ monto_usd: 100, fecha: '2026-09-03' })],
      SEPTIEMBRE,
      HOY,
    )
    expect(r.saldo).toEqual([
      { fecha: '2026-09-01', saldo: 0 },
      { fecha: '2026-09-03', saldo: 100 },
      { fecha: '2026-09-10', saldo: 85 },
      { fecha: HOY, saldo: 85 },
    ])
  })

  it('el saldo puede quedar negativo: alguien puso de su bolsillo', () => {
    const r = resumir([compra({ monto_usd: 150 })], [aporte({ monto_usd: 100 })], SEPTIEMBRE, HOY)
    expect(r.saldoFinal).toBe(-50)
  })

  it('no arrastra errores de decimales', () => {
    const r = resumir(
      [compra({ monto_usd: 0.1 }), compra({ monto_usd: 0.2 })],
      [aporte({ monto_usd: 0.3 })],
      SEPTIEMBRE,
      HOY,
    )
    expect(r.gastado).toBe(0.3)
    expect(r.diferencia).toBe(0)
  })

  it('arma un mes por cada mes del período, aunque alguno esté vacío', () => {
    const r = resumir(
      [compra({ monto_usd: 20, fecha_compra: '2026-07-05' }), compra({ monto_usd: 15, fecha_compra: '2026-09-05' })],
      [aporte({ monto_usd: 100, fecha: '2026-07-01' })],
      { desde: '2026-07-01', hasta: HOY },
      HOY,
    )
    expect(r.meses).toEqual([
      { mes: '2026-07', recibido: 100, gastado: 20 },
      { mes: '2026-08', recibido: 0, gastado: 0 },
      { mes: '2026-09', recibido: 0, gastado: 15 },
    ])
    expect(r.promedioMensual).toBeCloseTo(35 / 3, 2)
  })

  it('con "todo", los meses empiezan en el primer movimiento', () => {
    const r = resumir([compra({ fecha_compra: '2026-08-20' })], [], { desde: null, hasta: null }, HOY)
    expect(r.meses.map((m) => m.mes)).toEqual(['2026-08', '2026-09'])
    expect(r.saldoInicial).toBe(0)
  })

  it('sin ningún movimiento no hay meses ni línea', () => {
    const r = resumir([], [], { desde: null, hasta: null }, HOY)
    expect(r.meses).toEqual([])
    expect(r.saldo).toEqual([])
    expect(r.tasaPromedio).toBeNull()
    expect(r.promedioMensual).toBeNull()
  })

  it('un período que ya terminó no se estira hasta hoy', () => {
    const r = resumir([compra({ fecha_compra: '2026-08-10' })], [], { desde: '2026-08-01', hasta: '2026-08-31' }, HOY)
    expect(r.meses.map((m) => m.mes)).toEqual(['2026-08'])
    expect(r.saldo.at(-1)?.fecha).toBe('2026-08-31')
  })

  it('reparte por persona', () => {
    const r = resumir(
      [compra({ registrada_por: ALIX, monto_usd: 5 }), compra({ registrada_por: JOSE, monto_usd: 7 })],
      [aporte({ registrada_por: ALIX, monto_usd: 50 })],
      SEPTIEMBRE,
      HOY,
    )
    expect(r.personas).toEqual(
      expect.arrayContaining([
        { id: ALIX, recibido: 50, gastado: 5 },
        { id: JOSE, recibido: 0, gastado: 7 },
      ]),
    )
  })

  it('agrupa el dinero por método sin distinguir mayúsculas', () => {
    const r = resumir(
      [],
      [aporte({ metodo: 'Zelle', monto_usd: 10 }), aporte({ metodo: 'zelle', monto_usd: 5 }), aporte({ metodo: 'Efectivo', monto_usd: 20 })],
      SEPTIEMBRE,
      HOY,
    )
    expect(r.metodos).toEqual([
      { clave: 'efectivo', etiqueta: 'Efectivo', monto: 20, cantidad: 1 },
      { clave: 'zelle', etiqueta: 'Zelle', monto: 15, cantidad: 2 },
    ])
  })

  it('más de seis métodos: los más chicos se juntan en "Otros", al final', () => {
    const aportes = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((metodo, i) =>
      aporte({ metodo, monto_usd: 100 - i }),
    )
    const r = resumir([], aportes, SEPTIEMBRE, HOY)
    expect(r.metodos).toHaveLength(6)
    expect(r.metodos.at(-1)).toEqual({ clave: '', etiqueta: 'Otros', monto: 95 + 94, cantidad: 2 })
  })

  it('cuenta lo que hay que revisar: sin factura y encargos sin entregar', () => {
    const r = resumir(
      [
        compra({ monto_usd: 10, facturas: [{ storage_path: 'a/b.jpg' }] }),
        compra({ monto_usd: 20 }),
        compra({ monto_usd: 30, solicitud_id: 's1' }),
        compra({ monto_usd: 40, solicitud_id: 's2', fecha_entrega: '2026-09-12' }),
      ],
      [],
      SEPTIEMBRE,
      HOY,
    )
    expect(r.sinFactura).toEqual({ cantidad: 3, monto: 90 })
    expect(r.porEntregar).toEqual({ cantidad: 1, monto: 30 })
    expect(r.encargos).toEqual({ cantidad: 2, monto: 70 })
    expect(r.sueltos).toEqual({ cantidad: 2, monto: 30 })
  })

  it('la tasa promedio pesa cada compra por su monto e ignora las que no traen bolívares', () => {
    const r = resumir(
      [
        compra({ monto_usd: 10, monto_bs: 1000 }),
        compra({ monto_usd: 30, monto_bs: 3600 }),
        compra({ monto_usd: 50, monto_bs: 0 }),
      ],
      [],
      SEPTIEMBRE,
      HOY,
    )
    expect(r.tasaPromedio).toBe(115)
  })

  it('los cinco gastos más grandes, de mayor a menor', () => {
    const r = resumir(
      [1, 9, 3, 7, 5, 8].map((monto_usd) => compra({ monto_usd })),
      [],
      SEPTIEMBRE,
      HOY,
    )
    expect(r.mayores.map((c) => c.monto_usd)).toEqual([9, 8, 7, 5, 3])
  })
})
