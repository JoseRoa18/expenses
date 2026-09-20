import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { config } from 'dotenv'

// dotenv carga `.env` por defecto; los secretos de este proyecto viven en
// `.env.local`, asi que hay que nombrarlo explicitamente.
config({ path: '.env.local', quiet: true })

const aqui = dirname(fileURLToPath(import.meta.url))
const carpeta = join(aqui, '..', 'migraciones')

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en .env.local')
  process.exit(1)
}

const cliente = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

await cliente.connect()

const archivos = readdirSync(carpeta).filter((n) => n.endsWith('.sql')).sort()

for (const archivo of archivos) {
  const sql = readFileSync(join(carpeta, archivo), 'utf8')
  process.stdout.write(`Aplicando ${archivo}... `)
  try {
    await cliente.query(sql)
    console.log('listo')
  } catch (error) {
    console.log('ERROR')
    console.error(error.message)
    await cliente.end()
    process.exit(1)
  }
}

await cliente.end()
console.log(`\n${archivos.length} migracion(es) aplicadas.`)
