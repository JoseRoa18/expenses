import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'

describe('andamiaje del proyecto', () => {
  it('ignora los archivos de secretos', () => {
    const gitignore = readFileSync('.gitignore', 'utf8')
    expect(gitignore).toContain('.env.local')
  })

  it('tiene una plantilla de variables de entorno sin valores', () => {
    expect(existsSync('.env.example')).toBe(true)
    const plantilla = readFileSync('.env.example', 'utf8')
    expect(plantilla).toContain('NEXT_PUBLIC_SUPABASE_URL')
    // La plantilla no puede llevar llaves reales: las de Supabase empiezan por "eyJ"
    expect(plantilla).not.toContain('eyJ')
  })

  it('no expone la llave de servicio al navegador', () => {
    const plantilla = readFileSync('.env.example', 'utf8')
    expect(plantilla).not.toContain('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY')
  })
})
