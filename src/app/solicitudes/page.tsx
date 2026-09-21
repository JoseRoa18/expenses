import { redirect } from 'next/navigation'
import { crearClienteServidor, obtenerPerfilObligatorio } from '@/lib/supabase/servidor'
import { TarjetaSolicitud } from '@/componentes/TarjetaSolicitud'
import { FormularioSolicitud } from '@/componentes/FormularioSolicitud'
import { Encabezado } from '@/componentes/Encabezado'
import { Vacio } from '@/componentes/Vacio'
import type { Solicitud, Perfil } from '@/lib/tipos'

export const dynamic = 'force-dynamic'

// Fix 6: columnas nombradas una por una, no `select('*')`. Hoy `solicitudes`
// no tiene ninguna columna de dinero, así que Alix nunca la ve -- pero eso
// hoy es una coincidencia del esquema, no una garantía. Esta fila se pasa
// entera como prop a <TarjetaSolicitud>, un componente de cliente: React
// serializa TODAS sus props al payload RSC que llega al navegador de Alix,
// sin importar qué se renderice condicionalmente adentro. Con `select('*')`,
// una futura migración que agregue, por ejemplo, `monto_estimado` se filtra
// a su payload sin ningún cambio de código. Nombrando las columnas, esa
// migración simplemente no aparece aquí hasta que alguien decida agregarla
// a esta lista a propósito.
const COLUMNAS_SOLICITUD =
  'id, creada_por, titulo, cantidad, urgencia, notas, estado, motivo_rechazo, created_at, updated_at'

export default async function Solicitudes() {
  const perfil = await obtenerPerfilObligatorio()
  if (!perfil) redirect('/entrar')

  const supabase = await crearClienteServidor()
  const [{ data: solicitudes, error: errorSolicitudes }, { data: perfiles }] = await Promise.all([
    supabase.from('solicitudes').select(COLUMNAS_SOLICITUD).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, nombre, rol'),
  ])

  // Igual que en /dinero (commit edbb1c4): si la consulta falla, no se debe
  // mostrar "Todavía no hay solicitudes" -- Alix, viendo eso, volvería a
  // crear una solicitud que ya había hecho, Jose la compraría de nuevo, y es
  // dinero real gastado dos veces.
  const listaSolicitudes = errorSolicitudes ? null : ((solicitudes as Solicitud[]) ?? [])

  const nombrePorId = new Map((perfiles as Perfil[] ?? []).map((p) => [p.id, p.nombre]))
  const puedePedir = perfil.rol === 'solicitante' || perfil.rol === 'financista'

  return (
    <main className="con-barra mx-auto max-w-md px-4 py-6">
      <Encabezado titulo="Solicitudes" nombre={perfil.nombre} />

      {puedePedir && <FormularioSolicitud />}

      <div className="flex flex-col gap-3">
        {listaSolicitudes === null && (
          <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
            No se pudo cargar la lista de solicitudes. Vuelve a intentarlo antes de crear una
            nueva.
          </p>
        )}

        {listaSolicitudes?.map((s) => (
          <TarjetaSolicitud
            key={s.id}
            solicitud={s}
            autor={nombrePorId.get(s.creada_por) ?? '—'}
            esAutor={s.creada_por === perfil.id}
            esComprador={perfil.rol === 'comprador'}
          />
        ))}
        {listaSolicitudes !== null && listaSolicitudes.length === 0 && (
          <Vacio
            titulo="Todavía no hay solicitudes"
            ayuda={
              puedePedir
                ? 'Escribe arriba lo que haga falta y toca Pedir.'
                : 'Cuando alguien pida algo, aparecerá aquí.'
            }
          />
        )}
      </div>
    </main>
  )
}
