# Alon Sports: qué falta para acercarse a Strava Premium

> Documento de gap analysis basado en la implementación actual de la PWA, el contrato de la API disponible y las capacidades que Strava incluye actualmente en su suscripción. No pretende ser una copia visual 1:1: el objetivo es identificar qué valor de producto falta para que Alon Sports se sienta como una herramienta premium de entrenamiento.

Fecha de revisión: 2026-09-04

## Veredicto

Alon Sports ya tiene una base sólida de análisis individual: conexión OAuth con Strava, dashboard, historial paginado, detalle de actividad, mapas, métricas, segmentos propios, importación, perfil/preferencias y enlaces públicos.

La diferencia principal con una experiencia premium no está en añadir más tarjetas, sino en cerrar este ciclo:

```text
registrar datos → entender la carga → decidir qué entrenar → planificar → comprobar progreso
```

Hoy la app cubre sobre todo **registrar / consultar**. Falta convertir los datos en decisiones y continuidad de entrenamiento.

## Qué ya existe

- Login OAuth con Strava, sesión HttpOnly, CSRF y guardas de rutas.
- Dashboard con volumen, tendencia de 31 días y últimas actividades.
- Historial de actividades con filtros por deporte y paginación por cursor.
- Detalle de actividad con mapa, métricas, gráficos preparados, estadísticas, segmentos y datos técnicos.
- Comparativas con la media cuando el backend devuelve `comparisons`.
- Segmentos propios: listado, creación básica, detalle agregado, evolución, ranking y mapa.
- Importación FIT, GPX y TCX.
- Sincronización manual con Strava.
- Perfil, preferencias y cierre de sesión.
- Enlace público de actividad con ocultación del inicio del recorrido.

## Gaps prioritarios

| Prioridad | Área | Falta hoy | Base disponible | Resultado premium esperado |
| --- | --- | --- | --- | --- |
| P0 | Carga y estado físico | No hay una vista real de `Fitness & Freshness`, fatiga, forma, carga semanal ni rango recomendado. El anillo del dashboard muestra `74%` fijo. | `/statistics`, `/analysis`, `/training-load`; datos de pulso/esfuerzo en actividad. | Un resumen que responda “¿cómo estoy?” y “¿cuánto puedo apretar esta semana?”. |
| P0 | Objetivos y calendario | No se pueden crear ni seguir objetivos de distancia, tiempo, desnivel o actividades; tampoco hay calendario de descanso, enfermedad o entrenamientos planificados. | `/goals`, `/calendar`, `/planned-workouts`. | Progreso visible, rachas, objetivos con fecha y próxima sesión clara. |
| P0 | Análisis profundo de actividad | La pestaña Gráficos solo muestra el mapa y un mensaje; no pinta streams interactivos de ritmo, pulso, altitud, cadencia o potencia. | `streams`, `laps`, `zones`, `achievements`, `milestones`; `/compare`. | Gráficos con tooltip, zoom, zonas, parciales, GAP y comparación contra PR/otra actividad. |
| P0 | Progreso histórico | El dashboard resume el volumen, pero no hay una vista dedicada de estadísticas, récords, mejores esfuerzos, tendencias por deporte ni comparación mensual. | `/statistics`, `/analysis`. | Una sección “Progreso” que convierta meses de datos en una historia entendible. |
| P1 | Rutas | No hay listado, creador completo, waypoints, detalle, exportación GPX/TCX, rutas sugeridas, heatmap personal ni mapas offline. | `/routes`, `/maps/routes/{routeId}`, `/heatmap`, `/matched-routes`. | Descubrir, guardar, preparar y reutilizar recorridos antes de salir. |
| P1 | Segmentos competitivos | Los segmentos propios funcionan en modo básico, pero faltan editar, borrar, recalcular, objetivos, grupos, orden, segmentos de Strava, favoritos, exploración por mapa y leaderboards filtrables. | `/segments/{id}` PUT/DELETE/recalculate/goal, `/segment-groups`, `/strava/segments`, `/strava/segments/explore`. | Pasar de “mis tramos” a un ecosistema de competición y mejora continua. |
| P1 | Edición y diario de actividad | No hay experiencia UI para nombre, etiquetas, notas, esfuerzo percibido, molestias, tipo de sesión, compañeros, meteorología, refresco desde Strava, borrado, recorte, división o unión. | `/activities/{id}`, `/labels`, `/notes`, `/weather`, `/refresh`, `/crop`, `/split`, `/merge`. | Poder corregir, contextualizar y aprender de cada salida sin salir de la actividad. |
| P1 | Entrenamiento guiado | No hay planes, sesiones estructuradas, bloques, intensidad ni una acción de “enviar al dispositivo”. | `/planned-workouts`; la API define bloques e intensidad. | La app deja de ser solo un diario y acompaña el siguiente entrenamiento. |
| P1 | Comparación de recorridos | No existe una pantalla explícita para matched activities ni comparar dos actividades con sus streams alineados. | `/matched-routes`, `/compare?one=&two=`. | Ver dónde se ganó o perdió tiempo en el mismo recorrido. |
| P2 | Grabación y seguridad | La PWA no ofrece grabación GPS en directo, datos de rendimiento en tiempo real, Beacon ni flujo de emergencia. | `/recordings` permite guardar una actividad grabada; el resto requiere producto/integración adicional. | Cubrir el antes, durante y después de la actividad. |
| P2 | Comunidad y motivación | No hay feed, seguidores, kudos, clubes ni retos de grupo. | No se observan endpoints equivalentes en el contrato disponible; compartir actividad sí existe. | Añadir accountability social sin convertir el producto en una red social completa de entrada. |
| P2 | Offline y sincronización | Existe service worker, pero no una política completa de caché, sesión offline, cola de mutaciones, progreso de sincronización ni recuperación de reintentos. | Notas de integración y `POST /activities/sync`. | La experiencia es fiable en móvil y con mala cobertura. |

