# Control de gastos compartidos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir una app web donde Alix pide insumos, Jose los compra y registra el gasto con factura, y Yenny financia y audita, con un balance en dólares visible solo para Jose y Yenny.

**Architecture:** Next.js (App Router) desplegado en Vercel, con Supabase como base de datos, autenticación y almacenamiento de facturas. Los permisos se aplican con Row Level Security dentro de Postgres, no en el código de la app: aunque la app tuviera un fallo, Alix no puede leer montos ni facturas. La lógica de dinero y de estados vive en módulos puros de TypeScript, probados sin base de datos.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4, `@supabase/supabase-js`, `@supabase/ssr`, Vitest, `pg` (solo para aplicar migraciones).

**Spec:** `docs/superpowers/specs/2026-09-20-control-gastos-design.md`

## Global Constraints

- **Idioma:** toda la interfaz, los nombres de tablas/columnas y los mensajes de error visibles van en español. El código (nombres de funciones y variables) también en español, para que sea coherente con el dominio.
- **Moneda ancla:** dólares. `balance = SUMA(aportes.monto_usd) − SUMA(compras.monto_usd)`. Los bolívares se guardan pero nunca entran en el balance.
- **Formato de números:** estilo venezolano — punto para miles, coma para decimales, siempre 2 decimales. `$157,50`, `1.500,00 Bs`.
- **Dinero en el código:** nunca sumar `number` con decimales directamente. Convertir a centavos enteros (`Math.round(n * 100)`), operar, y dividir entre 100 al final.
- **Roles:** `solicitante` (Alix), `comprador` (Jose), `financista` (Yenny). Las reglas se escriben contra el rol, nunca contra el nombre.
- **Alix no ve dinero:** ni montos, ni facturas, ni notas de compra, ni balance. Esto se garantiza en la base de datos.
- **Secretos:** `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` y los PIN viven solo en `.env.local`, que está en `.gitignore`. Nunca se escriben en código, ni en migraciones, ni en commits.
- **Móvil primero:** todas las pantallas se diseñan para pantalla de teléfono; los botones de acción principal deben ser cómodos con el pulgar (mínimo 44px de alto).
- **Proyecto Supabase:** `cdjkosrunejazgojjoxe`. **Repo:** `github.com/JoseRoa18/expenses`.

---

## Estructura de archivos

```
expenses/
├── .env.example                       # plantilla sin secretos, SÍ se versiona
├── .env.local                         # secretos reales, NO se versiona
├── .gitignore
├── package.json
├── next.config.ts
├── tsconfig.json
├── vitest.config.ts
├── postcss.config.mjs
│
├── supabase/
│   ├── migraciones/
│   │   ├── 0001_esquema.sql           # tipos, tablas, restricciones, triggers
│   │   ├── 0002_permisos.sql          # RLS, función mi_rol(), RPC de balance
│   │   └── 0003_almacenamiento.sql    # bucket privado de facturas + permisos
│   └── scripts/
│       ├── migrar.mjs                 # aplica las migraciones en orden
│       └── crear-usuarios.mjs         # crea las 3 cuentas con sus PIN
│
├── src/
│   ├── lib/
│   │   ├── tipos.ts                   # tipos compartidos del dominio
│   │   ├── balance.ts                 # cálculo del balance (puro)
│   │   ├── solicitudes.ts             # reglas de transición de estado (puro)
│   │   ├── formato.ts                 # formateo de montos y fechas (puro)
│   │   └── supabase/
│   │       ├── navegador.ts           # cliente para componentes del navegador
│   │       ├── servidor.ts            # cliente para componentes de servidor
│   │       └── middleware.ts          # refresco de sesión
│   │
│   ├── middleware.ts                  # protege rutas, redirige a /entrar
│   │
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── page.tsx                   # redirige a la pantalla según el rol
│   │   ├── entrar/
│   │   │   ├── page.tsx               # selector de persona + teclado de PIN
│   │   │   └── acciones.ts            # server action: iniciar sesión
│   │   ├── solicitudes/
│   │   │   ├── page.tsx               # lista (Alix, Yenny, Jose)
│   │   │   ├── acciones.ts            # crear, editar, cancelar, rechazar
│   │   │   └── [id]/page.tsx          # detalle de una solicitud
│   │   ├── compras/
│   │   │   ├── page.tsx               # historial de gastos (Jose, Yenny)
│   │   │   └── acciones.ts            # registrar compra, subir factura, entregar
│   │   └── dinero/
│   │       ├── page.tsx               # balance + aportes (Jose, Yenny)
│   │       └── acciones.ts            # registrar aporte
│   │
│   └── componentes/
│       ├── TecladoPin.tsx
│       ├── TarjetaSolicitud.tsx
│       ├── EtiquetaEstado.tsx
│       ├── ResumenBalance.tsx
│       ├── FormularioCompra.tsx
│       └── VisorFacturas.tsx
│
└── tests/
    ├── balance.test.ts                # puro, sin base de datos
    ├── solicitudes.test.ts            # puro, sin base de datos
    ├── formato.test.ts                # puro, sin base de datos
    └── permisos.test.ts               # integración: RLS contra Supabase real
```

**Por qué esta división:** las tres piezas que pueden causar daño real (el cálculo del dinero, las reglas de estado, y los permisos) quedan aisladas en archivos pequeños que se prueban solos. Las pantallas son consumidoras de esas piezas y no contienen reglas propias.

---

## Task 1: Andamiaje del proyecto

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.example`, `.env.local`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Test: `tests/andamiaje.test.ts`

**Interfaces:**
- Consumes: nada (primera tarea)
- Produces: proyecto que arranca con `npm run dev`, compila con `npm run build`, y corre pruebas con `npm test`

- [ ] **Step 1: Crear el proyecto Next.js**

Ejecutar en `E:\Trabajo\PIM\expenses` (la carpeta ya existe y tiene `docs/`, por eso se usa `.`):

```bash
npx --yes create-next-app@latest . --typescript --tailwind --app --src-dir --eslint --no-turbopack --import-alias "@/*" --use-npm
```

Si pregunta por sobrescribir archivos existentes, responder que sí: solo hay `docs/` y `.git/`, que no toca.

- [ ] **Step 2: Instalar las dependencias del proyecto**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install --save-dev vitest dotenv pg
```

- [ ] **Step 3: Configurar Vitest**

Crear `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
```

Añadir los scripts a `package.json` (dentro de `"scripts"`, conservando los que puso `create-next-app`):

```json
"test": "vitest run",
"test:watch": "vitest",
"migrar": "node supabase/scripts/migrar.mjs",
"crear-usuarios": "node supabase/scripts/crear-usuarios.mjs"
```

- [ ] **Step 4: Asegurar que los secretos no se suban a GitHub**

Añadir al final de `.gitignore` (create-next-app ya ignora `.env*`, pero se deja explícito porque es la línea que más importa del proyecto):

```gitignore
# Secretos — NUNCA versionar
.env
.env.local
.env*.local
```

Crear `.env.example` (esta sí se versiona, sirve de plantilla y no lleva valores):

```bash
# Públicas: van al navegador, no son secretas
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Secretas: solo servidor y scripts. NUNCA con prefijo NEXT_PUBLIC_
SUPABASE_SERVICE_ROLE_KEY=
# Session Pooler, puerto 5432 (Settings → Database → Connection string → Session pooler).
# NO uses la conexión directa db.<ref>.supabase.co: solo resuelve a IPv6.
DATABASE_URL=postgresql://postgres.TU_PROYECTO:CONTRASENA@aws-0-TU_REGION.pooler.supabase.com:5432/postgres

# PIN de cada persona (6 dígitos). Solo se usan al crear las cuentas y en las pruebas.
PIN_ALIX=
PIN_JOSE=
PIN_YENNY=
```

- [ ] **Step 5: Crear `.env.local` con los valores reales**

Crear `.env.local` copiando `.env.example` y rellenando:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://cdjkosrunejazgojjoxe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key del dashboard>
SUPABASE_SERVICE_ROLE_KEY=<service_role key del dashboard>
DATABASE_URL=<Settings → Database → Connection string → URI, modo "Direct connection">
PIN_ALIX=<6 dígitos>
PIN_JOSE=<6 dígitos>
PIN_YENNY=<6 dígitos>
```

Verificar que git no lo ve:

```bash
git status --porcelain | grep -c ".env.local"
```

Expected: `0`. Si sale `1`, el `.gitignore` está mal y hay que arreglarlo antes de seguir.

- [ ] **Step 6: Escribir una prueba de humo que falla**

Crear `tests/andamiaje.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'

describe('andamiaje del proyecto', () => {
  it('ignora los archivos de secretos', () => {
    const gitignore = readFileSync('.gitignore', 'utf8')
    expect(gitignore).toContain('.env.local')
  })

  it('tiene una plantilla de variables de entorno sin valores', () => {
    expect(existsSync('.env.example')).toBe(true)
    const plantilla = readFileSync('.env.example', 'utf8')
    expect(plantilla).toContain('NEXT_PUBLIC_SUPABASE_URL')
    // La plantilla no puede llevar llaves reales: las de Supabase empiezan por "eyJ"
    expect(plantilla).not.toContain('eyJ')
  })

  it('no expone la llave de servicio al navegador', () => {
    const plantilla = readFileSync('.env.example', 'utf8')
    expect(plantilla).not.toContain('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY')
  })
})
```

- [ ] **Step 7: Correr las pruebas**

Run: `npm test`
Expected: PASS, 3 pruebas.

- [ ] **Step 8: Verificar que el proyecto compila**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: andamiaje Next.js + Supabase + Vitest"
```

---

## Task 2: Cálculo del balance

**Files:**
- Create: `src/lib/balance.ts`
- Test: `tests/balance.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `type EstadoBalance = 'disponible' | 'a_favor_de_jose' | 'al_dia'`
  - `type Balance = { totalAportes: number; totalGastos: number; neto: number; estado: EstadoBalance; monto: number }`
  - `calcularBalance(aportesUsd: number[], gastosUsd: number[]): Balance`
  - `tasaImplicita(montoBs: number, montoUsd: number): number | null`

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `tests/balance.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { calcularBalance, tasaImplicita } from '@/lib/balance'

describe('calcularBalance', () => {
  it('cuando Yenny mandó más de lo gastado, queda dinero disponible', () => {
    const b = calcularBalance([200, 200, 150], [342.5])
    expect(b.totalAportes).toBe(550)
    expect(b.totalGastos).toBe(342.5)
    expect(b.neto).toBe(207.5)
    expect(b.estado).toBe('disponible')
    expect(b.monto).toBe(207.5)
  })

  it('cuando Jose gastó más de lo recibido, el saldo queda a su favor', () => {
    const b = calcularBalance([500], [642.5])
    expect(b.neto).toBe(-142.5)
    expect(b.estado).toBe('a_favor_de_jose')
    expect(b.monto).toBe(142.5)
  })

  it('cuando coinciden exactamente, está al día', () => {
    const b = calcularBalance([100, 50], [150])
    expect(b.neto).toBe(0)
    expect(b.estado).toBe('al_dia')
    expect(b.monto).toBe(0)
  })

  it('sin movimientos, está al día en cero', () => {
    const b = calcularBalance([], [])
    expect(b.totalAportes).toBe(0)
    expect(b.totalGastos).toBe(0)
    expect(b.neto).toBe(0)
    expect(b.estado).toBe('al_dia')
  })

  it('no arrastra errores de decimales', () => {
    // Sumado como números sueltos, 0.1 + 0.2 da 0.30000000000000004
    const b = calcularBalance([0.1, 0.2], [0.3])
    expect(b.neto).toBe(0)
    expect(b.estado).toBe('al_dia')
  })

  it('acumula muchos movimientos pequeños sin desviarse', () => {
    const centavos = Array.from({ length: 300 }, () => 0.01)
    const b = calcularBalance(centavos, [])
    expect(b.totalAportes).toBe(3)
  })
})

