'use client'

import { useState, useTransition } from 'react'
import { EtiquetaEstado } from '@/componentes/EtiquetaEstado'
import { AccionesSolicitud } from '@/componentes/AccionesSolicitud'
import { puedeEditar, puedeCancelar } from '@/lib/solicitudes'
import { formatearMarcaDeTiempo } from '@/lib/formato'
import { cancelarSolicitud, editarSolicitud } from '@/app/solicitudes/acciones'
import { ERROR_CONEXION } from '@/lib/errores'
import { Boton } from '@/componentes/Boton'
import { Campo, CLASE_ENTRADA } from '@/componentes/Campo'
import type { Solicitud } from '@/lib/tipos'

export function TarjetaSolicitud({
  solicitud,
  autor,
  esAutor,
  esComprador,
}: {
  solicitud: Solicitud
  autor: string
  esAutor: boolean
  esComprador: boolean
}) {
  const [editando, setEditando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()

  function guardar(datos: FormData) {
    iniciar(async () => {
      try {
        const resultado = await editarSolicitud(solicitud.id, datos)
        setError(resultado.error)
        if (!resultado.error) setEditando(false)
      } catch {
        setError(ERROR_CONEXION)
      }
    })
  }

  function cancelar() {
    iniciar(async () => {
      try {
        const resultado = await cancelarSolicitud(solicitud.id)
        setError(resultado.error)
      } catch {
        setError(ERROR_CONEXION)
      }
    })
  }

  if (editando) {
    return (
      <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
        <form action={guardar}>
          <Campo etiqueta="¿Qué necesitas?" className="mb-3">
            <input
              name="titulo"
              required
              defaultValue={solicitud.titulo}
              className={CLASE_ENTRADA}
            />
          </Campo>

          <Campo etiqueta="Cantidad" className="mb-3">
            <input
              name="cantidad"
              defaultValue={solicitud.cantidad}
              placeholder="2 cajas"
              className={CLASE_ENTRADA}
            />
          </Campo>

          <Campo etiqueta="Notas" className="mb-3">
            <textarea
              name="notas"
              rows={2}
              defaultValue={solicitud.notas}
              placeholder="Opcional"
              className={CLASE_ENTRADA}
            />
          </Campo>

          <label className="mb-4 flex min-h-11 items-center gap-3 text-sm text-slate-800">
            <input
              type="checkbox"
              name="urgencia"
              value="urgente"
              defaultChecked={solicitud.urgencia === 'urgente'}
              className="h-5 w-5 rounded border-slate-300 accent-slate-900"
            />
            Es urgente
          </label>

          {error && (
            <p className="mb-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <Boton type="submit" disabled={pendiente} className="flex-1">
              {pendiente ? 'Guardando...' : 'Guardar'}
            </Boton>
            <Boton
              type="button"
              variante="secundario"
              onClick={() => {
                setEditando(false)
                setError(null)
              }}
              className="flex-1"
            >
              Descartar
            </Boton>
          </div>
        </form>
      </article>
    )
  }

  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-slate-900">{solicitud.titulo}</h2>
          {solicitud.cantidad && <p className="text-sm text-slate-600">{solicitud.cantidad}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <EtiquetaEstado estado={solicitud.estado} />
          {solicitud.urgencia === 'urgente' && (
            <span className="text-xs font-semibold tracking-wide text-red-600">URGENTE</span>
          )}
        </div>
      </div>

      {solicitud.notas && <p className="mt-2 text-sm text-slate-600">{solicitud.notas}</p>}

      {solicitud.estado === 'rechazada' && solicitud.motivo_rechazo && (
        <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          <strong>Motivo:</strong> {solicitud.motivo_rechazo}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
        <span className="min-w-0 truncate">
          {autor} · {formatearMarcaDeTiempo(solicitud.created_at)}
        </span>

        <span className="flex shrink-0 items-center gap-1">
          {puedeEditar(solicitud.estado, esAutor) && (
            <Boton type="button" variante="texto" onClick={() => setEditando(true)}>
              Editar
            </Boton>
          )}
          {puedeCancelar(solicitud.estado, esAutor) && (
            <Boton type="button" variante="texto" disabled={pendiente} onClick={cancelar}>
              Cancelar
            </Boton>
          )}
        </span>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {esComprador && <AccionesSolicitud solicitud={solicitud} />}
    </article>
  )
}