## Detalle de lo que debería construirse

### 1. Dashboard premium / “Progreso"

Sustituir el indicador fijo del dashboard por datos calculados y explicables:

- carga de entrenamiento de la semana y de las últimas 6–8 semanas;
- esfuerzo relativo basado en pulso o percepción de esfuerzo;
- estado de fitness, fatiga y frescura;
- comparación contra la media de 3 semanas;
- objetivos activos y porcentaje completado;
- próxima sesión planificada y recomendación sencilla de recuperación;
- filtros por deporte, periodo y unidad;
- estados sin datos, datos insuficientes y última sincronización.

**Criterio de terminado:** el usuario puede abrir el dashboard y entender su carga actual, su tendencia, su objetivo y la siguiente acción sin interpretar varias gráficas por su cuenta.

### 2. Análisis de actividad que justifique el producto

La pestaña `Gráficos` debería mostrar, según los streams existentes:

- ritmo/velocidad, frecuencia cardíaca, altitud, cadencia y potencia;
- selección de series y escalas sincronizadas con la posición del mapa;
- laps y parciales de 1 km/500 m cuando existan;
- zonas de pulso, ritmo y potencia;
- GAP para carrera y explicación de cómo se calcula;
- logros, mejores esfuerzos y milestones destacados;
- botón para comparar con PR, actividad emparejada o actividad seleccionada;
- exportación o compartición de un resumen visual.

**Criterio de terminado:** una actividad con streams permite localizar visualmente un cambio de ritmo, pulso o desnivel y relacionarlo con un punto del recorrido.

### 3. Objetivos, calendario y plan

Crear una navegación de primer nivel “Progreso” o “Plan” con:

- objetivos semanales, mensuales y anuales por deporte;
- objetivos de distancia, tiempo, desnivel, número de actividades y segmentos;
- calendario mensual con actividad realizada, descanso, lesión, viaje y sesión planificada;
- creación de entrenamientos con bloques, duración, distancia e intensidad;
- progreso acumulado y previsión de cumplimiento;
- recordatorios y estados de objetivo alcanzado, retrasado o pausado.

**Criterio de terminado:** el usuario puede definir un objetivo, ver qué le falta y planificar la sesión que le acerca a él.

### 4. Rutas y exploración

La vista de mapas debería crecer desde “ver mi recorrido” hacia “preparar mi próxima salida”:

- guardar y renombrar rutas;
- editar waypoints y añadir fuente, avituallamiento o punto de interés;
- ver distancia, desnivel y tiempo estimado;
- exportar GPX/TCX;
- rutas emparejadas y recorridos habituales;
- heatmap personal por deporte y año;
- exploración de segmentos cercanos por bounds;
- descarga offline y aviso de última actualización.

