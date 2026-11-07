# AsisBot — Prototipo demo

Control de asistencia laboral por WhatsApp (prototipo: simulador web, sin WhatsApp real): el trabajador marca
entrada/salida con un mensaje, comparte ubicación y envía una selfie; reglas deterministas simulan la verificación y generan alertas;
las marcaciones en revisión las decide una persona en el panel de RR.HH.; las normales y las duplicadas se deciden automáticamente según las reglas del motor.
Desde el 2026-11-07, una IA real (Gemini, plan gratuito de Google AI Studio) explica en lenguaje claro por qué una marcación quedó en revisión
y sugiere qué debe revisar el supervisor; la IA solo sugiere, la decisión sigue siendo humana. La verificación facial sigue siendo simulada:
las selfies de la demo son ilustraciones, no fotos reales.

> **Seguridad (estado actual):** no hay autenticación ni autorización en ningún endpoint, incluido `POST /api/demo/reset`, que borra y recrea todos los datos. El acceso a Supabase usa la `service_role` key del lado servidor, por lo que las políticas RLS no protegen nada mientras las rutas sigan usando ese cliente.

> **Demo con datos ficticios.** No usa WhatsApp real, ni datos biométricos reales, ni
> datos personales reales. Los indicadores de impacto son **metas proyectadas**, no
> resultados observados.

Prerrequisitos: Bun instalado (este repo usa `bun.lock`; hay también un `package-lock.json` de npm que debe eliminarse para fijar un solo gestor). Versión mínima de Bun: por confirmar. Se necesita un proyecto Supabase con las 6 tablas ya creadas (`Zone`, `Worker`, `CheckIn`, `Consent`, `Correction`, `Alert`) — el repositorio no incluye migraciones ni scripts SQL. La URL y la `service_role` key se obtienen en Supabase → Project Settings → API (ver `.env.example`). IA real (opcional): clave gratuita de Google AI Studio (`GEMINI_API_KEY`, ver `.env.example`); sin clave, el análisis de marcaciones usa el modo simulado y la demo sigue igual.

## Cómo correrlo (5 pasos)

> ⚠️ `POST /api/demo/reset` borra y recrea TODOS los datos de la demo. No tiene autenticación ni protección; no lo ejecutes contra una base que no sea la de la demo.

1. Instalar dependencias: `bun install`
2. Credenciales de Supabase (URL + service_role): `cp .env.example .env`
3. Levantar la app en http://localhost:3000: `bun run dev`
4. Datos semilla (8 trabajadores, 2 zonas, 7 días): `curl -X POST localhost:3000/api/demo/reset`
5. Verificación: `bun run build` y `bunx tsc --noEmit`. Hoy no hay tests ni verificación de tipos en el flujo.

El seed corre contra Supabase desde `POST /api/demo/reset`; también está disponible como botón «Reiniciar demo» en la UI (vista Simulador WhatsApp).

> Nota: en la demo, la hora simulada (`demoAt`) y el revisor son valores que fija quien llama; no son identidad ni hora verificadas.

Nota: el historial de 7 días incluye casos especiales que se solapan con las marcas genéricas (p. ej. José en D-4 tiene la entrada genérica y la corregida 08:47→08:00); «7 días» no significa 2 marcas limpias por trabajador y día.

## Qué incluye

- **Simulador WhatsApp** — flujo del trabajador (entrada/salida, ubicación, selfie ilustrada) con los 7 casos clicables del simulador ([brief](upload/brief-para-ia-prototipo-verifystaff.md)): elegir trabajador, ubicación y selfie y pulsar «Marcar entrada» (hora simulada). El motor evalúa 10 tipos de alerta.
- **Panel** — dotación de hoy con líneas de jornada (franja de horario de cada trabajador con sus marcas de entrada y salida), KPIs (Presentes, En revisión, Ausentes, Jornada terminada, Alertas pendientes y marcas sin señal) y mapa con geocercas (Leaflet + tiles abiertos, sin API key). Se actualiza por sondeo cada 15 s.
- **Cola de revisión** — aprobar/rechazar con motivo; las decisiones de aprobación/rechazo quedan auditadas (usuario, fecha, nota).
- **Análisis con IA real** — `POST /api/ai/analyze` (Gemini, plan gratuito): explica en lenguaje claro por qué una marcación quedó en revisión y sugiere la acción para RR.HH. Cada marcación nueva trae su análisis en el campo `ai` de la respuesta de `POST /api/checkins`. Sin clave o si Gemini no responde, usa el modo simulado. La IA no compara rostros ni decide: la verificación facial sigue siendo simulada.
- **Alertas** — filtro por tipo y estado, resolución con nota.
- **Trabajadores y Zonas** — zonas: crear y listar; trabajadores: crear, listar, editar y desactivar (sin eliminar) (admin demo).
- **Reportes** — jornadas por trabajador/día con exportación a CSV.
- **Mis marcas** — autoconsulta del trabajador: sus marcas del día y su estado.
- **Reporte mandante** — vista pública de solo lectura por zona (deep-link `#/mandante?z=id`).
- **Reporte mensual para el contador** — jornadas por semana con control de 42 h semanales.
- **Guion de demo de 5 minutos** → [`docs/demo-script.md`](docs/demo-script.md).

