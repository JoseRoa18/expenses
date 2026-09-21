import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { randomUUID } from 'node:crypto'

// dotenv carga `.env` por defecto; los secretos de este proyecto viven en
// `.env.local`, asi que hay que nombrarlo explicitamente.
config({ path: '.env.local', quiet: true })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !servicio) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

// Los PIN ya no se asignan aqui: cada persona crea el suyo la primera vez
// que entra en la app. Una cuenta recien creada nace con una contrasena
// aleatoria que nadie ve ni se guarda en ningun sitio -- existe solo para
// que no haya cuenta sin contrasena, y deja de servir en cuanto su duena
// crea su PIN.
const PERSONAS = [
  { nombre: 'Alix',  correo: 'alix@expenses.local',  rol: 'solicitante' },
  { nombre: 'Jose',  correo: 'jose@expenses.local',  rol: 'comprador'   },
  { nombre: 'Yenny', correo: 'yenny@expenses.local', rol: 'financista'  },
]

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
    // A una cuenta que ya existe NO se le toca la contrasena: si su duena
    // ya creo su PIN, cambiarselo aqui la dejaria fuera sin avisar. Para
    // borrar un PIN a proposito esta `npm run reiniciar-pin`.
    id = yaExiste.id
    console.log(`${persona.nombre}: la cuenta ya existe (su PIN no se toca)`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: persona.correo,
      password: randomUUID(),
      email_confirm: true,
    })
    if (error) {
      console.error(`No se pudo crear a ${persona.nombre}:`, error.message)
      process.exit(1)
    }
    id = data.user.id
    console.log(`${persona.nombre}: cuenta creada, sin PIN todavia`)
  }

  // Se actualizan nombre y rol, pero no `pin_configurado_en`: esa columna
  // es de la persona, y repetir este script no debe borrarle el PIN.
  const { error: errorPerfil } = await admin
    .from('profiles')
    .upsert({ id, nombre: persona.nombre, rol: persona.rol }, { onConflict: 'id' })

  if (errorPerfil) {
    console.error(`No se pudo guardar el perfil de ${persona.nombre}:`, errorPerfil.message)
    process.exit(1)
  }
}

console.log('\nListo. Las tres cuentas existen con su rol.')
console.log('Cada quien crea su PIN la primera vez que abra la app.')
