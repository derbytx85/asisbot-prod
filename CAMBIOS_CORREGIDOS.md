# AsisBot — correcciones aplicadas (2026-11-05)

Basado en `asisbot-supabase-limpio.zip` (última versión enviada por Marcos).

## 1. Seed destructivo corregido — `src/lib/seed-data.ts`
El seed borraba todas las tablas y luego insertaba sin `id`. Como las tablas de
Supabase no generan el `id` por defecto, el primer insert fallaba y las tablas
quedaban VACÍAS. Ahora cada insert genera su propio `id` con `crypto.randomUUID()`
(Zone x2, Worker, Consent, CheckIn, Alert, Correction). Verificado: el seed
completo carga 8 trabajadores, 2 zonas y 134 marcaciones.

## 2. Tiempo de espera de la API — `src/components/asisbot/api.ts`
Las peticiones se cancelaban a los 10 s (`AbortController`). Con Supabase frío
la primera carga puede tardar más y daba "No se pudo cargar...". Subido a 30 s.

## 3. Verificación
`npx tsc --noEmit` pasa sin errores (exit 0).

## Importante: el repo desplegado en Vercel NO es este código
El repo `derbytx85/asisbot-prod` (commit 6947bc5) tiene la migración a Supabase
a medias: `src/lib/supabase.ts` existe, pero las 16 rutas de `src/app/api/`
todavía usan `db.*` de Prisma, y Prisma ya no está instalado (`db` no existe).
Por eso TODAS las rutas devuelven 500 vacío y el dashboard se ve vacío.
Este ZIP es la versión limpia que sí usa Supabase en todas las rutas.
Hay que subir este código al repo (o reemplazarlo) para que Vercel despliegue
la versión que funciona.

## Variables en Vercel (ya corregidas por Ember el 2026-11-05)
- `NEXT_PUBLIC_SUPABASE_URL` = https://rpesgwsyoecanqchnsdl.supabase.co
- `SUPABASE_SERVICE_ROLE_KEY` = la service_role JWT real (NO la clave publicable)
La app NO usa `NEXT_PUBLIC_SUPABASE_ANON_KEY`; no hace falta agregarla.
Después de subir este código, Vercel redespliega solo.