Flujos: **consentimiento** (`POST /api/consent`, versión `v1-2026-10`; sin consentimiento, `POST /api/checkins` devuelve 403 `CONSENT_REQUIRED`), **correcciones auditadas** (`/api/checkins/[id]/correct`, `/api/corrections`, con nota del trabajador) y **sincronización offline** (marca `PENDIENTE_SYNC`; si tarda más de 30 min, alerta `SYNC_TARDE`).

## Alternativas consideradas

- **SaaS existente (GeoVictoria, Buk, Talana):** suites amplias de asistencia/RR.HH. con años de mercado; precio por cotización y obligan a adoptar todo el sistema o instalar otra app. Rechazado: AsisBot apuesta por WhatsApp que el trabajador ya usa, puesta en marcha en días y precio simple por trabajador.
- **App móvil propia con geocerca:** control total, pero exige instalar y mantener otra app y capacitar al personal. Rechazado: fricción de adopción para personal en terreno.
- **Planillas / grupos de WhatsApp:** costo cero, pero errores manuales (1–5%), 2–4 h/semana de consolidación y sin trazabilidad; no escalan más allá de ~5–7 personas. Rechazado: no resuelve el problema a escala.
- **Reloj biométrico (huella):** verificación presencial fiable, pero hardware por sede y sin cobertura para personal en terreno disperso. Rechazado: no cubre el caso de uso principal.
- **Verificación por PIN/código en vez de biometría:** simple, pero el PIN se comparte y borra la identidad. Rechazado: no previene suplantación.

## Arquitectura

| Capa | Implementación | Estado |
|------|----------------|--------|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 + shadcn/ui | existente |
| API simulada | Route handlers bajo `src/app/api/*` (sin documentar formalmente; el contrato de facto es `src/components/asisbot/api.ts` + `types.ts`), reemplazables por un backend real | existente |
| Datos | Supabase (PostgREST vía `@supabase/supabase-js`) con datos semilla en `src/lib/seed-data.ts` | existente |
| Motor de verificación | `src/lib/attendance.ts` (reglas deterministas que simulan la verificación: haversine, similitud facial simulada con hash determinista, duplicadas, atrasos) | existente |
| Análisis con IA | `src/lib/ai.ts` + `POST /api/ai/analyze` (Gemini, plan gratuito de Google AI Studio; modelo `gemini-3-flash-preview`, con respaldo a `gemini-3.5-flash` y `gemini-flash-latest`) — explica marcaciones ya evaluadas y sugiere la acción para RR.HH.; `POST /api/checkins` devuelve el análisis en el campo `ai`. Sin `GEMINI_API_KEY` o si Gemini no responde, cae al modo simulado. | existente |
| Mapa | react-leaflet + tiles directos de OpenStreetMap (sin API key en esta demo) | existente |

Contratos y datos: no existe OpenAPI ni esquema documentado. Modelo de datos: 6 tablas (`Zone`, `Worker`, `CheckIn`, `Consent`, `Correction`, `Alert`; ver `.env.example`). Flujo: mensaje del trabajador → `POST /api/checkins` → `evaluateCheckIn()` en `src/lib/attendance.ts` → análisis con IA (`ai` en la respuesta, `src/lib/ai.ts`) → panel/cola de revisión. `GET /api` devuelve un placeholder `{ message: "Hello, world!" }` sin documentar.

Reglas del motor (`src/lib/attendance.ts`): similitud mínima 75% (`SIMILARITY_THRESHOLD`), duplicada < 5 min (`DUPLICATE_WINDOW_MIN`), tolerancia de atraso 10 min (`LATE_TOLERANCE_MIN`), coherencia de ubicación 2000 m / 90 min (`COHERENCE_DISTANCE_M` / `COHERENCE_WINDOW_MIN`), sincronización tardía > 30 min (`SYNC_LATE_THRESHOLD_MIN`), consentimiento `v1-2026-10`. Todos los umbrales son placeholders sin validación contra un motor biométrico real. Tipos de alerta: duplicada, sin selfie, foto de galería, posible suplantación, sin ubicación, fuera de zona, atraso, sin entrada, ubicación incoherente y sincronización tardía. Fechas: `src/lib/tz.ts` (`chileParts`, `America/Santiago`) es el punto de verdad de «hoy». Limitación conocida: GPS con ±50–100 m de error en interiores frente a radios de 200–250 m; sin defensa contra mock-location.

