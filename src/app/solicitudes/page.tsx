import { redirect } from 'next/navigation'
import { crearClienteServidor, obtenerPerfilObligatorio } from '@/lib/supabase/servidor'
import { TarjetaSolicitud } from '@/componentes/TarjetaSolicitud'
import { FormularioSolicitud } from '@/componentes/FormularioSolicitud'
import { Encabezado } from '@/componentes/Encabezado'
import { Vacio } from '@/componentes/Vacio'
import { Desplegable } from '@/componentes/Desplegable'
import { VerMas } from '@/componentes/VerMas'
import { BarraFiltros } from '@/componentes/BarraFiltros'
import { Resultados, ZonaFiltrada } from '@/componentes/ZonaFiltrada'
import { leerPerfiles, leerSolicitudes } from '@/lib/datos'
import {
  ESTADOS_FILTRO,
  conParametros,
  contarActivos,
  contarPorEstado,
  filtrarSolicitudes,
  leerCuantos,
  leerFiltrosSolicitudes,
  type EstadoFiltro,
  type Parametros,
} from '@/lib/filtros'

export const dynamic = 'force-dynamic'

const PASO = 30

const ETIQUETAS_FILTRO_ESTADO: Record<EstadoFiltro, string> = {
  todas: 'Todas',
  en_curso: 'En curso',
  pendiente: 'Pendientes',
  comprada: 'Compradas',
  entregada: 'Entregadas',
  rechazada: 'Rechazadas',
  cancelada: 'Canceladas',
}

export default async function Solicitudes({ searchParams }: { searchParams: Promise<Parametros> }) {
  const perfil = await obtenerPerfilObligatorio()
  if (!perfil) redirect('/entrar')
  const params = await searchParams

  const supabase = await crearClienteServidor()
  const [solicitudes, perfiles] = await Promise.all([
    leerSolicitudes(supabase),
    leerPerfiles(supabase),
  ])

  // Igual que en /dinero (commit edbb1c4): si la consulta falla, no se debe
  // mostrar "Todavía no hay solicitudes" -- Alix, viendo eso, volvería a
  // crear una solicitud que ya había hecho, Jose la compraría de nuevo, y es
  // dinero real gastado dos veces.
  const filtros = leerFiltrosSolicitudes(params)
  const filtradas = solicitudes ? filtrarSolicitudes(solicitudes, filtros) : null
  const cuentas = solicitudes ? contarPorEstado(solicitudes, filtros) : null
  const cuantos = leerCuantos(params, PASO)
  const visibles = filtradas?.slice(0, cuantos) ?? []

  const nombrePorId = new Map(perfiles.map((p) => [p.id, p.nombre]))
  const puedePedir = perfil.rol === 'solicitante' || perfil.rol === 'financista'
  const quienesPiden = perfiles.filter((p) => p.rol === 'solicitante' || p.rol === 'financista')
  const hayFiltros = contarActivos(filtros, leerFiltrosSolicitudes({})) > 0

  return (
    <main className="con-barra mx-auto max-w-md px-4 py-6">
      <Encabezado titulo="Solicitudes" nombre={perfil.nombre} />

      {puedePedir && (
        <Desplegable titulo="Pedir algo" abierto={solicitudes?.length === 0}>
          <FormularioSolicitud />
        </Desplegable>
      )}

      <ZonaFiltrada>
        <BarraFiltros
          busqueda={{ valor: filtros.q, placeholder: 'Buscar solicitudes' }}
          chips={[
            {
              clave: 'estado',
              etiqueta: 'Estado',
              valor: filtros.estado,
              porDefecto: 'todas',
              opciones: ESTADOS_FILTRO.map((e) => ({
                valor: e,
                etiqueta: ETIQUETAS_FILTRO_ESTADO[e],
                cuenta: cuentas?.[e],
              })),
            },
          ]}
          selects={[
            {
              clave: 'autor',
              etiqueta: 'Quién pidió',
              valor: filtros.autor ?? '',
              porDefecto: '',
              opciones: [
                { valor: '', etiqueta: 'Todos' },
                ...quienesPiden.map((p) => ({ valor: p.id, etiqueta: p.nombre })),
              ],
            },
          ]}
          casillas={[{ clave: 'urgentes', etiqueta: 'Solo las urgentes', activa: filtros.urgentes }]}
          activos={[
            ...(filtros.autor
              ? [{ etiqueta: `Pidió ${nombrePorId.get(filtros.autor) ?? 'otra persona'}`, quitar: ['autor'] }]
              : []),
            ...(filtros.urgentes ? [{ etiqueta: 'Urgentes', quitar: ['urgentes'] }] : []),
          ]}
        />

        <Resultados>
          <div className="flex flex-col gap-3">
            {filtradas === null && (
              <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
                No se pudo cargar la lista de solicitudes. Vuelve a intentarlo antes de crear una
                nueva.
              </p>
            )}

            {visibles.map((s) => (
              <TarjetaSolicitud
                key={s.id}
                solicitud={s}
                autor={nombrePorId.get(s.creada_por) ?? '—'}
                esAutor={s.creada_por === perfil.id}
                esComprador={perfil.rol === 'comprador'}
              />
            ))}

            {filtradas !== null && (
              <VerMas
                href={conParametros('/solicitudes', params, { ver: String(cuantos + PASO) })}
                restantes={filtradas.length - visibles.length}
                paso={PASO}
              />
            )}

            {solicitudes !== null && solicitudes.length === 0 && (
              <Vacio
                titulo="Todavía no hay solicitudes"
                ayuda={
                  puedePedir
                    ? 'Escribe arriba lo que haga falta y toca Pedir.'
                    : 'Cuando alguien pida algo, aparecerá aquí.'
                }
              />
            )}

            {solicitudes !== null && solicitudes.length > 0 && filtradas?.length === 0 && (
              <Vacio
                titulo="Ninguna solicitud coincide"
                ayuda={
                  hayFiltros
                    ? 'Prueba con otra búsqueda u otro estado, o quita los filtros.'
                    : 'No hay solicitudes que mostrar.'
                }
              />
            )}
          </div>
        </Resultados>
      </ZonaFiltrada>
    </main>
  )
}