describe('tasaImplicita', () => {
  it('divide bolívares entre dólares', () => {
    expect(tasaImplicita(1500, 12.5)).toBe(120)
  })

  it('redondea a dos decimales', () => {
    expect(tasaImplicita(1000, 3)).toBe(333.33)
  })

  it('devuelve null si el monto en dólares es cero', () => {
    expect(tasaImplicita(1500, 0)).toBeNull()
  })

  it('devuelve null si el monto en dólares es negativo', () => {
    expect(tasaImplicita(1500, -5)).toBeNull()
  })
})
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx vitest run tests/balance.test.ts`
Expected: FAIL — no encuentra el módulo `@/lib/balance`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `src/lib/balance.ts`:

```ts
/**
 * Cálculo del balance entre el dinero que Yenny entrega y lo que Jose gasta.
 *
 * Todo se opera en centavos enteros. Sumar dólares como decimales acumula
 * errores: 0.1 + 0.2 no da 0.3 exacto, y con suficientes movimientos el
 * balance dejaría de cuadrar contra las facturas.
 */

export type EstadoBalance = 'disponible' | 'a_favor_de_jose' | 'al_dia'

export type Balance = {
  /** Total recibido de Yenny, en dólares */
  totalAportes: number
  /** Total gastado por Jose, en dólares */
  totalGastos: number
  /** Aportes menos gastos. Positivo = sobra, negativo = Jose puso de lo suyo */
  neto: number
  estado: EstadoBalance
  /** El neto sin signo, que es lo que se muestra en pantalla */
  monto: number
}

const aCentavos = (montos: number[]): number =>
  montos.reduce((total, monto) => total + Math.round(monto * 100), 0)

export function calcularBalance(aportesUsd: number[], gastosUsd: number[]): Balance {
  const centavosAportes = aCentavos(aportesUsd)
  const centavosGastos = aCentavos(gastosUsd)
  const centavosNetos = centavosAportes - centavosGastos

  let estado: EstadoBalance = 'al_dia'
  if (centavosNetos > 0) estado = 'disponible'
  else if (centavosNetos < 0) estado = 'a_favor_de_jose'

  return {
    totalAportes: centavosAportes / 100,
    totalGastos: centavosGastos / 100,
    neto: centavosNetos / 100,
    estado,
    monto: Math.abs(centavosNetos) / 100,
  }
}

/**
 * La tasa de cambio que salió en una compra concreta. No se guarda en la base
 * de datos: se deduce de los dos montos, para que no haya dos versiones de la
 * verdad que puedan contradecirse.
 */
export function tasaImplicita(montoBs: number, montoUsd: number): number | null {
  if (montoUsd <= 0) return null
  return Math.round((montoBs / montoUsd) * 100) / 100
}
```

- [ ] **Step 4: Correr para verificar que pasa**

Run: `npx vitest run tests/balance.test.ts`
Expected: PASS, 10 pruebas.

- [ ] **Step 5: Commit**

```bash
git add src/lib/balance.ts tests/balance.test.ts
git commit -m "feat: calculo del balance en centavos enteros"
```

---

## Task 3: Reglas de estado y formateo

**Files:**
- Create: `src/lib/tipos.ts`, `src/lib/solicitudes.ts`, `src/lib/formato.ts`
- Test: `tests/solicitudes.test.ts`, `tests/formato.test.ts`

**Interfaces:**
- Consumes: `Balance`, `EstadoBalance` de `@/lib/balance` (Task 2)
- Produces:
  - `src/lib/tipos.ts`: `Rol`, `EstadoSolicitud`, `Urgencia`, `Perfil`, `Solicitud`, `Compra`, `Factura`, `Aporte`
  - `src/lib/solicitudes.ts`: `puedeEditar`, `puedeCancelar`, `puedeComprar`, `puedeRechazar`, `puedeEntregar`, `ETIQUETAS_ESTADO`
  - `src/lib/formato.ts`: `formatearUsd`, `formatearBs`, `formatearFecha`, `TITULOS_BALANCE`

- [ ] **Step 1: Crear los tipos compartidos**

Crear `src/lib/tipos.ts`:

```ts
export type Rol = 'solicitante' | 'comprador' | 'financista'
export type Urgencia = 'normal' | 'urgente'
export type EstadoSolicitud =
  | 'pendiente'
  | 'comprada'
  | 'entregada'
  | 'rechazada'
  | 'cancelada'

export type Perfil = {
  id: string
  nombre: string
  rol: Rol
}

export type Solicitud = {
  id: string
  creada_por: string
  titulo: string
  cantidad: string
  urgencia: Urgencia
  notas: string
  estado: EstadoSolicitud
  motivo_rechazo: string | null
  created_at: string
  updated_at: string
}

export type Compra = {
  id: string
  solicitud_id: string | null
  registrada_por: string
  descripcion: string
  monto_bs: number
  monto_usd: number
  notas: string
  fecha_compra: string
  fecha_entrega: string | null
  created_at: string
}

export type Factura = {
  id: string
  compra_id: string
  storage_path: string
  created_at: string
}

export type Aporte = {
  id: string
  registrada_por: string
  monto_usd: number
  fecha: string
  metodo: string
  notas: string
  created_at: string
}
```

- [ ] **Step 2: Escribir las pruebas de las reglas de estado**

Crear `tests/solicitudes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  puedeEditar,
  puedeCancelar,
  puedeComprar,
  puedeRechazar,
  puedeEntregar,
  ETIQUETAS_ESTADO,
} from '@/lib/solicitudes'
import type { EstadoSolicitud } from '@/lib/tipos'

const TODOS: EstadoSolicitud[] = [
  'pendiente',
  'comprada',
  'entregada',
  'rechazada',
  'cancelada',
]

describe('puedeEditar', () => {
  it('el autor puede editar mientras está pendiente', () => {
    expect(puedeEditar('pendiente', true)).toBe(true)
  })

  it('quien no es el autor no puede editar, ni estando pendiente', () => {
    expect(puedeEditar('pendiente', false)).toBe(false)
  })

  it('nadie puede editar una vez comprada', () => {
    expect(puedeEditar('comprada', true)).toBe(false)
  })

  it('ningún estado cerrado admite edición', () => {
    for (const estado of ['comprada', 'entregada', 'rechazada', 'cancelada'] as const) {
      expect(puedeEditar(estado, true)).toBe(false)
    }
  })
})

describe('puedeCancelar', () => {
  it('el autor puede cancelar mientras está pendiente', () => {
    expect(puedeCancelar('pendiente', true)).toBe(true)
  })

  it('quien no es el autor no puede cancelar', () => {
    expect(puedeCancelar('pendiente', false)).toBe(false)
  })

  it('no se puede cancelar algo ya comprado', () => {
    expect(puedeCancelar('comprada', true)).toBe(false)
  })
})

describe('puedeComprar', () => {
  it('solo desde pendiente', () => {
    expect(puedeComprar('pendiente')).toBe(true)
    for (const estado of TODOS.filter((e) => e !== 'pendiente')) {
      expect(puedeComprar(estado)).toBe(false)
    }
  })
})

describe('puedeRechazar', () => {
  it('solo desde pendiente', () => {
    expect(puedeRechazar('pendiente')).toBe(true)
    for (const estado of TODOS.filter((e) => e !== 'pendiente')) {
      expect(puedeRechazar(estado)).toBe(false)
    }
  })
})

describe('puedeEntregar', () => {
  it('solo desde comprada', () => {
    expect(puedeEntregar('comprada')).toBe(true)
    for (const estado of TODOS.filter((e) => e !== 'comprada')) {
      expect(puedeEntregar(estado)).toBe(false)
    }
  })
})

describe('ETIQUETAS_ESTADO', () => {
  it('tiene un texto en español para cada estado', () => {
    for (const estado of TODOS) {
      expect(ETIQUETAS_ESTADO[estado]).toBeTruthy()
    }
  })
})
```

- [ ] **Step 3: Escribir las pruebas de formateo**

Crear `tests/formato.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatearUsd, formatearBs, formatearFecha, TITULOS_BALANCE } from '@/lib/formato'
import { calcularBalance } from '@/lib/balance'

describe('formatearUsd', () => {
  it('usa coma decimal y siempre dos decimales', () => {
    expect(formatearUsd(157.5)).toBe('$157,50')
  })

  it('usa punto para los miles', () => {
    expect(formatearUsd(1234.56)).toBe('$1.234,56')
  })

  it('muestra el cero con decimales', () => {
    expect(formatearUsd(0)).toBe('$0,00')
  })
})

describe('formatearBs', () => {
  it('pone el sufijo Bs', () => {
    expect(formatearBs(1500)).toBe('1.500,00 Bs')
  })
})

describe('formatearFecha', () => {
  it('muestra día, mes abreviado y año', () => {
    expect(formatearFecha('2026-09-20')).toBe('20 sep 2026')
  })
})

describe('TITULOS_BALANCE', () => {
  it('cuando sobra dinero, dice que está disponible', () => {
    expect(TITULOS_BALANCE[calcularBalance([500], [342.5]).estado]).toBe('Disponible')
  })

  it('cuando Jose puso de lo suyo, lo dice a su favor', () => {
    expect(TITULOS_BALANCE[calcularBalance([500], [642.5]).estado]).toBe('A favor de Jose')
  })

  it('cuando cuadra, dice que está al día', () => {
    expect(TITULOS_BALANCE[calcularBalance([100], [100]).estado]).toBe('Al día')
  })
})
```

- [ ] **Step 4: Correr para verificar que fallan**

Run: `npx vitest run tests/solicitudes.test.ts tests/formato.test.ts`
Expected: FAIL — no encuentra `@/lib/solicitudes` ni `@/lib/formato`.

- [ ] **Step 5: Implementar las reglas de estado**

Crear `src/lib/solicitudes.ts`:

```ts
import type { EstadoSolicitud } from '@/lib/tipos'

/**
 * Reglas de qué se puede hacer con una solicitud según su estado.
 *
 * Estas funciones deciden qué botones se muestran. La base de datos impone las
 * mismas reglas con triggers; esto es la capa amable, no la que protege.
 */

export function puedeEditar(estado: EstadoSolicitud, esAutor: boolean): boolean {
  return esAutor && estado === 'pendiente'
}

export function puedeCancelar(estado: EstadoSolicitud, esAutor: boolean): boolean {
  return esAutor && estado === 'pendiente'
}

export function puedeComprar(estado: EstadoSolicitud): boolean {
  return estado === 'pendiente'
}

export function puedeRechazar(estado: EstadoSolicitud): boolean {
  return estado === 'pendiente'
}

export function puedeEntregar(estado: EstadoSolicitud): boolean {
  return estado === 'comprada'
}

export const ETIQUETAS_ESTADO: Record<EstadoSolicitud, string> = {
  pendiente: 'Pendiente',
  comprada: 'Comprada',
  entregada: 'Entregada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
}
```

- [ ] **Step 6: Implementar el formateo**

Crear `src/lib/formato.ts`:

```ts
import type { EstadoBalance } from '@/lib/balance'

/**
 * El nombre de cada situación del balance. Vive aquí y solo aquí: la pantalla
 * lo lee de esta tabla en vez de repetir los textos.
 */
export const TITULOS_BALANCE: Record<EstadoBalance, string> = {
  disponible: 'Disponible',
  a_favor_de_jose: 'A favor de Jose',
  al_dia: 'Al día',
}

const numero = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

export function formatearUsd(monto: number): string {
  return `$${numero.format(monto)}`
}

