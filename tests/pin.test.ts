import { describe, it, expect } from 'vitest'
import { validarPinNuevo, PIN_CORTO, PIN_NO_COINCIDE } from '@/lib/pin'

describe('validarPinNuevo', () => {
  it('acepta seis dígitos repetidos igual', () => {
    expect(validarPinNuevo('481602', '481602')).toBeNull()
  })

  it('rechaza un PIN de menos de seis dígitos', () => {
    expect(validarPinNuevo('4816', '4816')).toBe(PIN_CORTO)
  })

  it('rechaza un PIN de más de seis dígitos', () => {
    expect(validarPinNuevo('4816021', '4816021')).toBe(PIN_CORTO)
  })

  it('rechaza un PIN con algo que no es un dígito', () => {
    expect(validarPinNuevo('4816o2', '4816o2')).toBe(PIN_CORTO)
  })

  it('rechaza el PIN vacío', () => {
    expect(validarPinNuevo('', '')).toBe(PIN_CORTO)
  })

  it('rechaza cuando la repetición no coincide', () => {
    expect(validarPinNuevo('481602', '481603')).toBe(PIN_NO_COINCIDE)
  })

  it('avisa del formato antes que de la coincidencia', () => {
    // Si el primer PIN ni siquiera tiene seis dígitos, decir "no coinciden"
    // manda a la persona a corregir lo que no está mal.
    expect(validarPinNuevo('48', '481602')).toBe(PIN_CORTO)
  })

  it('no acepta espacios alrededor', () => {
    // El teclado de la app solo produce dígitos; cualquier otra cosa viene
    // de un envío hecho a mano contra la acción de servidor.
    expect(validarPinNuevo(' 481602 ', ' 481602 ')).toBe(PIN_CORTO)
  })
})
