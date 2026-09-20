import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// dotenv carga `.env` por defecto; los secretos de este proyecto viven en
// `.env.local`, asi que hay que nombrarlo explicitamente.
config({ path: '.env.local', quiet: true })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function entrarComo(correo: string, pin: string): Promise<SupabaseClient> {
  const cliente = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await cliente.auth.signInWithPassword({ email: correo, password: pin })
  if (error) throw new Error(`No se pudo entrar como ${correo}: ${error.message}`)
  return cliente
}

let alix: SupabaseClient
let jose: SupabaseClient
let yenny: SupabaseClient

beforeAll(async () => {
  alix = await entrarComo('alix@expenses.local', process.env.PIN_ALIX!)
  jose = await entrarComo('jose@expenses.local', process.env.PIN_JOSE!)
  yenny = await entrarComo('yenny@expenses.local', process.env.PIN_YENNY!)
})

afterAll(async () => {
  await Promise.all([alix, jose, yenny].map((c) => c?.auth.signOut()))
})

describe('Alix no puede ver nada de dinero', () => {
  it('no lee compras', async () => {
    const { data } = await alix.from('compras').select('*')
    expect(data).toEqual([])
  })

  it('no lee aportes', async () => {
    const { data } = await alix.from('aportes').select('*')
    expect(data).toEqual([])
  })

  it('no lee facturas', async () => {
    const { data } = await alix.from('facturas').select('*')
    expect(data).toEqual([])
  })

  it('no obtiene el balance', async () => {
    const { data } = await alix.rpc('obtener_balance')
    expect(data).toEqual([])
  })

  it('no puede registrar una compra', async () => {
    const { data: perfil } = await alix.from('profiles').select('id').limit(1).single()
    const { error } = await alix.from('compras').insert({
      registrada_por: perfil!.id,
      descripcion: 'intento no autorizado',
      monto_bs: 100,
      monto_usd: 1,
    })
    expect(error).not.toBeNull()
  })

  it('no puede registrar un aporte', async () => {
    const { data: perfil } = await alix.from('profiles').select('id').limit(1).single()
    const { error } = await alix.from('aportes').insert({
      registrada_por: perfil!.id,
      monto_usd: 100,
    })
    expect(error).not.toBeNull()
  })
})

describe('Yenny audita todo pero no registra gastos', () => {
  it('lee compras', async () => {
    const { error } = await yenny.from('compras').select('*')
    expect(error).toBeNull()
  })

  it('obtiene el balance', async () => {
    const { data, error } = await yenny.rpc('obtener_balance')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0]).toHaveProperty('total_aportes')
    expect(data![0]).toHaveProperty('total_gastos')
  })

  it('no puede registrar una compra', async () => {
    const { data: perfil } = await yenny.from('profiles').select('id')
      .eq('nombre', 'Yenny').single()
    const { error } = await yenny.from('compras').insert({
      registrada_por: perfil!.id,
      descripcion: 'intento no autorizado',
      monto_bs: 100,
      monto_usd: 1,
    })
    expect(error).not.toBeNull()
  })

  it('no puede registrar un aporte', async () => {
    const { data: perfil } = await yenny.from('profiles').select('id')
      .eq('nombre', 'Yenny').single()
    const { error } = await yenny.from('aportes').insert({
      registrada_por: perfil!.id,
      monto_usd: 100,
    })
    expect(error).not.toBeNull()
  })

  it('sí puede crear solicitudes', async () => {
    const { data: perfil } = await yenny.from('profiles').select('id')
      .eq('nombre', 'Yenny').single()
    const { data, error } = await yenny.from('solicitudes')
      .insert({ creada_por: perfil!.id, titulo: 'prueba de permisos (Yenny)' })
      .select().single()
    expect(error).toBeNull()
    // No hay política de borrado a propósito: nada se elimina de la base.
    // La solicitud de prueba se cierra cancelándola.
    await yenny.from('solicitudes').update({ estado: 'cancelada' }).eq('id', data!.id)
  })
})

describe('Jose registra el dinero', () => {
  it('obtiene el balance', async () => {
    const { data, error } = await jose.rpc('obtener_balance')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('no puede crear solicitudes', async () => {
    const { data: perfil } = await jose.from('profiles').select('id')
      .eq('nombre', 'Jose').single()
    const { error } = await jose.from('solicitudes')
      .insert({ creada_por: perfil!.id, titulo: 'intento no autorizado' })
    expect(error).not.toBeNull()
  })
})

describe('las reglas de estado se imponen en la base de datos', () => {
  it('rechazar sin motivo no entra', async () => {
    const { data: perfilAlix } = await alix.from('profiles').select('id')
      .eq('nombre', 'Alix').single()
    const { data: solicitud } = await alix.from('solicitudes')
      .insert({ creada_por: perfilAlix!.id, titulo: 'prueba: rechazo sin motivo' })
      .select().single()

    const { error } = await jose.from('solicitudes')
      .update({ estado: 'rechazada' })
      .eq('id', solicitud!.id)
    expect(error).not.toBeNull()

    await jose.from('solicitudes').update({ estado: 'cancelada' }).eq('id', solicitud!.id)
  })

  it('una solicitud comprada ya no se puede cancelar', async () => {
    const { data: perfilAlix } = await alix.from('profiles').select('id')
      .eq('nombre', 'Alix').single()
    const { data: solicitud } = await alix.from('solicitudes')
      .insert({ creada_por: perfilAlix!.id, titulo: 'prueba: cancelar comprada' })
      .select().single()

    await jose.from('solicitudes').update({ estado: 'comprada' }).eq('id', solicitud!.id)

    const { error } = await jose.from('solicitudes')
      .update({ estado: 'cancelada' })
      .eq('id', solicitud!.id)
    expect(error).not.toBeNull()

    await jose.from('solicitudes').update({ estado: 'entregada' }).eq('id', solicitud!.id)
  })
})
