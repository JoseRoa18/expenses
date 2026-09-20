import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// dotenv carga `.env` por defecto; los secretos de este proyecto viven en
// `.env.local`, asi que hay que nombrarlo explicitamente.
config({ path: '.env.local', quiet: true })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !servicio) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const PERSONAS = [
  { nombre: 'Alix',  correo: 'alix@expenses.local',  rol: 'solicitante', pin: process.env.PIN_ALIX },
  { nombre: 'Jose',  correo: 'jose@expenses.local',  rol: 'comprador',   pin: process.env.PIN_JOSE },
  { nombre: 'Yenny', correo: 'yenny@expenses.local', rol: 'financista',  pin: process.env.PIN_YENNY },
]

for (const persona of PERSONAS) {
  if (!/^\d{6}$/.test(persona.pin ?? '')) {
    console.error(`El PIN de ${persona.nombre} debe ser exactamente 6 dígitos.`)
    process.exit(1)
  }
}

const admin = createClient(url, servicio, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Se listan las cuentas existentes para poder repetir el script sin duplicar.
const { data: existentes, error: errorLista } = await admin.auth.admin.listUsers()
if (errorLista) {
  console.error('No se pudo listar usuarios:', errorLista.message)
  process.exit(1)
}

for (const persona of PERSONAS) {
  const yaExiste = existentes.users.find((u) => u.email === persona.correo)
  let id

  if (yaExiste) {
    id = yaExiste.id
    const { error } = await admin.auth.admin.updateUserById(id, { password: persona.pin })
    if (error) {
      console.error(`No se pudo actualizar el PIN de ${persona.nombre}:`, error.message)
      process.exit(1)
    }
    console.log(`${persona.nombre}: PIN actualizado`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: persona.correo,
      password: persona.pin,
      email_confirm: true,
    })
    if (error) {
      console.error(`No se pudo crear a ${persona.nombre}:`, error.message)
      process.exit(1)
    }
    id = data.user.id
    console.log(`${persona.nombre}: cuenta creada`)
  }

  const { error: errorPerfil } = await admin
    .from('profiles')
    .upsert({ id, nombre: persona.nombre, rol: persona.rol }, { onConflict: 'id' })

  if (errorPerfil) {
    console.error(`No se pudo guardar el perfil de ${persona.nombre}:`, errorPerfil.message)
    process.exit(1)
  }
}

console.log('\nListo. Las tres cuentas existen con su rol y su PIN.')
