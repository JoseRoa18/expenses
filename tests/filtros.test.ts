import { describe, it, expect } from 'vitest'
import {
  conParametros,
  contarActivos,
  contarPorEstado,
  filtrarAportes,
  filtrarGastos,
  filtrarSolicitudes,
  leerCuantos,
  leerFiltrosDinero,
  leerFiltrosGastos,
  leerFiltrosResumen,
  leerFiltrosSolicitudes,
  metodosDistintos,
} from '@/lib/filtros'
import type { Aporte, CompraDetallada, Solicitud } from '@/lib/tipos'

const HOY = '2026-09-27'
const ALIX = '11111111-1111-4111-8111-111111111111'
const JOSE = '22222222-2222-4222-8222-222222222222'

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

function solicitud(parcial: Partial<Solicitud>): Solicitud {
  return {
    id: crypto.randomUUID(),
    creada_por: ALIX,
    titulo: 'Algo',
    cantidad: '',
    urgencia: 'normal',
    notas: '',
    estado: 'pendiente',
    motivo_rechazo: null,
    created_at: '2026-09-10T12:00:00Z',
    updated_at: '2026-09-10T12:00:00Z',
    ...parcial,
  }
}

function aporte(parcial: Partial<Aporte>): Aporte {
  return {
    id: crypto.randomUUID(),
    registrada_por: JOSE,
    monto_usd: 100,
    fecha: '2026-09-10',
    metodo: 'Zelle',
    notas: '',
    created_at: '2026-09-10T12:00:00Z',
    ...parcial,
  }
}

describe('leer filtros de la dirección', () => {
  it('sin parámetros, los gastos se ven todos y en orden de fecha', () => {
    expect(leerFiltrosGastos({})).toEqual({
      periodo: 'todo',
      desde: null,
      hasta: null,
      q: '',
      persona: null,
      entrega: 'todas',
      factura: 'todas',
      origen: 'todos',
      orden: 'recientes',
    })
  })

  it('un valor que no se reconoce vale lo mismo que no ponerlo', () => {
    const f = leerFiltrosGastos({ factura: 'drop table', orden: '1; --', periodo: 'siempre' })
    expect(f.factura).toBe('todas')
    expect(f.orden).toBe('recientes')
    expect(f.periodo).toBe('todo')
  })

  it('una persona que no tiene forma de id se ignora', () => {
    expect(leerFiltrosGastos({ persona: "' or 1=1" }).persona).toBeNull()
    expect(leerFiltrosGastos({ persona: ALIX }).persona).toBe(ALIX)
  })

  it('las fechas a mano solo cuentan con el período "rango"', () => {
    expect(leerFiltrosGastos({ periodo: 'mes', desde: '2026-01-01' }).desde).toBeNull()
    expect(leerFiltrosGastos({ periodo: 'rango', desde: '2026-01-01' }).desde).toBe('2026-01-01')
  })

  it('si un parámetro viene repetido, se toma el primero', () => {
    expect(leerFiltrosGastos({ q: ['leche', 'pan'] }).q).toBe('leche')
  })

  it('la búsqueda se recorta a 100 letras', () => {
    expect(leerFiltrosGastos({ q: 'a'.repeat(500) }).q).toHaveLength(100)
  })

  it('el resumen arranca mostrando todo el historial', () => {
    expect(leerFiltrosResumen({}).periodo).toBe('todo')
  })

  it('las solicitudes arrancan en "todas", sin solo urgentes', () => {
    expect(leerFiltrosSolicitudes({})).toEqual({ q: '', estado: 'todas', autor: null, urgentes: false })
    expect(leerFiltrosSolicitudes({ urgentes: '1' }).urgentes).toBe(true)
  })

  it('el método del dinero se compara sin mayúsculas ni tildes', () => {
    expect(leerFiltrosDinero({ metodo: 'Pago Móvil' }).metodo).toBe('pago movil')
  })
})

