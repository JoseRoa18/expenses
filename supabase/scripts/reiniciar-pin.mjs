import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { randomUUID } from 'node:crypto'

// Borra el PIN de una persona: su cuenta vuelve a quedar "sin PIN" y la app
// le dejara crear uno nuevo la proxima vez que toque su nombre.
//
//   npm run reiniciar-pin -- Alix
//   npm run reiniciar-pin -- --todos
//
// Para dos casos:
//   1. Alguien olvido su PIN.
//   2. El paso a "cada quien crea el suyo": borrar de una vez los PIN
//      viejos que habia asignado el dueno del proyecto.
//
// Ojo: mientras una cuenta esta sin PIN, cualquiera que abra la direccion
// de la app puede tocar ese nombre y ponerle uno. Es el riesgo que el
// diseno acepta a sabiendas (ver el spec). Hazlo cuando la persona vaya a
// entrar, no dias antes.

// dotenv carga `.env` por defecto; los secretos de este proyecto viven en
// `.env.local`, asi que hay que nombrarlo explicitamente.
config({ path: '.env.local', quiet: true })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !servicio) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const argumentos = process.argv.slice(2)
if (argumentos.length === 0) {
  console.error('Falta decir a quien. Ejemplo: npm run reiniciar-pin -- Alix')
  console.error('Para las tres a la vez:    npm run reiniciar-pin -- --todos')
  process.exit(1)
}

const admin = createClient(url, servicio, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: perfiles, error: errorPerfiles } = await admin
  .from('profiles')
  .select('id, nombre')

if (errorPerfiles) {
  console.error('No se pudieron leer los perfiles:', errorPerfiles.message)
  process.exit(1)
}

const objetivo = argumentos.includes('--todos')
  ? perfiles
  : perfiles.filter((p) => argumentos.includes(p.nombre))

if (objetivo.length === 0) {
  console.error(`Ningun perfil se llama asi. Los que hay: ${perfiles.map((p) => p.nombre).join(', ')}`)
  process.exit(1)
}

for (const persona of objetivo) {
  // Primero la contrasena, luego la marca. En ese orden, si el script se
  // corta a la mitad, lo peor que queda es una cuenta con un PIN que nadie
  // conoce -- molesto, pero se arregla repitiendo el script. Al reves
  // quedaria una cuenta marcada como libre pero con el PIN viejo todavia
  // bueno: dos personas distintas podrian entrar a la misma cuenta.
  const { error: errorClave } = await admin.auth.admin.updateUserById(persona.id, {
    password: randomUUID(),
  })
  if (errorClave) {
    console.error(`No se pudo borrar el PIN de ${persona.nombre}:`, errorClave.message)
    process.exit(1)
  }

  const { error: errorMarca } = await admin
    .from('profiles')
    .update({ pin_configurado_en: null })
    .eq('id', persona.id)

  if (errorMarca) {
    console.error(`No se pudo marcar a ${persona.nombre} como sin PIN:`, errorMarca.message)
    console.error('Su PIN viejo ya no sirve. Vuelve a correr este script para terminar.')
    process.exit(1)
  }

  console.log(`${persona.nombre}: sin PIN. Creara uno nuevo la proxima vez que entre.`)
}
