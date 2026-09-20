# Control de gastos compartidos — Diseño

Fecha: 2026-09-20
Estado: pendiente de aprobación

## Qué problema resuelve

Tres personas coordinan la compra de insumos concretos (medicinas, pastillas,
bebidas, artículos puntuales). Hoy no hay registro común: quién pidió qué, si ya
se compró, cuánto costó, ni cuánto dinero queda. Esta app es ese registro.

- **Alix** dice qué se necesita.
- **Jose** compra, sube la factura y entrega.
- **Yenny** pone el dinero y audita todo.

## Roles y permisos

| Acción | Alix | Jose | Yenny |
|---|:---:|:---:|:---:|
| Crear solicitud | ✅ | ❌ | ✅ |
| Editar / cancelar solicitud propia (si no está comprada) | ✅ | ❌ | ✅ |
| Ver solicitudes y su estado | ✅ | ✅ | ✅ |
| Rechazar solicitud (con motivo) | ❌ | ✅ | ❌ |
| Registrar compra | ❌ | ✅ | ❌ |
| Subir factura | ❌ | ✅ | ❌ |
| Marcar como entregada | ❌ | ✅ | ❌ |
| Registrar dinero recibido | ❌ | ✅ | ❌ |
| Ver montos, facturas y balance | ❌ | ✅ | ✅ |

### Decisiones de permisos (confirmar)

1. **Alix no ve ninguna información económica.** Ni montos, ni facturas, ni las
   notas que escriba Jose en la compra. Solo ve sus solicitudes y el estado en
   que están. Si Jose rechaza algo, Alix sí ve el motivo del rechazo.
2. **Yenny = Alix + auditoría total.** Crea y edita solicitudes igual que Alix, y
   ve absolutamente todo lo económico. No registra compras ni dinero.
3. **Alix y Yenny ven las solicitudes de ambas**, no solo las propias. Editar y
   cancelar queda limitado a las propias.

## Flujo de una solicitud

```
  Alix crea          Jose compra         Jose entrega
  PENDIENTE  ──────▶  COMPRADA  ────────▶  ENTREGADA
      │
      ├──▶ CANCELADA   (Alix/Yenny, solo mientras esté PENDIENTE)
      └──▶ RECHAZADA   (Jose, con motivo obligatorio)
```

Una vez COMPRADA, la solicitud ya no se puede editar ni cancelar.

Jose también puede registrar una **compra suelta**, sin solicitud previa. Entra
en los gastos y afecta el balance igual que cualquier otra.

## Modelo de datos

### `profiles`

Una fila por persona, ligada a la cuenta de Supabase Auth.

| campo | tipo | notas |
|---|---|---|
| `id` | uuid | referencia a `auth.users` |
| `nombre` | text | Alix, Jose, Yenny |
| `rol` | enum | `solicitante` / `comprador` / `financista` |

El rol define los permisos, no el nombre. Si mañana entra otra persona como
solicitante, se crea con rol `solicitante` y funciona sin tocar código.

### `solicitudes`

| campo | tipo | notas |
|---|---|---|
| `id` | uuid | |
| `creada_por` | uuid → profiles | |
| `titulo` | text | qué se necesita |
| `cantidad` | text | libre: "2 cajas", "1 frasco 500ml" |
| `urgencia` | enum | `normal` / `urgente` |
| `notas` | text | opcional, de quien pide |
| `estado` | enum | `pendiente` / `comprada` / `entregada` / `rechazada` / `cancelada` |
| `motivo_rechazo` | text | obligatorio si el estado es `rechazada` |
| `created_at`, `updated_at` | timestamptz | |

El "obligatorio" de `motivo_rechazo` es una restricción de la propia base de
datos (`CHECK`), no solo una validación del formulario: sin motivo, el rechazo no
entra. Lo mismo con las transiciones de estado — que una solicitud ya comprada no
pueda volver a `cancelada` lo impide la base, no la pantalla.

