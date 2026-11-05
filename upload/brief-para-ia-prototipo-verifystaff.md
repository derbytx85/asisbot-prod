# AsisBot — Brief para construir un prototipo (para pasar a una IA programadora)

> Objetivo: construir un prototipo funcional y demostrable de AsisBot, no un producto en producción.
> Todo lo que sigue es para una DEMO con datos ficticios. No usar datos reales de trabajadores,
> no conectar WhatsApp en producción y no tomar decisiones biométricas reales.

## 1. Qué es AsisBot

Plataforma SaaS de control de asistencia laboral por WhatsApp, sin instalar apps adicionales:

- El trabajador marca entrada/salida con mensajes simples por WhatsApp.
- En la marcación comparte ubicación y envía una selfie para validar identidad.
- La IA compara la selfie con fotos previamente registradas (en el prototipo: comparación simulada).
- Supervisores y RR.HH. ven asistencia en tiempo real en un panel web, gestionan trabajadores,
  generan reportes y reciben alertas ante irregularidades.
- La IA detecta anomalías por patrones e históricos: posible suplantación, marcación desde una
  ubicación no autorizada o comportamiento inusual.
- La decisión final ante una inconsistencia siempre la revisa un humano autorizado.

Público objetivo: pymes con trabajadores en terreno, remotos, contratistas y equipos distribuidos.
Sectores: construcción, seguridad, logística, servicios técnicos, mantenimiento, ventas en terreno y retail.

Problema que resuelve: los sistemas tradicionales de control horario son costosos, complejos o poco
confiables para personal distribuido. AsisBot busca reducir fraude en marcaciones, mejorar la
trazabilidad y facilitar el cumplimiento normativo, sin apps ni capacitaciones complejas.

**Estado real del proyecto (no inflar en la demo):** está en definición de integraciones
(WhatsApp, geolocalización, validación biométrica, IA) y busca pruebas piloto. Los indicadores
de impacto son PROYECTADOS, no observados: reducción de más del 70% del tiempo de supervisores y
RR.HH. en registro y consolidación, y trazabilidad superior al 95% de las marcaciones. En la demo,
mostrar estos números etiquetados como "meta proyectada", nunca como resultado logrado.

## 2. Decisión de stack para el prototipo: React (recomendado)

**Construir el prototipo en React + TypeScript + Vite.**

- Frontend: React + TypeScript, Vite, Tailwind CSS, React Router.
- Mapa: Leaflet (gratuito, sin API key de pago).
- Backend del prototipo: API simulada local (datos en JSON / mock server en Node con Express),
  con endpoints bien definidos para que después se pueda reemplazar por un backend real sin
  reescribir el frontend.
- Base de datos del prototipo: datos semilla en JSON, no una base de datos en producción.
- Despliegue de demo: estático gratuito (Vercel o Netlify) o ejecución local con `npm run dev`.

### Por qué React para este prototipo (y no Rust)

| | React | Rust |
|---|---|---|
| Velocidad para un prototipo visual | Muy alta: componentes, mapas, tablas y formularios listos | Baja: hay que construir mucho más a mano |
| Madurez para UI web | Máxima: ecosistema enorme, ejemplos y librerías | Baja: Yew / Leptos / Dioxus son menos maduros y con menos componentes listos |
| Facilidad para que una IA genere buen código | Muy alta: muchísimo código React/TypeScript de referencia | Media: menos ejemplos de UI completa y más fricción en compilación y dependencias |
| Demo para jurado / cliente | Ideal: se abre en el navegador y se hace clic | Incómoda: más trabajo para igualar la misma experiencia visual |
| Rendimiento y seguridad a largo plazo | Suficiente para el frontend; el backend real puede ser otro lenguaje | Excelente para backend: rendimiento, concurrencia y seguridad de memoria |
| Curva de aprendizaje | Baja/media | Alta (ownership, borrow checker, ecosistema web menos directo) |

**Conclusión:** React ahora para validar la idea y mostrarla. Rust es una excelente opción
**posterior** para el backend real (servidor de webhooks de WhatsApp, cálculo de geocercas,
procesamiento concurrente), no para construir la UI del prototipo. No dividir el prototipo
en dos lenguajes: eso duplica trabajo sin aportar nada a la demo.

## 2.1 Skills de diseño obligatorios antes de programar la UI

