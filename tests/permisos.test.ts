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

async function entrarComo(correo: string, pin: string): Promise<SupabaseClient> {
  const cliente = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await cliente.auth.signInWithPassword({ email: correo, password: pin })
  if (error) throw new Error(`No se pudo entrar como ${correo}: ${error.message}`)
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

// Balance justo antes de sembrar dinero, para que la prueba compruebe la
// DIFERENCIA que produce la semilla, no un total absoluto. No hay entorno
// de prueba separado (ver comentario de `admin` más abajo): esta suite
// corre contra el mismo libro de cuentas real que van a usar Jose y Yenny.
// Un total absoluto ("total_aportes === 777.77") es correcto solo mientras
// la base esté vacía de dinero real; en cuanto Jose registre un aporte de
// verdad, esa aserción falla para siempre, y la tentación de aflojarla
// -- a `toBeGreaterThan(0)` o similar -- le quita los dientes a la prueba
// más valiosa del proyecto. Con la diferencia, la prueba sigue siendo
// exacta (sigue comprobando el redondeo de `numeric` a centavos exactos)
// sin importar cuánto dinero real ya exista.
let balanceAntes: { total_aportes: number; total_gastos: number }

beforeAll(async () => {
  alix = await entrarComo('alix@expenses.local', process.env.PIN_ALIX!)
  jose = await entrarComo('jose@expenses.local', process.env.PIN_JOSE!)
  yenny = await entrarComo('yenny@expenses.local', process.env.PIN_YENNY!)

  idPerfilAlix = (await alix.from('profiles').select('id').eq('nombre', 'Alix').single())
    .data!.id
  idPerfilJose = (await jose.from('profiles').select('id').eq('nombre', 'Jose').single())
    .data!.id
  idPerfilYenny = (await yenny.from('profiles').select('id').eq('nombre', 'Yenny').single())
    .data!.id

  const { data: balanceInicial, error: errBalanceInicial } = await yenny.rpc('obtener_balance')
  if (errBalanceInicial) throw errBalanceInicial
  balanceAntes = {
    total_aportes: Number(balanceInicial![0].total_aportes),
    total_gastos: Number(balanceInicial![0].total_gastos),
  }

  // --- Semilla de dinero real -------------------------------------------
  // Sin esto, "Alix no lee compras/aportes/facturas" comprueba una tabla
  // vacía: esa comprobación pasa igual si la RLS está activa o si está
  // completamente apagada, así que no protege nada. Con filas reales de
  // dinero, la aserción `toEqual([])` sí depende de que la política
  // funcione: si la RLS de la tabla se desactivara, esto devolvería la fila
  // sembrada y la prueba fallaría, que es justo lo que se necesita.
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

  const { data: aporteSemilla, error: errAporte } = await jose
    .from('aportes')
    .insert({ registrada_por: idPerfilJose, monto_usd: 777.77 })
    .select()
    .single()
  if (errAporte) throw errAporte
  idsAportes.push(aporteSemilla!.id)
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

describe('Alix no puede ver nada de dinero', () => {
  it('no lee compras', async () => {
    const { data } = await alix.from('compras').select('*')
    expect(data).toEqual([])
  })

  it('no lee aportes', async () => {
    const { data } = await alix.from('aportes').select('*')
    expect(data).toEqual([])
  })

  it('no lee facturas', async () => {
    const { data } = await alix.from('facturas').select('*')
    expect(data).toEqual([])
  })

  it('no obtiene el balance', async () => {
    const { data } = await alix.rpc('obtener_balance')
    expect(data).toEqual([])
  })

  it('no puede registrar una compra', async () => {
    const { data: perfil } = await alix.from('profiles').select('id').limit(1).single()
    const { error } = await alix.from('compras').insert({
      registrada_por: perfil!.id,
      descripcion: 'intento no autorizado',
      monto_bs: 100,
      monto_usd: 1,
    })
    expect(error).not.toBeNull()
  })

  it('no puede registrar un aporte', async () => {
    const { data: perfil } = await alix.from('profiles').select('id').limit(1).single()
    const { error } = await alix.from('aportes').insert({
      registrada_por: perfil!.id,
      monto_usd: 100,
    })
    expect(error).not.toBeNull()
  })
})

describe('Yenny audita todo pero no registra gastos', () => {
  it('lee compras', async () => {
    const { error } = await yenny.from('compras').select('*')
    expect(error).toBeNull()
  })

  it('obtiene el balance, y refleja exactamente la semilla que se sembró', async () => {
    const { data, error } = await yenny.rpc('obtener_balance')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0]).toHaveProperty('total_aportes')
    expect(data![0]).toHaveProperty('total_gastos')

    // La semilla de este archivo mete exactamente un aporte de $777.77 y una
    // compra de $555.55 -- montos con centavos, elegidos a propósito para que
    // un `numeric` mal convertido (redondeo, truncamiento, o una suma hecha
    // como texto) se note. No se compara contra un total absoluto: esta
    // suite corre contra el libro de cuentas real (no hay entorno de prueba
    // separado), así que en cuanto exista un solo aporte o gasto real, un
    // total absoluto falla para siempre. Se compara contra `balanceAntes`
    // (leído en beforeAll, antes de sembrar), así que la prueba sigue siendo
    // exacta sin importar cuánto dinero real ya haya en la base.
    const fila = data![0]

    // `numeric` de Postgres: PostgREST lo serializa como número JSON (no como
    // string entrecomillado), así que supabase-js ya entrega un `number` de
    // JS aquí, no un string -- `Number()` en la pantalla es un no-op, no una
    // conversión que esté haciendo trabajo real. Se deja constancia con este
    // chequeo de tipo en vez de solo suponerlo.
    expect(typeof fila.total_aportes).toBe('number')
    expect(typeof fila.total_gastos).toBe('number')

    const deltaAportes = Number(fila.total_aportes) - balanceAntes.total_aportes
    const deltaGastos = Number(fila.total_gastos) - balanceAntes.total_gastos
    expect(deltaAportes).toBeCloseTo(777.77, 2)
    expect(deltaGastos).toBeCloseTo(555.55, 2)

    // El mismo cálculo que hace la pantalla de dinero (`calcularBalance`, con
    // las sumas ya hechas por Postgres, tal como las usa
    // `src/app/dinero/page.tsx`) aplicado a la diferencia que introdujo la
    // semilla debe dar exactamente $222.22 a favor.
    const balanceDelta = calcularBalance([deltaAportes], [deltaGastos])
    expect(balanceDelta.neto).toBeCloseTo(222.22, 2)
  })

  it('no puede registrar una compra', async () => {
    const { data: perfil } = await yenny.from('profiles').select('id')
      .eq('nombre', 'Yenny').single()
    const { error } = await yenny.from('compras').insert({
      registrada_por: perfil!.id,
      descripcion: 'intento no autorizado',
      monto_bs: 100,
      monto_usd: 1,
    })
    expect(error).not.toBeNull()
  })

  it('no puede registrar un aporte', async () => {
    const { data: perfil } = await yenny.from('profiles').select('id')
      .eq('nombre', 'Yenny').single()
    const { error } = await yenny.from('aportes').insert({
      registrada_por: perfil!.id,
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

describe('Jose registra el dinero', () => {
  it('obtiene el balance', async () => {
    const { data, error } = await jose.rpc('obtener_balance')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
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
    expect(error).not.toBeNull()
  })

  it('no puede reescribir las notas de una solicitud pendiente ajena', async () => {
    const { data: solicitud } = await alix.from('solicitudes')
      .insert({ creada_por: idPerfilAlix, titulo: 'prueba: notas originales' })
      .select().single()
    idsSolicitudes.push(solicitud!.id)

    const { error } = await jose.from('solicitudes')
      .update({ notas: 'notas reescritas por Jose' })
      .eq('id', solicitud!.id)
    expect(error).not.toBeNull()
  })

  it('no puede robarse la autoría de una solicitud', async () => {
    const { data: solicitud } = await alix.from('solicitudes')
      .insert({ creada_por: idPerfilAlix, titulo: 'prueba: no robar autoría' })
      .select().single()
    idsSolicitudes.push(solicitud!.id)

    const { error } = await jose.from('solicitudes')
      .update({ creada_por: idPerfilJose })
      .eq('id', solicitud!.id)
    expect(error).not.toBeNull()
  })

  it('no puede cambiar el estado y reescribir el título en el mismo llamado', async () => {
    const { data: solicitud } = await alix.from('solicitudes')
      .insert({ creada_por: idPerfilAlix, titulo: 'prueba: combinado estado+título' })
      .select().single()
    idsSolicitudes.push(solicitud!.id)

    const { error } = await jose.from('solicitudes')
      .update({ estado: 'comprada', titulo: 'título reescrito por Jose' })
      .eq('id', solicitud!.id)
    expect(error).not.toBeNull()
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
