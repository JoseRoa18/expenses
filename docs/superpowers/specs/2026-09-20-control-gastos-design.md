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
| Registrar un gasto propio | ✅ | ✅ | ✅ |
| Subir factura de un gasto propio | ✅ | ✅ | ✅ |
| Comprar lo que otro pidió | ❌ | ✅ | ❌ |
| Marcar como entregada | ❌ | ✅ | ❌ |
| Registrar dinero recibido, a su nombre | ✅ | ✅ | ✅ |
| Registrar dinero a nombre de otro | ❌ | ❌ | ❌ |
| Ver su propia bolsa (ingresos, gastos, facturas, balance) | ✅ | ✅ | ✅ |
| Ver la bolsa de los demás | ❌ | ✅ | ✅ |

### Cada persona tiene su propia bolsa

Esto **sustituye** a la regla anterior, que decía que Alix no podía ver nada
económico. Alix también recibe dinero y también compra, así que tiene su
propia bolsa. Lo que sigue siendo cierto es que **no ve la de nadie más**.

```
bolsa de X = SUMA(ingresos de X) − SUMA(gastos de X)
```

**El dueño de un movimiento es quien lo registró.** No hay una columna de
"dueño" aparte de `registrada_por`, y no hace falta: nadie puede registrar
dinero ni gastos a nombre de otro, así que las dos cosas son siempre la
misma. El día que haga falta que Yenny registre a nombre de alguien, ese día
aparece la columna; hoy sería una segunda fuente de verdad que mantener
sincronizada sin motivo.

1. **Alix ve lo suyo y solo lo suyo.** Sus ingresos, sus gastos, sus facturas
   y su balance. De Jose y Yenny no ve ni montos ni facturas ni balance.
2. **Jose y Yenny ven las tres bolsas**, por separado y en total. Yenny
   audita; Jose necesita el total porque es quien compra para la casa.
3. **Lo que Jose compra sale de la bolsa de Jose**, también cuando lo compró
   porque Alix lo pidió. La bolsa de Alix solo baja con lo que ella misma
   registra. Comprar por encargo no mueve el dinero de quien encargó.
4. **Alix y Yenny ven las solicitudes de ambas**, no solo las propias. Editar
   y cancelar queda limitado a las propias.

### Qué se debilitó, dicho en voz alta

La garantía anterior era la más fuerte que puede dar este diseño: *Alix no
puede leer una sola cifra, ni aunque consulte la base directamente*. La de
ahora es *Alix solo puede leer lo suyo*. Sigue impuesta por la base de datos
y no por la app -- que es lo que importa -- pero es una superficie más grande:
donde antes la respuesta era "ninguna fila", ahora es "las filas que cumplan
esta condición", y esa condición hay que escribirla bien en cada tabla.

El bucket de facturas pasa de aceptar a una sola persona a aceptar a las
tres. Lo que decide quién ve qué es la lectura, atada a de quién es la
compra, no la escritura.

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

Dinero que alguien recibe. Cada fila pertenece a la bolsa de quien la
registró.

| campo | tipo | notas |
|---|---|---|
| `id` | uuid | |
| `registrada_por` | uuid → profiles | quien recibió el dinero; es el dueño |
| `monto_usd` | numeric(12,2) | |
| `fecha` | date | |
| `metodo` | text | Zelle, efectivo, etc. |
| `notas` | text | opcional |
| `created_at` | timestamptz | |

Se registra cuando el dinero ya está en la mano. No hay estado "en tránsito":
lo que está en la tabla es dinero real recibido.

Todo lo registrado antes de este cambio lo registró Jose, así que al pasar a
bolsas por persona queda entero en la bolsa de Jose. Es lo correcto -- era
dinero que Yenny le dio a él -- y no hace falta migrar ninguna fila.

## Cálculo del balance

Moneda ancla: **dólares**. Hay un balance por persona, no uno solo.

```
balance de X = SUMA(aportes de X) − SUMA(compras de X)
```

| resultado | significado | cómo se muestra |
|---|---|---|
| mayor que 0 | le queda dinero de lo que recibió | "Disponible: $157,50" |
| menor que 0 | puso de su bolsillo | "A favor de Alix: $142,50" |
| igual a 0 | cuadrado | "Al día" |

El rótulo del medio se compone con el nombre de quien sea la bolsa. Antes
estaba escrito "A favor de Jose" de forma fija, porque solo existía su bolsa.

Quién ve cuántos balances lo decide la base de datos, no la pantalla: la
función devuelve una fila por persona y filtra por lo mismo que filtran las
tablas. A Alix le devuelve exactamente una fila, la suya; a Jose y a Yenny,
las tres. Una pantalla con un fallo no puede enseñar un balance ajeno porque
nunca llega a tenerlo.

Los bolívares nunca entran en el balance. Se guardan para poder cuadrar contra
las facturas físicas.

## Pantallas