describe('filtrarGastos', () => {
  const base = leerFiltrosGastos({})

  it('busca en la descripción y en las notas, sin tildes', () => {
    const lista = [
      compra({ descripcion: 'Azúcar' }),
      compra({ descripcion: 'Pan', notas: 'para el azucarero' }),
      compra({ descripcion: 'Leche' }),
    ]
    expect(filtrarGastos(lista, { ...base, q: 'azucar' }, HOY)).toHaveLength(2)
  })

  it('filtra por el período', () => {
    const lista = [
      compra({ fecha_compra: '2026-09-01' }),
      compra({ fecha_compra: '2026-08-31' }),
    ]
    const f = { ...base, periodo: 'mes' as const }
    expect(filtrarGastos(lista, f, HOY).map((c) => c.fecha_compra)).toEqual(['2026-09-01'])
  })

  it('filtra por persona', () => {
    const lista = [compra({ registrada_por: ALIX }), compra({ registrada_por: JOSE })]
    expect(filtrarGastos(lista, { ...base, persona: ALIX }, HOY)).toHaveLength(1)
  })

  it('separa con y sin factura', () => {
    const lista = [compra({ facturas: [{ storage_path: 'x/y.jpg' }] }), compra({})]
    expect(filtrarGastos(lista, { ...base, factura: 'con' }, HOY)).toHaveLength(1)
    expect(filtrarGastos(lista, { ...base, factura: 'sin' }, HOY)[0].facturas).toEqual([])
  })

  it('separa encargos de compras sueltas', () => {
    const lista = [compra({ solicitud_id: crypto.randomUUID() }), compra({}), compra({})]
    expect(filtrarGastos(lista, { ...base, origen: 'encargo' }, HOY)).toHaveLength(1)
    expect(filtrarGastos(lista, { ...base, origen: 'suelto' }, HOY)).toHaveLength(2)
  })

  it('separa lo entregado de lo que falta por entregar', () => {
    const lista = [compra({ fecha_entrega: '2026-09-12' }), compra({})]
    expect(filtrarGastos(lista, { ...base, entrega: 'entregadas' }, HOY)).toHaveLength(1)
    expect(filtrarGastos(lista, { ...base, entrega: 'por_entregar' }, HOY)[0].fecha_entrega).toBeNull()
  })

  it('ordena por fecha y desempata por la hora de registro', () => {
    const a = compra({ fecha_compra: '2026-09-10', created_at: '2026-09-10T08:00:00Z', descripcion: 'a' })
    const b = compra({ fecha_compra: '2026-09-10', created_at: '2026-09-10T09:00:00Z', descripcion: 'b' })
    const c = compra({ fecha_compra: '2026-09-11', descripcion: 'c' })
    expect(filtrarGastos([a, b, c], base, HOY).map((x) => x.descripcion)).toEqual(['c', 'b', 'a'])
    expect(
      filtrarGastos([a, b, c], { ...base, orden: 'antiguos' }, HOY).map((x) => x.descripcion),
    ).toEqual(['a', 'b', 'c'])
  })

  it('ordena por monto en los dos sentidos', () => {
    const lista = [compra({ monto_usd: 5 }), compra({ monto_usd: 50 }), compra({ monto_usd: 20 })]
    expect(filtrarGastos(lista, { ...base, orden: 'mayor' }, HOY).map((c) => c.monto_usd)).toEqual([50, 20, 5])
    expect(filtrarGastos(lista, { ...base, orden: 'menor' }, HOY).map((c) => c.monto_usd)).toEqual([5, 20, 50])
  })

  it('no toca la lista original', () => {
    const lista = [compra({ monto_usd: 5 }), compra({ monto_usd: 50 })]
    filtrarGastos(lista, { ...base, orden: 'mayor' }, HOY)
    expect(lista.map((c) => c.monto_usd)).toEqual([5, 50])
  })
})