### `compras`

| campo | tipo | notas |
|---|---|---|
| `id` | uuid | |
| `solicitud_id` | uuid → solicitudes | **nullable**: null = compra suelta |
| `registrada_por` | uuid → profiles | siempre Jose |
| `descripcion` | text | qué se compró realmente |
| `monto_bs` | numeric(14,2) | lo que dice la factura. **Opcional** |
| `monto_usd` | numeric(12,2) | lo que costó en dólares. **Obligatorio** |
| `notas` | text | opcional |
| `fecha_compra` | date | |
| `fecha_entrega` | date | null hasta que se entrega |
| `created_at` | timestamptz | |

### Por qué los dólares son obligatorios y los bolívares no

El balance se calcula en dólares. Una compra sin monto en dólares no se puede
restar de él: con `1.500 Bs` a secas, la app no sabe si eso fueron 12 dólares o
40, y la tasa cambia a diario. Ese gasto quedaría fuera del cálculo y Yenny
vería más dinero disponible del que realmente queda, sin saber que falta contar
algo.

Jose siempre conoce el monto en dólares, porque es su dinero saliendo. El monto
en bolívares es el dato de respaldo —sirve para cuadrar contra la factura de
papel— y lo pone si la tiene delante.

Cuando están los dos, la app muestra la tasa que salió en esa compra. Cuando
solo está el dólar, no muestra tasa.

La tasa de cambio **no se guarda**: se calcula como `monto_bs / monto_usd` y se
muestra solo como referencia. Así no hay dos fuentes de verdad que puedan
contradecirse.

Una solicitud tiene como máximo una compra, garantizado por una restricción de
unicidad sobre `solicitud_id` (que ignora los nulos, para que puedan existir
varias compras sueltas).

**Relación entre `compras.fecha_entrega` y `solicitudes.estado`.** El estado de
la solicitud es el que manda para lo que ve Alix, y la app lo actualiza en la
misma operación que toca la compra:

- Al registrar la compra → la solicitud pasa a `comprada`.
- Al poner `fecha_entrega` → la solicitud pasa a `entregada`.

Ambos cambios se hacen dentro de una misma transacción, para que no pueda quedar
una compra entregada con la solicitud diciendo otra cosa.

Una **compra suelta** (sin solicitud) puede tener `fecha_entrega` o no; como no
hay nadie esperándola, es solo informativo.

### `facturas`

| campo | tipo | notas |
|---|---|---|
| `id` | uuid | |
| `compra_id` | uuid → compras | |
| `storage_path` | text | ruta en el bucket privado |
| `created_at` | timestamptz | |

Varias fotos por compra. Bucket **privado**: las imágenes solo se ven mediante
enlaces firmados de corta duración que la app genera para Jose y Yenny.

### `aportes`

Dinero que Jose recibe de Yenny.

| campo | tipo | notas |
|---|---|---|
| `id` | uuid | |
| `registrado_por` | uuid → profiles | siempre Jose |
| `monto_usd` | numeric(12,2) | |
| `fecha` | date | |
| `metodo` | text | Zelle, efectivo, etc. |
| `notas` | text | opcional |
| `created_at` | timestamptz | |

Jose registra el aporte cuando el dinero ya está en su mano. No hay estado "en
tránsito": lo que está en la tabla es dinero real recibido.

## Cálculo del balance

Moneda ancla: **dólares**.

```
balance = SUMA(aportes.monto_usd) − SUMA(compras.monto_usd)
```

| resultado | significado | cómo se muestra |
|---|---|---|
| mayor que 0 | sobra dinero del que Yenny mandó | "Disponible: $157,50" |
| menor que 0 | Jose puso de su bolsillo | "A favor de Jose: $142,50" |
| igual a 0 | cuadrado | "Al día" |

Los bolívares nunca entran en el balance. Se guardan para poder cuadrar contra
las facturas físicas.