Móvil primero, en español.

**Entrar** — tres botones grandes con los nombres. Tocas el tuyo, tecleas 6
dígitos, entras. La sesión queda recordada en el dispositivo.

**Alix** — tres pestañas, como los demás. *Solicitudes*: todas (las suyas y
las de Yenny) con el estado bien visible; las suyas se pueden editar, las de
Yenny no. *Balance*: su bolsa, su formulario para registrar dinero recibido y
su historial. *Gastos*: los suyos, con el mismo formulario que usa Jose --
bolívares y dólares, factura opcional y avisada. De Jose y de Yenny no ve una
sola cifra en ninguna de las tres.

**Jose** — arriba el balance y el número de solicitudes pendientes. Toca una
solicitud y desde ahí registra la compra (montos, notas, fotos) y luego la marca
entregada. Dos accesos aparte: registrar gasto suelto, registrar dinero recibido.

**Yenny** — balance primero, luego el historial de gastos con sus facturas, y las
solicitudes. Puede crear solicitudes igual que Alix.

## Decisiones técnicas

- **Next.js (App Router) + TypeScript + Tailwind**, desplegado en Vercel.
- **Supabase** para base de datos, cuentas y almacenamiento de facturas.
- **Los permisos viven en la base de datos** (Row Level Security), no en la app.
  Alix no puede leer el dinero de otro ni aunque consulte la base directamente.
  Para que se filtrara información habría que equivocarse en dos capas a la vez.
### Cada quien elige su propio PIN

Nadie recibe un PIN asignado. La primera vez que una persona toca su nombre,
la app le pide que cree el suyo y lo repita. A partir de ese momento su cuenta
queda cerrada: la opción de crear PIN no vuelve a aparecer para ella.

**El riesgo, aceptado a sabiendas por el dueño del proyecto:** mientras una
cuenta no tenga PIN, cualquiera que abra la dirección puede tocar ese nombre y
ponerle uno, quedándose con la cuenta. No hace falta un ataque; basta con que
la dirección circule antes de que los tres hayan entrado.

Se planteó la alternativa (un PIN temporal que el dueño reparte y la app obliga
a cambiar, como hace un banco) y se descartó a favor de la simplicidad de uso.

Lo que sí acota el riesgo:

- La ventana se cierra sola y por persona, en cuanto esa persona crea su PIN.
- Se registra cuándo se configuró cada uno, para poder mirarlo si hace falta.
- El dueño puede reabrirla desde Supabase si alguien olvida su PIN.
- Operativamente: que los tres entren el mismo día, y que la dirección no
  circule hasta entonces. Eso reduce la ventana de días a minutos.

- **El PIN es la contraseña de una cuenta real.** Cada persona tiene un correo
  interno fijo (`alix@expenses.local`, etc.) que nunca ve. La pantalla de login
  traduce "toqué mi nombre + tecleé mi PIN" a un inicio de sesión normal de
  Supabase. Esto es lo que hace que los permisos de base de datos funcionen.
  - PIN de 6 dígitos.
  - Supabase limita los intentos repetidos de inicio de sesión por su cuenta.
  - Cada persona establece su propio PIN la primera vez que entra; nunca viajan
    por el chat ni quedan en el repositorio, y el dueño del proyecto tampoco los
    conoce.
- **Sin notificaciones** en esta versión. Jose ve las pendientes al abrir la app.

### Riesgo aceptado

Un PIN de 6 dígitos es más débil que una contraseña, y no hay recuperación por
correo: si alguien olvida su PIN, hay que restablecerlo desde Supabase. El
usuario eligió esta opción a cambio de la sencillez de uso. Las mitigaciones son
las de arriba: contraseña cifrada, límite de intentos, y permisos aplicados en la
base de datos aunque la sesión se comprometa.

## Qué se prueba

Dos cosas importan de verdad y llevan pruebas automáticas:

1. **El balance.** Que sume y reste bien en los tres casos: a favor de quien
   sea la bolsa, disponible, y cero. Incluye redondeo a dos decimales.
2. **Los permisos.** Sigue siendo la prueba más importante del proyecto, pero
   cambia de forma: ya no comprueba que Alix no vea nada, sino que **solo vea
   lo suyo**. Autenticada como Alix, lee `compras`, `aportes`, `facturas` y el
   balance, y se verifica que le llegan sus filas y ninguna de Jose ni de
   Yenny. Y al revés: que un intento de registrar dinero o un gasto a nombre
   de otro lo niega la base.

   Ojo con la trampa de esta prueba: "Alix no ve nada" fallaba sola si alguien
   rompía la política. "Alix ve lo suyo" puede pasar con una política que deje
   ver de más, si la prueba solo mira que estén sus filas. Por eso comprueba
   las dos mitades -- lo que tiene que estar y lo que no puede estar -- sobre
   datos sembrados de las tres personas en la misma corrida.

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
