import { redirect } from 'next/navigation'
import { crearClienteServidor, obtenerPerfil } from '@/lib/supabase/servidor'
import { TarjetaSolicitud } from '@/componentes/TarjetaSolicitud'
import { FormularioSolicitud } from '@/componentes/FormularioSolicitud'
import { BotonSalir } from '@/componentes/BotonSalir'
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

      {puedePedir && <FormularioSolicitud />}

      <div className="flex flex-col gap-3">
        {(solicitudes as Solicitud[] ?? []).map((s) => (
          <TarjetaSolicitud
            key={s.id}
            solicitud={s}
            autor={nombrePorId.get(s.creada_por) ?? '—'}
            esAutor={s.creada_por === perfil.id}
            esComprador={perfil.rol === 'comprador'}
          />
        ))}
        {(solicitudes ?? []).length === 0 && (
          <p className="py-12 text-center text-slate-400">Todavía no hay solicitudes.</p>
        )}
      </div>
    </main>
  )
}
