/**
 * Qué color es qué, en todos los gráficos del resumen.
 *
 * El texto va en la tinta de la app y el color solo en el cuadrito de al
 * lado: el naranja como letra sobre blanco no se lee, y así nadie depende
 * de distinguir el color para saber qué es cada cosa.
 */
export function Leyenda({ series }: { series: ('recibido' | 'gastado')[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {series.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={`inline-block h-2.5 w-2.5 rounded-[2px] ${s === 'recibido' ? 'bg-recibido' : 'bg-gastado'}`}
          />
          {s === 'recibido' ? 'Recibido' : 'Gastado'}
        </li>
      ))}
    </ul>
  )
}
