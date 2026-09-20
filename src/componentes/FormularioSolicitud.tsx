'use client'

import { useRef, useState, useTransition } from 'react'
import { crearSolicitud } from '@/app/solicitudes/acciones'
import { ERROR_CONEXION } from '@/lib/errores'

/**
 * El formulario de "Pedir algo" necesita ser un componente de cliente (y no
 * un <form action> de servidor inline como antes) por dos razones a la vez:
 *
 * 1. Sin un componente de cliente no hay forma de saber si el envío está en
 *    curso, así que un doble toque en el teléfono podía crear la misma
 *    solicitud dos veces, visibles ambas en una lista que comparten tres
 *    personas.
 * 2. El formulario anterior descartaba el `{error}` que devuelve
 *    `crearSolicitud` y no tenía ninguna forma de mostrarlo: un rechazo de
 *    la base de datos quedaba en silencio total.
 *
 * Se usa el mismo patrón (useTransition + Resultado) que ya tienen
 * `TarjetaSolicitud`, `AccionesSolicitud` y `FormularioCompra`, en vez de
 * `useFormStatus` en un botón aparte, para no introducir un segundo idioma
 * de "formulario pendiente" en la misma pantalla.
 */
export function FormularioSolicitud() {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()

  function enviar(datos: FormData) {
    iniciar(async () => {
      try {
        const resultado = await crearSolicitud(datos)
        setError(resultado.error)
        if (!resultado.error) formRef.current?.reset()
      } catch {
        // Mismo caso que en TecladoPin: un fallo que ni siquiera llegó a
        // devolver { error } (red caída, etc.). Sin este catch, Alix perdía
        // lo que había escrito y veía la pantalla de error en inglés de Next.
        setError(ERROR_CONEXION)
      }
    })
  }

  return (
    <form ref={formRef} action={enviar} className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-medium">Pedir algo</h2>
      <input
        name="titulo"
        required
        placeholder="¿Qué necesitas?"
        className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-3"
      />
      <input
        name="cantidad"
        placeholder="Cantidad (ej: 2 cajas)"
        className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-3"
      />
      <textarea
        name="notas"
        rows={2}
        placeholder="Notas (opcional)"
        className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-3"
      />
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" name="urgencia" value="urgente" className="h-5 w-5" />
        Es urgente
      </label>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pendiente}
        className="h-12 w-full rounded-xl bg-slate-900 font-medium text-white disabled:opacity-50"
      >
        {pendiente ? 'Guardando...' : 'Pedir'}
      </button>
    </form>
  )
}