**Importante:** el editor de segmentos actual usa una ruta de ejemplo para la previsualización. Debe seleccionar puntos sobre el mapa real de la actividad antes de considerarse una experiencia premium.

### 5. Segmentos al nivel de Strava

- ranking personal con PR, última marca y objetivo;
- comparación entre esfuerzos de dos fechas;
- filtros por periodo, deporte y tipo de esfuerzo;
- favoritos y segmentos de Strava cercanos;
- objetivos de tiempo, velocidad, intentos mensuales o mejora;
- grupos de segmentos y orden personalizado;
- edición, borrado y recalculado con confirmación y feedback de progreso;
- live segment únicamente si se incorpora grabación/dispositivo compatible.

### 6. Edición, privacidad y confianza

- editar nombre, deporte, etiquetas, notas, esfuerzo percibido y tipo de entrenamiento;
- mostrar meteorología y permitir corregirla;
- refrescar una actividad desde Strava sin duplicarla;
- recortar, dividir, unir y borrar con confirmación clara y posibilidad de recuperación si el backend lo permite;
- granularidad de privacidad para inicio, final, nombre, hora y métricas;
- mostrar fuente, fecha de sincronización y estado de datos incompletos;
- mensajes de error accionables y reintento para cada mutación.

## Orden recomendado de ejecución

### Fase 1 — convertir datos en decisiones

1. Tipar los contratos (`contracts.ts` / OpenAPI) y normalizar estados de carga y error.
2. Integrar `/statistics`, `/analysis` y `/training-load`.
3. Rehacer el dashboard con carga real, objetivos y última sincronización.
4. Construir gráficos de streams, zonas, laps y comparación.
5. Añadir objetivos básicos y calendario.

### Fase 2 — mejorar la exploración

1. Rutas guardadas, waypoints y exportación.
2. Heatmap personal, matched routes y comparación de actividades.
3. Editor de segmentos sobre el mapa real.
4. Objetivos, grupos, favoritos y exploración de segmentos.

### Fase 3 — completar el ciclo de entrenamiento

1. Edición/diario de actividad y operaciones GPS.
2. Entrenamientos planificados y planes.
3. Offline robusto, cola de sincronización y progreso de importación.
4. Grabación en dispositivo y funciones de seguridad.
5. Comunidad, retos y accountability.

## Señales de calidad premium

- Ningún número importante es decorativo o fijo: `74%` debe desaparecer o venir de una métrica explicada.
- Cada dato debe tener periodo, unidad, fuente y fecha de actualización.
- Cada gráfica debe responder a una pregunta: carga, progreso, comparación o decisión.
- Los estados vacíos deben explicar qué falta y ofrecer una acción.
- Las mutaciones deben tener feedback, reintento y protección contra duplicados.
- Las pantallas móviles deben priorizar una acción principal y mantener targets táctiles cómodos.
- La accesibilidad necesita validación real de teclado, foco, lectores de pantalla, contraste y motion; no puede darse por garantizada solo por el aspecto visual.

## Referencia de benchmark

La lista de capacidades premium se contrasta con la documentación oficial de Strava, que incluye leaderboards y esfuerzos de segmentos, objetivos, esfuerzo relativo, Fitness & Freshness, Training Log, matched activities, estadísticas acumuladas, GAP, zonas, análisis de workouts/potencia/ritmo, planes, rutas, heatmaps, mapas offline, retos y meteorología:

- [What Features Are Included in a Strava Subscription?](https://support.strava.com/en-us/articles/15402044-what-features-are-included-in-a-strava-subscription)
- [Relative Effort](https://support.strava.com/en-us/articles/15401794-relative-effort)
- [Goals on the Strava Website](https://support.strava.com/en-us/articles/15401848-goals-on-the-strava-website)

## Límites de esta revisión

- Se ha revisado el código y el contrato local disponible, además de la pantalla de acceso capturada en la ejecución actual.
- No se ha podido validar una sesión autenticada real contra todos los datos de producción.
- La apariencia visual ya está cuidada, pero este documento prioriza gaps de producto, interacción y datos; no sustituye una auditoría exhaustiva de accesibilidad o responsive.
- La disponibilidad exacta de funciones de Strava puede cambiar por país, plataforma o tipo de suscripción.