export function formatearBs(monto: number): string {
  return `${numero.format(monto)} Bs`
}

/**
 * Recibe una fecha en formato ISO corto (`2026-09-20`) tal como la devuelve
 * Postgres para una columna `date`. Se parte a mano en vez de usar `new Date()`
 * porque construir una fecha desde ISO la interpreta en UTC y, en una zona
 * horaria negativa como la de Venezuela, mostraría el día anterior.
 */
export function formatearFecha(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split('-')
  return `${Number(dia)} ${MESES[Number(mes) - 1]} ${anio}`
}
```

- [ ] **Step 7: Correr para verificar que pasan**

Run: `npm test`
Expected: PASS, todas las pruebas (andamiaje + balance + solicitudes + formato).

Si `formatearUsd` falla porque el separador no coincide, imprimir el valor real y ajustar la prueba al separador que produzca Node — pero **solo** después de confirmar que el problema es el espacio no separable de `Intl` y no un error del código.

- [ ] **Step 8: Commit**

```bash
git add src/lib/tipos.ts src/lib/solicitudes.ts src/lib/formato.ts tests/solicitudes.test.ts tests/formato.test.ts
git commit -m "feat: tipos del dominio, reglas de estado y formateo en espanol"
```

---

## Task 4: Esquema de la base de datos

**Files:**
- Create: `supabase/migraciones/0001_esquema.sql`, `supabase/scripts/migrar.mjs`

**Interfaces:**
- Consumes: `DATABASE_URL` de `.env.local` (Task 1)
- Produces: tablas `profiles`, `solicitudes`, `compras`, `facturas`, `aportes` en Supabase, con sus restricciones y triggers. Script `npm run migrar` que aplica las migraciones en orden alfabético y es seguro de repetir.

- [ ] **Step 1: Escribir el script que aplica las migraciones**

Crear `supabase/scripts/migrar.mjs`:

```js
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { config } from 'dotenv'

// dotenv carga `.env` por defecto; los secretos de este proyecto viven en
// `.env.local`, asi que hay que nombrarlo explicitamente.
config({ path: '.env.local', quiet: true })

const aqui = dirname(fileURLToPath(import.meta.url))
const carpeta = join(aqui, '..', 'migraciones')

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en .env.local')
  process.exit(1)
}

const cliente = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

await cliente.connect()

const archivos = readdirSync(carpeta).filter((n) => n.endsWith('.sql')).sort()

for (const archivo of archivos) {
  const sql = readFileSync(join(carpeta, archivo), 'utf8')
  process.stdout.write(`Aplicando ${archivo}... `)
  try {
    await cliente.query(sql)
    console.log('listo')
  } catch (error) {
    console.log('ERROR')
    console.error(error.message)
    await cliente.end()
    process.exit(1)
  }
}

await cliente.end()
console.log(`\n${archivos.length} migracion(es) aplicadas.`)
```

- [ ] **Step 2: Escribir el esquema**

Crear `supabase/migraciones/0001_esquema.sql`. Todo el archivo es repetible: se puede correr varias veces sin romper nada.

```sql
-- =====================================================================
-- 0001: tipos, tablas, restricciones y triggers
-- Repetible: correrlo dos veces no cambia el resultado.
-- =====================================================================

-- --- Tipos ------------------------------------------------------------

do $$ begin
  create type rol_usuario as enum ('solicitante', 'comprador', 'financista');
exception when duplicate_object then null; end $$;

do $$ begin
  create type urgencia_solicitud as enum ('normal', 'urgente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_solicitud as enum
    ('pendiente', 'comprada', 'entregada', 'rechazada', 'cancelada');
exception when duplicate_object then null; end $$;

-- --- Tablas -----------------------------------------------------------

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null check (length(trim(nombre)) > 0),
  rol         rol_usuario not null,
  created_at  timestamptz not null default now()
);

create table if not exists solicitudes (
  id              uuid primary key default gen_random_uuid(),
  creada_por      uuid not null references profiles(id) on delete restrict,
  titulo          text not null check (length(trim(titulo)) > 0),
  cantidad        text not null default '',
  urgencia        urgencia_solicitud not null default 'normal',
  notas           text not null default '',
  estado          estado_solicitud not null default 'pendiente',
  motivo_rechazo  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- El motivo es obligatorio al rechazar, y no puede quedar colgando en
  -- otros estados. Lo impone la base, no el formulario.
  constraint motivo_solo_si_rechazada check (
    (estado = 'rechazada'
      and motivo_rechazo is not null
      and length(trim(motivo_rechazo)) > 0)
    or
    (estado <> 'rechazada' and motivo_rechazo is null)
  )
);

create table if not exists compras (
  id              uuid primary key default gen_random_uuid(),
  -- null = compra suelta, sin que nadie la pidiera.
  -- El UNIQUE ignora los nulos, así que puede haber muchas compras sueltas
  -- pero solo una compra por solicitud.
  solicitud_id    uuid unique references solicitudes(id) on delete restrict,
  registrada_por  uuid not null references profiles(id) on delete restrict,
  descripcion     text not null check (length(trim(descripcion)) > 0),
  monto_bs        numeric(14, 2) not null check (monto_bs >= 0),
  monto_usd       numeric(12, 2) not null check (monto_usd >= 0),
  notas           text not null default '',
  fecha_compra    date not null default current_date,
  fecha_entrega   date,
  created_at      timestamptz not null default now(),

  constraint entrega_no_antes_de_compra check (
    fecha_entrega is null or fecha_entrega >= fecha_compra
  )
);

create table if not exists facturas (
  id            uuid primary key default gen_random_uuid(),
  compra_id     uuid not null references compras(id) on delete cascade,
  storage_path  text not null check (length(trim(storage_path)) > 0),
  created_at    timestamptz not null default now()
);

create table if not exists aportes (
  id              uuid primary key default gen_random_uuid(),
  registrada_por  uuid not null references profiles(id) on delete restrict,
  monto_usd       numeric(12, 2) not null check (monto_usd > 0),
  fecha           date not null default current_date,
  metodo          text not null default '',
  notas           text not null default '',
  created_at      timestamptz not null default now()
);

-- --- Índices ----------------------------------------------------------

create index if not exists idx_solicitudes_estado on solicitudes (estado, created_at desc);
create index if not exists idx_solicitudes_autor on solicitudes (creada_por);
create index if not exists idx_compras_fecha on compras (fecha_compra desc);
create index if not exists idx_facturas_compra on facturas (compra_id);
create index if not exists idx_aportes_fecha on aportes (fecha desc);

-- --- Transiciones de estado -------------------------------------------

create or replace function validar_transicion_solicitud()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();

  -- Sin cambio de estado: solo se admite editar si sigue pendiente.
  if old.estado = new.estado then
    if old.estado <> 'pendiente'
       and (old.titulo, old.cantidad, old.urgencia, old.notas)
           is distinct from (new.titulo, new.cantidad, new.urgencia, new.notas)
    then
      raise exception
        'La solicitud está en estado % y ya no se puede editar', old.estado;
    end if;
    return new;
  end if;

  -- Estados cerrados: no se sale de ellos.
  if old.estado in ('entregada', 'rechazada', 'cancelada') then
    raise exception
      'La solicitud ya está cerrada (%) y no admite más cambios', old.estado;
  end if;

  if old.estado = 'pendiente'
     and new.estado not in ('comprada', 'rechazada', 'cancelada') then
    raise exception 'Una solicitud pendiente no puede pasar a %', new.estado;
  end if;

  if old.estado = 'comprada' and new.estado <> 'entregada' then
    raise exception 'Una solicitud comprada solo puede pasar a entregada';
  end if;

  return new;
end
$$;

drop trigger if exists trg_transicion_solicitud on solicitudes;
create trigger trg_transicion_solicitud
  before update on solicitudes
  for each row execute function validar_transicion_solicitud();
```

- [ ] **Step 3: Aplicar las migraciones**

Run: `npm run migrar`
Expected: `Aplicando 0001_esquema.sql... listo`

Si falla con un error de conexión, revisar `DATABASE_URL`. La cadena que funciona
en este proyecto es la del **Session Pooler**, puerto **5432**:

```
postgresql://postgres.cdjkosrunejazgojjoxe:CONTRASENA@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

Dos cosas que no funcionan y conviene no perder tiempo con ellas:

- La **conexión directa** (`db.cdjkosrunejazgojjoxe.supabase.co`) solo resuelve a
  IPv6. Desde una red sin IPv6 da `ENOTFOUND`, que parece un error de contraseña
  pero no lo es.
- El **Transaction Pooler** (puerto 6543) no admite bien varias sentencias DDL en
  una sola llamada, que es justo lo que hacen estas migraciones.

- [ ] **Step 4: Verificar que es repetible**

Run: `npm run migrar`
Expected: `listo` otra vez, sin errores. Si falla, alguna sentencia no es repetible y hay que arreglarla antes de seguir.

- [ ] **Step 5: Verificar las tablas en el dashboard**

Abrir Supabase → Table Editor. Deben aparecer las cinco tablas: `profiles`, `solicitudes`, `compras`, `facturas`, `aportes`.

- [ ] **Step 6: Commit**

```bash
git add supabase/
git commit -m "feat: esquema de base de datos con restricciones y transiciones"
```

---

## Task 5: Permisos en la base de datos

Esta es la tarea más importante del proyecto. Si sale mal, Alix ve el dinero.

**Files:**
- Create: `supabase/migraciones/0002_permisos.sql`, `supabase/migraciones/0003_almacenamiento.sql`, `supabase/scripts/crear-usuarios.mjs`
- Test: `tests/permisos.test.ts`

**Interfaces:**
- Consumes: tablas de Task 4, `SUPABASE_SERVICE_ROLE_KEY` y los tres PIN de `.env.local`
- Produces:
  - Función SQL `mi_rol()` que devuelve el rol de quien consulta
  - Función SQL `obtener_balance()` que devuelve `total_aportes` y `total_gastos`, y no devuelve nada si quien pregunta es Alix
  - Bucket privado `facturas`
  - Tres cuentas creadas: `alix@expenses.local`, `jose@expenses.local`, `yenny@expenses.local`

- [ ] **Step 1: Escribir el script que crea las tres cuentas**

Crear `supabase/scripts/crear-usuarios.mjs`:

```js
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// dotenv carga `.env` por defecto; los secretos de este proyecto viven en
// `.env.local`, asi que hay que nombrarlo explicitamente.
config({ path: '.env.local', quiet: true })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !servicio) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const PERSONAS = [
  { nombre: 'Alix',  correo: 'alix@expenses.local',  rol: 'solicitante', pin: process.env.PIN_ALIX },
  { nombre: 'Jose',  correo: 'jose@expenses.local',  rol: 'comprador',   pin: process.env.PIN_JOSE },
  { nombre: 'Yenny', correo: 'yenny@expenses.local', rol: 'financista',  pin: process.env.PIN_YENNY },
]

for (const persona of PERSONAS) {
  if (!/^\d{6}$/.test(persona.pin ?? '')) {
    console.error(`El PIN de ${persona.nombre} debe ser exactamente 6 dígitos.`)
    process.exit(1)
  }
}

const admin = createClient(url, servicio, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Se listan las cuentas existentes para poder repetir el script sin duplicar.
const { data: existentes, error: errorLista } = await admin.auth.admin.listUsers()
if (errorLista) {
  console.error('No se pudo listar usuarios:', errorLista.message)
  process.exit(1)
}

for (const persona of PERSONAS) {
  const yaExiste = existentes.users.find((u) => u.email === persona.correo)
  let id

  if (yaExiste) {
    id = yaExiste.id
    const { error } = await admin.auth.admin.updateUserById(id, { password: persona.pin })
    if (error) {
      console.error(`No se pudo actualizar el PIN de ${persona.nombre}:`, error.message)
      process.exit(1)
    }
    console.log(`${persona.nombre}: PIN actualizado`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: persona.correo,
      password: persona.pin,
      email_confirm: true,
    })
    if (error) {
      console.error(`No se pudo crear a ${persona.nombre}:`, error.message)
      process.exit(1)
    }
    id = data.user.id
    console.log(`${persona.nombre}: cuenta creada`)
  }

  const { error: errorPerfil } = await admin
    .from('profiles')
    .upsert({ id, nombre: persona.nombre, rol: persona.rol }, { onConflict: 'id' })

  if (errorPerfil) {
    console.error(`No se pudo guardar el perfil de ${persona.nombre}:`, errorPerfil.message)
    process.exit(1)
  }
}

console.log('\nListo. Las tres cuentas existen con su rol y su PIN.')
```

