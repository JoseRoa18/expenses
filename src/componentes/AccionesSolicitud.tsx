'use client'

import { useState, useTransition } from 'react'
import { FormularioCompra } from '@/componentes/FormularioCompra'
import { rechazarSolicitud } from '@/app/compras/acciones'
import { puedeComprar, puedeRechazar } from '@/lib/solicitudes'
import { ERROR_CONEXION } from '@/lib/errores'
import { Boton } from '@/componentes/Boton'
import { CLASE_ENTRADA } from '@/componentes/Campo'
import type { Solicitud } from '@/lib/tipos'

export function AccionesSolicitud({ solicitud }: { solicitud: Solicitud }) {
  const [abierto, setAbierto] = useState<'ninguno' | 'comprar' | 'rechazar'>('ninguno')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()

  if (!puedeComprar(solicitud.estado) && !puedeRechazar(solicitud.estado)) return null

  function rechazar() {
    iniciar(async () => {
      try {
        const resultado = await rechazarSolicitud(solicitud.id, motivo)
        setError(resultado.error)
        if (!resultado.error) setAbierto('ninguno')
      } catch {
        setError(ERROR_CONEXION)
      }
    })
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      {abierto === 'ninguno' && (
        <div className="flex gap-2">
          <Boton type="button" onClick={() => setAbierto('comprar')} className="flex-1">
            Comprar
          </Boton>
          <Boton
            type="button"
            variante="secundario"
            onClick={() => setAbierto('rechazar')}
            className="flex-1"
          >
            No se puede
          </Boton>
        </div>
      )}

      {abierto === 'comprar' && (
        <div>
          <FormularioCompra solicitudId={solicitud.id} descripcionInicial={solicitud.titulo} />
          <Boton
            type="button"
            variante="texto"
            onClick={() => setAbierto('ninguno')}
            className="mt-2 w-full"
          >
            Cerrar
          </Boton>
        </div>
      )}

      {abierto === 'rechazar' && (
        <div>
          <textarea
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="¿Por qué no se puede? Alix verá este mensaje."
            className={`${CLASE_ENTRADA} mb-2`}
          />
          {error && (
            <p className="mb-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Boton
              type="button"
              disabled={pendiente}
              onClick={rechazar}
              // El único botón rojo de la app. Rechazar es lo que le llega a
              // Alix como un no, y conviene que no se toque por error al
              // lado de "Volver".
              className="flex-1 bg-red-600 active:bg-red-700"
            >
              {pendiente ? 'Rechazando...' : 'Rechazar'}
            </Boton>
            <Boton
              type="button"
              variante="secundario"
              onClick={() => setAbierto('ninguno')}
              className="flex-1"
            >
              Volver
            </Boton>
          </div>
        </div>
      )}
    </div>
  )
}
