# Notas de integración con Alon Sports API

El documento `README.md` de `/Applications/MAMP/htdocs/OV2/sports/api/` es el contrato técnico de la API; no sustituye los requisitos de producto de esta aplicación. Las rutas privadas ya intentan cargar datos reales tras la sesión; los componentes demo originales se conservan como referencia visual.

## Ya preparado

- `ApiService` usa `https://alon.one/sports/api/v1`, cookies HttpOnly (`withCredentials`) y el header `X-CSRF-Token` en mutaciones.
- Están declarados los accesos base a sesión, CSRF, dashboard, actividades y segmentos.
- El importador tiene el flujo visual para Strava y archivos FIT/GPX/TCX.
- La build está en modo estático y la app incluye `manifest.webmanifest` y `sw.js` para GitHub Pages.

## Integración activa

1. `AuthStore` inicializa `/auth/session` y protege las rutas privadas con un guard.
2. `apiInterceptor` envía cookies y añade `X-CSRF-Token` automáticamente en mutaciones.
3. La URL de OAuth debe redirigir a `/auth/strava` y el callback de Strava debe estar registrado para `https://alon.one/sports/api/v1/auth/strava/callback`.
4. Configurar CORS en `.env.php` con el origen exacto `https://sports.alon.one` y revisar que el backend exponga la API bajo el prefijo `/sports/api/v1`.

## Flujo de login aplicado

- La pantalla de login inicia OAuth solicitando `/auth/strava` y redirige el navegador a `authorization_url`.
- La redirección de la callback (`/?auth=success|error`) se procesa en Angular: en éxito se vuelve a cargar `/auth/session`; en error se muestra `message` y se limpian los parámetros de la URL.
- El interceptor mantiene `withCredentials`, añade CSRF a las mutaciones, redirige a `/login` ante `401` y, ante `419`, refresca `/auth/session` y repite la petición una sola vez.
- La API aún no tiene endpoint de email/contraseña: el botón de login usa OAuth de Strava, que es el flujo descrito en el contrato.

## Ampliaciones de API recomendadas

No son imprescindibles para renderizar la experiencia, pero ayudarían a eliminar lógica de presentación en Angular:

- Un endpoint agregado de detalle de segmento que devuelva explícitamente ranking, evolución temporal y esfuerzos por actividad en una sola respuesta.
- Contratos TypeScript/OpenAPI publicados para tipar `dashboard`, `streams`, `segments`, `strava`, `statistics` y `analysis` sin `unknown`.
- Una respuesta de mapa normalizada (bounds, puntos decodificados o GeoJSON) para evitar que cada cliente implemente decodificación de polilíneas.
- Metadatos de paginación/cursor para `/activities`; el contrato actual solo admite `limit`.
- Endpoint de perfil editable y preferencias, ya que el README describe la sesión del usuario pero no mutaciones de perfil/configuración.
