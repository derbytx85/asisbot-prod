# AsisBot — Mejoras desde la investigación de mercado (para la IA que desarrolla el prototipo)

> Documento complementario al brief del prototipo
> (`brief-para-ia-prototipo-asisbot.md`). No reemplaza ese brief: agrega lo que el
> mercado chileno realmente pide, según la investigación Go To Market del 2026-10-27
> (redes sociales, Reddit, reseñas y competidores: GeoVictoria, Buk, Talana, Factorial).
>
> Regla general: todo lo que sigue es para DEMO con datos ficticios, salvo que se indique
> lo contrario. No inventar clientes, pilotos, testimonios ni resultados. El impacto
> (>70% menos tiempo, >95% trazabilidad) sigue siendo PROYECTADO, no observado.

## Prioridad

Las mejoras están en orden de impacto según el mercado. Implementar en ese orden.
En el prototipo, cada una debe ser demostrable con datos ficticios y con su caso de
prueba correspondiente.

---

## 1. Módulo de confianza para el trabajador (prioridad máxima)

### Problema de mercado
La mayor resistencia a GPS y selfie no es técnica, es de confianza: miedo al rastreo
fuera de jornada, dudas sobre dónde queda la foto y quién la ve, y la percepción de
vigilancia. En Chile, además, la selfie comparada con fotos registradas es tratamiento
de dato biométrico sensible (Ley 21.719, alto nivel — esto NO es asesoría legal).

### Qué construir
- **Consentimiento explícito antes de la primera marca:** pantalla/paso en el simulador
  WhatsApp donde el trabajador acepta, en lenguaje simple: qué se registra (foto,
  ubicación y hora, solo en el momento de la marca), para qué (validar esa marca),
  quién lo ve (su supervisor y RR.HH.), por cuánto tiempo se guarda y cómo pedir
  su eliminación. Guardar la aceptación con fecha y versión del texto.
- **"Mis marcas" para el trabajador:** vista donde cada trabajador ve solo sus propias
  marcas: fecha, hora, lugar aproximado, estado (aprobada / en revisión / rechazada)
  y motivo cuando no se aprobó.
- **Mensaje de privacidad siempre visible:** en el simulador y en el panel, en una línea:
  "Solo se registra ubicación en el momento de la marca, dentro de la jornada.
  Fuera de jornada, no hay registro."
- **Sin rastreo continuo:** prohibido registrar ubicación en segundo plano, fuera de
  jornada o entre marcas. Si un cliente futuro lo pidiera, el producto debe decir que no.

### Criterios de aceptación
- [ ] Ningún trabajador puede marcar por primera vez sin pasar por el consentimiento.
- [ ] La vista "Mis marcas" muestra solo las marcas del trabajador autenticado en la demo.
- [ ] El mensaje de privacidad aparece en el simulador y en el panel.
- [ ] No existe ninguna función de seguimiento continuo en el código del prototipo.

---

## 2. Corrección de marcas sin volver a Excel

### Problema de mercado
Incluso con sistemas instalados (ej. GeoVictoria), hay cargos de RR.HH. cuya función
es corregir marcas a mano y armar el reporte en Excel. Si AsisBot obliga a volver a
Excel para corregir, no resolvió el problema.

### Qué construir
- **Corrección desde el panel:** el supervisor/RR.HH. puede corregir una marca
  (hora, estado) indicando motivo obligatorio.
- **Trazabilidad de cada corrección:** quién la hizo, cuándo, valor anterior, valor
  nuevo y motivo. La marca original nunca se borra: queda el historial.
- **Exportación lista para el contador:** reporte mensual en CSV/Excel con, por
  trabajador y día: horas trabajadas, atrasos, marcas corregidas (con motivo) y
  distinción de jornada según la jornada vigente del cliente (referencia: 42 h en Chile
  desde abril 2026, camino a 40 h). El reporte NO liquida sueldos: solo entrega
  asistencia ordenada.

### Criterios de aceptación
- [ ] Corregir una marca exige motivo y deja registro auditable.
- [ ] La marca original sigue visible en el historial.
- [ ] El reporte mensual se exporta en un archivo y contiene horas, atrasos y correcciones.

---

## 3. Reporte para el cliente mandante (evidencia vendible)

### Problema de mercado
En seguridad privada y facility, el cliente que contrata el servicio (mandante,
condominio, bodega, obra) exige prueba de que el guardia o el personal estuvo.
Hoy esa "prueba" muchas veces es una foto suelta en un grupo de WhatsApp.

### Qué construir
- **Vista de reporte por instalación/cliente:** por sitio y por día, con dotación
  esperada, presentes, ausentes, atrasos y marcas con evidencia (foto, ubicación,
  hora). Solo lectura.
- **Enlace/vista compartible de demo:** en el prototipo, una vista pública de
  demostración (datos ficticios) que simule lo que vería el mandante, sin acceso
  al panel interno ni a datos de otros clientes.
