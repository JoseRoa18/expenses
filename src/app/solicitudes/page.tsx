import { redirect } from 'next/navigation'
import { crearClienteServidor, obtenerPerfil } from '@/lib/supabase/servidor'
import { TarjetaSolicitud } from '@/componentes/TarjetaSolicitud'
import { BotonSalir } from '@/componentes/BotonSalir'
import { crearSolicitud } from '@/app/solicitudes/acciones'
import type { Solicitud, Perfil } from '@/lib/tipos'

export const dynamic = 'force-dynamic'

export default async function Solicitudes() {
  const perfil = await obtenerPerfil()
  if (!perfil) redirect('/entrar')

  const supabase = await crearClienteServidor()
  const [{ data: solicitudes }, { data: perfiles }] = await Promise.all([
    supabase.from('solicitudes').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, nombre, rol'),
  ])

  const nombrePorId = new Map((perfiles as Perfil[] ?? []).map((p) => [p.id, p.nombre]))
  const puedePedir = perfil.rol === 'solicitante' || perfil.rol === 'financista'

  return (
    <main className="mx-auto max-w-md px-4 py-6 pb-24">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Solicitudes</h1>
        <BotonSalir nombre={perfil.nombre} />
      </header>

      {puedePedir && (
        <form
          action={async (datos: FormData) => {
            'use server'
            await crearSolicitud(datos)
          }}
          className="mb-6 rounded-2xl bg-white p-4 shadow-sm"
        >
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
          <button
            type="submit"
            className="h-12 w-full rounded-xl bg-slate-900 font-medium text-white"
          >
            Pedir
          </button>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {(solicitudes as Solicitud[] ?? []).map((s) => (
          <TarjetaSolicitud
            key={s.id}
            solicitud={s}
            autor={nombrePorId.get(s.creada_por) ?? '—'}
            esAutor={s.creada_por === perfil.id}
          />
        ))}
        {(solicitudes ?? []).length === 0 && (
          <p className="py-12 text-center text-slate-400">Todavía no hay solicitudes.</p>
        )}
      </div>
    </main>
  )
}
