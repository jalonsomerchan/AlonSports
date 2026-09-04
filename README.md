# Alon Sports

PWA mobile-first para analizar actividades, segmentos y evolución deportiva, inspirada en el lenguaje de uso de Strava. Construida con Angular 22 standalone, signals, Angular Material y CSS responsive.

## Desarrollo

```bash
npm install
npm start
```

La app abre el flujo de sesión en `http://localhost:4200/`. Tras autenticarte con Strava, dashboard, actividades, segmentos y detalle se cargan desde `https://alon.one/sports/api/v1` usando cookies HttpOnly y CSRF.

## GitHub Pages

El proyecto está preparado como aplicación estática para el dominio personalizado `sports.alon.one`:

```bash
npm run build:github
```

Publica el contenido generado en `dist/alonsports/browser` y configura el custom domain `sports.alon.one` en GitHub Pages. El manifest y el service worker se copian desde `public/`.

## Vistas incluidas

- Login y conexión visual con Strava.
- Dashboard con volumen, estadísticas y últimas salidas.
- Historial y detalle de actividad con resumen, mapa, gráficos, estadísticas, segmentos y datos detallados.
- Segmentos propios, ranking personal, evolución, mapa y editor.
- Importación Strava / FIT / GPX / TCX.
- Perfil, preferencias, conexiones, exportación y cierre de sesión.
- Compartir actividad con enlace público, privacidad y caducidad.

La integración y las ampliaciones recomendadas de API están anotadas en [API_NOTES.md](API_NOTES.md).

## Regla de gráficas

Todas las gráficas de datos de la PWA deben implementarse con Chart.js sobre `<canvas>`. No se deben dibujar gráficas manualmente con SVG, rutas geométricas o barras CSS; los componentes reutilizables están en `src/app/chart-components.ts`.