- [ ] **Step 2: Escribir las reglas de permisos**

Crear `supabase/migraciones/0002_permisos.sql`:

```sql
-- =====================================================================
-- 0002: Row Level Security
--
-- Regla central: Alix (rol 'solicitante') NUNCA puede leer compras,
-- facturas, aportes ni el balance. Esto se impone aquí, dentro de la base
-- de datos, de modo que siga siendo cierto aunque la app tenga un fallo.
-- =====================================================================

-- --- Quién soy --------------------------------------------------------

-- security definer: necesita leer profiles sin que la política de profiles
-- la llame de vuelta a sí misma y se quede dando vueltas.
create or replace function mi_rol()
returns rol_usuario
language sql
stable
security definer
set search_path = public
as $$
  select rol from profiles where id = auth.uid()
$$;

revoke all on function mi_rol() from public;
grant execute on function mi_rol() to authenticated;

-- --- profiles ---------------------------------------------------------

alter table profiles enable row level security;

drop policy if exists "leer perfiles" on profiles;
create policy "leer perfiles" on profiles
  for select to authenticated
  using (true);
-- Nadie escribe en profiles desde la app: las cuentas se crean con el
-- script de administración.

-- --- solicitudes ------------------------------------------------------

alter table solicitudes enable row level security;

drop policy if exists "leer solicitudes" on solicitudes;
create policy "leer solicitudes" on solicitudes
  for select to authenticated
  using (true);

drop policy if exists "crear solicitudes" on solicitudes;
create policy "crear solicitudes" on solicitudes
  for insert to authenticated
  with check (
    creada_por = auth.uid()
    and mi_rol() in ('solicitante', 'financista')
  );

-- El autor edita las suyas mientras estén pendientes. El trigger de la
-- migración 0001 se encarga de que no cambie el estado por esta vía.
drop policy if exists "editar propias" on solicitudes;
create policy "editar propias" on solicitudes
  for update to authenticated
  using (
    creada_por = auth.uid()
    and mi_rol() in ('solicitante', 'financista')
    and estado = 'pendiente'
  )
  with check (creada_por = auth.uid());

-- Jose cambia el estado de cualquier solicitud (comprar, rechazar, entregar).
drop policy if exists "comprador gestiona estado" on solicitudes;
create policy "comprador gestiona estado" on solicitudes
  for update to authenticated
  using (mi_rol() = 'comprador')
  with check (mi_rol() = 'comprador');

-- --- compras ----------------------------------------------------------

alter table compras enable row level security;

drop policy if exists "leer compras" on compras;
create policy "leer compras" on compras
  for select to authenticated
  using (mi_rol() in ('comprador', 'financista'));

drop policy if exists "registrar compras" on compras;
create policy "registrar compras" on compras
  for insert to authenticated
  with check (mi_rol() = 'comprador' and registrada_por = auth.uid());

drop policy if exists "actualizar compras" on compras;
create policy "actualizar compras" on compras
  for update to authenticated
  using (mi_rol() = 'comprador')
  with check (mi_rol() = 'comprador');

-- --- facturas ---------------------------------------------------------

alter table facturas enable row level security;

drop policy if exists "leer facturas" on facturas;
create policy "leer facturas" on facturas
  for select to authenticated
  using (mi_rol() in ('comprador', 'financista'));

drop policy if exists "subir facturas" on facturas;
create policy "subir facturas" on facturas
  for insert to authenticated
  with check (mi_rol() = 'comprador');

-- --- aportes ----------------------------------------------------------

alter table aportes enable row level security;

drop policy if exists "leer aportes" on aportes;
create policy "leer aportes" on aportes
  for select to authenticated
  using (mi_rol() in ('comprador', 'financista'));

drop policy if exists "registrar aportes" on aportes;
create policy "registrar aportes" on aportes
  for insert to authenticated
  with check (mi_rol() = 'comprador' and registrada_por = auth.uid());

-- --- Balance ----------------------------------------------------------

-- Devuelve los dos totales en una sola consulta. El WHERE de dentro hace
-- que a Alix no le devuelva ninguna fila: no es que vea ceros, es que no
-- hay resultado.
create or replace function obtener_balance()
returns table (total_aportes numeric, total_gastos numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select sum(monto_usd) from aportes), 0)::numeric as total_aportes,
    coalesce((select sum(monto_usd) from compras), 0)::numeric as total_gastos
  where mi_rol() in ('comprador', 'financista')
$$;

revoke all on function obtener_balance() from public;
grant execute on function obtener_balance() to authenticated;
```

- [ ] **Step 3: Escribir los permisos del almacenamiento**

Crear `supabase/migraciones/0003_almacenamiento.sql`:

```sql
-- =====================================================================
-- 0003: bucket privado para las fotos de las facturas
-- Privado = las imágenes no se sirven por URL directa. La app genera
-- enlaces firmados de corta duración para Jose y Yenny.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'facturas',
  'facturas',
  false,
  10485760,                                              -- 10 MB por foto
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ver archivos de facturas" on storage.objects;
create policy "ver archivos de facturas" on storage.objects
  for select to authenticated
  using (bucket_id = 'facturas' and mi_rol() in ('comprador', 'financista'));

drop policy if exists "subir archivos de facturas" on storage.objects;
create policy "subir archivos de facturas" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'facturas' and mi_rol() = 'comprador');
```

- [ ] **Step 4: Aplicar y crear las cuentas**

```bash
npm run migrar
npm run crear-usuarios
```

Expected: las tres migraciones dicen `listo`, y luego `Alix: cuenta creada`, `Jose: cuenta creada`, `Yenny: cuenta creada`.

- [ ] **Step 5: Escribir la prueba de permisos**

Crear `tests/permisos.test.ts`. Es una prueba de integración: habla con el Supabase real usando la llave pública, igual que lo haría un navegador.

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// dotenv carga `.env` por defecto; los secretos de este proyecto viven en
// `.env.local`, asi que hay que nombrarlo explicitamente.
config({ path: '.env.local', quiet: true })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function entrarComo(correo: string, pin: string): Promise<SupabaseClient> {
  const cliente = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await cliente.auth.signInWithPassword({ email: correo, password: pin })
  if (error) throw new Error(`No se pudo entrar como ${correo}: ${error.message}`)
  return cliente
}

let alix: SupabaseClient
let jose: SupabaseClient
let yenny: SupabaseClient

beforeAll(async () => {
  alix = await entrarComo('alix@expenses.local', process.env.PIN_ALIX!)
  jose = await entrarComo('jose@expenses.local', process.env.PIN_JOSE!)
  yenny = await entrarComo('yenny@expenses.local', process.env.PIN_YENNY!)
})

afterAll(async () => {
  await Promise.all([alix, jose, yenny].map((c) => c?.auth.signOut()))
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

  it('obtiene el balance', async () => {
    const { data, error } = await yenny.rpc('obtener_balance')
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0]).toHaveProperty('total_aportes')
    expect(data![0]).toHaveProperty('total_gastos')
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
    // No hay política de borrado a propósito: nada se elimina de la base.
    // La solicitud de prueba se cierra cancelándola.
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
    const { data: perfilAlix } = await alix.from('profiles').select('id')
      .eq('nombre', 'Alix').single()
    const { data: solicitud } = await alix.from('solicitudes')
      .insert({ creada_por: perfilAlix!.id, titulo: 'prueba: rechazo sin motivo' })
      .select().single()

    const { error } = await jose.from('solicitudes')
      .update({ estado: 'rechazada' })
      .eq('id', solicitud!.id)
    expect(error).not.toBeNull()

    await jose.from('solicitudes').update({ estado: 'cancelada' }).eq('id', solicitud!.id)
  })

  it('una solicitud comprada ya no se puede cancelar', async () => {
    const { data: perfilAlix } = await alix.from('profiles').select('id')
      .eq('nombre', 'Alix').single()
    const { data: solicitud } = await alix.from('solicitudes')
      .insert({ creada_por: perfilAlix!.id, titulo: 'prueba: cancelar comprada' })
      .select().single()

    await jose.from('solicitudes').update({ estado: 'comprada' }).eq('id', solicitud!.id)

    const { error } = await jose.from('solicitudes')
      .update({ estado: 'cancelada' })
      .eq('id', solicitud!.id)
    expect(error).not.toBeNull()

    await jose.from('solicitudes').update({ estado: 'entregada' }).eq('id', solicitud!.id)
  })
})
```

- [ ] **Step 6: Correr la prueba de permisos**

Run: `npx vitest run tests/permisos.test.ts`
Expected: PASS, todas.

Si alguna de las pruebas de Alix falla porque **sí** ve datos, parar todo y arreglar la política antes de continuar. Es el requisito central del proyecto.

- [ ] **Step 7: Correr todas las pruebas**

Run: `npm test`
Expected: PASS, todas.

- [ ] **Step 8: Commit**

```bash
git add supabase/ tests/permisos.test.ts
git commit -m "feat: permisos en base de datos y prueba de que Alix no ve el dinero"
```

---

## Task 6: Entrar con PIN

**Files:**
- Create: `src/lib/supabase/navegador.ts`, `src/lib/supabase/servidor.ts`, `src/lib/supabase/middleware.ts`, `src/middleware.ts`
- Create: `src/app/entrar/page.tsx`, `src/app/entrar/acciones.ts`, `src/componentes/TecladoPin.tsx`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`

**Interfaces:**
- Consumes: cuentas creadas en Task 5, `Rol` y `Perfil` de `@/lib/tipos` (Task 3)
- Produces:
  - `crearClienteNavegador(): SupabaseClient`
  - `crearClienteServidor(): Promise<SupabaseClient>`
  - `obtenerPerfil(): Promise<Perfil | null>` — el perfil de quien está en sesión
  - `iniciarSesion(persona: string, pin: string): Promise<{ error: string | null }>` — server action
  - Ruta `/entrar` funcional; el resto de rutas redirigen ahí si no hay sesión

- [ ] **Step 1: Crear los clientes de Supabase**

Crear `src/lib/supabase/navegador.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'

export function crearClienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

Crear `src/lib/supabase/servidor.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Perfil } from '@/lib/tipos'

export async function crearClienteServidor() {
  const almacen = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => almacen.getAll(),
        setAll: (cookiesNuevas) => {
          try {
            cookiesNuevas.forEach(({ name, value, options }) =>
              almacen.set(name, value, options),
            )
          } catch {
            // Los componentes de servidor no pueden escribir cookies.
            // El middleware ya refresca la sesión, así que se ignora.
          }
        },
      },
    },
  )
}

/** El perfil de quien está en sesión, o null si no hay nadie. */
export async function obtenerPerfil(): Promise<Perfil | null> {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, nombre, rol')
    .eq('id', user.id)
    .single()

  return data ?? null
}
```

- [ ] **Step 2: Proteger las rutas**

Crear `src/lib/supabase/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const RUTAS_PUBLICAS = ['/entrar']

