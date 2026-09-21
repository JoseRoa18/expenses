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
npm run crear-usuarios       # crea las tres cuentas (cada quien pone su PIN)
npm run dev
```

`npm run migrar` corre cada archivo de `supabase/migraciones/` en orden contra
`DATABASE_URL`. Esa variable debe ser el **Session Pooler** (puerto 5432,
Settings → Database → Connection string → Session pooler) y no la conexión
directa `db.<ref>.supabase.co`: la directa solo resuelve por IPv6 y falla desde
la mayoría de las máquinas y CI. Las migraciones son repetibles: correrlas de
nuevo no rompe nada.

`npm run crear-usuarios` crea las cuentas de Alix, Jose y Yenny con su rol.
No les pone PIN: cada persona crea el suyo la primera vez que toca su nombre
en la app, y nadie más lo conoce. A una cuenta que ya existe el script no le
toca el PIN, así que se puede repetir sin dejar a nadie fuera.

## Pruebas

```bash
npm test
```

`tests/permisos.test.ts` habla con el Supabase real (no hay un entorno de
prueba separado) y comprueba, entre otras cosas, que Alix no puede leer nada
de dinero. Si esa prueba falla, no se despliega.

## El PIN

La primera vez que una persona toca su nombre, la app le pide crear su PIN de
6 dígitos y repetirlo. Desde ese momento su cuenta queda cerrada: al tocar su
nombre le pedirá el PIN, no volverá a ofrecerle crear uno.

**Mientras una cuenta no tenga PIN, cualquiera que abra la dirección de la app
puede tocar ese nombre y quedarse con ella.** Es un riesgo aceptado a cambio de
que nadie tenga que repartir PIN (está razonado en
`docs/superpowers/specs/2026-09-20-control-gastos-design.md`). En la práctica:
que los tres entren el mismo día, y que la dirección no circule antes.

### Si alguien olvida su PIN

```bash
npm run reiniciar-pin -- Alix      # o --todos
```

Le borra el PIN: la próxima vez que entre, la app le deja crear uno nuevo. El
viejo deja de servir de inmediato. Hazlo cuando la persona vaya a entrar, no
días antes, porque reabre la ventana de arriba para esa cuenta.

## Variables de entorno

Ver `.env.example` para la lista completa y su formato.

En Vercel (Project Settings → Environment Variables) solo hacen falta estas
tres:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

`SUPABASE_SERVICE_ROLE_KEY` sí la usa la app en producción, pero en un solo
sitio: para saber si una persona ya tiene PIN y para fijarlo cuando lo crea.
Quien está en esa pantalla todavía no tiene sesión, y las políticas de la base
exigen estar autenticado, así que no hay forma de preguntarlo con la llave
pública. Nunca debe llevar el prefijo `NEXT_PUBLIC_`: eso la mandaría al
navegador.

**No** subir `DATABASE_URL` a Vercel: es solo para los scripts de
administración (`migrar`, `crear-usuarios`, `reiniciar-pin`), que se corren
desde una máquina local y nunca desde la app en producción.
