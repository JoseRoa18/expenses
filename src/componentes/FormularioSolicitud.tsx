'use client'

import { useRef, useState, useTransition } from 'react'
import { crearSolicitud } from '@/app/solicitudes/acciones'
import { ERROR_CONEXION } from '@/lib/errores'
import { Boton } from '@/componentes/Boton'
import { Campo, CLASE_ENTRADA } from '@/componentes/Campo'

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
    <form
      ref={formRef}
      action={enviar}
      className="mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5"
    >
      <h2 className="mb-3 font-semibold text-slate-900">Pedir algo</h2>

      <Campo etiqueta="¿Qué necesitas?" className="mb-3">
        <input name="titulo" required placeholder="Harina de maíz" className={CLASE_ENTRADA} />
      </Campo>

      <Campo etiqueta="Cantidad" className="mb-3">
        <input name="cantidad" placeholder="2 cajas" className={CLASE_ENTRADA} />
      </Campo>

      <Campo etiqueta="Notas" className="mb-3">
        <textarea name="notas" rows={2} placeholder="Opcional" className={CLASE_ENTRADA} />
      </Campo>

      <label className="mb-4 flex min-h-11 items-center gap-3 text-sm text-slate-800">
        <input
          type="checkbox"
          name="urgencia"
          value="urgente"
          className="h-5 w-5 rounded border-slate-300 accent-slate-900"
        />
        Es urgente
      </label>

      {error && (
        <p className="mb-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <Boton type="submit" disabled={pendiente} className="w-full">
        {pendiente ? 'Guardando...' : 'Pedir'}
      </Boton>
    </form>
  )
}
