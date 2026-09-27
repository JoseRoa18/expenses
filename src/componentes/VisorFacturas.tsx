import { IconoArchivo } from '@/componentes/Iconos'

/**
 * Las facturas de una compra.
 *
 * Cada elemento es el enlace de una foto, o `null` si esa foto existe pero no
 * se le pudo sacar enlace. Antes esas se descartaban en silencio, y una
 * compra con su factura podía verse "Sin factura" por un fallo de red: para
 * Yenny, cuyo trabajo es auditar que la evidencia existe, esa distinción es
 * la mitad de la pantalla. "Sin factura" es una acusación que el código no
 * se ganó si en realidad fue un fallo de red.
 */
export function VisorFacturas({ enlaces }: { enlaces: (string | null)[] | null }) {
  if (enlaces === null) {
    return <p className="text-xs text-red-600">No se pudo comprobar si hay factura.</p>
  }
  if (enlaces.length === 0) {
    // slate-500 y no slate-400: esto es justo lo que Yenny viene a buscar, y
    // el gris anterior no llegaba al contraste mínimo sobre blanco.
    return <p className="text-xs font-medium text-slate-500">Sin factura</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {enlaces.map((enlace, i) =>
        enlace ? (
          <a
            key={enlace}
            href={enlace}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 active:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <IconoArchivo className="h-4 w-4" />
            Factura {i + 1}
          </a>
        ) : (
          <span
            key={`sin-enlace-${i}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-dashed border-red-200 px-3 text-xs font-medium text-red-700"
          >
            <IconoArchivo className="h-4 w-4" />
            Factura {i + 1}: no se pudo abrir
          </span>
        ),
      )}
    </div>
  )
}
