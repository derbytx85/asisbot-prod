# Worklog — Proyecto AsisBot (prototipo demo)

---
Task ID: 1
Agent: Z.ai Code (principal)
Task: Preparar contexto: leer brief del usuario, instalar skills de diseño obligatorias

Work Log:
- Leído brief completo: /home/z/my-project/upload/brief-para-ia-prototipo-verifystaff.md (AsisBot: asistencia por WhatsApp, panel supervisor, 5 casos demo, datos ficticios)
- `npx skills add` se cuelga sin TTY; fallback permitido por el brief §2.1: cloné Leonxlnx/taste-skill y copié la skill a .agents/skills/design-taste-frontend
- Leído COMPLETO: SKILL.md (543 líneas) + references/app-screens.md (1199 líneas) — reglas de app screens
- Skills previamente instaladas en .agents/skills/: las 15 de emilkowalski/skill (animate, ask-sonner, emil-design-eng, etc.)
- Leído ask-sonner/SKILL.md (setup correcto: un solo <Toaster/> en layout, richColors) y reglas de easing de emil-design-eng (ease-out cubic-bezier(0.23,1,0.32,1), UI <300ms)

Stage Summary:
- Design read declarada: app screen de operación (no landing). Diales: variance 3, motion 2, density 7
- Decisiones de estilo (según skill): pantalla clara, sidebar sobre el fondo (sin dark sidebar), título sustantivo 24px, KPIs como texto dividido por hairlines (sin iconos ni sparklines), color solo en datos (acento verde sobrio ~3%), botón primario casi negro, pills de estado pálidas, tablas con reglas y alineación (sin cebra), radios 8/6/4, sin sombras en reposo, tipografía IBM Plex Sans (una sola), tabular-nums, elemento distintivo = "línea de jornada" por trabajador
- Stack: Next.js 16 (sandbox) en vez de Vite del brief — misma arquitectura (React+TS+Tailwind, API simulada bien definida, datos semilla), endpoints reemplazables luego por backend real/Supabase

---
Task ID: 3
Agent: Z.ai Code (principal)
Task: Schema Prisma + datos semilla

Work Log:
- prisma/schema.prisma: Zone, Worker, CheckIn, Alert (SQLite). Sin listas primitivas. Índices en (workerId,timestamp), status, (status,type)
- bun run db:push OK
- src/lib/attendance.ts: motor de verificación simulado (haversine, similitud facial simulada 88-97% referencia / 52-71% otra, umbral 75, duplicada <5min, atraso >10min tolerancia, salida sin entrada; razones en lenguaje simple es-CL; horario evaluado en hora de pared Chile vía Intl)
- src/lib/tz.ts: helpers America/Santiago (tzOffsetMs, chileInstant, chileToday, chileDaysAgoAt)
- prisma/seed.ts: 2 zonas (Obra Balmaceda Santiago Centro, Bodega Central Quilicura), 8 trabajadores ficticios, historial 7 días con anomalías resueltas (D-5 fuera de zona aprobada, D-2 suplantación rechazada + re-marcación, D-1 duplicada, D-3 atraso), HOY: 4 presentes + guardia que terminó + 2 EN_REVISION pendientes (fuera de zona José, suplantación Andrés) + 1 ausente
- bun prisma/seed.ts OK: 129 marcaciones

Stage Summary:
- DB poblada y lista para demo; cola de revisión ya trae 2 casos pendientes
- Motor centraliza decisiones; API y seed comparten formatos de mensaje

---
Task ID: 5 (en curso)
Agent: Z.ai Code (principal)
Task: Endpoints API (dashboard, workers, zones, checkins + verificación, review, alerts, reports)