## Pantallas

Móvil primero, en español.

**Entrar** — tres botones grandes con los nombres. Tocas el tuyo, tecleas 6
dígitos, entras. La sesión queda recordada en el dispositivo.

**Alix** — una sola lista: todas las solicitudes (las suyas y las de Yenny) con
el estado bien visible; las suyas se pueden editar, las de Yenny no. Botón grande
para pedir algo nuevo. Cero información de dinero en toda la pantalla.

**Jose** — arriba el balance y el número de solicitudes pendientes. Toca una
solicitud y desde ahí registra la compra (montos, notas, fotos) y luego la marca
entregada. Dos accesos aparte: registrar gasto suelto, registrar dinero recibido.

**Yenny** — balance primero, luego el historial de gastos con sus facturas, y las
solicitudes. Puede crear solicitudes igual que Alix.

## Decisiones técnicas

- **Next.js (App Router) + TypeScript + Tailwind**, desplegado en Vercel.
- **Supabase** para base de datos, cuentas y almacenamiento de facturas.
- **Los permisos viven en la base de datos** (Row Level Security), no en la app.
  Alix no puede leer montos ni aunque consulte la base directamente. Para que se
  filtrara información habría que equivocarse en dos capas a la vez.
- **El PIN es la contraseña de una cuenta real.** Cada persona tiene un correo
  interno fijo (`alix@expenses.local`, etc.) que nunca ve. La pantalla de login
  traduce "toqué mi nombre + tecleé mi PIN" a un inicio de sesión normal de
  Supabase. Esto es lo que hace que los permisos de base de datos funcionen.
  - PIN de 6 dígitos.
  - Supabase limita los intentos repetidos de inicio de sesión por su cuenta.
  - Los PIN los establece el dueño del proyecto directamente; nunca viajan por el
    chat ni quedan en el repositorio.
- **Sin notificaciones** en esta versión. Jose ve las pendientes al abrir la app.

### Riesgo aceptado

Un PIN de 6 dígitos es más débil que una contraseña, y no hay recuperación por
correo: si alguien olvida su PIN, hay que restablecerlo desde Supabase. El
usuario eligió esta opción a cambio de la sencillez de uso. Las mitigaciones son
las de arriba: contraseña cifrada, límite de intentos, y permisos aplicados en la
base de datos aunque la sesión se comprometa.

## Qué se prueba

Dos cosas importan de verdad y llevan pruebas automáticas:

1. **El balance.** Que sume y reste bien en los tres casos: a favor de Jose,
   disponible, y cero. Incluye redondeo a dos decimales.
2. **Los permisos.** Una prueba que, autenticada como Alix, intenta leer
   `compras`, `aportes`, `facturas` y el balance — y verifica que la base los
   niega. Es la prueba más importante del proyecto. También verifica que Yenny
   *no* puede insertar en `compras` ni `aportes`.

Además, pruebas de las transiciones de estado de una solicitud (que no se pueda
cancelar una ya comprada, que rechazar exija motivo).

## Fuera de alcance

- Notificaciones (push, correo, WhatsApp).
- Tasas de cambio automáticas.
- Informes, exportación a Excel, gráficas.
- Más de tres personas (el modelo lo soporta, pero no se construye pantalla de
  administración de usuarios).
- Edición o borrado de compras y aportes ya registrados. Si hay un error, se
  corrige desde Supabase. *(Si esto molesta en la práctica, se agrega después.)*

## Lo que hace falta para desplegar

1. Proyecto Supabase `cdjkosrunejazgojjoxe` — llaves *anon* y *service_role*,
   puestas en `.env.local` (que nunca se sube a git).
2. Repositorio `github.com/JoseRoa18/expenses`.
3. Vercel conectado al repositorio por el dueño del proyecto.
4. Tres PIN de 6 dígitos, establecidos directamente por el dueño.
