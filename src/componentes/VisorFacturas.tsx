export function VisorFacturas({ enlaces }: { enlaces: string[] }) {
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
          className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700"
        >
          Factura {i + 1}
        </a>
      ))}
    </div>
  )
}
