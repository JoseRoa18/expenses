/**
 * Comprimir la foto de una factura antes de subirla.
 *
 * Una foto de factura tomada con el teléfono pesa entre 2 y 6 MB. Subir eso
 * con datos móviles, parado en la calle frente al que te acaba de vender,
 * es lento y se cae. Encogerla a 2000 px de lado largo y ~1 MB la deja
 * subiendo en segundos y se sigue leyendo el papel, que es lo único que
 * importa: la factura es evidencia, no una fotografía.
 *
 * La regla de oro de este archivo: **ante la duda, el original**. Un
 * formato que el navegador no sepa decodificar, un canvas que falle, lo que
 * sea -- se sube la foto tal como salió de la cámara. Una factura pesada es
 * un fastidio; una factura que no se subió es una compra sin evidencia.
 */

/** Ningún lado de la imagen pasa de aquí. */
export const LADO_MAXIMO = 2000

/** A lo que se apunta. No es un techo duro: si ni la peor calidad llega, se sube lo más chico que salió. */
export const TAMANO_OBJETIVO = 1024 * 1024

/**
 * Calidades JPEG que se prueban, de mejor a peor. Se para en la primera que
 * baje del objetivo, así que una foto que ya es buena no se castiga.
 */
const CALIDADES = [0.85, 0.75, 0.65, 0.55, 0.45]

/**
 * Cuánto tiene que medir la imagen para caber en `ladoMaximo` sin
 * deformarse. Nunca agranda: una foto chica se queda como está.
 */
export function calcularDimensiones(
  ancho: number,
  alto: number,
  ladoMaximo: number = LADO_MAXIMO,
): { ancho: number; alto: number } {
  const ladoLargo = Math.max(ancho, alto)
  if (!Number.isFinite(ladoLargo) || ladoLargo <= 0) return { ancho, alto }
  if (ladoLargo <= ladoMaximo) return { ancho, alto }

  const escala = ladoMaximo / ladoLargo
  return {
    // Un lado que redondea a 0 deja un canvas que no dibuja nada.
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
  }
}

/** Si vale la pena pasar este tipo de archivo por el canvas. */
export function esImagenComprimible(tipo: string): boolean {
  if (!tipo.startsWith('image/')) return false
  // El GIF puede estar animado y saldría del canvas con un solo cuadro; el
  // SVG es vectorial, no pesa y rasterizarlo solo lo empeora.
  if (tipo === 'image/gif' || tipo === 'image/svg+xml') return false
  return true
}

/** Si esta imagen está fuera de alguno de los dos límites. */
export function necesitaEncogerse(tamano: number, ladoLargo: number): boolean {
  return tamano > TAMANO_OBJETIVO || ladoLargo > LADO_MAXIMO
}

/**
 * Devuelve la foto lista para subir: encogida y recomprimida si hacía
 * falta, o el archivo original si no hacía falta o si algo salió mal.
 *
 * Solo corre en el navegador (usa canvas). Nunca lanza: quien la llama
 * siempre recibe un archivo que puede subir.
 */
export async function comprimirImagen(archivo: File): Promise<File> {
  if (!esImagenComprimible(archivo.type)) return archivo

  let imagen: ImageBitmap
  try {
    // `from-image` respeta la rotación que la cámara dejó anotada en el
    // EXIF. Sin esto, las fotos tomadas en vertical -- o sea, todas las de
    // una factura -- se suben acostadas.
    imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  } catch {
    return archivo
  }

  try {
    if (!necesitaEncogerse(archivo.size, Math.max(imagen.width, imagen.height))) {
      return archivo
    }

    const { ancho, alto } = calcularDimensiones(imagen.width, imagen.height)
    if (ancho <= 0 || alto <= 0) return archivo

    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto

    const pincel = lienzo.getContext('2d')
    if (!pincel) return archivo

    // El JPEG no tiene transparencia. Sin pintar el fondo, una captura de
    // pantalla en PNG con zonas transparentes saldría con manchas negras
    // justo encima del texto.
    pincel.fillStyle = '#ffffff'
    pincel.fillRect(0, 0, ancho, alto)
    pincel.drawImage(imagen, 0, 0, ancho, alto)

    let mejor: Blob | null = null
    for (const calidad of CALIDADES) {
      const intento = await aBlob(lienzo, calidad)
      if (!intento) continue
      if (!mejor || intento.size < mejor.size) mejor = intento
      // Las calidades van de mejor a peor, así que la primera que entra en
      // el objetivo es la mejor que cabe. No se sigue castigando la foto.
      if (intento.size <= TAMANO_OBJETIVO) break
    }

    // Si no se logró nada (una foto ya muy comprimida puede salir más
    // pesada al recomprimirla), se sube la original.
    if (!mejor || mejor.size >= archivo.size) return archivo

    return new File([mejor], conExtensionJpg(archivo.name), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } catch {
    return archivo
  } finally {
    imagen.close()
  }
}

function aBlob(lienzo: HTMLCanvasElement, calidad: number): Promise<Blob | null> {
  return new Promise((resolver) => lienzo.toBlob(resolver, 'image/jpeg', calidad))
}

function conExtensionJpg(nombre: string): string {
  const base = nombre.replace(/\.[^.]+$/, '').trim()
  return `${base || 'factura'}.jpg`
}
