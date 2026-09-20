'use client'

import { useState, useTransition } from 'react'
import { FormularioCompra } from '@/componentes/FormularioCompra'
import { rechazarSolicitud } from '@/app/compras/acciones'
import { puedeComprar, puedeRechazar } from '@/lib/solicitudes'
import type { Solicitud } from '@/lib/tipos'

export function AccionesSolicitud({ solicitud }: { solicitud: Solicitud }) {
  const [abierto, setAbierto] = useState<'ninguno' | 'comprar' | 'rechazar'>('ninguno')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()

  if (!puedeComprar(solicitud.estado) && !puedeRechazar(solicitud.estado)) return null

  function rechazar() {
    iniciar(async () => {
      const resultado = await rechazarSolicitud(solicitud.id, motivo)
      setError(resultado.error)
      if (!resultado.error) setAbierto('ninguno')
    })
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      {abierto === 'ninguno' && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAbierto('comprar')}
            className="h-11 flex-1 rounded-xl bg-slate-900 text-sm font-medium text-white"
          >
            Comprar
          </button>
          <button
            type="button"
            onClick={() => setAbierto('rechazar')}
            className="h-11 flex-1 rounded-xl bg-slate-100 text-sm font-medium text-slate-700"
          >
            No se puede
          </button>
        </div>
      )}

      {abierto === 'comprar' && (
        <div>
          <FormularioCompra
            solicitudId={solicitud.id}
            descripcionInicial={solicitud.titulo}
          />
          <button
            type="button"
            onClick={() => setAbierto('ninguno')}
            className="mt-2 flex h-11 w-full items-center justify-center text-sm text-slate-500 underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {abierto === 'rechazar' && (
        <div>
          <textarea
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="¿Por qué no se puede? (Alix verá este mensaje)"
            className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"
          />
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pendiente}
              onClick={rechazar}
              className="h-11 flex-1 rounded-xl bg-red-600 text-sm font-medium text-white disabled:opacity-50"
            >
              Rechazar
            </button>
            <button
              type="button"
              onClick={() => setAbierto('ninguno')}
              className="h-11 flex-1 rounded-xl bg-slate-100 text-sm font-medium text-slate-700"
            >
              Volver
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
