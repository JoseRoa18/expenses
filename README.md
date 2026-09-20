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

`npm run migrar` corre cada archivo de `supabase/migraciones/` en orden contra
`DATABASE_URL`. Esa variable debe ser el **Session Pooler** (puerto 5432,
Settings → Database → Connection string → Session pooler) y no la conexión
directa `db.<ref>.supabase.co`: la directa solo resuelve por IPv6 y falla desde
la mayoría de las máquinas y CI. Las migraciones son repetibles: correrlas de
nuevo no rompe nada.

`npm run crear-usuarios` crea (o actualiza el PIN de) las cuentas de Alix,
Jose y Yenny usando `PIN_ALIX`, `PIN_JOSE` y `PIN_YENNY` de `.env.local`.

## Pruebas

```bash
npm test
```

`tests/permisos.test.ts` habla con el Supabase real (no hay un entorno de
prueba separado) y comprueba, entre otras cosas, que Alix no puede leer nada
de dinero. Si esa prueba falla, no se despliega.

## Cambiar un PIN

Editar el `PIN_*` correspondiente en `.env.local` y volver a correr
`npm run crear-usuarios`.

## Variables de entorno

Ver `.env.example` para la lista completa y su formato.

En Vercel (Project Settings → Environment Variables) solo hacen falta estas
tres:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**No** subir `DATABASE_URL` ni los `PIN_*` a Vercel: son solo para los scripts
de administración (`migrar`, `crear-usuarios`) que se corren desde una
máquina local, nunca desde la app en producción. `SUPABASE_SERVICE_ROLE_KEY`
tampoco debe llevar el prefijo `NEXT_PUBLIC_`: eso la mandaría al navegador.
