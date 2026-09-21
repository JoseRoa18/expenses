import { BotonSalir } from '@/componentes/BotonSalir'

/**
 * La barra de arriba de las tres pantallas.
 *
 * Se queda pegada al desplazar (`sticky`) porque las listas de gastos y
 * solicitudes crecen sin final: al bajar treinta filas ya no había forma de
 * saber en qué pantalla estabas ni de salir sin volver arriba del todo.
 *
 * El `-mx-4` la saca de los márgenes de la página para que la línea de
 * abajo llegue de borde a borde; el relleno propio le devuelve el margen al
 * contenido.
 */
export function Encabezado({ titulo, nombre }: { titulo: string; nombre: string }) {
  return (
    <header className="sticky top-0 z-10 -mx-4 mb-5 flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur-sm">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">{titulo}</h1>
      <BotonSalir nombre={nombre} />
    </header>
  )
}
