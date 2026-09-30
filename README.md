# La Misión Topolev

Un juego de navegador en ASCII, en español. Negro, naranja y roca.

## Cómo jugar

- Abre `index.html` en un navegador moderno (doble clic funciona; no hace falta servidor).
- O sírvelo en local: `npx http-server .` y abre `http://localhost:8080`.
- Usa toda la ventana. Mejor con teclado y ratón; en móvil aparece una cruceta táctil.
- La partida se guarda sola en el navegador (`localStorage`). Puedes cerrar y continuar después.
- Todo lo demás está en **Instrucciones**, dentro del juego.

> El documento `plan.md` contiene el diseño completo del juego (con *spoilers*).

## Estructura

```
index.html        página única
css/style.css     tema y capas
js/*.js           motor (sin dependencias ni build)
tools/*.js        pruebas: generación, mecánicas, simulación y capturas con Playwright
```

## Pruebas

```
node tools/genstats.js 60     # accesibilidad y reparto de tiles de 60 semillas × 10 niveles
node tools/mech.js            # mecánicas en escenarios construidos
node tools/sim.js 20          # un bot juega 20 partidas (detecta errores)
NODE_PATH=$(npm root -g) node tools/smoke.js   # arranque en Chromium + capturas en shots/
```