El prototipo debe verse profesional y no como una plantilla genérica de IA. Antes de escribir
código de interfaz, la IA que construya el prototipo debe instalar y aplicar el siguiente skill
de diseño:

```bash
npx skills add Leonxlnx/taste-skill
```

Forma completa recomendada (skill `design-taste-frontend` del repo
`Leonxlnx/taste-skill`):

```bash
npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"
```

Reglas de aplicación para AsisBot (es un panel de control, no una landing):

- Aplicar el skill a todo el frontend: simulador WhatsApp, panel en vivo, cola de revisión,
  trabajadores, zonas y reportes.
- La IA debe declarar primero su "design read" (lectura de diseño) en una línea y luego
  fijar los tres diales del skill para un dashboard, no para una landing vistosa:
  **variance 3, motion 2, density 7** (diseño sobrio y ordenado, poco movimiento, alta densidad
  de información útil).
- Evitar los patrones genéricos que el skill prohíbe (gradientes morados de plantilla,
  tarjetas idénticas sin jerarquía, iconos decorativos sin función).
- Priorizar legibilidad y jerarquía: estado de asistencia, alertas y acciones de revisión
  deben verse primero; lo decorativo va después.
- Mantener la identidad sobria de una herramienta laboral para pymes: limpia, clara y
  confiable, no festiva ni publicitaria.
- Al terminar la UI, ejecutar el pre-flight check del skill antes de dar el prototipo por listo.

Si la IA que construye el prototipo no soporta `npx skills add`, debe leer el `SKILL.md` del
repo `Leonxlnx/taste-skill` y aplicar sus reglas manualmente, indicando en el README que lo hizo así.

## 3. Alcance del prototipo (MVP demostrable)

### 3.1 Roles

1. **Trabajador (demo):** simula el flujo de WhatsApp dentro de la misma app web
   (panel "Simulador WhatsApp"), porque la integración real con WhatsApp Cloud API queda fuera del prototipo.
2. **Supervisor / RR.HH.:** panel web con monitoreo, gestión, reportes y alertas.
3. **Administrador demo:** carga trabajadores y zonas de trabajo.

### 3.2 Flujo del trabajador (simulador WhatsApp)

Pantalla tipo chat, con un trabajador de ejemplo seleccionado:

1. Escribe `entrada` (o pulsa el botón "Marcar entrada").
2. Comparte ubicación: el simulador ofrece 3 ubicaciones de ejemplo (dentro de zona, fuera de zona,
   sin ubicación) o permite escribir latitud/longitud.
3. Sube una selfie de ejemplo (imagen de demo, no una foto real de nadie).
4. El sistema muestra el resultado simulado: verificación de identidad con un puntaje ficticio
   (ej. 94%), estado de la marcación (Aprobada / En revisión / Rechazada) y motivo.
5. Igual para `salida`. El sistema calcula horas trabajadas de la jornada.

Casos que la demo DEBE cubrir (son el corazón de la presentación):

- Marcación normal dentro de zona, selfie similar: Aprobada.
- Marcación fuera de zona autorizada: alerta "Fuera de zona" y queda En revisión.
- Selfie con baja similitud simulada: alerta "Posible suplantación" y queda En revisión.
- Marcación duplicada en pocos minutos: alerta "Duplicada".
- Entrada tardía respecto al horario asignado: alerta "Atraso".

### 3.3 Panel del supervisor / RR.HH.

- **Vista en vivo:** lista de trabajadores con estado actual (presente, ausente, en revisión,
  fuera de zona), hora de entrada/salida y última ubicación.
- **Mapa:** marcadores de las marcaciones del día sobre las zonas autorizadas (geocercas dibujadas
  como círculos/polígonos).
- **Cola de revisión:** solo las marcaciones En revisión, con botones "Aprobar" / "Rechazar" y
  campo de motivo. Toda decisión queda registrada con usuario, fecha y motivo (trazabilidad).
- **Gestión de trabajadores:** crear, editar y desactivar (nombre, cargo, zona asignada, horario,
  foto de referencia de demo).
- **Gestión de zonas:** crear zonas con nombre, centro y radio.
- **Reportes:** tabla por trabajador y por día, con horas trabajadas, atrasos y alertas;
  exportación a CSV.
- **Alertas:** panel de alertas del día, con filtro por tipo y estado (pendiente / resuelta).

