'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor, obtenerPerfil } from '@/lib/supabase/servidor'

type Resultado = { error: string | null }

function leerCampos(datos: FormData) {
  return {
    titulo: String(datos.get('titulo') ?? '').trim(),
    cantidad: String(datos.get('cantidad') ?? '').trim(),
    urgencia: datos.get('urgencia') === 'urgente' ? 'urgente' : 'normal',
    notas: String(datos.get('notas') ?? '').trim(),
  } as const
}

export async function crearSolicitud(datos: FormData): Promise<Resultado> {
  const perfil = await obtenerPerfil()
  if (!perfil) return { error: 'No hay sesión' }

  const campos = leerCampos(datos)
  if (!campos.titulo) return { error: 'Escribe qué necesitas' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('solicitudes')
    .insert({ ...campos, creada_por: perfil.id })

  if (error) return { error: 'No se pudo guardar la solicitud' }

  revalidatePath('/solicitudes')
  return { error: null }
}

export async function editarSolicitud(id: string, datos: FormData): Promise<Resultado> {
  const campos = leerCampos(datos)
  if (!campos.titulo) return { error: 'Escribe qué necesitas' }

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('solicitudes')
    .update(campos)
    .eq('id', id)
    .select('id')

  // Los permisos y el trigger de la base ya impiden editar lo que no toca;
  // si llega un error, es porque se intentó algo no permitido.
  if (error) return { error: 'No se pudo editar. Puede que ya esté comprada.' }

  // La política de RLS usa un `USING` que simplemente hace invisibles las
  // filas que no tocan: si Jose ya compró esta solicitud entre que Alix
  // abrió la pantalla y tocó "Guardar", el `update` no toca ninguna fila y
  // Postgres/PostgREST no lo cuenta como error. Sin esta comprobación, Alix
  // vería "guardado" en algo que en realidad no cambió.
  if (!data || data.length === 0) {
    return { error: 'Ya no se puede editar: Jose ya la compró.' }
  }

  revalidatePath('/solicitudes')
  return { error: null }
}

export async function cancelarSolicitud(id: string): Promise<Resultado> {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase
    .from('solicitudes')
    .update({ estado: 'cancelada' })
    .eq('id', id)
    .select('id')

  if (error) return { error: 'No se pudo cancelar. Puede que ya esté comprada.' }

  // Mismo caso que en editarSolicitud: cero filas no es un error para
  // PostgREST, pero para la persona que tocó "Cancelar" sí que lo es.
  if (!data || data.length === 0) {
    return { error: 'Ya no se puede cancelar: Jose ya la compró.' }
  }

  revalidatePath('/solicitudes')
  return { error: null }
}
