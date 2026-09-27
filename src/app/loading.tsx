/**
 * Lo que se ve al cambiar de pestaña mientras llega la pantalla nueva.
 *
 * Sin esto, tocar "Gastos" con poca señal no hacía nada visible durante un
 * par de segundos, y el toque se repetía. Next muestra esto en el acto y lo
 * cambia por la pantalla en cuanto está.
 *
 * No aparece al filtrar una lista: filtrar es navegar a la misma pantalla
 * con otros parámetros, y ahí la lista de antes se queda atenuada (ver
 * `ZonaFiltrada`) en vez de desaparecer bajo el pulgar.
 */
export default function Cargando() {
  return (
    <main className="con-barra mx-auto max-w-md px-4 py-6" aria-busy="true" aria-label="Cargando">
      <div className="-mx-4 mb-5 flex h-[57px] items-center border-b border-slate-200 px-4">
        <div className="h-6 w-32 animate-pulse rounded-lg bg-slate-200" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-12 animate-pulse rounded-xl bg-slate-200" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5" />
        ))}
      </div>
    </main>
  )
}
