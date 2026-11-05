# AsisBot — Prototipo demo

Control de asistencia laboral por WhatsApp, sin instalar apps: el trabajador marca
entrada/salida con un mensaje, comparte ubicación y envía una selfie; la IA simula la
verificación y sugiere alertas; la decisión final siempre la revisa una persona en el
panel de RR.HH.

> **Demo con datos ficticios.** No usa WhatsApp real, ni datos biométricos reales, ni
> datos personales reales. Los indicadores de impacto son **metas proyectadas**, no
> resultados observados.

## Cómo correrlo (4 pasos)

```bash
bun install                        # 1. dependencias
cp .env.example .env               # 2. credenciales de Supabase (URL + service_role)
bun run dev                        # 3. levantar la app en http://localhost:3000
curl -X POST localhost:3000/api/demo/reset   # 4. datos semilla ficticios (8 trabajadores, 2 zonas, 7 días)
```

El seed corre contra Supabase desde `POST /api/demo/reset` (borra y recrea los datos
ficticios de la demo; también está disponible como botón en la UI).

## Qué incluye

- **Simulador WhatsApp** — flujo del trabajador (entrada/salida, ubicación, selfie
  ilustrada) con los 5 casos del brief ejecutables en un clic (hora simulada).
- **Panel en vivo** — dotación de hoy con líneas de jornada, KPIs y mapa con geocercas
  (Leaflet + tiles abiertos, sin API key).
- **Cola de revisión** — aprobar/rechazar con motivo; todo queda auditado (usuario,
  fecha, nota).
- **Alertas** — filtro por tipo y estado, resolución con nota.
- **Trabajadores y Zonas** — CRUD completo (admin demo).
- **Reportes** — jornadas por trabajador/día con exportación a CSV.
- **Guion de demo de 5 minutos** → [`docs/demo-script.md`](docs/demo-script.md).

## Arquitectura

| Capa | Implementación |
|------|----------------|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 + shadcn/ui |
| API simulada | Route handlers bajo `src/app/api/*` (endpoints bien definidos, reemplazables por un backend real) |
| Datos | Supabase (PostgREST vía `@supabase/supabase-js`) con datos semilla en `src/lib/seed-data.ts` |
| Motor de verificación | `src/lib/attendance.ts` (haversine, similitud facial simulada, duplicadas, atrasos) |
| Mapa | react-leaflet + CARTO/OSM (gratuito, sin API key) |

### Diseño

Construido aplicando la skill **design-taste-frontend** (repositorio
`Leonxlnx/taste-skill`) con los diales del brief: **variance 3 · motion 2 · density 7**.
Como `npx skills add` no está disponible en este entorno, la skill se leyó y aplicó
manualmente (`SKILL.md` + `references/app-screens.md` completos), junto con las skills de
Emil Kowalski (animación, sonner). Pre-flight check aplicado: sin gradientes, sin
sombras en reposo, sin KPI-tiles con iconos, sin zebra, color solo en datos (~3%),
botón primario casi negro, cifras tabulares, estados vacíos/rellenos honestos.

### Pasar a producción (WhatsApp + biometría real)

El frontend solo consume `/api/*` y la base ya está en Supabase:

1. Reemplazar los route handlers por el backend real (mismos contratos JSON) o
   dejarlos como capa de acceso con autenticación propia.
2. Conectar WhatsApp Cloud API y un motor biométrico real en el punto donde el
   prototipo simula (`src/lib/attendance.ts`).
3. Aplicar RLS en Supabase: hoy el acceso usa `service_role` solo del lado servidor.

## Notas de privacidad (visibles en la app)

- Banner permanente: demo con datos ficticios; en producción se requiere autorización
  de la empresa y del trabajador.
- Las selfies de la demo son **ilustraciones generadas**; no se almacenan datos
  biométricos.
- Toda decisión ante una inconsistencia es humana y queda auditada.
