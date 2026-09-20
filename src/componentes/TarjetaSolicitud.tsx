'use client'

import { useState, useTransition } from 'react'
import { EtiquetaEstado } from '@/componentes/EtiquetaEstado'
import { AccionesSolicitud } from '@/componentes/AccionesSolicitud'
import { puedeEditar, puedeCancelar } from '@/lib/solicitudes'
import { formatearFecha } from '@/lib/formato'
import { cancelarSolicitud, editarSolicitud } from '@/app/solicitudes/acciones'
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
      const resultado = await editarSolicitud(solicitud.id, datos)
      setError(resultado.error)
      if (!resultado.error) setEditando(false)
    })
  }

  function cancelar() {
    iniciar(async () => {
      const resultado = await cancelarSolicitud(solicitud.id)
      setError(resultado.error)
    })
  }

  if (editando) {
    return (
      <article className="rounded-2xl bg-white p-4 shadow-sm">
        <form action={guardar}>
          <input
            name="titulo"
            required
            defaultValue={solicitud.titulo}
            className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-3"
          />
          <input
            name="cantidad"
            defaultValue={solicitud.cantidad}
            placeholder="Cantidad"
            className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-3"
          />
          <textarea
            name="notas"
            rows={2}
            defaultValue={solicitud.notas}
            placeholder="Notas"
            className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-3"
          />
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="urgencia"
              value="urgente"
              defaultChecked={solicitud.urgencia === 'urgente'}
              className="h-5 w-5"
            />
            Es urgente
          </label>

          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pendiente}
              className="h-11 flex-1 rounded-xl bg-slate-900 text-sm font-medium text-white disabled:opacity-50"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => { setEditando(false); setError(null) }}
              className="h-11 flex-1 rounded-xl bg-slate-100 text-sm font-medium text-slate-700"
            >
              Cancelar
            </button>
          </div>
        </form>
      </article>
    )
  }

  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-medium text-slate-900">{solicitud.titulo}</h2>
          {solicitud.cantidad && (
            <p className="text-sm text-slate-500">{solicitud.cantidad}</p>
          )}
        </div>
        <EtiquetaEstado estado={solicitud.estado} />
      </div>

      {solicitud.notas && (
        <p className="mt-2 text-sm text-slate-600">{solicitud.notas}</p>
      )}

      {solicitud.estado === 'rechazada' && solicitud.motivo_rechazo && (
        <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          <strong>Motivo:</strong> {solicitud.motivo_rechazo}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>
          {autor} · {formatearFecha(solicitud.created_at)}
          {solicitud.urgencia === 'urgente' && (
            <span className="ml-2 font-medium text-red-600">URGENTE</span>
          )}
        </span>

        <span className="flex items-center gap-1">
          {puedeEditar(solicitud.estado, esAutor) && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="flex h-11 items-center px-2 text-slate-500 underline"
            >
              Editar
            </button>
          )}
          {puedeCancelar(solicitud.estado, esAutor) && (
            <button
              type="button"
              disabled={pendiente}
              onClick={cancelar}
              className="flex h-11 items-center px-2 text-slate-500 underline disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
        </span>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {esComprador && <AccionesSolicitud solicitud={solicitud} />}
    </article>
  )
}
