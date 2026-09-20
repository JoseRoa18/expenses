import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { leerEntorno } from '@/lib/entorno'

const RUTAS_PUBLICAS = ['/entrar']

export async function refrescarSesion(request: NextRequest) {
  // El middleware corre antes que cualquier página, así que si lanza aquí, el
  // navegador solo ve "MIDDLEWARE_INVOCATION_FAILED" y ninguna ruta responde.
  // Por eso comprueba y responde explicando, en vez de reventar.
  const config = leerEntorno()
  if (!config.ok) {
    return new NextResponse(
      `<!doctype html><html lang="es"><head><meta charset="utf-8">`
        + `<meta name="viewport" content="width=device-width,initial-scale=1">`
        + `<title>Falta configuración</title></head>`
        + `<body style="font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;`
        + `margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px">`
        + `<div style="max-width:28rem"><h1 style="font-size:1.25rem;margin:0 0 .75rem">`
        + `Falta configuración</h1><p style="margin:0 0 .75rem;line-height:1.5">`
        + `La aplicación no puede arrancar porque no encuentra `
        + `${config.faltan.map((v) => `<code>${v}</code>`).join(' ni ')}.</p>`
        + `<p style="margin:0;line-height:1.5;color:#475569">En Vercel se configuran en `
        + `Settings → Environment Variables. Después hay que volver a desplegar: `
        + `cambiar el valor no basta.</p></div></body></html>`,
      { status: 500, headers: { 'content-type': 'text/html; charset=utf-8' } },
    )
  }

  let respuesta = NextResponse.next({ request })

  const supabase = createServerClient(
    config.entorno.url,
    config.entorno.anon,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesNuevas) => {
          cookiesNuevas.forEach(({ name, value }) => request.cookies.set(name, value))
          respuesta = NextResponse.next({ request })
          cookiesNuevas.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const ruta = request.nextUrl.pathname
  const esPublica = RUTAS_PUBLICAS.some((p) => ruta === p || ruta.startsWith(`${p}/`))

  if (!user && !esPublica) {
    const destino = request.nextUrl.clone()
    destino.pathname = '/entrar'
    return NextResponse.redirect(destino)
  }

  if (user && ruta === '/entrar') {
    const destino = request.nextUrl.clone()
    destino.pathname = '/'
    return NextResponse.redirect(destino)
  }

  return respuesta
}