Work Log (Task 5-7):
- Endpoints creados y probados por curl: /api/dashboard, /api/workers(+[id]), /api/zones, /api/checkins(GET/POST con motor), /api/checkins/[id]/review, /api/alerts(+[id]/resolve), /api/reports, /api/demo/reset (reusa seed-data.ts)
- Motor verificado por curl: caso atraso APROBADA+ATRASO ✓, duplicada RECHAZADA+DUPLICADA ✓, fuera de zona EN_REVISION+FUERA_ZONA ✓, suplantación EN_REVISION sim 58% ✓
- POST /api/checkins acepta demoAt (hora simulada) para casos reproducibles
- Dashboard usa la ÚLTIMA entrada del día (re-marcación refleja estado actual)
- Imágenes demo generadas: public/demo/selfie-carlos.png, selfie-otro.png (ilustraciones, claramente ficticias)
- Tokens de diseño en globals.css (skill app-screens §9.5 adaptado: fondo con tinte verde, acento #0e7a47 solo en datos, primario #1b1e1b, radios 8/6/4, pares de píldora pálidas)
- layout.tsx: IBM Plex Sans/Mono (cara del producto, no Geist/Inter del kit), lang es, Toaster sonner richColors (skill ask-sonner)
- Componentes: Avatar (iniciales + tinte propio ≥60°), StatusPill, JornadaStrip (elemento distintivo: franja de horario con marcas E/S), MapView (Leaflet+react-leaflet, tiles CARTO Positron, círculos de geocerca + CircleMarker por estado, FitBounds), MapViewClient (dynamic ssr:false)
- Vistas: PanelEnVivo (KPI strip dividido por hairlines sin iconos, lista dotación con JornadaStrip, mapa 360px con leyenda, stamp de frescura), SimuladorWhatsApp (chat real con burbujas #d9fdd3/white sobre fondo WhatsApp, typing indicator, ubicación como tarjeta, selfie como imagen, resultado con pill+similitud+razón; 5 casos demo con hora simulada 08:05-08:50; selector de trabajador; reiniciar demo), ColaRevision (evidencia+aprobar/rechazar con motivo obligatorio en Dialog, historial de decisiones), AlertasView (filtros estado/tipo/período + resolver con nota), TrabajadoresView (CRUD + activar/desactivar), ZonasView (lista + mapa + crear con radio slider), ReportesView (tabla con columnas num right-aligned tabular, CSV con BOM+; para Excel es-CL)
- Shell page.tsx: sidebar 232px sobre fondo (sin dark sidebar, píldora gris activa), contadores solo en colas de acción, marca AsisBot (burbuja+check SVG), scope "Demo Chile", user row, banner DEMO ámbar (patrón notice del skill), footer sticky con metas proyectadas, móvil: top bar 48px + Sheet, hash routing con useSyncExternalStore
- ESLint: pasadas las reglas (immutability, set-state-in-effect, parsing); ignores para .agents/
- docs/demo-script.md (guion 5 min) y README.md escritos

Stage Summary:
- Frontend completo; app responde 200; pendiente verificación end-to-end con Agent Browser

Work Log (Task 7-13, cierre):
- Verificación end-to-end con Agent Browser (25 capturas): panel en vivo (KPIs, líneas de jornada, mapa OSM con geocercas), simulador WhatsApp (caso 2 fuera de zona ejecutado en chat, caso 4 duplicada, flujo manual completo con chips ubicación+selfie), cola de revisión (aprobar con motivo → auditoría), alertas (resolver con nota), reportes (55 jornadas, CSV descargado y verificado: BOM UTF-8, ';', CRLF, acentos), trabajadores (crear Rodrigo Salas OK), zonas (geocercas en mapa)
- Responsive verificado: 1440 (sidebar), 768 tablet, 390 móvil (top bar + Sheet, KPIs 2-col, tablas→listas)
- Footer sticky verificado (pegado abajo con contenido corto, mt-auto)
- Bugs encontrados y corregidos durante la verificación:
  1. Tiles CARTO exigían API key → cambiado a OSM estándar (gratuito, sin key)
  2. "Decisiones recientes" vacío → nuevo param reviewed=1 en GET /api/checkins
  3. Seed histórico: decisiones resueltas quedaban EN_REVISION → APROBADA/RECHAZADA
  4. /api/reports import roto (chileParts) → movido a @/lib/tz
  5. Dashboard: duplicada rechazada dejaba al trabajador AUSENTE → entrada relevante = última no rechazada
  6. Warning Radix DialogContent → reemplazo de <p> por <DialogDescription> (sin id custom)
- Pre-flight del skill design-taste-frontend ejecutado (scripts/lint.mjs --app): 2 FAIL corregidos (patrón WhatsApp marcado taste-skill-ignore como fragmento data-ui; sombras de burbujas eliminadas; typing dots con animación propia). RESULTADO FINAL: 0 FAIL, 5 WARN defendibles
- Demo reiniciada a estado semilla (129 marcaciones) para la presentación
- Lint ESLint: limpio. Dev.log: sin errores recientes, todas las rutas 200

Stage Summary:
- CRITERIOS DE ACEPTACIÓN DEL BRIEF (§8): todos cumplidos y verificados en navegador
- Skills aplicadas: design-taste-frontend (variance 3 · motion 2 · density 7, leída completa: SKILL.md + app-screens.md), ask-sonner (Toaster único richColors), emil-design-eng (easings/300ms/reduced-motion)
- Migración futura a Supabase documentada en README (solo cambia datasource Prisma + DATABASE_URL; contratos API intactos)

---
Task ID: 14
Agent: Z.ai Code (principal)
Task: Fix — el diálogo "Nueva zona de trabajo" quedaba detrás del mapa Leaflet

Work Log:
- Reporte del usuario: al crear una nueva zona, el formulario quedaba detrás del mapa de Leaflet
- Causa raíz: los paneles internos de Leaflet usan z-index 200–1000 (tile 200, overlay 400, marker 600, tooltip 650, popup 700, controles 1000); el Dialog de shadcn (portal Radix en body) usa z-50. Como ningún ancestro del mapa creaba un stacking context, los paneles del mapa escapaban al contexto raíz y pintaban por encima de cualquier overlay z-50
- Fix global en src/components/asisbot/MapView.tsx: el contenedor del mapa ahora lleva `relative z-0 isolate` (isolation: isolate + z-index 0) → crea un stacking context propio que encierra TODOS los z-index internos de Leaflet; los overlays (Dialog, Sheet, toasts) vuelven a pintar encima en ambas vistas con mapa (Panel en vivo y Zonas) y en móvil
- Verificación end-to-end con Agent Browser (4 capturas): diálogo "Nueva zona" sobre el mapa ✓, flujo completo de creación (Obra Mapocho Test, radio 200 m) → toast "Zona creada" + lista 2→3 zonas + geocercas re-fit en mapa ✓, Sheet móvil sobre mapa ✓ (viewport 390), Panel en vivo móvil ✓
- Consola sin errores; ESLint limpio

Stage Summary:
- Fix de z-index centralizado en MapView (una sola línea de clases), cubre ambos mapas y cualquier overlay futuro
- Criterio: aislamiento de stacking context (mejor práctica Leaflet+Radix) en vez de subir z-index de cada diálogo

---
Task ID: 2-c
Agent: Z.ai Code (subagente 2-c)
Task: Mis marcas (nuevo), Portal mandante (nuevo), Reporte mensual contador
Work Log:
- PASO 0: leído worklog.md completo (Tasks 1, 3, 5, 14) + api.ts, types.ts, format.ts, Avatar.tsx, StatusPill.tsx, PanelEnVivo.tsx, globals.css, ZonasView.tsx, ReportesView.tsx; verifiqué endpoints reales por curl (/api/workers trae consent {version, acceptedAt}, /api/mandante, /api/reports/monthly, /api/checkins trae pendingSync/syncAt/workerNote/corrections)
- CREAR MisMarcas.tsx: selector de identidad con chips Avatar (mismo patrón visual del SimuladorWhatsApp, rounded-full + tinte activo verde), estado local workerId con primero por defecto (cálculo en render, sin setState en effect); tarjeta de consentimiento (ShieldCheck verde + versión + fecha larga es-CL America/Santiago + botón "Solicitar eliminación de mis datos (demo)" → toast.info) o tarjeta ámbar si no hay consent; PRIVACY_LINE siempre visible al pie de la vista con ShieldCheck; lista divide-y (sin tabla) de getCheckins({workerId, scope:"all"}): tipo + fmtWhen + StatusPill, lugar aproximado con formato km coma decimal ("a 6,2 km de…"), caso PENDIENTE_SYNC con texto "Guardada en tu teléfono…", línea de sincronización con syncAt, motivo si status≠APROBADA, «Tu explicación: …» para workerNote, correcciones con icono History ("Corregida: hora/estado old → new · motivo"); sin selfies; skeletons + vacío "Aún no tienes marcas registradas."
- CREAR MandantePortal.tsx: página completa autosuficiente (min-h-screen flex flex-col, footer mt-auto pegado abajo), header propio h-12 con marca AsisBot (cuadrado verde + check SVG), "Portal del mandante", pill "Solo lectura", pill DEMO; franja de aviso ámbar (var(--pill-warning-bg)/ink); botón "← Volver al panel (demo interno)" → window.location.hash="#/panel"; chips de instalación con getZones (activeZoneId = initialZoneId ?? primera, con fallback si la zona inicial quedó obsoleta); getMandante(zoneId); KPIs Esperados/Presentes/Ausentes/Atrasos estilo hairlines de PanelEnVivo (grid-cols-2 sm:grid-cols-4, número 24px + label 12px); tabla real con overflow-x-auto (Trabajador · Cargo · Horario · Entrada · Salida · Estado · Atraso + col evidencia); estado con mapping propio (JORNADA_TERMINADA verde, PENDIENTE_SYNC neutral "Por sincronizar"); fila de evidencia expandible por fila (botón con chevron, estado local por fila): tipo+hora, selfie ilustrativa /demo/selfie-carlos.png con alt "Evidencia ilustrativa (foto no real)", "a X m del centro de la zona"/"sin ubicación", coords aprox 3 decimales, nota de sync; SIN RUT, teléfono ni similitud; footer "Generado con datos ficticios…"
- MODIFICAR ReportesView.tsx: sección semanal intacta; AGREGADA al inicio sección "Reporte mensual para el contador" (card): input type=month (default mes actual de Chile vía Intl en-CA America/Santiago, lazy initializer de useState, sin effect), botón Exportar CSV → downloadMonthlyCsv(month), nota "BOM UTF-8 + \";\" — listo para Excel es-CL"; resumen "{rows.length} jornadas · {correctionsCount} correcciones · {n} semanas >42 h"; nota honesta (NO liquida sueldos, 42 h desde abril 2026); tabla resumen semanal (Trabajador · Semana del fmtDayLabel · Horas fmtMinutes · Excede 42 h pill warning/—) con max-h-64 scroll-fine; línea de correcciones auditadas si correctionsCount>0; botón secundario "Vista mandante (demo)" que copia {origin}/#mandante?z={primera zona} al portapapeles + toast.success (con fallback toast.error si falla el clipboard)
- Verificación: bun run lint → 0 errores; tsc --noEmit → 0 errores en MisMarcas/MandantePortal/ReportesView (los TS existentes en examples/skills/api/seed-data son de otros agentes, fuera de alcance); dev.log sin errores, rutas 200
Stage Summary:
- MisMarcas: export function MisMarcas() sin props — se integra dentro del panel (usa queryKeys ["workers"] y ["checkins","mine",workerId])
- MandantePortal: export function MandantePortal({ initialZoneId }: { initialZoneId?: string }) — se dibuja full-screen con header/footer propios; el integrador debe montarlo FUERA del shell del panel cuando el hash sea #mandante, pasando initialZoneId desde el query param z (ej: #mandante?z=cmvrbxjz…); useQuery keys: ["zones"] y ["mandante", zoneId]
- ReportesView: misma firma export function ReportesView() sin props; nueva sección mensual encima de la semanal (que quedó intacta); keys nuevas ["reports-monthly", month]

---
Task ID: 2-b
Agent: Z.ai Code (subagente UI · Cola de revisión + Alertas)
Task: UI Cola de revisión (corrección auditada, sync, nota) + Alertas (FP counter)

Work Log:
- Leído worklog.md y contratos listos (api.ts, types.ts, format.ts, Avatar, StatusPill, globals.css); verificados los endpoints reales: POST /api/checkins/[id]/correct (valida motivo ≥3, exige al menos un cambio, resuelve alertas pendientes y cierra la revisión), GET /api/corrections (relación `checkIn` con worker, orderBy correctedAt desc, take 50) y GET /api/alerts (fpSummary real calculado de datos, ATRASO excluido)
- ColaRevision.tsx — mejora §2 (corrección sin volver a Excel):
  1. Tercer botón "Corregir" (PencilLine, mismo estilo h-8 que Aprobar/Rechazar) en cada pendiente → Dialog "Corregir marcación": grilla de valores actuales (trabajador, tipo, hora actual con fmtWhen, estado actual con STATUS_LABEL), input datetime-local "Nueva hora" prellenado en hora de pared Chile, select "Nuevo estado" (Mantener estado actual / Aprobar / Rechazar), Textarea "Motivo (obligatorio)" con el placeholder indicado, y nota visible "La marca original nunca se borra…"
  2. Conversión tz sin tocar format.ts ni tz.ts: importé chileInstant/chileParts de @/lib/tz (puros, client-safe) y agregué helpers locales isoToChileInput (ISO→valor datetime-local Chile) y chileInputToIso (wall Chile→ISO, regex estricta); round-trip verificado para ambos regímenes DST (-03 enero / -04 junio). No cambia hora → manda null; no cambia estado → null; el estado elegido igual al actual no cuenta como cambio
  3. Confirmar deshabilitado si motivo <3 chars o si no hay cambio (hora ni estado) o si la hora es inválida; al confirmar: correctCheckin → toast.success("Marcación corregida", { description: "El cambio quedó auditado: quién, cuándo, valor anterior y nuevo." }) → invalidateQueries(). Sin useEffect (restricción ESLint): el borrador se fija en onClick, snapshot al abrir
  4. Sección "Correcciones recientes" al final (useQuery getCorrections, refetchInterval 30000): avatar · nombre · entrada/salida · cambio ("hora 08:47 → 08:00" / "estado En revisión → Aprobada" con STATUS_LABEL) · motivo entre comillas · correctedBy · fmtWhen(correctedAt); vacío → "Aún no hay correcciones registradas."; type CorrectionRow = Correction & { checkIn } (la relación se llama checkIn)
  5. Tarjetas pendientes: si trae syncAt → línea "Marca original HH:MM · sincronizada HH:MM (X min después, sin señal)" con X = Math.round((syncAt − timestamp)/60000) y .num; si trae workerNote → bloque cita con MessageSquareQuote y «nota» precedido de "El trabajador explicó:". Sin acción de borrado en ningún lugar
- AlertasView.tsx — mejora §5 (anti-trampa honesto):
  1. Tarjeta fija arriba de los filtros (bg-card, border, p-4, rounded-lg): izquierda título "La IA alerta, no sanciona" + texto exacto del documento; derecha (border-l en sm+, segunda fila en móvil) contador REAL desde data.fpSummary: "Falsos positivos: X de Y alertas de anomalía resueltas (Z%)" con .num + tabular-nums, y debajo a 11.5px muted "Meta del piloto: <20% en la semana 4 (proyectado, no observado). La demo siembra anomalías a propósito: esta tasa no representa un entorno real.". fpSummary undefined → "—" (nada inventado)
  2. TIPOS del filtro + "FOTO_GALERIA", "INCOHERENTE", "SYNC_TARDE" (ALERT_LABEL ya las tenía)
  3. Búsqueda de "fraude" en todo src (grep -i): cero ocurrencias en AlertasView/ColaRevision/cualquier componente; tampoco "fraude cero"/"garantiza"/"elimina el fraude". Los textos nuevos usan lenguaje honesto requerido
  4. Flujo de resolver alertas intacto (verificado en navegador)
- Verificación end-to-end con Agent Browser: cola (3 tarjetas con 3 botones), diálogo corrección prellenado 08:47 Chile (27-10-2026, DST correcta), confirmar deshabilitado solo con motivo / habilitado con motivo+cambio, submit → toast "Marcación corregida" + fila nueva en "Correcciones recientes" ("José · entrada estado En revisión → Aprobada"); card de alertas con contador real (4 de 6, 67% tras reset), filtro SYNC_TARDE filtra la alerta creada, resolver con nota → toast "Alerta resuelta"; móvil 390px sin overflow; consola sin errores; curl: correct con hora+estado devuelve 2 correcciones y cierra revisión
- Datos de prueba limpiados: POST /api/demo/reset al terminar (134 marcaciones semilla; el seed incluye correcciones históricas, así que la sección nueva no queda vacía en la demo)

Stage Summary:
- Mejora §2 completa en UI: RR.HH. corrige hora y/o estado desde el panel con motivo obligatorio; la marca original nunca se borra y cada cambio queda auditado (quién, cuándo, valor anterior/nuevo) en "Correcciones recientes"; evidencia extra en pendientes: horas original/sincronizada con minutos de retraso y explicación del trabajador
- Mejora §5 completa en UI: mensaje "La IA alerta, no sanciona" siempre visible + contador real de falsos positivos con descargo honesto (proyectado, no observado; demo siembra anomalías); filtro con los 9 tipos de alerta
- Solo se modificaron ColaRevision.tsx y AlertasView.tsx; bun run lint 0 errores; demo en estado semilla

---
Task ID: 2-a
Agent: Z.ai Code (agente UI simulador)
Task: UI Simulador WhatsApp — consentimiento, sin señal, galería, explicación, privacidad

Work Log:
- Leído worklog.md (tareas 1, 3, 5-14) y todos los contratos: api.ts, types.ts, Avatar, StatusPill, format.ts, globals.css; verificados por lectura los endpoints que consume: POST /api/consent, POST /api/checkins (offline → PENDIENTE_SYNC), POST /api/checkins/[id]/sync (syncLateMin), POST /api/checkins/[id]/note, GET /api/checkins?status=PENDIENTE_SYNC; confirmado en seed: solo Andrés Vidal Rojas sin consentimiento y Daniela con 1 marca PENDIENTE_SYNC de 07:58
- Reescrito SOLO src/components/asisbot/SimuladorWhatsApp.tsx (sin tocar page.tsx/api.ts/types.ts ni nada más):
  §1 Consentimiento: needsConsent derivado de worker.consent; botones "Marcar entrada/salida" bloqueados y guard en startManual (respuesta del bot) y runCase (toast de error); burbuja fija del bot con botón "Ver y aceptar consentimiento" (render condicional fuera de msgs, sin efectos nuevos → sin riesgos de loops); Dialog con lenguaje simple (QUÉ/PARA QUÉ/QUIÉN/POR CUÁNTO TIEMPO + aviso fuera de jornada), versión v1-2026-10; "Aceptar y continuar" → await acceptConsent → invalidateQueries(["workers"]) → bot confirma con fecha es-CL y versión; "Ahora no" → bot: sin aceptar no puedes marcar
  §1 Privacidad: línea PRIVACY_LINE permanente bajo la cabecera (fondo #fdf4c8, ShieldCheck size-3)
  §4 Sin señal: toggle "Buena/Sin señal" (Wifi/WifiOff, ámbar al cortar) en la cabecera del teléfono; estado senal; chooseSelfie y sendMark (casos sin bandera) envían offline cuando senal==="sin"; casos con offline:true lo fuerzan por parámetro; respuesta PENDIENTE_SYNC = mensaje de texto con píldora neutral "Por sincronizar" (ChatMsg.pill), SIN burbuja de resultado; query ["checkins","pendientes",workerId] + botón ámbar "Sincronizar N marca(s)" sobre el input (solo con señal buena, deshabilitado en busy/syncing); syncOne confirma "Sincronizada: tu marca de las HH:MM llegó a las HH:MM (X min después, sin señal)." + "Quedó por revisar…" si EN_REVISION; sin auto-sync al volver a "buena"
  §5 Galería: tercera opción "Foto de galería" (thumb con etiqueta mini "GALERÍA"); ChatMsg.gallery → chip "desde galería" sobre la imagen; backend responde EN_REVISION+FOTO_GALERIA y el flujo existente lo pinta
  §5 Explicación: tras todo EN_REVISION de markCheckin el bot pregunta "¿Quieres explicar qué pasó?…"; paso explain (input + "Enviar explicación" + "Omitir", deshabilitado mientras envía); addWorkerNote → bot agradece; máximo 1 por marca (explainedRef Set, incluye omitidas)
  Casos: 6 "Foto de galería" (Carlos, 08:22) y 7 "Marca sin señal" (Daniela, 08:14, offline:true, aviso de hora simulada); caso 7 hace syncCheckin del id devuelto (sendMark ahora devuelve {id, explainOffered}) y muestra la confirmación; píldora esperada "Por sincronizar → Por revisar" mapeada a PENDIENTE_SYNC; casos 1-5 intactos
- Refactor interno: handleMarkResponse centraliza la respuesta del motor (resultado/sin señal/explicación) para sendMark y chooseSelfie; estructura de burbuja de texto ahora envuelve píldora+párrafo (misma piel); burbuja de imagen envuelta en relative para el chip; lista de casos con max-h-96 overflow-y-auto (7 casos)
- Lint: bun run lint → 0 errores; tsc --noEmit → 0 errores en mi archivo (los que lista son preexistentes en examples/, skills/, rutas API, MapView y seed-data, fuera de alcance)
- Verificación end-to-end con Agent Browser (/#/simulador): consentimiento completo con Andrés (bloqueo → dialog → "Ahora no" → aceptar → confirmación con versión/fecha y botones habilitados), toggle señal + marca manual sin señal ("Por sincronizar" con hora 21:04), botón "Sincronizar 2 marcas" (confirmaciones 0 y 787 min, la de 07:58 quedó por revisar), caso 6 (chip "desde galería", EN_REVISION, explicación enviada y verificada en DB: workerNote persistido), caso 7 (PENDIENTE_SYNC 08:14 → auto-sync → 771 min → por revisar), caso 2 regresión (mismo texto del motor + prompt de explicación), consola sin errores; demo reiniciada a semilla (1 pendiente Daniela 07:58)

Stage Summary:
- El simulador integra las 4 mejoras de mercado respetando el patrón WhatsApp y los comentarios taste-skill-ignore; sin efectos nuevos (la burbuja de consentimiento es render condicional), sin any, transiciones ≤300ms ease [0.23,1,0.32,1], toasts sonner
- Decisiones: (1) consentimiento en Dialog (texto largo legible) + burbuja-CTA fija en el chat en vez de mensajes insertados — evita duplicarse al refrescar workers; (2) la explicación se ofrece en TODO EN_REVISION de markCheckin (incluye casos 2/3/6); el caso queda con el paso explain activo para que el demostrador responda u omita; tras syncCheckin NO se ofrece (solo el texto "Quedó por revisar"); (3) toggle de señal dentro de la cabecera verde como píldora (ámbar en "Sin señal"); (4) "menos de 1 min" cuando syncLateMin redondea a 0
- Observaciones de contrato/motor (fuera de mi alcance, no tocados): (a) con el orden 3→6 el motor marca RECHAZADA·Duplicada (08:18→08:22 < ventana de 5 min); el caso 6 demostrado solo o tras "Reiniciar demo" da el EN_REVISION·Foto de galería esperado — si el guion corre 3 y 6 seguidos, mover demoAt del caso 6 a 08:26; (b) el chequeo de duplicados admite diffs negativos: una marca manual a hora real posterior (p. ej. 21:04) seguida de un caso a 08:05 rechaza por "hace -779 min" (preexistente en attendance.ts); (c) no faltó ningún endpoint: consent, sync y note estaban listos

---
Task ID: 15 (1-4 base) + 2-a/2-b/2-c (UI) + 8/9 (integración/verificación)
Agent: Z.ai Code (principal) + 3 subagentes full-stack (2-a Simulador, 2-b Cola/Alertas, 2-c MisMarcas/Mandante/Reportes)
Task: Aplicar asisbot-mejoras-desde-mercado.md — 5 módulos con criterios de aceptación

Work Log:
- Fase base (principal): schema Prisma += CheckIn.pendingSync/syncAt/workerNote, modelos Consent y Correction, tipos de alerta FOTO_GALERIA/INCOHERENTE/SYNC_TARDE, SelfieKind "galeria", CheckStatus "PENDIENTE_SYNC"; db:push OK
- Motor (attendance.ts): galería → similitud como referencia pero SIEMPRE EN_REVISION+FOTO_GALERIA (foto vieja puede pasar la cara; lo delata el momento); coherencia con marca anterior (>2 km en <90 min → INCOHERENTE); evaluateSyncLate() evalúa con hora ORIGINAL y marca SYNC_TARDE si >30 min; ATRASO excluido del conteo de FP (es informativo)
- APIs nuevas: POST /api/consent (exige versión, idempotente), POST /api/checkins/[id]/sync (evalúa con hora original, nunca reescribe), /note (explicación trabajador, solo en revisión), /correct (motivo obligatorio ≥3, una fila Correction por campo cambiado, cierra revisión y resuelve alertas), GET /api/corrections, GET /api/reports/monthly (json+csv BOM;';' con resumen semanal 42 h), GET /api/mandante (solo lectura: sin RUT/teléfono/similitud, ubicación aprox 3 decimales); alerts GET añade fpSummary REAL (resueltas de anomalía que terminaron APROBADA); dashboard filtra PENDIENTE_SYNC de entrada/salida/posición y expone pendientesSync + pendingSyncTypes; workers GET incluye consent; checkins GET incluye corrections; POST checkins exige consentimiento (403 CONSENT_REQUIRED) y excluye pendientes de duplicados/coherencia/entrada previa
- Seed: 7/8 consentimientos (Andrés sin consentir para demostrar el gate), D-4 corrección histórica auditable (08:47→08:00+APROBADA con 2 filas), D-6 foto galería aprobada tras revisión (FP real), HOY Daniela con entrada 07:58 PENDIENTE_SYNC, workerNote en caso de José; demo/reset limpiando Correction+Consent; 134 marcas
- Contratos UI: types.ts (Correction, MonthlyRow, MonthlyWeekRow, FpSummary, MandanteData, PRIVACY_LINE, SELFIE_KIND_LABEL, labels nuevos, PENDIENTE_SYNC píldora neutral) y api.ts (acceptConsent, syncCheckin, addWorkerNote, correctCheckin, getCorrections, getMonthlyReport, downloadMonthlyCsv, getMandante, markCheckin offline/galeria, fpSummary en getAlerts)
- Subagente 2-a (SimuladorWhatsApp): gate de consentimiento con Dialog (qué/para qué/quién/cuánto + versión v1-2026-10), toggle Buena/Sin señal, marcas offline con píldora "Por sincronizar" y botón "Sincronizar N marca(s)" (confirma ambas horas), tercera opción "Foto de galería" con chip en la burbuja, paso "explain" tras EN_REVISION (máx 1 por marca), PRIVACY_LINE en el chat, casos demo 6 (galería 08:22) y 7 (sin señal 08:14 con auto-sync)
- Subagente 2-b (Cola+Alertas): botón "Corregir" con Dialog (datetime-local en hora Chile con DST correcta, select estado, motivo, nota "la marca original nunca se borra", deshabilitado sin cambios), línea de sync original/sincronizada, cita de explicación del trabajador, sección "Correcciones recientes" (getCorrections), tarjeta "La IA alerta, no sanciona" + contador FP real + descargo honesto de la demo, filtros con los 3 tipos nuevos; grep "fraude cero" = 0 ocurrencias en src
- Subagente 2-c (MisMarcas+Mandante+Reportes): MisMarcas.tsx (identidad simulada, tarjeta de consentimiento + solicitar eliminación, lista divide-y con lugar aprox km es-CL, sync, motivo, explicación y correcciones), MandantePortal.tsx (standalone solo lectura, chips de instalación, KPIs hairlines, tabla con evidencia expandible: selfie ilustrativa + distancia + coords aprox, sin RUT/teléfono/similitud), ReportesView (card mensual: month picker Chile, Exportar CSV, resumen jornadas/correcciones/>42h, nota "NO liquida sueldos", tabla semanal con pill excede 42 h, botón "Vista mandante (demo)" que copia {origin}/#mandante?z={zoneId})
- Integración (principal): page.tsx += vistas "mismarcas"/"mandante" en NAV+TITLES, parseHash con query (?z=) para deep-link, mandante renderiza standalone sin shell (después de hooks), key={zoneId} para remount al cambiar el deep-link, pie con línea de Privacidad (PRIVACY_LINE); PanelEnVivo += banner ámbar "N marcas guardadas sin señal", badge "sin señal" por fila, punto gris + leyenda "Por sincronizar (sin señal)" en el mapa
- Verificación E2E (Agent Browser, 18 capturas): consentimiento bloquea→acepta→habilita; marca offline guardada en teléfono (hora original) → Sincronizar 1 marca → "llegó al sistema (menos de 1 min)" → APROBADA sin pasar por cola; cola con 3 botones y nota del trabajador; corrección 08:47→08:30+APROBADA con motivo → toast auditado + fila en Decisiones + historial de correcciones; portal mandante standalone con KPIs/evidencia/estados (Daniela "Por sincronizar", José 08:30 corregida) y deep-link #mandante?z= verificado tras reload; Mis marcas con consentimiento v1-2026-10 y solo marcas propias; Alertas con FP 5/7 (71%) calculado de datos reales; caso 6 galería → chip "desde galería" + EN_REVISION; mensual 64 jornadas/4 correcciones/8 semanas >42 h; móvil 390 OK (portal 2-col, tabla con scroll)
- Bugs encontrados y corregidos durante verificación: (1) Turbopack sirvió chunks viejos tras los primeros restarts → reinicio limpio rm -rf .next; (2) relación Prisma "checkin" vs "checkIn" en /api/corrections → 500 corregido; (3) hhmmToMinutes importado desde tz en mandante → movido a attendance; (4) duplicados/coherencia contaban marcas PENDIENTE_SYNC → filtradas; (5) deep-link ?z= no remontaba → key en page.tsx; (6) FP contaba ATRASO aprobado → excluido (informativo)
- Cierre: demo reseteada a semilla (134 marcas, 7 consentimientos), ESLint 0 errores, dev.log sin errores

Stage Summary:
- LOS 5 MÓDULOS IMPLEMENTADOS Y VERIFICADOS con sus criterios de aceptación del documento:
  §1 Confianza: gate de consentimiento obligatorio (nadie marca sin aceptar; backend 403), Mis marcas solo propias, mensaje de privacidad en simulador+panel+footer, sin rastreo continuo en el código
  §2 Corrección: corregir exige motivo y deja auditoría (quién/cuándo/anterior/nuevo), original visible en historial, CSV mensual con horas+atrasos+correcciones y resumen 42 h
  §3 Mandante: vista por instalación/día con esperados/presentes/ausentes/atrasos + evidencia, solo lectura, deep-link compartible, sin datos sensibles
  §4 Sin señal: modo demostrable, pendiente conserva hora original, sincronización tardía → cola con ambas horas, supervisor decide
  §5 Anti-trampa honesto: galería/duplicada/fuera de zona generan alertas distintas, trabajador comenta, ninguna alerta sanciona sola, contador de FP visible (real, no inventado), sin promesas de "fraude cero"
- Fuera de alcance respetado: sin liquidación, sin rastreo continuo, sin hardware, sin ERP, sin multiempresa
- Migración futura intacta: contratos API estables, solo Prisma+SQLite en demo
