export function VisorFacturas({ enlaces }: { enlaces: string[] | null }) {
  // `null` significa que la consulta falló -- no que no haya factura. Para
  // Yenny, cuyo trabajo es auditar que la evidencia existe, esa distinción
  // es la mitad de la pantalla: "Sin factura" es una acusación que el
  // código no se ganó si en realidad fue un fallo de red.
  if (enlaces === null) {
    return <p className="text-xs text-red-600">No se pudo comprobar si hay factura.</p>
  }
  if (enlaces.length === 0) {
    return <p className="text-xs text-slate-400">Sin factura</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {enlaces.map((enlace, i) => (
        <a
          key={enlace}
          href={enlace}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 items-center rounded-lg bg-slate-100 px-3 text-xs font-medium text-slate-700"
        >
          Factura {i + 1}
        </a>
      ))}
    </div>
  )
}