### 3.4 Datos semilla (ficticios)

- 8 trabajadores de ejemplo, 2 zonas de trabajo (ej. "Obra Balmaceda" y "Bodega Central"),
  horarios asignados, y un historial de 7 días con marcaciones normales y con anomalías.
- Ningún dato real. Nombres y fotos solo de ejemplo, con aviso visible "DEMO — datos ficticios".

## 4. Fuera de alcance (NO construir en el prototipo)

- Integración real con WhatsApp Cloud API ni envío de mensajes reales.
- Reconocimiento facial real ni almacenamiento de datos biométricos reales.
- Nómina, cálculo de sueldos o integración con sistemas de RR.HH. reales.
- Autenticación en producción, multi-empresa real o pagos.
- App móvil nativa: el prototipo es web responsive y el trabajador se simula en el chat web.

## 5. Reglas de privacidad y IA responsable (visibles en la demo)

- Banner visible: "Demo con datos ficticios. En producción, el uso requiere autorización de la
  empresa y del trabajador".
- La IA solo sugiere y marca alertas; la decisión final es humana y queda auditada.
- No guardar selfies reales ni ubicaciones reales en el prototipo.
- Explicar en la pantalla de revisión, en lenguaje simple, por qué una marcación quedó en revisión
  (motivo + puntaje simulado), sin lenguaje técnico opaco.

## 6. Estructura sugerida del repositorio

```
asisbot-prototipo/
  README.md            # cómo correrlo en 3 pasos
  frontend/            # React + TypeScript + Vite + Tailwind
    src/
      pages/           # SimuladorWhatsApp, Dashboard, Revision, Trabajadores, Zonas, Reportes
      components/      # Mapa, TablaMarcaciones, TarjetaAlerta, ChatSimulado
      api/             # cliente de la API simulada
      data/            # datos semilla ficticios
  mock-api/            # Express con endpoints: trabajadores, zonas, marcaciones, alertas, reportes
  docs/
    demo-script.md     # guion de demo de 5 minutos (ver sección 7)
```

## 7. Guion de demo de 5 minutos (entregable obligatorio)

El prototipo debe incluir un `docs/demo-script.md` con el recorrido exacto para presentarlo:

1. (1 min) El problema: personal en terreno sin sistema simple de asistencia.
2. (1 min) El trabajador marca entrada por el simulador WhatsApp: ubicación + selfie.
3. (1 min) El panel en vivo muestra la marcación y el mapa con la geocerca.
4. (1 min) Se fuerza un caso anómalo (fuera de zona o baja similitud) y aparece en la cola de revisión.
5. (1 min) El supervisor aprueba/rechaza con motivo, y el reporte del día se exporta a CSV.
   Cierre: impacto PROYECTADO (no observado) y próximos pasos hacia un piloto real.

## 8. Criterios de aceptación (para dar el prototipo por terminado)

- [ ] `npm run dev` levanta frontend y mock-api sin errores, con instrucciones en el README.
- [ ] Se puede completar una marcación de entrada y salida desde el simulador WhatsApp.
- [ ] Los 5 casos de alerta (sección 3.2) funcionan y se ven en el panel.
- [ ] La cola de revisión permite aprobar/rechazar con motivo y deja registro auditable.
- [ ] El mapa muestra marcaciones y geocercas del día.
- [ ] El reporte se exporta a CSV.
- [ ] Toda la interfaz está en español (mercado Chile) y la demo indica "datos ficticios".
- [ ] La UI aplica el skill `design-taste-frontend` (sección 2.1) con diales variance 3, motion 2,
  density 7, y pasó su pre-flight check: no es una plantilla genérica.
- [ ] No hay claves, tokens ni datos personales reales en el código.

## 9. Qué pedirle a la IA cuando se le pase este brief

> "Construye el prototipo descrito en este documento, en React + TypeScript + Vite,
> con mock-api local. Primero instala y aplica el skill de diseño
> `npx skills add Leonxlnx/taste-skill` (skill `design-taste-frontend`, diales variance 3,
> motion 2, density 7 para dashboard). Empieza por el simulador WhatsApp y el panel en vivo,
> luego la cola de revisión y los reportes. No conectes servicios reales ni uses datos
> personales reales. Entrega el proyecto corriendo con `npm run dev` y el guion de demo
> de 5 minutos."
