import { redirect } from 'next/navigation'
import { crearClienteServidor, obtenerPerfilObligatorio } from '@/lib/supabase/servidor'
import { FormularioCompra } from '@/componentes/FormularioCompra'
import { TarjetaCompra } from '@/componentes/TarjetaCompra'
import { Encabezado } from '@/componentes/Encabezado'
import { Vacio } from '@/componentes/Vacio'
import { Desplegable } from '@/componentes/Desplegable'
import { VerMas } from '@/componentes/VerMas'
import { BarraFiltros, type FiltroActivo } from '@/componentes/BarraFiltros'
import { Resultados, ZonaFiltrada } from '@/componentes/ZonaFiltrada'
import { IconoDescargar } from '@/componentes/Iconos'
import { firmarFacturas, leerCompras, leerPerfiles } from '@/lib/datos'
import {
  ENTREGAS,
  ETIQUETAS_ENTREGA,
  ETIQUETAS_FACTURA,
  ETIQUETAS_ORDEN,
  ETIQUETAS_ORIGEN,
  FACTURAS,
  ORDENES,
  ORIGENES,
  conParametros,
  contarActivos,
  filtrarGastos,
  leerCuantos,
  leerFiltrosGastos,
  type Parametros,
} from '@/lib/filtros'
import { formatearUsd, hoyVenezuela } from '@/lib/formato'
import { sumarUsd } from '@/lib/balance'

export const dynamic = 'force-dynamic'

/** Cuántos gastos se muestran de entrada, y cuántos más con cada "Ver más". */
const PASO = 30