export async function refrescarSesion(request: NextRequest) {
  let respuesta = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
  const esPublica = RUTAS_PUBLICAS.some((p) => ruta.startsWith(p))

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
```

Crear `src/middleware.ts`:

```ts
import type { NextRequest } from 'next/server'
import { refrescarSesion } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return refrescarSesion(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
}
```

- [ ] **Step 3: Escribir la acción de inicio de sesión**

Crear `src/app/entrar/acciones.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/servidor'

/**
 * La app muestra nombres; Supabase necesita correos. Esta tabla es la
 * traducción, y vive solo en el servidor.
 */
const CORREOS: Record<string, string> = {
  Alix: 'alix@expenses.local',
  Jose: 'jose@expenses.local',
  Yenny: 'yenny@expenses.local',
}

export async function iniciarSesion(
  persona: string,
  pin: string,
): Promise<{ error: string | null }> {
  const correo = CORREOS[persona]
  if (!correo) return { error: 'Persona no reconocida' }
  if (!/^\d{6}$/.test(pin)) return { error: 'El PIN son 6 dígitos' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: pin })

  if (error) {
    // No se distingue entre "PIN incorrecto" y otros fallos, para no dar
    // pistas a quien esté probando combinaciones.
    return { error: 'PIN incorrecto' }
  }

  redirect('/')
}
```

- [ ] **Step 4: Crear el teclado de PIN**

Crear `src/componentes/TecladoPin.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { iniciarSesion } from '@/app/entrar/acciones'

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '←']

