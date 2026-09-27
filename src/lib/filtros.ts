import { coincideBusqueda, normalizarTexto } from '@/lib/busqueda'
import { enRango, esFechaValida, esPeriodo, rangoDelPeriodo, type Periodo, type Rango } from '@/lib/periodos'
import type { Aporte, CompraDetallada, EstadoSolicitud, Solicitud } from '@/lib/tipos'

/**
 * Los filtros de cada pantalla viven en la dirección (`/compras?q=leche`), no
 * en la memoria del teléfono. Así el botón de atrás deshace un filtro, una
 * recarga no lo pierde, y un enlace del resumen ("gastos sin factura") abre
 * la lista ya filtrada.
 *
 * Todo lo que llega por la dirección lo escribió cualquiera, así que se lee
 * con lista blanca: un valor que no se reconoce vale lo mismo que no haberlo
 * puesto. Nunca se pasa tal cual a una consulta.
 *
 * El filtrado se hace aquí, en el servidor y sobre filas que la base ya dejó
 * pasar por sus políticas: filtrar no puede enseñar nada que la persona no
 * pudiera ver sin filtro. Hacerlo en JavaScript y no en SQL tiene una razón
 * concreta: la búsqueda sin tildes (ver `busqueda.ts`), y que todas las
 * reglas de filtrado se prueban sin base de datos.
 */

export type Parametros = Record<string, string | string[] | undefined>

/** El primer valor de un parámetro, recortado. Nadie escribe 100 letras en un buscador. */
export function leerParametro(params: Parametros, clave: string): string {
  const valor = params[clave]
  const texto = Array.isArray(valor) ? valor[0] : valor
  return (texto ?? '').trim().slice(0, 100)
}

