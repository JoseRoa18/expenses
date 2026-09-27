import Link from 'next/link'

/**
 * El final de una lista que sigue. Es un enlace y no un botón: la cantidad
 * que se ve queda en la dirección (`?ver=60`), así que volver atrás desde
 * una factura deja la lista donde estaba.
 */
export function VerMas({ href, restantes, paso }: { href: string; restantes: number; paso: number }) {
  if (restantes <= 0) return null
  return (
    <Link
      href={href}
      scroll={false}
      className="flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 font-medium text-slate-800 active:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
    >
      Ver {Math.min(paso, restantes)} más
      <span className="cifras ml-1 text-sm font-normal text-slate-500">(quedan {restantes})</span>
    </Link>
  )
}