- **Sin datos sensibles expuestos:** el reporte del mandante muestra asistencia
  y evidencia de presencia, no datos personales innecesarios ni el historial
  completo del trabajador.

### Criterios de aceptación
- [ ] Existe una vista por instalación/día con presentes, ausentes y atrasos.
- [ ] La vista del mandante no permite editar marcas ni ver otros clientes.
- [ ] El reporte se genera con datos ficticios y está marcado como demo.

---

## 4. Marca tolerante a mala señal (faenas y zonas sin cobertura)

### Problema de mercado
En construcción y terreno, la señal es irregular. Si la marca falla por falta de
cobertura, se pierde la jornada completa en el registro, justo en el entorno
donde más se necesita.

### Qué construir
- **Marca pendiente en el simulador:** si el simulador está en modo "sin señal",
  la marca queda guardada como pendiente, con su hora, foto y ubicación originales,
  y se sincroniza al recuperar señal.
- **Estado visible "por revisar":** toda marca sincronizada tarde queda en la cola
  de revisión, con la marca de tiempo original y la de sincronización, para que
  el supervisor decida con contexto.
- **Sin inventar la hora:** nunca reescribir la hora original con la hora de
  sincronización. Ambas quedan registradas.

### Criterios de aceptación
- [ ] El simulador tiene un modo "sin señal" demostrable.
- [ ] Una marca hecha sin señal aparece después como pendiente y luego como
  "por revisar", conservando su hora original.
- [ ] El supervisor puede aprobarla o rechazarla con motivo.

---

## 5. Anti-trampa honesto, sin prometer "fraude cero"

### Problema de mercado
El marcaje por otro (buddy punching con tarjeta, PIN o clave compartida) es un
dolor real, pero ningún sistema es infalible: foto vieja, ubicación falsa y
errores de GPS existen. Prometer "fraude cero" destruye credibilidad.

### Qué construir
- **Foto en el momento, no de galería:** en el simulador, la subida debe
  distinguirse como "foto tomada ahora" frente a "foto de galería" (en la demo,
  con un selector explícito). La foto de galería genera alerta automática.
- **Detección de duplicados:** dos marcas de entrada en pocos minutos para el
  mismo trabajador generan alerta "Duplicada".
- **Inconsistencia ubicación/hora:** marca fuera de geocerca, o con ubicación
  incoherente con la marca anterior, genera alerta y queda en revisión.
- **Explicación del trabajador:** desde el simulador, el trabajador puede dejar
  un comentario en una marca en revisión ("estaba en el acceso B, sin señal").
  El comentario queda en el historial de la marca.
- **La IA alerta, no sanciona:** ninguna alerta genera una sanción automática.
  Toda anomalía la resuelve una persona, y la tasa de falsos positivos debe
  ser visible en el panel (en el piloto real, el umbral propuesto es <20% en
  la semana 4; en el prototipo, mostrar el contador, no un resultado inventado).

### Criterios de aceptación
- [ ] Foto de galería, duplicado y fuera de geocerca generan alertas distintas.
- [ ] El trabajador puede comentar una marca en revisión.
- [ ] Ninguna alerta cambia el estado a sancionado sin revisión humana.
- [ ] En ningún texto del prototipo aparece "fraude cero", "elimina el fraude"
  ni "garantiza asistencia".

---

## Qué NO construir todavía (fuera de alcance)

Estas funcionalidades se pidieron explícitamente NO agregar en esta etapa, porque
son pelear contra Buk/Talana en su terreno o romper la confianza del producto:

- Liquidación de sueldos o cálculo de remuneraciones (AsisBot exporta asistencia,
  no liquida).
- Rastreo continuo de ubicación o geocerca activa fuera de jornada.
- Relojes de huella, tarjetas RFID o hardware propio.
- Integración nativa con ERP/nómina desde el día 1 (primero exportación limpia).
- Multiempresa real, pagos o autenticación en producción.

## Orden de implementación sugerido

1. Módulo de confianza (sección 1) — sin esto, el resto genera rechazo.
2. Corrección sin Excel (sección 2) — es lo que RR.HH. usa todos los días.
3. Reporte mandante (sección 3) — es el argumento de venta del nicho 1.
4. Marca tolerante a mala señal (sección 4) — imprescindible para construcción.
5. Anti-trampa honesto (sección 5) — completa la cola de revisión del brief original.

## Qué pedirle a la IA con este documento

> "Aplica este documento sobre el prototipo de AsisBot ya descrito en
> `brief-para-ia-prototipo-asisbot.md`, en el orden de implementación indicado.
> Cada mejora debe tener su caso demostrable con datos ficticios y sus criterios
> de aceptación cumplidos. No agregues nada de la lista 'Qué NO construir todavía'
> y no presentes ningún resultado como observado: todo es demo o hipótesis
> a validar en piloto."