function leerOpcion<T extends string>(
  params: Parametros,
  clave: string,
  opciones: readonly T[],
  porDefecto: T,
): T {
  const valor = leerParametro(params, clave)
  return (opciones as readonly string[]).includes(valor) ? (valor as T) : porDefecto
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Un id de persona, o `null` si lo que vino no tiene forma de id. */
function leerPersona(params: Parametros, clave: string): string | null {
  const valor = leerParametro(params, clave)
  return UUID.test(valor) ? valor.toLowerCase() : null
}

// --- Período ----------------------------------------------------------

export type FiltroPeriodo = {
  periodo: Periodo
  /** Solo con `periodo = 'rango'`; en los demás, siempre `null`. */
  desde: string | null
  hasta: string | null
}

function leerPeriodo(params: Parametros, porDefecto: Periodo): FiltroPeriodo {
  const crudo = leerParametro(params, 'periodo')
  const periodo = esPeriodo(crudo) ? crudo : porDefecto
  if (periodo !== 'rango') return { periodo, desde: null, hasta: null }

  const desde = leerParametro(params, 'desde')
  const hasta = leerParametro(params, 'hasta')
  return {
    periodo,
    desde: esFechaValida(desde) ? desde : null,
    hasta: esFechaValida(hasta) ? hasta : null,
  }
}

export function rangoDeFiltro(f: FiltroPeriodo, hoy: string): Rango {
  return rangoDelPeriodo(f.periodo, hoy, f.desde, f.hasta)
}

// --- Gastos -----------------------------------------------------------

export const ENTREGAS = ['todas', 'entregadas', 'por_entregar'] as const
export const FACTURAS = ['todas', 'con', 'sin'] as const
export const ORIGENES = ['todos', 'encargo', 'suelto'] as const
export const ORDENES = ['recientes', 'antiguos', 'mayor', 'menor'] as const

export const ETIQUETAS_ENTREGA: Record<(typeof ENTREGAS)[number], string> = {
  todas: 'Todas',
  entregadas: 'Entregadas',
  por_entregar: 'Sin entregar',
}
export const ETIQUETAS_FACTURA: Record<(typeof FACTURAS)[number], string> = {
  todas: 'Todas',
  con: 'Con factura',
  sin: 'Sin factura',
}
export const ETIQUETAS_ORIGEN: Record<(typeof ORIGENES)[number], string> = {
  todos: 'Todos',
  encargo: 'Encargos',
  suelto: 'Gastos sueltos',
}
export const ETIQUETAS_ORDEN: Record<(typeof ORDENES)[number], string> = {
  recientes: 'Más recientes',
  antiguos: 'Más antiguos',
  mayor: 'Monto mayor',
  menor: 'Monto menor',
}

export type FiltrosGastos = FiltroPeriodo & {
  q: string
  persona: string | null
  entrega: (typeof ENTREGAS)[number]
  factura: (typeof FACTURAS)[number]
  origen: (typeof ORIGENES)[number]
  orden: (typeof ORDENES)[number]
}

export function leerFiltrosGastos(params: Parametros): FiltrosGastos {
  return {
    // Sin período elegido se ve todo, como se veía antes de que existieran
    // los filtros: nadie abre la lista y se encuentra con que "faltan" gastos.
    ...leerPeriodo(params, 'todo'),
    q: leerParametro(params, 'q'),
    persona: leerPersona(params, 'persona'),
    entrega: leerOpcion(params, 'entrega', ENTREGAS, 'todas'),
    factura: leerOpcion(params, 'factura', FACTURAS, 'todas'),
    origen: leerOpcion(params, 'origen', ORIGENES, 'todos'),
    orden: leerOpcion(params, 'orden', ORDENES, 'recientes'),
  }
}

export function filtrarGastos(
  compras: CompraDetallada[],
  f: FiltrosGastos,
  hoy: string,
): CompraDetallada[] {
  const rango = rangoDeFiltro(f, hoy)

  const quedan = compras.filter((c) => {
    if (!enRango(c.fecha_compra, rango)) return false
    if (f.persona && c.registrada_por !== f.persona) return false
    if (f.entrega === 'entregadas' && !c.fecha_entrega) return false
    if (f.entrega === 'por_entregar' && c.fecha_entrega) return false
    if (f.factura === 'con' && c.facturas.length === 0) return false
    if (f.factura === 'sin' && c.facturas.length > 0) return false
    if (f.origen === 'encargo' && !c.solicitud_id) return false
    if (f.origen === 'suelto' && c.solicitud_id) return false
    return coincideBusqueda(f.q, c.descripcion, c.notas)
  })

  return quedan.sort(ordenarGastos(f.orden))
}

function ordenarGastos(orden: FiltrosGastos['orden']) {
  // Desempate siempre por la hora en que se registró, lo más nuevo primero:
  // dos compras del mismo día o del mismo monto no deben bailar de sitio
  // entre una carga y la siguiente.
  const porRegistro = (a: CompraDetallada, b: CompraDetallada) =>
    b.created_at.localeCompare(a.created_at)

  return (a: CompraDetallada, b: CompraDetallada): number => {
    switch (orden) {
      case 'antiguos':
        return a.fecha_compra.localeCompare(b.fecha_compra) || -porRegistro(a, b)
      case 'mayor':
        return b.monto_usd - a.monto_usd || porRegistro(a, b)
      case 'menor':
        return a.monto_usd - b.monto_usd || porRegistro(a, b)
      default:
        return b.fecha_compra.localeCompare(a.fecha_compra) || porRegistro(a, b)
    }
  }
}

// --- Solicitudes ------------------------------------------------------

export const ESTADOS_FILTRO = [
  'todas',
  'en_curso',
  'pendiente',
  'comprada',
  'entregada',
  'rechazada',
  'cancelada',
] as const
export type EstadoFiltro = (typeof ESTADOS_FILTRO)[number]

export type FiltrosSolicitudes = {
  q: string
  estado: EstadoFiltro
  autor: string | null
  urgentes: boolean
}

export function leerFiltrosSolicitudes(params: Parametros): FiltrosSolicitudes {
  return {
    q: leerParametro(params, 'q'),
    estado: leerOpcion(params, 'estado', ESTADOS_FILTRO, 'todas'),
    autor: leerPersona(params, 'autor'),
    urgentes: leerParametro(params, 'urgentes') === '1',
  }
}

/** "En curso" es lo que todavía se está moviendo: pedido y aún no entregado. */
function cumpleEstado(estado: EstadoSolicitud, filtro: EstadoFiltro): boolean {
  if (filtro === 'todas') return true
  if (filtro === 'en_curso') return estado === 'pendiente' || estado === 'comprada'
  return estado === filtro
}

export function filtrarSolicitudes(solicitudes: Solicitud[], f: FiltrosSolicitudes): Solicitud[] {
  return solicitudes.filter(
    (s) =>
      cumpleEstado(s.estado, f.estado) &&
      (!f.autor || s.creada_por === f.autor) &&
      (!f.urgentes || s.urgencia === 'urgente') &&
      coincideBusqueda(f.q, s.titulo, s.cantidad, s.notas, s.motivo_rechazo),
  )
}

/**
 * Cuántas hay en cada estado, respetando los demás filtros. Así el número de
 * cada botón dice cuántas vas a ver si lo tocas, no cuántas hay en total.
 */
export function contarPorEstado(
  solicitudes: Solicitud[],
  f: FiltrosSolicitudes,
): Record<EstadoFiltro, number> {
  const base = filtrarSolicitudes(solicitudes, { ...f, estado: 'todas' })
  const cuentas = Object.fromEntries(ESTADOS_FILTRO.map((e) => [e, 0])) as Record<EstadoFiltro, number>
  for (const s of base) {
    for (const e of ESTADOS_FILTRO) if (cumpleEstado(s.estado, e)) cuentas[e]++
  }
  return cuentas
}

// --- Dinero recibido --------------------------------------------------

/** La clave de "no dijo por dónde": un guion bajo no lo escribe nadie como método. */
export const METODO_VACIO = '_'

export type FiltrosDinero = FiltroPeriodo & {
  q: string
  persona: string | null
  /** El método normalizado (ver `claveMetodo`), o `null` para todos. */
  metodo: string | null
}

export function leerFiltrosDinero(params: Parametros): FiltrosDinero {
  const metodo = leerParametro(params, 'metodo')
  return {
    ...leerPeriodo(params, 'todo'),
    q: leerParametro(params, 'q'),
    persona: leerPersona(params, 'persona'),
    metodo: metodo ? normalizarTexto(metodo) || null : null,
  }
}

/**
 * El método se escribe a mano, así que "Zelle", "zelle " y "ZELLE" son el
 * mismo. Esta es la forma con la que se agrupan y se comparan.
 */
export function claveMetodo(metodo: string): string {
  return normalizarTexto(metodo) || METODO_VACIO
}

/** Los métodos que aparecen en la lista, con la forma en que se escribieron la primera vez. */
export function metodosDistintos(aportes: Aporte[]): { valor: string; etiqueta: string }[] {
  const vistos = new Map<string, string>()
  for (const a of aportes) {
    const clave = claveMetodo(a.metodo)
    if (!vistos.has(clave)) vistos.set(clave, a.metodo.trim() || 'Sin especificar')
  }
  return [...vistos]
    .map(([valor, etiqueta]) => ({ valor, etiqueta }))
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'))
}

export function filtrarAportes(aportes: Aporte[], f: FiltrosDinero, hoy: string): Aporte[] {
  const rango = rangoDeFiltro(f, hoy)
  return aportes.filter(
    (a) =>
      enRango(a.fecha, rango) &&
      (!f.persona || a.registrada_por === f.persona) &&
      (!f.metodo || claveMetodo(a.metodo) === f.metodo) &&
      coincideBusqueda(f.q, a.metodo, a.notas),
  )
}

// --- Resumen ----------------------------------------------------------

export type FiltrosResumen = FiltroPeriodo & { persona: string | null }

export function leerFiltrosResumen(params: Parametros): FiltrosResumen {
  return {
    // Seis meses: suficiente para ver una tendencia, y el gráfico mes a mes
    // cabe entero en la pantalla de un teléfono.
    ...leerPeriodo(params, '6m'),
    persona: leerPersona(params, 'persona'),
  }
}

// --- Utilidades comunes -----------------------------------------------

/** Cuántos campos de `f` son distintos de los de `porDefecto`. */
export function contarActivos<T extends Record<string, unknown>>(
  f: T,
  porDefecto: T,
  ignorar: (keyof T)[] = [],
): number {
  return (Object.keys(f) as (keyof T)[]).filter(
    (clave) => !ignorar.includes(clave) && f[clave] !== porDefecto[clave],
  ).length
}

/** Cuántas filas se muestran. Crece de `paso` en `paso` con "Ver más". */
export function leerCuantos(params: Parametros, paso: number): number {
  const valor = Number.parseInt(leerParametro(params, 'ver'), 10)
  if (!Number.isFinite(valor) || valor < paso) return paso
  return Math.min(valor, 10_000)
}

/**
 * La dirección `ruta` con los parámetros actuales y algunos cambiados.
 * `null` borra el parámetro.
 */
export function conParametros(
  ruta: string,
  params: Parametros,
  cambios: Record<string, string | null> = {},
): string {
  const busqueda = new URLSearchParams()
  for (const [clave, valor] of Object.entries(params)) {
    const texto = Array.isArray(valor) ? valor[0] : valor
    if (texto) busqueda.set(clave, texto)
  }
  for (const [clave, valor] of Object.entries(cambios)) {
    if (valor === null || valor === '') busqueda.delete(clave)
    else busqueda.set(clave, valor)
  }
  const texto = busqueda.toString()
  return texto ? `${ruta}?${texto}` : ruta
}