describe('filtrarSolicitudes', () => {
  const base = leerFiltrosSolicitudes({})
  const lista = [
    solicitud({ estado: 'pendiente', titulo: 'Acetaminofén', urgencia: 'urgente' }),
    solicitud({ estado: 'comprada', titulo: 'Leche' }),
    solicitud({ estado: 'entregada', titulo: 'Pan' }),
    solicitud({ estado: 'rechazada', titulo: 'Queso', motivo_rechazo: 'No había en ningún lado' }),
    solicitud({ estado: 'cancelada', titulo: 'Café', creada_por: JOSE }),
  ]

  it('"en curso" junta lo pendiente y lo comprado', () => {
    expect(filtrarSolicitudes(lista, { ...base, estado: 'en_curso' }).map((s) => s.titulo)).toEqual([
      'Acetaminofén',
      'Leche',
    ])
  })

  it('busca también en el motivo del rechazo', () => {
    expect(filtrarSolicitudes(lista, { ...base, q: 'ningun lado' })).toHaveLength(1)
  })

  it('filtra por quién pidió y por urgencia', () => {
    expect(filtrarSolicitudes(lista, { ...base, autor: JOSE })).toHaveLength(1)
    expect(filtrarSolicitudes(lista, { ...base, urgentes: true })).toHaveLength(1)
  })

  it('cuenta por estado respetando la búsqueda, pero no el estado elegido', () => {
    const cuentas = contarPorEstado(lista, { ...base, estado: 'entregada', q: 'e' })
    // "e" está en Acetaminofén, Leche, Queso y Café ("cafe" sin tilde); no en Pan.
    expect(cuentas.todas).toBe(4)
    expect(cuentas.en_curso).toBe(2)
    expect(cuentas.entregada).toBe(0)
    expect(cuentas.cancelada).toBe(1)
  })
})

describe('dinero recibido', () => {
  it('agrupa los métodos escritos de formas distintas', () => {
    const lista = [aporte({ metodo: 'Zelle' }), aporte({ metodo: 'zelle ' }), aporte({ metodo: '' })]
    expect(metodosDistintos(lista)).toEqual([
      { valor: '_', etiqueta: 'Sin especificar' },
      { valor: 'zelle', etiqueta: 'Zelle' },
    ])
  })

  it('filtra por método, incluido "sin especificar"', () => {
    const lista = [aporte({ metodo: 'Zelle' }), aporte({ metodo: 'ZELLE' }), aporte({ metodo: '' })]
    const base = leerFiltrosDinero({})
    expect(filtrarAportes(lista, { ...base, metodo: 'zelle' }, HOY)).toHaveLength(2)
    expect(filtrarAportes(lista, { ...base, metodo: '_' }, HOY)).toHaveLength(1)
  })

  it('filtra por persona y por período', () => {
    const lista = [
      aporte({ registrada_por: ALIX, fecha: '2026-09-05' }),
      aporte({ registrada_por: JOSE, fecha: '2026-08-05' }),
    ]
    const base = leerFiltrosDinero({})
    expect(filtrarAportes(lista, { ...base, persona: ALIX }, HOY)).toHaveLength(1)
    expect(filtrarAportes(lista, { ...base, periodo: 'mes_pasado' }, HOY)[0].registrada_por).toBe(JOSE)
  })
})

describe('utilidades', () => {
  it('contarActivos cuenta solo lo que se cambió', () => {
    const porDefecto = leerFiltrosGastos({})
    const f = { ...porDefecto, q: 'x', factura: 'sin' as const }
    expect(contarActivos(f, porDefecto)).toBe(2)
    expect(contarActivos(f, porDefecto, ['q'])).toBe(1)
  })

  it('leerCuantos no baja del paso ni se va a las nubes', () => {
    expect(leerCuantos({}, 30)).toBe(30)
    expect(leerCuantos({ ver: '5' }, 30)).toBe(30)
    expect(leerCuantos({ ver: '60' }, 30)).toBe(60)
    expect(leerCuantos({ ver: 'mucho' }, 30)).toBe(30)
    expect(leerCuantos({ ver: '99999999' }, 30)).toBe(10_000)
  })

  it('conParametros conserva lo que hay y cambia o borra lo pedido', () => {
    expect(conParametros('/compras', { q: 'leche', ver: '60' }, { ver: null, factura: 'sin' })).toBe(
      '/compras?q=leche&factura=sin',
    )
    expect(conParametros('/compras', {}, {})).toBe('/compras')
  })
})
