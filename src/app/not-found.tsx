import Link from 'next/link'
import { obtenerPerfil } from '@/lib/supabase/servidor'
import { BotonSalir } from '@/componentes/BotonSalir'

export default async function NoEncontrado() {
  const perfil = await obtenerPerfil()

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="mb-2 text-xl font-semibold text-slate-900">
        No encontramos esta página
      </h1>
      <p className="mb-8 text-sm text-slate-500">
        Revisa la dirección o vuelve al inicio.
      </p>

      <Link
        href="/"
        className="flex h-11 w-full items-center justify-center rounded-2xl bg-slate-900 text-base font-medium text-white active:bg-slate-700"
      >
        Volver al inicio
      </Link>

      {perfil && (
        <div className="mt-6">
          <BotonSalir nombre={perfil.nombre} />
        </div>
      )}
    </main>
  )
}
