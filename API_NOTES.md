# Notas de integración con Alon Sports API

El contrato técnico del backend está en `README.md` y `openapi.yaml` dentro de `/Applications/MAMP/htdocs/OV2/sports/api/`. La PWA consume `https://alon.one/sports/api/v1`, mantiene la sesión en cookies HttpOnly y deja los identificadores de la API como valores opacos.

## Integración implementada en la PWA

- `AuthStore` inicializa `/auth/session`, conserva el CSRF y protege las rutas privadas.
- El interceptor envía `withCredentials`, añade `X-CSRF-Token` en mutaciones, redirige ante `401` y reintenta una vez tras renovar la sesión en `419`.
- El login usa `/auth/strava` y procesa `/?auth=success|error` sin exponer tokens en el navegador.
- Dashboard y actividades consumen datos reales. `/activities` usa `limit` y el cursor opaco de `pagination.next_cursor`; la vista permite filtrar por deporte y cargar la siguiente página.
- El detalle de actividad usa `map.points` del mapa normalizado, con fallback a `streams.latlng.data` únicamente para respuestas antiguas o incompletas.
- El detalle de segmento usa `/segments/{segmentId}/detail` para récord, media, esfuerzos, evolución y mapa normalizado.
- Perfil y preferencias se cargan desde `/profile` y se guardan con `PUT /profile` y `PUT /preferences`.
- Importación FIT/GPX/TCX usa `POST /activities/import`, valida el límite de 25 MB y envía `name`, `sport_type`, `date` y `activity_file`.
- La acción de sincronización usa `POST /activities/sync` y refresca el dashboard, actividades y segmentos.
- El editor de segmento usa `POST /segments` y valida que el intervalo tenga al menos tres puntos.
- Compartir actividad usa `GET/POST /activities/{activityId}/share`, respeta `hide_start` y permite copiar o compartir el enlace público.

## Pendiente de integrar en la interfaz

Estas rutas ya existen en el contrato, pero aún no tienen una experiencia completa en la PWA:

- Edición de nombre/etiquetas, notas, percepción de esfuerzo, meteorología, refresco desde Strava y borrado de actividad (`PUT`, `/labels`, `/notes`, `/weather`, `/refresh`, `DELETE`).
- Estadísticas y análisis históricos (`/statistics` y `/analysis`) en una vista dedicada, incluyendo carga de entrenamiento, récords e insights.
- Objetivos de segmento (`PUT /segments/{segmentId}/goal`), edición y borrado de segmentos, recalculado, grupos y orden personalizado.
- Selección visual de puntos sobre el mapa real de una actividad al crear o editar un segmento; el editor actual envía índices, pero su previsualización aún usa la ruta de ejemplo.
- Rutas locales: listado, editor de waypoints, detalle y exportación GPX/TCX (`/routes`).
- Segmentos de Strava: atleta, favoritos, sincronización y exploración por bounds.

## Nuevas mejoras necesarias

- Generar un cliente TypeScript desde `openapi.yaml` o publicar tipos versionados para dejar de usar `unknown`/`Record<string, any>` en dashboard, detalle, streams, estadísticas y análisis.
- Estandarizar en todos los endpoints los estados de carga, errores `ApiError` y mensajes de validación para que la PWA pueda mostrar acciones de recuperación concretas.
- Añadir `ETag`/`Last-Modified` a dashboard, actividades, mapas y estadísticas; la PWA puede revalidar caché sin descargar de nuevo payloads grandes.
- Definir una política de caché del service worker: lectura offline de la última sesión y datos, actualización visible del worker y exclusión explícita de OAuth y mutaciones.
- Añadir idempotencia a sincronización e importación para evitar duplicados al reintentar desde una conexión móvil inestable.
- Versionar los cambios de preferencias y devolver la preferencia persistida en cada actualización para mantener coherencia entre pestañas.
- Documentar límites de frecuencia y tiempos esperados de sincronización de Strava, junto con un estado de progreso consultable si la sincronización pasa a ser asíncrona.