Modo degradado del mapa: si el proveedor de tiles falla, el panel sigue funcionando sin mapa y las geocercas se listan como texto (sin caché ni proveedor de respaldo en esta demo).

Diseño visual: interfaz construida con la skill design-taste-frontend (sin degradados de color; los `radial-gradient` existentes son patrones de puntos, no degradados). El detalle visual vive fuera de este README.

## Trabajo futuro: pasar a producción (WhatsApp + biometría real)

Lo siguiente NO es un plan ejecutable: son las decisiones pendientes para pasar a producción, sin fases, contratos ni pruebas definidas.

1. **Arquitectura de acceso:** elegir UNA opción — reemplazar los route handlers por el backend real (mismos contratos JSON) o dejarlos como capa de acceso con autenticación propia. (Decisión pendiente.)
2. **WhatsApp Cloud API y motor biométrico real:** sin diseñar — falta webhook, verificación de firma, mapeo teléfono→trabajador, proveedor biométrico, umbral, enrolamiento, liveness y retención de plantillas.
3. **Seguridad de datos:** no existe ninguna política RLS ni migración; el acceso usa `service_role` solo del lado servidor (ver B1). El endpoint `POST /api/demo/reset` debe eliminarse o aislarse por entorno antes de exponer la app. (Decisión pendiente.)
- **Verificación asíncrona:** un motor biométrico real tiene latencia, timeouts y fallos transitorios; la verificación no puede ir en el mismo route handler síncrono. Diseñar cola/bus + worker con estados pendientes, reintentos con backoff y clave de idempotencia (`whatsappMessageId` único); definir qué recibe el trabajador por WhatsApp ante cada fallo (sin ubicación, sin foto, timeout, 5xx, foto corrupta o sin rostro, reentrega de webhook, sincronización offline fuera de orden).
- **Casos de prueba mínimos (producción):** camino feliz (marca correcta), timeout del motor, 5xx del proveedor, reentrega de webhook (idempotencia), mensaje sin ubicación, mensaje sin foto, foto corrupta o sin rostro, sincronización offline fuera de orden. Los 5 casos del demo-script no sirven como plan de pruebas de producción porque dependen de la simulación.
- **Fases y puntos de control:** por definir. Cada fase debe dejar el sistema estable, construible y testeable, con criterios de aceptación y rollback si la biometría falla en el piloto.
- **Consentimiento biométrico y marco legal:** no diseñado. Falta el flujo de consentimiento por WhatsApp (texto, versión, registro, revocación), la política de retención y borrado de selfies y plantillas, y la referencia normativa (Ley 19.628). Es precondición para el piloto, no un detalle posterior.

## Riesgos conocidos

- **Sin autenticación (ver B1):** cualquier endpoint es invocable sin credenciales; `POST /api/demo/reset` borra los datos.
- **Condición de carrera en duplicadas:** `POST /api/checkins` lee las marcas del día y luego inserta sin transacción ni lock; dos marcaciones simultáneas pueden pasar la detección de duplicadas.
- **Caída de Supabase:** único backend, sin réplica ni respaldo documentado.
- **WhatsApp Cloud API (producción):** un cambio de política o una caída deja sin canal al trabajador; sin plan de respaldo.
- **GPS sin señal:** en obras subterráneas o rurales no hay ubicación; el flujo offline (`PENDIENTE_SYNC`) cubre el registro, no la verificación de zona.
- **Paginación:** `GET /api/checkins` y `/api/alerts` cortan en `.limit(200)` sin cursor; con cientos de trabajadores se pierden datos silenciosamente.
- **Sin rate limiting:** `POST /api/checkins` puede inundarse.
- **Ubicación falsificada:** sin defensa contra mock-location.
- **Límites operativos conocidos:** `GET /api/checkins` y `/api/alerts` cortan en `.limit(200)` sin cursor; sin rate limiting; sin respaldo documentado; sin estimaciones de volumen, almacenamiento ni costos de Supabase. A escala de la demo (8 trabajadores) sobran, pero son límites reales.

## Notas de privacidad (visibles en la app)

- Banner permanente: demo con datos ficticios; en producción se requiere autorización de la empresa y del trabajador. El mecanismo existe en la demo: consentimiento versionado (`POST /api/consent`, `CONSENT_VERSION = "v1-2026-10"`); sin consentimiento, `POST /api/checkins` devuelve 403 `CONSENT_REQUIRED`. Antes de un piloto, validar el consentimiento requerido con asesoría legal (Ley 19.628, datos biométricos sensibles). Retención de selfies/ubicaciones, revocación y borrado: no definidos todavía.
- Las selfies de la demo son **ilustraciones generadas**; no se almacenan datos
  biométricos.
- La IA real no recibe ni compara fotos de rostros: solo recibe el resultado ya evaluado (alertas, distancia, similitud simulada) y lo explica en texto.
