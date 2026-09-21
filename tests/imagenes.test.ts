import { describe, it, expect } from 'vitest'
import {
  calcularDimensiones,
  esImagenComprimible,
  necesitaEncogerse,
  LADO_MAXIMO,
  TAMANO_OBJETIVO,
} from '@/lib/imagenes'

describe('calcularDimensiones', () => {
  it('no agranda una foto que ya es más chica que el límite', () => {
    expect(calcularDimensiones(800, 600)).toEqual({ ancho: 800, alto: 600 })
  })

  it('deja igual la que mide exactamente el límite', () => {
    expect(calcularDimensiones(LADO_MAXIMO, 1000)).toEqual({ ancho: LADO_MAXIMO, alto: 1000 })
  })

  it('encoge una foto horizontal por su lado largo', () => {
    expect(calcularDimensiones(4000, 3000)).toEqual({ ancho: 2000, alto: 1500 })
  })

  it('encoge una foto vertical por su lado largo', () => {
    // La forma en que llega una factura fotografiada con el teléfono.
    expect(calcularDimensiones(3000, 4000)).toEqual({ ancho: 1500, alto: 2000 })
  })

  it('redondea el lado corto en vez de dejar decimales', () => {
    // 3000x2251 a escala 2000/3000 da 1500,67: el canvas necesita enteros.
    expect(calcularDimensiones(3000, 2251)).toEqual({ ancho: 2000, alto: 1501 })
  })

  it('nunca devuelve un lado en cero', () => {
    // Una imagen larguísima y finísima (un recibo escaneado en tira) podría
    // redondear su lado corto a 0, y un canvas de 0 px no dibuja nada.
    expect(calcularDimensiones(10000, 2)).toEqual({ ancho: 2000, alto: 1 })
  })

  it('devuelve las medidas tal cual si no tienen sentido', () => {
    // No se inventa nada: quien llama verá que no hay nada que hacer y
    // subirá el archivo original.
    expect(calcularDimensiones(0, 0)).toEqual({ ancho: 0, alto: 0 })
  })
})

describe('esImagenComprimible', () => {
  it('acepta una foto de teléfono', () => {
    expect(esImagenComprimible('image/jpeg')).toBe(true)
  })

  it('acepta una captura de pantalla', () => {
    expect(esImagenComprimible('image/png')).toBe(true)
  })

  it('rechaza un PDF', () => {
    // Una factura en PDF se sube tal cual: el canvas no sabe dibujarla.
    expect(esImagenComprimible('application/pdf')).toBe(false)
  })

  it('rechaza un GIF', () => {
    // Pasarlo por el canvas lo dejaría en un solo cuadro. No es un formato
    // de factura, pero perder cuadros en silencio no es aceptable.
    expect(esImagenComprimible('image/gif')).toBe(false)
  })

  it('rechaza un SVG', () => {
    // Es vectorial: rasterizarlo lo empeora y además no pesa.
    expect(esImagenComprimible('image/svg+xml')).toBe(false)
  })

  it('rechaza un archivo sin tipo', () => {
    expect(esImagenComprimible('')).toBe(false)
  })
})

describe('necesitaEncogerse', () => {
  it('no toca una foto liviana y chica', () => {
    expect(necesitaEncogerse(200_000, 1200)).toBe(false)
  })

  it('encoge una foto pesada aunque sea chica de lado', () => {
    expect(necesitaEncogerse(TAMANO_OBJETIVO + 1, 1200)).toBe(true)
  })

  it('encoge una foto liviana pero enorme de lado', () => {
    // Pesa poco (mucho blanco) pero mide 4000 px: encogerla igual ahorra
    // memoria al visor y no le quita nada a la lectura.
    expect(necesitaEncogerse(200_000, 4000)).toBe(true)
  })

  it('deja pasar la que está justo en los dos límites', () => {
    expect(necesitaEncogerse(TAMANO_OBJETIVO, LADO_MAXIMO)).toBe(false)
  })
})
