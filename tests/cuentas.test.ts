import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { reclamarCuentaSinPin, liberarCuenta, personaTienePin } from '@/lib/cuentas'

// dotenv carga `.env` por defecto; los secretos de este proyecto viven en
// `.env.local`, asi que hay que nombrarlo explicitamente.
config({ path: '.env.local', quiet: true })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Esta suite escribe en la base real (no hay entorno de prueba separado),
// pero NUNCA sobre las cuentas de Alix, Jose o Yenny: reclamar una cuenta
// cambia el PIN de una persona de verdad. Trabaja sobre una cuenta
// desechable que crea al empezar y borra al terminar.
const NOMBRE = 'PruebaPin'
const CORREO = 'prueba-pin@expenses.local'

const admin: SupabaseClient = createClient(URL, SERVICIO, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let idPrueba: string

beforeAll(async () => {
  const { data: existentes } = await admin.auth.admin.listUsers()
  const viejo = existentes?.users.find((u) => u.email === CORREO)
  if (viejo) await admin.auth.admin.deleteUser(viejo.id)

  const { data, error } = await admin.auth.admin.createUser({
    email: CORREO,
    password: crypto.randomUUID(),
    email_confirm: true,
  })
  if (error) throw new Error(`No se pudo crear la cuenta de prueba: ${error.message}`)
  idPrueba = data.user.id

  const { error: errorPerfil } = await admin
    .from('profiles')
    .insert({ id: idPrueba, nombre: NOMBRE, rol: 'solicitante' })
  if (errorPerfil) throw new Error(`No se pudo crear el perfil de prueba: ${errorPerfil.message}`)
})

afterAll(async () => {
  // Borrar la cuenta arrastra su fila de profiles (on delete cascade).
  if (idPrueba) await admin.auth.admin.deleteUser(idPrueba)
})

beforeEach(async () => {
  // Se deja sin PIN con el cliente de administración directamente, no con
  // liberarCuenta(), para que la preparación de cada prueba no dependa de
  // la función que se está probando.
  await admin.from('profiles').update({ pin_configurado_en: null }).eq('id', idPrueba)
})

describe('reclamarCuentaSinPin', () => {
  it('devuelve el id de la cuenta cuando todavía no tiene PIN', async () => {
    expect(await reclamarCuentaSinPin(admin, NOMBRE)).toBe(idPrueba)
  })

  it('el segundo reclamo devuelve null: la cuenta ya es de alguien', async () => {
    // El caso que cierra la carrera entre dos personas que abren la app a
    // la vez sobre la misma cuenta libre. Solo la primera se la queda.
    await reclamarCuentaSinPin(admin, NOMBRE)
    expect(await reclamarCuentaSinPin(admin, NOMBRE)).toBeNull()
  })

  it('devuelve null para un nombre que no existe', async () => {
    expect(await reclamarCuentaSinPin(admin, 'Nadie')).toBeNull()
  })
})

describe('personaTienePin', () => {
  it('es falso mientras la cuenta no se haya reclamado', async () => {
    expect(await personaTienePin(admin, NOMBRE)).toBe(false)
  })

  it('es cierto después de reclamarla', async () => {
    await reclamarCuentaSinPin(admin, NOMBRE)
    expect(await personaTienePin(admin, NOMBRE)).toBe(true)
  })

  it('es cierto para un nombre que no existe', async () => {
    // Una cuenta que no existe no puede crear un PIN. Decir "sí tiene"
    // lleva a la pantalla de entrar, que responde "PIN incorrecto" sin
    // revelar qué nombres existen.
    expect(await personaTienePin(admin, 'Nadie')).toBe(true)
  })
})

describe('liberarCuenta', () => {
  it('deja la cuenta reclamable otra vez', async () => {
    const id = await reclamarCuentaSinPin(admin, NOMBRE)
    await liberarCuenta(admin, id!)
    expect(await reclamarCuentaSinPin(admin, NOMBRE)).toBe(idPrueba)
  })
})