export function TecladoPin({ persona, alVolver }: { persona: string; alVolver: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function pulsar(tecla: string) {
    if (enviando || tecla === '') return
    setError(null)

    if (tecla === '←') {
      setPin((actual) => actual.slice(0, -1))
      return
    }
    if (pin.length >= 6) return

    const nuevo = pin + tecla
    setPin(nuevo)

    if (nuevo.length === 6) {
      setEnviando(true)
      const resultado = await iniciarSesion(persona, nuevo)
      if (resultado?.error) {
        setError(resultado.error)
        setPin('')
        setEnviando(false)
      }
    }
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <p className="text-sm text-slate-500">Hola,</p>
        <p className="text-2xl font-semibold text-slate-900">{persona}</p>
      </div>

      <div className="flex gap-3" aria-label={`PIN: ${pin.length} de 6 dígitos`}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full border-2 ${
              i < pin.length ? 'border-slate-900 bg-slate-900' : 'border-slate-300'
            }`}
          />
        ))}
      </div>

      <p className="h-5 text-sm text-red-600" role="alert">{error ?? ''}</p>

      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        {TECLAS.map((tecla, i) => (
          <button
            key={i}
            type="button"
            onClick={() => pulsar(tecla)}
            disabled={tecla === '' || enviando}
            className={`h-16 rounded-2xl text-2xl font-medium transition ${
              tecla === ''
                ? 'invisible'
                : 'bg-slate-100 text-slate-900 active:bg-slate-200 disabled:opacity-40'
            }`}
          >
            {tecla}
          </button>
        ))}
      </div>

      <button type="button" onClick={alVolver} className="text-sm text-slate-500 underline">
        No soy {persona}
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Crear la pantalla de entrada**

Crear `src/app/entrar/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { TecladoPin } from '@/componentes/TecladoPin'

const PERSONAS = ['Alix', 'Jose', 'Yenny']

export default function Entrar() {
  const [persona, setPersona] = useState<string | null>(null)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      {persona ? (
        <TecladoPin persona={persona} alVolver={() => setPersona(null)} />
      ) : (
        <>
          <h1 className="mb-10 text-center text-xl font-semibold text-slate-900">
            ¿Quién eres?
          </h1>
          <div className="flex flex-col gap-3">
            {PERSONAS.map((nombre) => (
              <button
                key={nombre}
                type="button"
                onClick={() => setPersona(nombre)}
                className="h-16 rounded-2xl bg-slate-900 text-lg font-medium text-white active:bg-slate-700"
              >
                {nombre}
              </button>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 6: Redirigir desde la raíz según el rol**

Reemplazar el contenido de `src/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { obtenerPerfil } from '@/lib/supabase/servidor'

export default async function Inicio() {
  const perfil = await obtenerPerfil()
  if (!perfil) redirect('/entrar')

  // Alix vive en las solicitudes; Jose y Yenny entran por el dinero.
  redirect(perfil.rol === 'solicitante' ? '/solicitudes' : '/dinero')
}
```

- [ ] **Step 7: Poner el idioma y el título en el layout**

Reemplazar `src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gastos',
  description: 'Control de gastos compartidos',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 8: Probar a mano en el navegador**

Run: `npm run dev`

Comprobar, en orden:
1. Abrir `http://localhost:3000` → redirige a `/entrar`.
2. Tocar "Alix" → aparece el teclado.
3. Teclear un PIN incorrecto → dice "PIN incorrecto" y se vacían los puntos.
4. Teclear el PIN de Alix → entra y llega a `/solicitudes` (dará 404 hasta la Task 7; eso es lo esperado).
5. Volver a `http://localhost:3000/entrar` → redirige a `/` porque ya hay sesión.

- [ ] **Step 9: Verificar que compila**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: entrar con PIN y proteccion de rutas"
```

---

## Task 7: Solicitudes

**Files:**
- Create: `src/app/solicitudes/page.tsx`, `src/app/solicitudes/acciones.ts`
- Create: `src/componentes/TarjetaSolicitud.tsx`, `src/componentes/EtiquetaEstado.tsx`

**Interfaces:**
- Consumes: `obtenerPerfil` (Task 6), `puedeEditar`/`puedeCancelar`/`ETIQUETAS_ESTADO` (Task 3), tipo `Solicitud` (Task 3)
- Produces:
  - Server actions: `crearSolicitud(datos: FormData)`, `editarSolicitud(id: string, datos: FormData)`, `cancelarSolicitud(id: string)`
  - Componente `<EtiquetaEstado estado={...} />` reutilizado en las pantallas de Jose y Yenny

- [ ] **Step 1: Crear la etiqueta de estado**

Crear `src/componentes/EtiquetaEstado.tsx`:

```tsx
import { ETIQUETAS_ESTADO } from '@/lib/solicitudes'
import type { EstadoSolicitud } from '@/lib/tipos'

const COLORES: Record<EstadoSolicitud, string> = {
  pendiente: 'bg-amber-100 text-amber-800',
  comprada: 'bg-blue-100 text-blue-800',
  entregada: 'bg-emerald-100 text-emerald-800',
  rechazada: 'bg-red-100 text-red-800',
  cancelada: 'bg-slate-200 text-slate-600',
}

export function EtiquetaEstado({ estado }: { estado: EstadoSolicitud }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${COLORES[estado]}`}>
      {ETIQUETAS_ESTADO[estado]}
    </span>
  )
}
```

- [ ] **Step 2: Escribir las acciones de solicitudes**

Crear `src/app/solicitudes/acciones.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor, obtenerPerfil } from '@/lib/supabase/servidor'

type Resultado = { error: string | null }

function leerCampos(datos: FormData) {
  return {
    titulo: String(datos.get('titulo') ?? '').trim(),
    cantidad: String(datos.get('cantidad') ?? '').trim(),
    urgencia: datos.get('urgencia') === 'urgente' ? 'urgente' : 'normal',
    notas: String(datos.get('notas') ?? '').trim(),
  } as const
}

export async function crearSolicitud(datos: FormData): Promise<Resultado> {
  const perfil = await obtenerPerfil()
  if (!perfil) return { error: 'No hay sesión' }

  const campos = leerCampos(datos)
  if (!campos.titulo) return { error: 'Escribe qué necesitas' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('solicitudes')
    .insert({ ...campos, creada_por: perfil.id })

  if (error) return { error: 'No se pudo guardar la solicitud' }

  revalidatePath('/solicitudes')
  return { error: null }
}

export async function editarSolicitud(id: string, datos: FormData): Promise<Resultado> {
  const campos = leerCampos(datos)
  if (!campos.titulo) return { error: 'Escribe qué necesitas' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('solicitudes').update(campos).eq('id', id)

  // Los permisos y el trigger de la base ya impiden editar lo que no toca;
  // si llega un error, es porque se intentó algo no permitido.
  if (error) return { error: 'No se pudo editar. Puede que ya esté comprada.' }

  revalidatePath('/solicitudes')
  return { error: null }
}

export async function cancelarSolicitud(id: string): Promise<Resultado> {
  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('solicitudes')
    .update({ estado: 'cancelada' })
    .eq('id', id)

  if (error) return { error: 'No se pudo cancelar. Puede que ya esté comprada.' }

  revalidatePath('/solicitudes')
  return { error: null }
}
```

- [ ] **Step 3: Crear la tarjeta de solicitud**

Crear `src/componentes/TarjetaSolicitud.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { EtiquetaEstado } from '@/componentes/EtiquetaEstado'
import { puedeEditar, puedeCancelar } from '@/lib/solicitudes'
import { formatearFecha } from '@/lib/formato'
import { cancelarSolicitud, editarSolicitud } from '@/app/solicitudes/acciones'
import type { Solicitud } from '@/lib/tipos'

export function TarjetaSolicitud({
  solicitud,
  autor,
  esAutor,
}: {
  solicitud: Solicitud
  autor: string
  esAutor: boolean
}) {
  const [editando, setEditando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()

  function guardar(datos: FormData) {
    iniciar(async () => {
      const resultado = await editarSolicitud(solicitud.id, datos)
      setError(resultado.error)
      if (!resultado.error) setEditando(false)
    })
  }

  if (editando) {
    return (
      <article className="rounded-2xl bg-white p-4 shadow-sm">
        <form action={guardar}>
          <input
            name="titulo"
            required
            defaultValue={solicitud.titulo}
            className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-3"
          />
          <input
            name="cantidad"
            defaultValue={solicitud.cantidad}
            placeholder="Cantidad"
            className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-3"
          />
          <textarea
            name="notas"
            rows={2}
            defaultValue={solicitud.notas}
            placeholder="Notas"
            className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-3"
          />
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="urgencia"
              value="urgente"
              defaultChecked={solicitud.urgencia === 'urgente'}
              className="h-5 w-5"
            />
            Es urgente
          </label>

          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pendiente}
              className="h-11 flex-1 rounded-xl bg-slate-900 text-sm font-medium text-white disabled:opacity-50"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => { setEditando(false); setError(null) }}
              className="h-11 flex-1 rounded-xl bg-slate-100 text-sm font-medium text-slate-700"
            >
              Cancelar
            </button>
          </div>
        </form>
      </article>
    )
  }

  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-medium text-slate-900">{solicitud.titulo}</h2>
          {solicitud.cantidad && (
            <p className="text-sm text-slate-500">{solicitud.cantidad}</p>
          )}
        </div>
        <EtiquetaEstado estado={solicitud.estado} />
      </div>

      {solicitud.notas && (
        <p className="mt-2 text-sm text-slate-600">{solicitud.notas}</p>
      )}

      {solicitud.estado === 'rechazada' && solicitud.motivo_rechazo && (
        <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          <strong>Motivo:</strong> {solicitud.motivo_rechazo}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span>
          {autor} · {formatearFecha(solicitud.created_at)}
          {solicitud.urgencia === 'urgente' && (
            <span className="ml-2 font-medium text-red-600">URGENTE</span>
          )}
        </span>

        <span className="flex gap-3">
          {puedeEditar(solicitud.estado, esAutor) && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="text-slate-500 underline"
            >
              Editar
            </button>
          )}
          {puedeCancelar(solicitud.estado, esAutor) && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => iniciar(() => { cancelarSolicitud(solicitud.id) })}
              className="text-slate-500 underline disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
        </span>
      </div>
    </article>
  )
}
```

- [ ] **Step 4: Crear la pantalla de solicitudes**

Crear `src/app/solicitudes/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { crearClienteServidor, obtenerPerfil } from '@/lib/supabase/servidor'
import { TarjetaSolicitud } from '@/componentes/TarjetaSolicitud'
import { crearSolicitud } from '@/app/solicitudes/acciones'
import type { Solicitud, Perfil } from '@/lib/tipos'

export const dynamic = 'force-dynamic'

export default async function Solicitudes() {
  const perfil = await obtenerPerfil()
  if (!perfil) redirect('/entrar')

  const supabase = await crearClienteServidor()
  const [{ data: solicitudes }, { data: perfiles }] = await Promise.all([
    supabase.from('solicitudes').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, nombre, rol'),
  ])

  const nombrePorId = new Map((perfiles as Perfil[] ?? []).map((p) => [p.id, p.nombre]))
  const puedePedir = perfil.rol === 'solicitante' || perfil.rol === 'financista'

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Solicitudes</h1>
        <span className="text-sm text-slate-500">{perfil.nombre}</span>
      </header>

      {puedePedir && (
        <form
          action={async (datos: FormData) => {
            'use server'
            await crearSolicitud(datos)
          }}
          className="mb-6 rounded-2xl bg-white p-4 shadow-sm"
        >
          <h2 className="mb-3 font-medium">Pedir algo</h2>
          <input
            name="titulo"
            required
            placeholder="¿Qué necesitas?"
            className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-3"
          />
          <input
            name="cantidad"
            placeholder="Cantidad (ej: 2 cajas)"
            className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-3"
          />
          <textarea
            name="notas"
            rows={2}
            placeholder="Notas (opcional)"
            className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-3"
          />
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input type="checkbox" name="urgencia" value="urgente" className="h-5 w-5" />
            Es urgente
          </label>
          <button
            type="submit"
            className="h-12 w-full rounded-xl bg-slate-900 font-medium text-white"
          >
            Pedir
          </button>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {(solicitudes as Solicitud[] ?? []).map((s) => (
          <TarjetaSolicitud
            key={s.id}
            solicitud={s}
            autor={nombrePorId.get(s.creada_por) ?? '—'}
            esAutor={s.creada_por === perfil.id}
          />
        ))}
        {(solicitudes ?? []).length === 0 && (
          <p className="py-12 text-center text-slate-400">Todavía no hay solicitudes.</p>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 5: Probar a mano**

Run: `npm run dev`

1. Entrar como Alix → llega a `/solicitudes`.
2. Crear una solicitud "Pastillas para la tensión", cantidad "2 cajas", marcar urgente → aparece en la lista con etiqueta Pendiente y la marca URGENTE.
3. Tocar "Editar", cambiar la cantidad a "3 cajas", Guardar → la tarjeta muestra el cambio.
4. Tocar "Cancelar" → pasa a Cancelada y desaparecen los botones Editar y Cancelar.
5. Salir, entrar como Yenny → ve la solicitud de Alix y también tiene el formulario para pedir, pero en la de Alix **no** le salen Editar ni Cancelar.
6. Entrar como Jose → ve la lista pero **no** tiene formulario para pedir.

- [ ] **Step 6: Verificar que compila y que las pruebas siguen pasando**

```bash
npm run build
npm test
```

Expected: ambas sin errores.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: pantalla de solicitudes para Alix y Yenny"
```

---

## Task 8: Compras y facturas

**Files:**
- Create: `src/app/compras/page.tsx`, `src/app/compras/acciones.ts`
- Create: `src/componentes/FormularioCompra.tsx`, `src/componentes/VisorFacturas.tsx`
- Modify: `src/app/solicitudes/page.tsx` (añadir las acciones de Jose sobre cada solicitud)

**Interfaces:**
- Consumes: `tasaImplicita` (Task 2), `formatearUsd`/`formatearBs` (Task 3), bucket `facturas` (Task 5)
- Produces:
  - Server actions: `registrarCompra(datos: FormData)`, `marcarEntregada(compraId: string)`, `rechazarSolicitud(id: string, motivo: string)`
  - `obtenerEnlacesFacturas(compraId: string): Promise<string[]>` — URLs firmadas de 1 hora

- [ ] **Step 1: Escribir las acciones de compras**

Crear `src/app/compras/acciones.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor, obtenerPerfil } from '@/lib/supabase/servidor'

type Resultado = { error: string | null }

export async function registrarCompra(datos: FormData): Promise<Resultado> {
  const perfil = await obtenerPerfil()
  if (!perfil) return { error: 'No hay sesión' }
  if (perfil.rol !== 'comprador') return { error: 'Solo Jose registra compras' }

  const solicitudId = String(datos.get('solicitud_id') ?? '') || null
  const descripcion = String(datos.get('descripcion') ?? '').trim()
  const montoBs = Number(datos.get('monto_bs'))
  const montoUsd = Number(datos.get('monto_usd'))
  const notas = String(datos.get('notas') ?? '').trim()
  const fechaCompra = String(datos.get('fecha_compra') ?? '')

  if (!descripcion) return { error: 'Escribe qué compraste' }
  if (!Number.isFinite(montoBs) || montoBs < 0) return { error: 'Monto en Bs no válido' }
  if (!Number.isFinite(montoUsd) || montoUsd <= 0) return { error: 'Monto en dólares no válido' }

  const supabase = await crearClienteServidor()

  const { data: compra, error } = await supabase
    .from('compras')
    .insert({
      solicitud_id: solicitudId,
      registrada_por: perfil.id,
      descripcion,
      monto_bs: montoBs,
      monto_usd: montoUsd,
      notas,
      fecha_compra: fechaCompra || new Date().toISOString().slice(0, 10),
    })
    .select()
    .single()

  if (error || !compra) return { error: 'No se pudo guardar la compra' }

  // Si venía de una solicitud, esta pasa a "comprada".
  if (solicitudId) {
    const { error: errorEstado } = await supabase
      .from('solicitudes')
      .update({ estado: 'comprada' })
      .eq('id', solicitudId)

    if (errorEstado) {
      // La compra quedó guardada pero la solicitud no cambió: se deshace la
      // compra para que no queden las dos cosas diciendo lo contrario.
      await supabase.from('compras').delete().eq('id', compra.id)
      return { error: 'No se pudo actualizar la solicitud. No se guardó nada.' }
    }
  }

  // Facturas: se suben al bucket privado bajo la carpeta de esta compra.
  const archivos = datos.getAll('facturas').filter((f): f is File => f instanceof File && f.size > 0)

  for (const archivo of archivos) {
    const extension = archivo.name.split('.').pop() ?? 'jpg'
    const ruta = `${compra.id}/${crypto.randomUUID()}.${extension}`

    const { error: errorSubida } = await supabase.storage
      .from('facturas')
      .upload(ruta, archivo, { contentType: archivo.type })

    if (errorSubida) continue

    await supabase.from('facturas').insert({ compra_id: compra.id, storage_path: ruta })
  }

  revalidatePath('/compras')
  revalidatePath('/solicitudes')
  revalidatePath('/dinero')
  return { error: null }
}

export async function marcarEntregada(compraId: string): Promise<Resultado> {
  const supabase = await crearClienteServidor()
  const hoy = new Date().toISOString().slice(0, 10)

  const { data: compra, error } = await supabase
    .from('compras')
    .update({ fecha_entrega: hoy })
    .eq('id', compraId)
    .select('solicitud_id')
    .single()

  if (error || !compra) return { error: 'No se pudo marcar como entregada' }

  if (compra.solicitud_id) {
    await supabase
      .from('solicitudes')
      .update({ estado: 'entregada' })
      .eq('id', compra.solicitud_id)
  }

  revalidatePath('/compras')
  revalidatePath('/solicitudes')
  return { error: null }
}

export async function rechazarSolicitud(id: string, motivo: string): Promise<Resultado> {
  const limpio = motivo.trim()
  if (!limpio) return { error: 'Escribe el motivo del rechazo' }

  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('solicitudes')
    .update({ estado: 'rechazada', motivo_rechazo: limpio })
    .eq('id', id)

  if (error) return { error: 'No se pudo rechazar' }

  revalidatePath('/solicitudes')
  return { error: null }
}

/** URLs temporales (1 hora) para ver las fotos del bucket privado. */
export async function obtenerEnlacesFacturas(compraId: string): Promise<string[]> {
  const supabase = await crearClienteServidor()

  const { data: facturas } = await supabase
    .from('facturas')
    .select('storage_path')
    .eq('compra_id', compraId)

  if (!facturas?.length) return []

  const enlaces = await Promise.all(
    facturas.map(async ({ storage_path }) => {
      const { data } = await supabase.storage
        .from('facturas')
        .createSignedUrl(storage_path, 3600)
      return data?.signedUrl ?? null
    }),
  )

  return enlaces.filter((u): u is string => u !== null)
}
```

- [ ] **Step 2: Crear el formulario de compra**

Crear `src/componentes/FormularioCompra.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { registrarCompra } from '@/app/compras/acciones'
import { tasaImplicita } from '@/lib/balance'
import { formatearBs } from '@/lib/formato'

export function FormularioCompra({
  solicitudId,
  descripcionInicial = '',
}: {
  solicitudId?: string
  descripcionInicial?: string
}) {
  const [montoBs, setMontoBs] = useState('')
  const [montoUsd, setMontoUsd] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()

  const tasa = tasaImplicita(Number(montoBs), Number(montoUsd))

  function enviar(datos: FormData) {
    iniciar(async () => {
      const resultado = await registrarCompra(datos)
      setError(resultado.error)
      if (!resultado.error) {
        setMontoBs('')
        setMontoUsd('')
      }
    })
  }

  return (
    <form action={enviar} className="rounded-2xl bg-white p-4 shadow-sm">
      {solicitudId && <input type="hidden" name="solicitud_id" value={solicitudId} />}

      <input
        name="descripcion"
        required
        defaultValue={descripcionInicial}
        placeholder="¿Qué compraste?"
        className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-3"
      />

      <div className="mb-2 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Monto factura (Bs)</span>
          <input
            name="monto_bs"
            type="number"
            step="0.01"
            min="0"
            required
            value={montoBs}
            onChange={(e) => setMontoBs(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-3"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Monto en dólares</span>
          <input
            name="monto_usd"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={montoUsd}
            onChange={(e) => setMontoUsd(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-3"
          />
        </label>
      </div>

      <p className="mb-2 h-5 text-xs text-slate-500">
        {tasa !== null && `Tasa: ${formatearBs(tasa)} por dólar`}
      </p>

      <label className="mb-2 block">
        <span className="mb-1 block text-xs text-slate-500">Fecha de compra</span>
        <input
          name="fecha_compra"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="w-full rounded-xl border border-slate-200 px-3 py-3"
        />
      </label>

      <textarea
        name="notas"
        rows={2}
        placeholder="Notas (opcional)"
        className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-3"
      />

      <label className="mb-3 block">
        <span className="mb-1 block text-xs text-slate-500">Foto(s) de la factura</span>
        <input
          name="facturas"
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="w-full text-sm"
        />
      </label>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pendiente}
        className="h-12 w-full rounded-xl bg-slate-900 font-medium text-white disabled:opacity-50"
      >
        {pendiente ? 'Guardando...' : 'Registrar compra'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Crear el visor de facturas**

Crear `src/componentes/VisorFacturas.tsx`:

```tsx
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
```

- [ ] **Step 4: Crear la pantalla de compras**

Crear `src/app/compras/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { crearClienteServidor, obtenerPerfil } from '@/lib/supabase/servidor'
import { FormularioCompra } from '@/componentes/FormularioCompra'
import { VisorFacturas } from '@/componentes/VisorFacturas'
import { obtenerEnlacesFacturas, marcarEntregada } from '@/app/compras/acciones'
import { formatearUsd, formatearBs, formatearFecha } from '@/lib/formato'
import { tasaImplicita } from '@/lib/balance'
import type { Compra } from '@/lib/tipos'

export const dynamic = 'force-dynamic'

export default async function Compras() {
  const perfil = await obtenerPerfil()
  if (!perfil) redirect('/entrar')
  if (perfil.rol === 'solicitante') redirect('/solicitudes')

  const supabase = await crearClienteServidor()
  const { data } = await supabase
    .from('compras')
    .select('*')
    .order('fecha_compra', { ascending: false })

  const compras = (data as Compra[]) ?? []
  const enlacesPorCompra = new Map(
    await Promise.all(
      compras.map(async (c) => [c.id, await obtenerEnlacesFacturas(c.id)] as const),
    ),
  )

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Gastos</h1>
        <span className="text-sm text-slate-500">{perfil.nombre}</span>
      </header>

      {perfil.rol === 'comprador' && (
        <section className="mb-6">
          <h2 className="mb-2 font-medium">Registrar gasto suelto</h2>
          <FormularioCompra />
        </section>
      )}

      <div className="flex flex-col gap-3">
        {compras.map((compra) => {
          const tasa = tasaImplicita(compra.monto_bs, compra.monto_usd)
          return (
            <article key={compra.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 truncate font-medium">{compra.descripcion}</h3>
                <span className="shrink-0 font-semibold">{formatearUsd(compra.monto_usd)}</span>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                {formatearBs(compra.monto_bs)}
                {tasa !== null && ` · tasa ${formatearBs(tasa)}/$`}
              </p>

              {compra.notas && <p className="mt-2 text-sm text-slate-600">{compra.notas}</p>}

              <div className="mt-3">
                <VisorFacturas enlaces={enlacesPorCompra.get(compra.id) ?? []} />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Comprado {formatearFecha(compra.fecha_compra)}
                  {compra.fecha_entrega && ` · entregado ${formatearFecha(compra.fecha_entrega)}`}
                </span>

                {perfil.rol === 'comprador' && !compra.fecha_entrega && (
                  <form
                    action={async () => {
                      'use server'
                      await marcarEntregada(compra.id)
                    }}
                  >
                    <button type="submit" className="font-medium text-emerald-700 underline">
                      Marcar entregada
                    </button>
                  </form>
                )}
              </div>
            </article>
          )
        })}

        {compras.length === 0 && (
          <p className="py-12 text-center text-slate-400">Todavía no hay gastos.</p>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 5: Probar a mano**

Run: `npm run dev`

1. Entrar como Alix, crear una solicitud.
2. Salir, entrar como Jose → ir a `/compras`, registrar un gasto suelto de 1.500 Bs / 12,50 $ con una foto → aparece con "Tasa: 120,00 Bs por dólar" y un enlace "Factura 1".
3. Tocar "Factura 1" → abre la imagen en otra pestaña.
4. Tocar "Marcar entregada" → aparece la fecha de entrega y desaparece el botón.
5. Salir, entrar como Yenny → ve el gasto y puede abrir la factura, pero **no** tiene el formulario de registrar.
6. Salir, entrar como Alix, ir a `/compras` a mano → redirige a `/solicitudes`.

- [ ] **Step 6: Verificar**

```bash
npm run build
npm test
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: registrar compras, subir facturas y marcar entregas"
```

---

## Task 9: Acciones de Jose sobre las solicitudes

**Files:**
- Create: `src/componentes/AccionesSolicitud.tsx`
- Modify: `src/app/solicitudes/page.tsx`, `src/componentes/TarjetaSolicitud.tsx`

**Interfaces:**
- Consumes: `registrarCompra`, `rechazarSolicitud` (Task 8), `puedeComprar`/`puedeRechazar` (Task 3)
- Produces: componente `<AccionesSolicitud solicitud={...} />` que Jose ve dentro de cada tarjeta pendiente

- [ ] **Step 1: Crear el componente de acciones**

Crear `src/componentes/AccionesSolicitud.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { FormularioCompra } from '@/componentes/FormularioCompra'
import { rechazarSolicitud } from '@/app/compras/acciones'
import { puedeComprar, puedeRechazar } from '@/lib/solicitudes'
import type { Solicitud } from '@/lib/tipos'

export function AccionesSolicitud({ solicitud }: { solicitud: Solicitud }) {
  const [abierto, setAbierto] = useState<'ninguno' | 'comprar' | 'rechazar'>('ninguno')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()

  if (!puedeComprar(solicitud.estado) && !puedeRechazar(solicitud.estado)) return null

  function rechazar() {
    iniciar(async () => {
      const resultado = await rechazarSolicitud(solicitud.id, motivo)
      setError(resultado.error)
      if (!resultado.error) setAbierto('ninguno')
    })
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      {abierto === 'ninguno' && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAbierto('comprar')}
            className="h-11 flex-1 rounded-xl bg-slate-900 text-sm font-medium text-white"
          >
            Comprar
          </button>
          <button
            type="button"
            onClick={() => setAbierto('rechazar')}
            className="h-11 flex-1 rounded-xl bg-slate-100 text-sm font-medium text-slate-700"
          >
            No se puede
          </button>
        </div>
      )}

      {abierto === 'comprar' && (
        <div>
          <FormularioCompra
            solicitudId={solicitud.id}
            descripcionInicial={solicitud.titulo}
          />
          <button
            type="button"
            onClick={() => setAbierto('ninguno')}
            className="mt-2 w-full text-sm text-slate-500 underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {abierto === 'rechazar' && (
        <div>
          <textarea
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="¿Por qué no se puede? (Alix verá este mensaje)"
            className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"
          />
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pendiente}
              onClick={rechazar}
              className="h-11 flex-1 rounded-xl bg-red-600 text-sm font-medium text-white disabled:opacity-50"
            >
              Rechazar
            </button>
            <button
              type="button"
              onClick={() => setAbierto('ninguno')}
              className="h-11 flex-1 rounded-xl bg-slate-100 text-sm font-medium text-slate-700"
            >
              Volver
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Insertar las acciones en la tarjeta**

En `src/componentes/TarjetaSolicitud.tsx`, añadir el import al inicio:

```tsx
import { AccionesSolicitud } from '@/componentes/AccionesSolicitud'
```

Cambiar la firma del componente para que reciba si quien mira es el comprador:

```tsx
export function TarjetaSolicitud({
  solicitud,
  autor,
  esAutor,
  esComprador,
}: {
  solicitud: Solicitud
  autor: string
  esAutor: boolean
  esComprador: boolean
}) {
```

Y justo antes del `</article>` de cierre, añadir:

```tsx
      {esComprador && <AccionesSolicitud solicitud={solicitud} />}
```

- [ ] **Step 3: Pasar el dato desde la pantalla**

En `src/app/solicitudes/page.tsx`, en el `map` de solicitudes, añadir la nueva propiedad:

```tsx
          <TarjetaSolicitud
            key={s.id}
            solicitud={s}
            autor={nombrePorId.get(s.creada_por) ?? '—'}
            esAutor={s.creada_por === perfil.id}
            esComprador={perfil.rol === 'comprador'}
          />
```

- [ ] **Step 4: Probar a mano el flujo completo**

Run: `npm run dev`

1. Alix crea "Jarabe para la tos", 1 frasco, urgente.
2. Jose entra en `/solicitudes` → la ve con los botones "Comprar" y "No se puede".
3. Jose toca "Comprar", llena 2.400 Bs / 20 $, adjunta foto, registra → la solicitud pasa a **Comprada** y los botones desaparecen.
4. Jose va a `/compras` → la compra está ahí; toca "Marcar entregada".
5. Jose vuelve a `/solicitudes` → la solicitud está **Entregada**.
6. Alix entra → ve "Entregada", sin ningún monto ni factura por ninguna parte.
7. Alix crea otra solicitud. Jose toca "No se puede", escribe "No hay en la farmacia" → queda **Rechazada**.
8. Alix la ve rechazada con el motivo visible.

- [ ] **Step 5: Verificar**

```bash
npm run build
npm test
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: Jose compra o rechaza desde la lista de solicitudes"
```

---

## Task 10: Balance y aportes

**Files:**
- Create: `src/app/dinero/page.tsx`, `src/app/dinero/acciones.ts`, `src/app/acciones-sesion.ts`
- Create: `src/componentes/ResumenBalance.tsx`, `src/componentes/Navegacion.tsx`, `src/componentes/BotonSalir.tsx`
- Modify: `src/app/layout.tsx` (añadir la navegación), y la cabecera de `src/app/solicitudes/page.tsx` y `src/app/compras/page.tsx` (botón de salir)

**Interfaces:**
- Consumes: `obtener_balance()` RPC (Task 5), `calcularBalance` (Task 2), `formatearUsd`/`formatearFecha` (Task 3)
- Produces:
  - Server action `registrarAporte(datos: FormData): Promise<{ error: string | null }>`
  - Server action `cerrarSesion(): Promise<never>` — cierra sesión y lleva a `/entrar`
  - `<ResumenBalance balance={...} />`
  - `<Navegacion rol={...} />` — barra inferior con las pantallas de cada rol
  - `<BotonSalir nombre={...} />` — va en la cabecera de las tres pantallas

- [ ] **Step 1: Escribir la acción de aportes**

Crear `src/app/dinero/acciones.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor, obtenerPerfil } from '@/lib/supabase/servidor'

export async function registrarAporte(datos: FormData): Promise<{ error: string | null }> {
  const perfil = await obtenerPerfil()
  if (!perfil) return { error: 'No hay sesión' }
  if (perfil.rol !== 'comprador') return { error: 'Solo Jose registra el dinero recibido' }

  const montoUsd = Number(datos.get('monto_usd'))
  const fecha = String(datos.get('fecha') ?? '')
  const metodo = String(datos.get('metodo') ?? '').trim()
  const notas = String(datos.get('notas') ?? '').trim()

  if (!Number.isFinite(montoUsd) || montoUsd <= 0) {
    return { error: 'El monto debe ser mayor que cero' }
  }

  const supabase = await crearClienteServidor()
  const { error } = await supabase.from('aportes').insert({
    registrada_por: perfil.id,
    monto_usd: montoUsd,
    fecha: fecha || new Date().toISOString().slice(0, 10),
    metodo,
    notas,
  })

  if (error) return { error: 'No se pudo guardar' }

  revalidatePath('/dinero')
  return { error: null }
}
```

- [ ] **Step 2: Crear el resumen de balance**

Crear `src/componentes/ResumenBalance.tsx`:

```tsx
import { formatearUsd, TITULOS_BALANCE } from '@/lib/formato'
import type { Balance, EstadoBalance } from '@/lib/balance'

// Solo el color. El texto sale de TITULOS_BALANCE, para que no haya dos
// versiones del mismo rótulo que puedan quedar distintas.
const FONDOS: Record<EstadoBalance, string> = {
  disponible: 'bg-emerald-600',
  a_favor_de_jose: 'bg-amber-600',
  al_dia: 'bg-slate-700',
}

export function ResumenBalance({ balance }: { balance: Balance }) {
  return (
    <section className={`rounded-2xl ${FONDOS[balance.estado]} p-5 text-white`}>
      <p className="text-sm opacity-80">{TITULOS_BALANCE[balance.estado]}</p>
      <p className="mt-1 text-4xl font-semibold tracking-tight">
        {formatearUsd(balance.monto)}
      </p>

      <dl className="mt-4 flex justify-between border-t border-white/20 pt-3 text-sm">
        <div>
          <dt className="opacity-80">Recibido</dt>
          <dd className="font-medium">{formatearUsd(balance.totalAportes)}</dd>
        </div>
        <div className="text-right">
          <dt className="opacity-80">Gastado</dt>
          <dd className="font-medium">{formatearUsd(balance.totalGastos)}</dd>
        </div>
      </dl>
    </section>
  )
}
```

- [ ] **Step 3: Crear la barra de navegación**

Crear `src/componentes/Navegacion.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Rol } from '@/lib/tipos'

const ENLACES: Record<Rol, { href: string; texto: string }[]> = {
  solicitante: [{ href: '/solicitudes', texto: 'Solicitudes' }],
  comprador: [
    { href: '/dinero', texto: 'Balance' },
    { href: '/solicitudes', texto: 'Solicitudes' },
    { href: '/compras', texto: 'Gastos' },
  ],
  financista: [
    { href: '/dinero', texto: 'Balance' },
    { href: '/solicitudes', texto: 'Solicitudes' },
    { href: '/compras', texto: 'Gastos' },
  ],
}

export function Navegacion({ rol }: { rol: Rol }) {
  const ruta = usePathname()
  const enlaces = ENLACES[rol]

  if (enlaces.length < 2) return null

  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-md">
        {enlaces.map(({ href, texto }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 py-4 text-center text-sm font-medium ${
              ruta === href ? 'text-slate-900' : 'text-slate-400'
            }`}
          >
            {texto}
          </Link>
        ))}
      </div>
    </nav>
  )
}
```

- [ ] **Step 4: Permitir cerrar sesión**

Sin esto no hay forma de cambiar de persona en un teléfono compartido.

Crear `src/app/acciones-sesion.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/servidor'

export async function cerrarSesion() {
  const supabase = await crearClienteServidor()
  await supabase.auth.signOut()
  redirect('/entrar')
}
```

Crear `src/componentes/BotonSalir.tsx`:

```tsx
import { cerrarSesion } from '@/app/acciones-sesion'

export function BotonSalir({ nombre }: { nombre: string }) {
  return (
    <form action={cerrarSesion}>
      <button type="submit" className="text-sm text-slate-500 underline">
        {nombre} · Salir
      </button>
    </form>
  )
}
```

En las tres pantallas (`src/app/solicitudes/page.tsx`, `src/app/compras/page.tsx`,
`src/app/dinero/page.tsx`) sustituir la línea de la cabecera:

```tsx
        <span className="text-sm text-slate-500">{perfil.nombre}</span>
```

por:

```tsx
        <BotonSalir nombre={perfil.nombre} />
```

y añadir el import correspondiente en cada una:

```tsx
import { BotonSalir } from '@/componentes/BotonSalir'
```

- [ ] **Step 5: Crear la pantalla de dinero**

Crear `src/app/dinero/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { crearClienteServidor, obtenerPerfil } from '@/lib/supabase/servidor'
import { ResumenBalance } from '@/componentes/ResumenBalance'
import { registrarAporte } from '@/app/dinero/acciones'
import { calcularBalance } from '@/lib/balance'
import { formatearUsd, formatearFecha } from '@/lib/formato'
import type { Aporte } from '@/lib/tipos'

export const dynamic = 'force-dynamic'

export default async function Dinero() {
  const perfil = await obtenerPerfil()
  if (!perfil) redirect('/entrar')
  if (perfil.rol === 'solicitante') redirect('/solicitudes')

  const supabase = await crearClienteServidor()

  const [{ data: totales }, { data: datosAportes }, { count: pendientes }] = await Promise.all([
    supabase.rpc('obtener_balance'),
    supabase.from('aportes').select('*').order('fecha', { ascending: false }),
    supabase
      .from('solicitudes')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'pendiente'),
  ])

  // La RPC devuelve los totales ya sumados por Postgres. Se pasan a
  // calcularBalance como listas de un elemento para que la clasificación
  // (disponible / a favor / al día) salga de un solo sitio.
  const fila = totales?.[0] ?? { total_aportes: 0, total_gastos: 0 }
  const balance = calcularBalance([Number(fila.total_aportes)], [Number(fila.total_gastos)])

  const aportes = (datosAportes as Aporte[]) ?? []

  return (
    <main className="mx-auto max-w-md px-4 py-6 pb-24">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Balance</h1>
        <span className="text-sm text-slate-500">{perfil.nombre}</span>
      </header>

      <ResumenBalance balance={balance} />

      {(pendientes ?? 0) > 0 && (
        <a
          href="/solicitudes"
          className="mt-3 block rounded-2xl bg-amber-100 p-4 text-amber-900"
        >
          <strong>{pendientes}</strong>{' '}
          {pendientes === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}
        </a>
      )}

      {perfil.rol === 'comprador' && (
        <section className="mt-6">
          <h2 className="mb-2 font-medium">Registrar dinero recibido</h2>
          <form
            action={async (datos: FormData) => {
              'use server'
              await registrarAporte(datos)
            }}
            className="rounded-2xl bg-white p-4 shadow-sm"
          >
            <label className="mb-2 block">
              <span className="mb-1 block text-xs text-slate-500">Monto en dólares</span>
              <input
                name="monto_usd"
                type="number"
                step="0.01"
                min="0.01"
                required
                className="w-full rounded-xl border border-slate-200 px-3 py-3"
              />
            </label>
            <div className="mb-2 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Fecha</span>
                <input
                  name="fecha"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-3"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">Por dónde</span>
                <input
                  name="metodo"
                  placeholder="Zelle, efectivo..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-3"
                />
              </label>
            </div>
            <textarea
              name="notas"
              rows={2}
              placeholder="Notas (opcional)"
              className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-3"
            />
            <button
              type="submit"
              className="h-12 w-full rounded-xl bg-slate-900 font-medium text-white"
            >
              Registrar
            </button>
          </form>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 font-medium">Dinero recibido</h2>
        <div className="flex flex-col gap-2">
          {aportes.map((aporte) => (
            <article
              key={aporte.id}
              className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm"
            >
              <div>
                <p className="font-medium">{formatearUsd(aporte.monto_usd)}</p>
                <p className="text-xs text-slate-500">
                  {formatearFecha(aporte.fecha)}
                  {aporte.metodo && ` · ${aporte.metodo}`}
                </p>
                {aporte.notas && (
                  <p className="mt-1 text-sm text-slate-600">{aporte.notas}</p>
                )}
              </div>
            </article>
          ))}
          {aportes.length === 0 && (
            <p className="py-8 text-center text-slate-400">Todavía no hay aportes.</p>
          )}
        </div>
      </section>
    </main>
  )
}
```

- [ ] **Step 6: Añadir la navegación al layout**

Reemplazar `src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from 'next'
import { Navegacion } from '@/componentes/Navegacion'
import { obtenerPerfil } from '@/lib/supabase/servidor'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gastos',
  description: 'Control de gastos compartidos',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const perfil = await obtenerPerfil()

  return (
    <html lang="es">
      <body className="bg-slate-50 text-slate-900 antialiased">
        {children}
        {perfil && <Navegacion rol={perfil.rol} />}
      </body>
    </html>
  )
}
```

Añadir `pb-24` a las etiquetas `<main>` de `src/app/solicitudes/page.tsx` y `src/app/compras/page.tsx`, para que la barra inferior no tape el último elemento de la lista:

```tsx
    <main className="mx-auto max-w-md px-4 py-6 pb-24">
```

- [ ] **Step 7: Probar a mano**

Run: `npm run dev`

1. Jose entra → ve el balance. Sin movimientos, dice "Al día · $0,00".
2. Jose registra $200 por Zelle → el balance pasa a "Disponible: $200,00".
3. Jose registra un gasto de 12.000 Bs / $100 → el balance baja a "Disponible: $100,00".
4. Jose registra otro gasto de $250 → el balance pasa a "A favor de Jose: $150,00" en ámbar.
5. Yenny entra → ve exactamente el mismo balance, y la lista de aportes, pero **sin** el formulario de registrar.
6. Alix entra → no hay pestaña "Balance" en su barra, y si escribe `/dinero` a mano, la manda a `/solicitudes`.
7. Cualquiera de los tres toca "Salir" en la cabecera → vuelve a la pantalla de "¿Quién eres?".

- [ ] **Step 8: Verificar**

```bash
npm run build
npm test
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: balance en dolares, dinero recibido y cerrar sesion"
```

---

## Task 11: Desplegar

**Files:**
- Create: `README.md`
- Modify: ninguno

**Interfaces:**
- Consumes: todo lo anterior
- Produces: app funcionando en una URL pública de Vercel

- [ ] **Step 1: Escribir el README**

Crear `README.md`:

```markdown
# Gastos

Control de gastos compartidos entre tres personas.

- **Alix** pide lo que hace falta.
- **Jose** compra, sube la factura y entrega.
- **Yenny** pone el dinero y lo audita todo.

Alix no ve montos, facturas ni balance. Eso lo impone la base de datos, no la app.

## Arrancar en local

```bash
npm install
cp .env.example .env.local   # rellenar con los valores reales
npm run migrar               # crea tablas y permisos en Supabase
npm run crear-usuarios       # crea las tres cuentas con sus PIN
npm run dev
```

## Pruebas

```bash
npm test
```

`tests/permisos.test.ts` habla con el Supabase real y comprueba que Alix no
puede leer nada de dinero. Si esa prueba falla, no se despliega.

## Cambiar un PIN

Editar `PIN_*` en `.env.local` y volver a correr `npm run crear-usuarios`.

## Variables de entorno

Ver `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` y `DATABASE_URL` son secretas y
solo se usan en scripts de administración; nunca llegan al navegador.
```

- [ ] **Step 2: Confirmar que no se sube ningún secreto**

```bash
git status --porcelain
git ls-files | grep -E "^\.env" || echo "OK: ningun .env versionado"
```

Expected: `OK: ningun .env versionado`. Solo `.env.example` puede aparecer, y sin valores.

- [ ] **Step 3: Correr todo una última vez**

```bash
npm test
npm run build
```

Expected: ambas sin errores. No continuar si algo falla.

- [ ] **Step 4: Subir a GitHub**

```bash
git add -A
git commit -m "docs: README con instrucciones de arranque"
git remote add origin https://github.com/JoseRoa18/expenses.git
git push -u origin main
```

- [ ] **Step 5: Conectar Vercel (lo hace el dueño del proyecto)**

1. Entrar en vercel.com → Add New → Project → importar `JoseRoa18/expenses`.
2. Framework: Next.js (lo detecta solo). No cambiar nada más.
3. En **Environment Variables**, añadir estas tres:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

   **No** añadir `DATABASE_URL` ni los `PIN_*`: son solo para los scripts de
   administración que se corren desde la máquina local.
4. Deploy.

- [ ] **Step 6: Probar en el teléfono**

Abrir la URL de Vercel en un teléfono y repetir el recorrido completo:
Alix pide → Jose compra con foto → Jose entrega → Yenny audita → Alix confirma
que no ve ningún monto.

- [ ] **Step 7: Rotar las llaves de Supabase**

Las llaves originales quedaron expuestas durante el desarrollo.

1. Supabase → Settings → API → JWT Settings → *Generate a new JWT secret*.
2. Copiar las nuevas `anon` y `service_role`.
3. Actualizar `.env.local` en la máquina local.
4. Actualizar las variables de entorno en Vercel y volver a desplegar.
5. Supabase → Settings → Database → *Reset database password*, y actualizar
   `DATABASE_URL` en `.env.local`.

- [ ] **Step 8: Commit final**

```bash
git add -A
git commit -m "chore: proyecto desplegado"
git push
```
