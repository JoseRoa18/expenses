'use client'

import { useState, useTransition } from 'react'
import { marcarEntregada } from '@/app/compras/acciones'
import { ERROR_CONEXION } from '@/lib/errores'

/**
 * Antes esto era un <form action> de servidor inline en compras/page.tsx que
 * descartaba el `Resultado` que devuelve marcarEntregada. Su reversión (si
 * la solicitud no cambia de estado) funciona bien del lado de la base de
 * datos, pero Jose tocaba el botón, la reversión ocurría, y no se le decía
 * nada: era la única mutación de toda la rama cuyo fallo era completamente
 * invisible. Este componente de cliente es lo mínimo necesario para leer
 * ese resultado y mostrarlo.
 */
export function BotonMarcarEntregada({ compraId }: { compraId: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()

  function marcar() {
    setError(null)
    iniciar(async () => {
      try {
        const resultado = await marcarEntregada(compraId)
        setError(resultado.error)
        // Sin `else` aquí: si salió bien, `revalidatePath('/compras')` dentro
        // de la acción hace que el servidor vuelva a renderizar esta fila ya
        // con `fecha_entrega` puesta, y este botón deja de existir en el
        // árbol. No hay un estado "hecho" que mantener a mano.
      } catch {
        setError(ERROR_CONEXION)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pendiente}
        onClick={marcar}
        className="flex h-11 items-center px-2 font-medium text-emerald-700 underline disabled:opacity-50"
      >
        {pendiente ? 'Marcando...' : 'Marcar entregada'}
      </button>
      {error && <p className="max-w-40 text-right text-xs text-red-600">{error}</p>}
    </div>
  )
}
