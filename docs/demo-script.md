# Guion de demo — AsisBot (5 minutos)

> Antes de empezar: abre la app y pulsa **“Reiniciar demo”** (vista Simulador WhatsApp)
> para restaurar los datos semilla ficticios.

## 1. El problema (1 min)

- Vista **Panel en vivo**.
- Mensaje: “Personal en terreno sin un sistema simple de asistencia. Las planillas se
  rellenan a mano y el supervisor no sabe quién llegó, dónde ni cuándo.”
- Señalar el **estado de hoy**: presentes, en revisión, ausentes — y las **líneas de
  jornada**: cada trabajador tiene su franja de horario con las marcas de entrada y salida.
- Aclarar (banner visible): todo es **demo con datos ficticios**; los indicadores de
  impacto son **metas proyectadas**, no resultados observados.

## 2. El trabajador marca entrada (1 min)

- Vista **Simulador WhatsApp**.
- Elegir **Daniela Muñoz Vera** (ausente) y pulsar **“Marcar entrada”**.
- Elegir ubicación **“Dentro de la zona”** y la **selfie (yo)**.
- AsisBot responde: **identidad verificada (~92%) · dentro de Obra Balmaceda · Aprobada**.
- Mensaje: “Sin instalar nada: el trabajador ya sabe usar WhatsApp.”

## 3. El panel y el mapa (1 min)

- Volver a **Panel en vivo**: Daniela aparece **Presente**, su línea de jornada empezó a
  llenarse y en el **mapa** aparece un punto verde dentro de la geocerca verde.
- Señalar las dos geocercas: **Obra Balmaceda** y **Bodega Central** (radio autorizado).
- Mostrar el caso ya poblado: **José Fuentes** está **Fuera de zona** (punto ámbar lejos
  de su geocerca) y la sidebar muestra **Cola de revisión 2**.

## 4. Casos anómalos (1 min)

- En **Simulador WhatsApp**, ejecutar:
  - **Caso 3 · Posible suplantación**: la selfie de Carlos coincide solo ~60% → queda
    **En revisión** y el chat lo informa.
  - **Caso 2 · Fuera de zona**: Daniela marca desde la otra obra → alerta
    “Fuera de zona” (a km del radio de 200 m).
- Ir a **Panel en vivo**: ambos cambian a estado **En revisión / Fuera de zona** y hay
  puntos ámbar en el mapa.

## 5. Decisión humana, auditoría y reporte (1 min)

- Vista **Cola de revisión**: abrir un caso → **Aprobar** (o **Rechazar**) con un motivo
  (“La selfie no corresponde al trabajador; se solicita re-marcación”).
- Mostrar que la decisión queda en **Decisiones recientes** con usuario, fecha y motivo.
- Vista **Alertas**: filtrar por tipo y estado; resolver una alerta con nota.
- Vista **Reportes**: jornadas por trabajador/día con horas y atrasos → **Exportar CSV**
  (abre el archivo descargado).
- Cierre: en producción, integración real con WhatsApp Cloud API + motor biométrico;
  la decisión final siempre es humana. **Metas proyectadas**: −70% de tiempo
  administrativo, trazabilidad >95%. Próximo paso: piloto real con una pyme.

## Casos demo (reproducibles a cualquier hora)

| # | Caso | Resultado esperado |
|---|------|--------------------|
| 1 | Marcación normal dentro de zona, selfie correcta | Aprobada |
| 2 | Marcación desde la otra obra | En revisión · Fuera de zona |
| 3 | Selfie de otra persona (similitud simulada < 75%) | En revisión · Posible suplantación |
| 4 | Doble envío en menos de 5 minutos | Rechazada · Duplicada |
| 5 | Entrada después del horario + 10 min de tolerancia | Aprobada · alerta de atraso |

Los casos usan una **hora simulada** (08:05–08:50) para funcionar a cualquier hora del día.
Tras presentar, pulsa **Reiniciar demo** para dejar el estado inicial.