export default async function Compras({ searchParams }: { searchParams: Promise<Parametros> }) {
  const perfil = await obtenerPerfilObligatorio()
  if (!perfil) redirect('/entrar')
  const params = await searchParams

  // Jose y Yenny ven los gastos de todos; los demás, los suyos. Quien filtra
  // es la base de datos (política "leer compras"), no esta consulta: esto
  // solo decide si la pantalla escribe de quién es cada gasto.
  const veTodo = perfil.rol === 'comprador' || perfil.rol === 'financista'
  // Yenny audita los gastos de los demás, pero no tiene bolsa de la que
  // gastar, así que no se le ofrece el formulario.
  const tieneBolsa = perfil.rol !== 'financista'

  const supabase = await crearClienteServidor()
  const [compras, perfiles] = await Promise.all([leerCompras(supabase), leerPerfiles(supabase)])
  const nombrePorId = new Map(perfiles.map((p) => [p.id, p.nombre]))

  const filtros = leerFiltrosGastos(params)
  const porDefecto = leerFiltrosGastos({})
  // Igual que en /dinero (commit edbb1c4): si la consulta falla, no se debe
  // mostrar "Todavía no hay gastos" -- una lista vacía real y un fallo de
  // red se ven exactamente igual para quien lee la pantalla, y esta es la
  // que audita Yenny.
  const filtradas = compras ? filtrarGastos(compras, filtros, hoyVenezuela()) : null
  const cuantos = leerCuantos(params, PASO)
  const visibles = filtradas?.slice(0, cuantos) ?? []

  // Solo se firman las facturas de lo que se va a ver, y todas en una
  // petición. Antes se firmaba una por una, de todos los gastos de la casa.
  const enlaces = await firmarFacturas(
    supabase,
    visibles.flatMap((c) => c.facturas.map((f) => f.storage_path)),
  )

  const hayFiltros = contarActivos(filtros, porDefecto, ['orden']) > 0

  return (
    <main className="con-barra mx-auto max-w-md px-4 py-6">
      <Encabezado titulo="Gastos" nombre={perfil.nombre} />

      {tieneBolsa && (
        <Desplegable
          titulo={veTodo ? 'Registrar gasto suelto' : 'Registrar un gasto'}
          abierto={compras?.length === 0}
        >
          <FormularioCompra />
        </Desplegable>
      )}

      <ZonaFiltrada>
        <BarraFiltros
          busqueda={{ valor: filtros.q, placeholder: 'Buscar gastos' }}
          periodo={{ valor: filtros.periodo, desde: filtros.desde, hasta: filtros.hasta, porDefecto: 'todo' }}
          selects={[
            ...(veTodo
              ? [
                  {
                    clave: 'persona',
                    etiqueta: 'De quién',
                    valor: filtros.persona ?? '',
                    porDefecto: '',
                    opciones: [
                      { valor: '', etiqueta: 'Todos' },
                      ...perfiles
                        .filter((p) => p.rol !== 'financista')
                        .map((p) => ({ valor: p.id, etiqueta: p.nombre })),
                    ],
                  },
                ]
              : []),
            {
              clave: 'factura',
              etiqueta: 'Factura',
              valor: filtros.factura,
              porDefecto: porDefecto.factura,
              opciones: FACTURAS.map((v) => ({ valor: v, etiqueta: ETIQUETAS_FACTURA[v] })),
            },
            {
              clave: 'origen',
              etiqueta: 'Tipo',
              valor: filtros.origen,
              porDefecto: porDefecto.origen,
              opciones: ORIGENES.map((v) => ({ valor: v, etiqueta: ETIQUETAS_ORIGEN[v] })),
            },
            {
              clave: 'entrega',
              etiqueta: 'Entrega',
              valor: filtros.entrega,
              porDefecto: porDefecto.entrega,
              opciones: ENTREGAS.map((v) => ({ valor: v, etiqueta: ETIQUETAS_ENTREGA[v] })),
            },
            {
              clave: 'orden',
              etiqueta: 'Ordenar por',
              valor: filtros.orden,
              porDefecto: porDefecto.orden,
              opciones: ORDENES.map((v) => ({ valor: v, etiqueta: ETIQUETAS_ORDEN[v] })),
            },
          ]}
          activos={[
            ...(filtros.persona
              ? [{ etiqueta: nombrePorId.get(filtros.persona) ?? 'Otra persona', quitar: ['persona'] }]
              : []),
            ...(filtros.factura !== 'todas'
              ? [{ etiqueta: ETIQUETAS_FACTURA[filtros.factura], quitar: ['factura'] }]
              : []),
            ...(filtros.origen !== 'todos'
              ? [{ etiqueta: ETIQUETAS_ORIGEN[filtros.origen], quitar: ['origen'] }]
              : []),
            ...(filtros.entrega !== 'todas'
              ? [{ etiqueta: ETIQUETAS_ENTREGA[filtros.entrega], quitar: ['entrega'] }]
              : []),
            ...(filtros.orden !== 'recientes'
              ? [{ etiqueta: ETIQUETAS_ORDEN[filtros.orden], quitar: ['orden'] }]
              : []),
          ] satisfies FiltroActivo[]}
        />

        <Resultados>
          {filtradas && filtradas.length > 0 && (
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <p className="cifras text-sm text-slate-600">
                {filtradas.length} {filtradas.length === 1 ? 'gasto' : 'gastos'} ·{' '}
                <span className="font-semibold text-slate-900">
                  {formatearUsd(sumarUsd(filtradas.map((c) => c.monto_usd)))}
                </span>
              </p>
              <a
                href={conParametros('/exportar', params, { tipo: 'gastos', ver: null })}
                download
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 px-1 text-sm text-slate-600 underline underline-offset-2 active:text-slate-900"
              >
                <IconoDescargar className="h-4 w-4" />
                Descargar
              </a>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {filtradas === null && (
              <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
                No se pudo cargar la lista de gastos. Vuelve a intentarlo.
              </p>
            )}

            {visibles.map((compra) => (
              <TarjetaCompra
                key={compra.id}
                compra={compra}
                enlaces={compra.facturas.map((f) => enlaces.get(f.storage_path) ?? null)}
                // De quién es solo se dice cuando hay gastos de varias
                // personas a la vista: para Alix, todos son suyos.
                quien={veTodo ? (nombrePorId.get(compra.registrada_por) ?? '—') : null}
                pedidoPor={compra.solicitud ? (nombrePorId.get(compra.solicitud.creada_por) ?? null) : null}
                // Se entrega lo que uno mismo compró. Un gasto que Alix hizo
                // para sí misma no pasa por las manos de Jose.
                puedeEntregar={perfil.rol === 'comprador' && compra.registrada_por === perfil.id}
              />
            ))}

            {filtradas !== null && (
              <VerMas
                href={conParametros('/compras', params, { ver: String(cuantos + PASO) })}
                restantes={filtradas.length - visibles.length}
                paso={PASO}
              />
            )}

            {compras !== null && compras.length === 0 && (
              <Vacio
                titulo="Todavía no hay gastos"
                ayuda={
                  perfil.rol === 'financista'
                    ? 'Cuando alguien registre una compra, la verás aquí con su factura.'
                    : 'Registra arriba lo que compres y sube su factura.'
                }
              />
            )}

            {compras !== null && compras.length > 0 && filtradas?.length === 0 && (
              <Vacio
                titulo="Ningún gasto coincide"
                ayuda={
                  hayFiltros
                    ? 'Prueba con otra búsqueda, otro período, o quita los filtros.'
                    : 'No hay gastos que mostrar.'
                }
              />
            )}
          </div>
        </Resultados>
      </ZonaFiltrada>
    </main>
  )
}
