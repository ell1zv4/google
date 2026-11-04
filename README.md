# RISB

Portal estático con 24 juegos integrados, las 116 entradas del catálogo original y 43 accesos a sitios de fútbol, ropa, música, vídeo, herramientas y aprendizaje.

## Probar en local

```sh
python scripts/serve.py
```

Abre `http://127.0.0.1:8767` y escribe `risb-local` en la portada. Es una clave de demostración que solo acepta el servidor local de pruebas, enlazado a `127.0.0.1`. La función de autenticación de Netlify y la entrada publicada no se modifican.

No hay dependencias ni compilación para los juegos o el portal. El servidor de pruebas sirve `.mjs` con el tipo JavaScript correcto también en Windows.

## Verificación

Requiere Node.js 22+ y Python 3:

```sh
node --test tests/*.test.mjs
python tests/serve_test.py
git diff --check
```

Con el servidor local activo, la comprobación de navegador usa Playwright CLI (herramienta de desarrollo, no dependencia de la web):

```sh
npx --yes --package @playwright/cli playwright-cli -s=risb open http://127.0.0.1:8767
npx --yes --package @playwright/cli playwright-cli -s=risb run-code --filename=tests/browser-smoke.js
npx --yes --package @playwright/cli playwright-cli -s=risb run-code --filename=tests/browser-resilience.js
```

Prueba el acceso local, los 24 juegos, reinicios y cierre con Escape, devolución del foco, victorias de tres en raya/cuatro en raya, pantalla completa, favoritos persistentes, recientes, estados vacíos, enlaces externos y tamaños de escritorio/móvil. Durante las partidas bloquea las solicitudes a otros orígenes para comprobar que los juegos propios no dependen de webs de terceros. Las capturas se guardan en `output/playwright/`.

La comprobación de resiliencia añade almacenamiento denegado, controles táctiles, un intento de palabra, pulsación anticipada en el juego de reacción y una pantalla de 320 píxeles.

## Archivos

- `search.html` y `lens.html`: entrada al portal y al catálogo, con el control de sesión existente.
- `portal.mjs`, `portal.css`, `portal-state.mjs`: interfaz, reproductor, búsqueda y preferencias locales.
- `games/`: juegos propios y limpieza compartida de eventos/temporizadores.
- `catalog.mjs`: títulos, imágenes y destinos de las 116 entradas originales.
- `directory.mjs`: enlaces a servicios oficiales; no incrusta tiendas ni emisiones.

Favoritos, recientes y récords se guardan en el navegador. Si el almacenamiento no está disponible, la sesión sigue funcionando en memoria. Los juegos externos siguen dependiendo de sus proveedores; los servicios de vídeo pueden exigir una cuenta, suscripción o disponibilidad regional. La web no cambia las políticas de Blocksi o ChromeOS.

## Publicación

La web mantiene la estructura estática y las funciones existentes de Netlify. Publicar la rama de GitHub no sustituye por sí solo la versión de producción: revisar el deploy preview, si está habilitado, y fusionar la PR para usar el despliegue habitual del proyecto.
