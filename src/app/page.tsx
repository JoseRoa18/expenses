import { redirect } from 'next/navigation'
import { obtenerPerfilObligatorio } from '@/lib/supabase/servidor'

export default async function Inicio() {
  const perfil = await obtenerPerfilObligatorio()
  if (!perfil) redirect('/entrar')

  // Alix vive en las solicitudes; Jose y Yenny entran por el dinero.
  redirect(perfil.rol === 'solicitante' ? '/solicitudes' : '/dinero')
}
