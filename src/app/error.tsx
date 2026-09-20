'use client'

import { useEffect } from 'react'
import { BotonSalir } from '@/componentes/BotonSalir'

/**
 * Sin este archivo, cualquier pantalla que fallara durante el renderizado en
 * el servidor (una excepción sin capturar, una consulta que Next decide
 * propagar en vez de solo devolver `{ error }`) caía en la pantalla de error
 * genérica de Next: en inglés, sin BotonSalir, sin ninguna forma de volver a
 * una pantalla usable desde el teléfono.
 *
 * Esto también es lo que evita el bucle de redirección de
 * `obtenerPerfilObligatorio` (ver `src/lib/supabase/servidor.ts`): cuando
 * hay sesión pero no existe la fila de `profiles`, esa función lanza en vez
 * de devolver `null`, y este límite de error la atrapa aquí en vez de dejar
 * que la pantalla redirija a `/entrar`, que el middleware rebote a `/`, y
 * así indefinidamente.
 *
 * No se distingue el mensaje según el tipo de error: en producción, Next
 * reemplaza el mensaje real de un error de Server Component por uno
 * genérico antes de que llegue aquí (para no filtrar detalles internos), así
 * que cualquier lógica que dependiera de `error.message` funcionaría en
 * desarrollo y fallaría en producción sin avisar. Un mensaje único, en
 * español, con un botón para reintentar y otro para salir, cubre los dos
 * casos que importan.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Pantalla no manejada:', error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Algo falló</h1>
        <p className="mt-2 text-sm text-slate-500">
          No se pudo cargar esta pantalla. Puede ser la conexión o un problema pasajero.
        </p>
      </div>

      <button
        type="button"
        onClick={reset}
        className="h-12 w-full max-w-xs rounded-xl bg-slate-900 font-medium text-white"
      >
        Volver a intentar
      </button>

      <BotonSalir />
    </main>
  )
}
