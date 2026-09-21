import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { calcularBalance } from '@/lib/balance'

// dotenv carga `.env` por defecto; los secretos de este proyecto viven en
// `.env.local`, asi que hay que nombrarlo explicitamente.
config({ path: '.env.local', quiet: true })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Abre una sesión como esa persona SIN saber su PIN.
 *
 * Desde que cada quien crea el suyo, nadie -- tampoco quien corre las
 * pruebas -- conoce los PIN, así que ya no se puede entrar con contraseña.
 * En su lugar se pide un enlace de un solo uso con la llave de servicio y
 * se canjea por una sesión normal. No toca la contraseña de nadie.
 *
 * La sesión que sale de aquí es una sesión corriente de `authenticated`:
 * las políticas de RLS se le aplican igual que a la persona de verdad, que
 * es justo lo que esta suite existe para comprobar.
 */
async function entrarComo(correo: string): Promise<SupabaseClient> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: correo,
  })
  if (error) throw new Error(`No se pudo generar el enlace de ${correo}: ${error.message}`)

  const cliente = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: errorCanje } = await cliente.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: 'email',
  })
  if (errorCanje) throw new Error(`No se pudo entrar como ${correo}: ${errorCanje.message}`)
  return cliente
}

// Cliente de administración: puentea RLS con la llave de servicio. Esta
// suite escribe en la base real (no hay entorno de prueba separado), y como
// no existe política de DELETE para la app, la única forma de dejar la base
// como la encontró es borrar con la llave de servicio -- exactamente la vía
// de "corrección administrativa directa en Supabase" que el spec ya
// contempla. Esto no debilita el diseño: la regla de "nada se borra" es
// sobre lo que puede hacer la app con la llave pública, no sobre esto.
const admin = createClient(URL, SERVICIO, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let alix: SupabaseClient
let jose: SupabaseClient
let yenny: SupabaseClient

// Todo lo que esta suite crea, para borrarlo al final en orden seguro para
// las llaves foráneas: facturas -> compras -> aportes -> solicitudes.
const idsSolicitudes: string[] = []
const idsCompras: string[] = []
const idsFacturas: string[] = []
const idsAportes: string[] = []

let idPerfilAlix: string
let idPerfilJose: string
let idPerfilYenny: string

// Las filas propias de Alix, para poder comprobar que las ve -- y que las de
// Jose, sembradas al lado, no.
let idAporteAlix: string
let idCompraAlix: string
let idFacturaAlix: string
let idCompraJose: string
let idAporteJose: string
let idFacturaJose: string

// El balance de cada persona justo antes de sembrar, para que la prueba
// compruebe la DIFERENCIA que produce la semilla y no un total absoluto. No
// hay entorno de prueba separado (ver comentario de `admin` más abajo):
// esta suite corre contra el mismo libro de cuentas real que usan los tres.
// Un total absoluto ("total_aportes === 777.77") es correcto solo mientras
// la base esté vacía de dinero real; en cuanto alguien registre un aporte
// de verdad, esa aserción falla para siempre, y la tentación de aflojarla
// -- a `toBeGreaterThan(0)` o similar -- le quita los dientes a la prueba
// más valiosa del proyecto. Con la diferencia, la prueba sigue siendo
// exacta (sigue comprobando el redondeo de `numeric` a centavos exactos)
// sin importar cuánto dinero real ya exista.
type TotalesPersona = { total_aportes: number; total_gastos: number }
const balanceAntes = new Map<string, TotalesPersona>()

async function leerBalances(cliente: SupabaseClient) {
  const { data, error } = await cliente.rpc('obtener_balances')
  if (error) throw error
  return data as {
    persona_id: string
    nombre: string
    total_aportes: number
    total_gastos: number
  }[]
}

beforeAll(async () => {
  alix = await entrarComo('alix@expenses.local')
  jose = await entrarComo('jose@expenses.local')
  yenny = await entrarComo('yenny@expenses.local')

  idPerfilAlix = (await alix.from('profiles').select('id').eq('nombre', 'Alix').single())
    .data!.id
  idPerfilJose = (await jose.from('profiles').select('id').eq('nombre', 'Jose').single())
    .data!.id
  idPerfilYenny = (await yenny.from('profiles').select('id').eq('nombre', 'Yenny').single())
    .data!.id

  // Yenny ve las tres bolsas, así que de aquí sale el punto de partida de
  // todas.
  for (const fila of await leerBalances(yenny)) {
    balanceAntes.set(fila.nombre, {
      total_aportes: Number(fila.total_aportes),
      total_gastos: Number(fila.total_gastos),
    })
  }

  // --- Semilla de dinero real -------------------------------------------
  // Se siembra dinero de DOS bolsas: la de Jose y la de Alix. Con una sola
  // no se puede probar nada: "Alix ve lo suyo" pasaría igual con una
  // política que deje ver todo. Hacen falta filas ajenas y filas propias en
  // la misma corrida para poder comprobar las dos mitades de la regla --
  // lo que tiene que estar y lo que no puede estar.
  const { data: solicitudSemilla, error: errSolicitud } = await alix
    .from('solicitudes')
    .insert({ creada_por: idPerfilAlix, titulo: 'prueba de permisos: semilla de dinero' })
    .select()
    .single()
  if (errSolicitud) throw errSolicitud
  idsSolicitudes.push(solicitudSemilla!.id)

  const { error: errEstado } = await jose
    .from('solicitudes')
    .update({ estado: 'comprada' })
    .eq('id', solicitudSemilla!.id)
  if (errEstado) throw errEstado

  const { data: compraSemilla, error: errCompra } = await jose
    .from('compras')
    .insert({
      solicitud_id: solicitudSemilla!.id,
      registrada_por: idPerfilJose,
      descripcion: 'prueba de permisos: compra semilla ($555.55)',
      monto_bs: 20000,
      monto_usd: 555.55,
    })
    .select()
    .single()
  if (errCompra) throw errCompra
  idsCompras.push(compraSemilla!.id)
  idCompraJose = compraSemilla!.id

  const { data: facturaSemilla, error: errFactura } = await jose
    .from('facturas')
    .insert({
      compra_id: compraSemilla!.id,
      storage_path: 'facturas/prueba-permisos-semilla.jpg',
    })
    .select()
    .single()
  if (errFactura) throw errFactura
  idsFacturas.push(facturaSemilla!.id)
  idFacturaJose = facturaSemilla!.id

  const { data: aporteSemilla, error: errAporte } = await jose
    .from('aportes')
    .insert({ registrada_por: idPerfilJose, monto_usd: 777.77 })
    .select()
    .single()
  if (errAporte) throw errAporte
  idsAportes.push(aporteSemilla!.id)
  idAporteJose = aporteSemilla!.id

  // --- La bolsa de Alix -------------------------------------------------
  const { data: aporteAlix, error: errAporteAlix } = await alix
    .from('aportes')
    .insert({ registrada_por: idPerfilAlix, monto_usd: 333.33 })
    .select()
    .single()
  if (errAporteAlix) throw errAporteAlix
  idsAportes.push(aporteAlix!.id)
  idAporteAlix = aporteAlix!.id

  const { data: compraAlix, error: errCompraAlix } = await alix
    .from('compras')
    .insert({
      registrada_por: idPerfilAlix,
      descripcion: 'prueba de permisos: gasto de Alix ($111.11)',
      monto_bs: 4000,
      monto_usd: 111.11,
    })
    .select()
    .single()
  if (errCompraAlix) throw errCompraAlix
  idsCompras.push(compraAlix!.id)
  idCompraAlix = compraAlix!.id

  const { data: facturaAlix, error: errFacturaAlix } = await alix
    .from('facturas')
    .insert({
      compra_id: compraAlix!.id,
      storage_path: `${compraAlix!.id}/prueba-permisos-alix.jpg`,
    })
    .select()
    .single()
  if (errFacturaAlix) throw errFacturaAlix
  idsFacturas.push(facturaAlix!.id)
  idFacturaAlix = facturaAlix!.id
})

afterAll(async () => {
  await Promise.all([alix, jose, yenny].map((c) => c?.auth.signOut()))

  // Limpieza dura en orden seguro para las llaves foráneas: facturas
  // referencian compras, compras referencian solicitudes.
  if (idsFacturas.length > 0) {
    await admin.from('facturas').delete().in('id', idsFacturas)
  }
  if (idsCompras.length > 0) {
    await admin.from('compras').delete().in('id', idsCompras)
  }
  if (idsAportes.length > 0) {
    await admin.from('aportes').delete().in('id', idsAportes)
  }
  if (idsSolicitudes.length > 0) {
    await admin.from('solicitudes').delete().in('id', idsSolicitudes)
  }
})

/**
 * La prueba más importante del proyecto.
 *
 * Antes decía "Alix no ve nada de dinero" y se comprobaba con `toEqual([])`,
 * que falla sola en cuanto una política se rompe. Ahora la regla es "Alix ve
 * lo suyo", y esa se puede aprobar por accidente: una política que deje ver
 * de más pasaría igual si solo se comprobara que están sus filas. Por eso
 * cada prueba de aquí comprueba las dos mitades sobre la misma consulta: que
 * esté lo propio Y que no esté lo ajeno.
 */
describe('Alix ve su bolsa y solo la suya', () => {
  it('lee su gasto, no el de Jose', async () => {
    const { data, error } = await alix.from('compras').select('id')
    expect(error).toBeNull()
    const ids = (data ?? []).map((c) => c.id)
    expect(ids).toContain(idCompraAlix)
    expect(ids).not.toContain(idCompraJose)
  })

  it('lee su ingreso, no el de Jose', async () => {
    const { data, error } = await alix.from('aportes').select('id')
    expect(error).toBeNull()
    const ids = (data ?? []).map((a) => a.id)
    expect(ids).toContain(idAporteAlix)
    expect(ids).not.toContain(idAporteJose)
  })

  it('lee la factura de su gasto, no la del de Jose', async () => {
    const { data, error } = await alix.from('facturas').select('id')
    expect(error).toBeNull()
    const ids = (data ?? []).map((f) => f.id)
    expect(ids).toContain(idFacturaAlix)
    expect(ids).not.toContain(idFacturaJose)
  })

  it('el balance le devuelve una sola fila, la suya', async () => {
    const filas = await leerBalances(alix)
    expect(filas).toHaveLength(1)
    expect(filas[0].nombre).toBe('Alix')
    expect(filas[0].persona_id).toBe(idPerfilAlix)
  })

  it('su balance refleja exactamente lo que ella sembró', async () => {
    const [fila] = await leerBalances(alix)
    const antes = balanceAntes.get('Alix')!
    expect(Number(fila.total_aportes) - antes.total_aportes).toBeCloseTo(333.33, 2)
    expect(Number(fila.total_gastos) - antes.total_gastos).toBeCloseTo(111.11, 2)
  })

  it('registra un gasto suyo', async () => {
    const { data, error } = await alix
      .from('compras')
      .insert({
        registrada_por: idPerfilAlix,
        descripcion: 'prueba de permisos: gasto propio de Alix',
        monto_bs: 100,
        monto_usd: 1,
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    idsCompras.push(data!.id)
  })

  it('no puede registrar un gasto a nombre de Jose', async () => {
    // Si esto entrara, la bolsa de Jose bajaría sin que él hiciera nada.
    const { error } = await alix.from('compras').insert({
      registrada_por: idPerfilJose,
      descripcion: 'intento no autorizado',
      monto_bs: 100,
      monto_usd: 1,
    })
    expect(error).not.toBeNull()
  })

  it('no puede registrar un ingreso a nombre de Jose', async () => {
    const { error } = await alix.from('aportes').insert({
      registrada_por: idPerfilJose,
      monto_usd: 100,
    })
    expect(error).not.toBeNull()
  })
})

describe('Yenny audita las tres bolsas', () => {
  it('lee los gastos de todos', async () => {
    const { data, error } = await yenny.from('compras').select('id')
    expect(error).toBeNull()
    const ids = (data ?? []).map((c) => c.id)
    expect(ids).toContain(idCompraJose)
    expect(ids).toContain(idCompraAlix)
  })

  it('lee las facturas de todos', async () => {
    const { data, error } = await yenny.from('facturas').select('id')
    expect(error).toBeNull()
    const ids = (data ?? []).map((f) => f.id)
    expect(ids).toContain(idFacturaJose)
    expect(ids).toContain(idFacturaAlix)
  })

  it('el balance le devuelve una fila por persona', async () => {
    const filas = await leerBalances(yenny)
    expect(filas.map((f) => f.nombre).sort()).toEqual(['Alix', 'Jose', 'Yenny'])
  })

  it('la bolsa de Jose refleja exactamente la semilla que se sembró', async () => {
    const filas = await leerBalances(yenny)
    const fila = filas.find((f) => f.nombre === 'Jose')!
    expect(fila).toHaveProperty('total_aportes')
    expect(fila).toHaveProperty('total_gastos')

    // La semilla mete en la bolsa de Jose exactamente un aporte de $777.77 y
    // una compra de $555.55 -- montos con centavos, elegidos a propósito para
    // que un `numeric` mal convertido (redondeo, truncamiento, o una suma
    // hecha como texto) se note. No se compara contra un total absoluto: esta
    // suite corre contra el libro de cuentas real (no hay entorno de prueba
    // separado), así que en cuanto exista un solo aporte o gasto real, un
    // total absoluto falla para siempre. Se compara contra `balanceAntes`
    // (leído en beforeAll, antes de sembrar), así que la prueba sigue siendo
    // exacta sin importar cuánto dinero real ya haya en la base.
    //
    // Y sirve para una segunda cosa: si las sumas se escaparan de su bolsa,
    // el delta de Jose incluiría los $333.33 y los $111.11 que sembró Alix, y
    // esta prueba fallaría.

    // `numeric` de Postgres: PostgREST lo serializa como número JSON (no como
    // string entrecomillado), así que supabase-js ya entrega un `number` de
    // JS aquí, no un string -- `Number()` en la pantalla es un no-op, no una
    // conversión que esté haciendo trabajo real. Se deja constancia con este
    // chequeo de tipo en vez de solo suponerlo.
    expect(typeof fila.total_aportes).toBe('number')
    expect(typeof fila.total_gastos).toBe('number')

    const antes = balanceAntes.get('Jose')!
    const deltaAportes = Number(fila.total_aportes) - antes.total_aportes
    const deltaGastos = Number(fila.total_gastos) - antes.total_gastos
    expect(deltaAportes).toBeCloseTo(777.77, 2)
    expect(deltaGastos).toBeCloseTo(555.55, 2)

    // El mismo cálculo que hace la pantalla de dinero (`calcularBalance`, con
    // las sumas ya hechas por Postgres, tal como las usa
    // `src/app/dinero/page.tsx`) aplicado a la diferencia que introdujo la
    // semilla debe dar exactamente $222.22 a favor.
    const balanceDelta = calcularBalance([deltaAportes], [deltaGastos])
    expect(balanceDelta.neto).toBeCloseTo(222.22, 2)
  })

  it('registra un gasto suyo', async () => {
    // Cambió respecto al diseño anterior: Yenny también tiene su bolsa, así
    // que registra lo suyo. Lo que sigue sin poder es escribir en la de
    // otro, que es la prueba de abajo.
    const { data, error } = await yenny
      .from('compras')
      .insert({
        registrada_por: idPerfilYenny,
        descripcion: 'prueba de permisos: gasto propio de Yenny',
        monto_bs: 100,
        monto_usd: 1,
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    idsCompras.push(data!.id)
  })

  it('no puede registrar un gasto a nombre de Jose', async () => {
    const { error } = await yenny.from('compras').insert({
      registrada_por: idPerfilJose,
      descripcion: 'intento no autorizado',
      monto_bs: 100,
      monto_usd: 1,
    })
    expect(error).not.toBeNull()
  })

  it('no puede registrar un ingreso a nombre de Alix', async () => {
    const { error } = await yenny.from('aportes').insert({
      registrada_por: idPerfilAlix,
      monto_usd: 100,
    })
    expect(error).not.toBeNull()
  })

  it('sí puede crear solicitudes', async () => {
    const { data: perfil } = await yenny.from('profiles').select('id')
      .eq('nombre', 'Yenny').single()
    const { data, error } = await yenny.from('solicitudes')
      .insert({ creada_por: perfil!.id, titulo: 'prueba de permisos (Yenny)' })
      .select().single()
    expect(error).toBeNull()
    idsSolicitudes.push(data!.id)
    // No hay política de borrado para la app a propósito: la limpieza real
    // ocurre en el afterAll con la llave de servicio. Aquí solo se cierra
    // el flujo normal cancelándola, como haría la app.
    await yenny.from('solicitudes').update({ estado: 'cancelada' }).eq('id', data!.id)
  })
})

describe('Jose ve las tres bolsas', () => {
  it('el balance le devuelve una fila por persona', async () => {
    const filas = await leerBalances(jose)
    expect(filas.map((f) => f.nombre).sort()).toEqual(['Alix', 'Jose', 'Yenny'])
  })

  it('lee el gasto de Alix', async () => {
    const { data, error } = await jose.from('compras').select('id')
    expect(error).toBeNull()
    expect((data ?? []).map((c) => c.id)).toContain(idCompraAlix)
  })

  it('no puede crear solicitudes', async () => {
    const { data: perfil } = await jose.from('profiles').select('id')
      .eq('nombre', 'Jose').single()
    const { error } = await jose.from('solicitudes')
      .insert({ creada_por: perfil!.id, titulo: 'intento no autorizado' })
    expect(error).not.toBeNull()
  })
})

describe('las reglas de estado se imponen en la base de datos', () => {
  it('rechazar sin motivo no entra', async () => {
    const { data: solicitud } = await alix.from('solicitudes')
      .insert({ creada_por: idPerfilAlix, titulo: 'prueba: rechazo sin motivo' })
      .select().single()
    idsSolicitudes.push(solicitud!.id)

    const { error } = await jose.from('solicitudes')
      .update({ estado: 'rechazada' })
      .eq('id', solicitud!.id)
    expect(error).not.toBeNull()

    await jose.from('solicitudes').update({ estado: 'cancelada' }).eq('id', solicitud!.id)
  })

  it('una solicitud comprada ya no se puede cancelar', async () => {
    const { data: solicitud } = await alix.from('solicitudes')
      .insert({ creada_por: idPerfilAlix, titulo: 'prueba: cancelar comprada' })
      .select().single()
    idsSolicitudes.push(solicitud!.id)

    await jose.from('solicitudes').update({ estado: 'comprada' }).eq('id', solicitud!.id)

    const { error } = await jose.from('solicitudes')
      .update({ estado: 'cancelada' })
      .eq('id', solicitud!.id)
    expect(error).not.toBeNull()

    await jose.from('solicitudes').update({ estado: 'entregada' }).eq('id', solicitud!.id)
  })
})

describe('Jose no puede reescribir ni robarse solicitudes ajenas', () => {
  it('no puede reescribir el título de una solicitud pendiente ajena', async () => {
    const { data: solicitud } = await alix.from('solicitudes')
      .insert({ creada_por: idPerfilAlix, titulo: 'prueba: título original' })
      .select().single()
    idsSolicitudes.push(solicitud!.id)

    const { error } = await jose.from('solicitudes')
      .update({ titulo: 'título reescrito por Jose' })
      .eq('id', solicitud!.id)
    // No basta con "hubo un error": un error de FK, de red, o de cualquier
    // otra cosa también pasaría `expect(error).not.toBeNull()` sin que el
    // candado de autoría de contenido (0001, validar_transicion_solicitud)
    // haya hecho nada. Se comprueba el mensaje exacto que lanza ese trigger,
    // para que la prueba falle si algún día deja de ser ese candado el que
    // bloquea esto.
    expect(error?.message).toContain('Solo el autor de la solicitud puede cambiar su contenido')
  })

  it('no puede reescribir las notas de una solicitud pendiente ajena', async () => {
    const { data: solicitud } = await alix.from('solicitudes')
      .insert({ creada_por: idPerfilAlix, titulo: 'prueba: notas originales' })
      .select().single()
    idsSolicitudes.push(solicitud!.id)

    const { error } = await jose.from('solicitudes')
      .update({ notas: 'notas reescritas por Jose' })
      .eq('id', solicitud!.id)
    expect(error?.message).toContain('Solo el autor de la solicitud puede cambiar su contenido')
  })

  it('no puede robarse la autoría de una solicitud', async () => {
    const { data: solicitud } = await alix.from('solicitudes')
      .insert({ creada_por: idPerfilAlix, titulo: 'prueba: no robar autoría' })
      .select().single()
    idsSolicitudes.push(solicitud!.id)

    const { error } = await jose.from('solicitudes')
      .update({ creada_por: idPerfilJose })
      .eq('id', solicitud!.id)
    // Antes esto solo comprobaba `error !== null`, que pasa igual de bien
    // con un error de llave foránea que con el candado de autoría de
    // verdad ("no puede robarse la autoría" pasaría aunque el candado
    // estuviera roto, mientras algo -- cualquier cosa -- fallara antes).
    expect(error?.message).toContain('La autoría de una solicitud no se puede reasignar')
  })

  it('no puede cambiar el estado y reescribir el título en el mismo llamado', async () => {
    const { data: solicitud } = await alix.from('solicitudes')
      .insert({ creada_por: idPerfilAlix, titulo: 'prueba: combinado estado+título' })
      .select().single()
    idsSolicitudes.push(solicitud!.id)

    const { error } = await jose.from('solicitudes')
      .update({ estado: 'comprada', titulo: 'título reescrito por Jose' })
      .eq('id', solicitud!.id)
    expect(error?.message).toContain('Solo el autor de la solicitud puede cambiar su contenido')
  })

  it('sí puede cambiar solo el estado, de pendiente a comprada', async () => {
    const { data: solicitud } = await alix.from('solicitudes')
      .insert({ creada_por: idPerfilAlix, titulo: 'prueba: solo cambiar estado' })
      .select().single()
    idsSolicitudes.push(solicitud!.id)

    const { error } = await jose.from('solicitudes')
      .update({ estado: 'comprada' })
      .eq('id', solicitud!.id)
    expect(error).toBeNull()
  })

  it('sí puede rechazar con motivo', async () => {
    const { data: solicitud } = await alix.from('solicitudes')
      .insert({ creada_por: idPerfilAlix, titulo: 'prueba: rechazo con motivo' })
      .select().single()
    idsSolicitudes.push(solicitud!.id)

    const { error } = await jose.from('solicitudes')
      .update({ estado: 'rechazada', motivo_rechazo: 'no había presupuesto' })
      .eq('id', solicitud!.id)
    expect(error).toBeNull()
  })
})

describe('el autor sí edita el contenido de su propia solicitud pendiente', () => {
  it('Alix edita el título y las notas de su propia solicitud', async () => {
    const { data: solicitud } = await alix.from('solicitudes')
      .insert({ creada_por: idPerfilAlix, titulo: 'prueba: Alix edita lo suyo' })
      .select().single()
    idsSolicitudes.push(solicitud!.id)

    const { error } = await alix.from('solicitudes')
      .update({ titulo: 'prueba: Alix edita lo suyo (editado)', notas: 'nota agregada' })
      .eq('id', solicitud!.id)
    expect(error).toBeNull()
  })

  it('Yenny edita su propia solicitud', async () => {
    const { data: solicitud } = await yenny.from('solicitudes')
      .insert({ creada_por: idPerfilYenny, titulo: 'prueba: Yenny edita lo suyo' })
      .select().single()
    idsSolicitudes.push(solicitud!.id)

    const { error } = await yenny.from('solicitudes')
      .update({ titulo: 'prueba: Yenny edita lo suyo (editado)' })
      .eq('id', solicitud!.id)
    expect(error).toBeNull()
  })
})
