# LA MISIÓN TOPOLEV — Plan de desarrollo

> ⚠️ **SPOILERS**: este documento describe el juego completo. Es la hoja de ruta
> técnica para las sesiones de desarrollo. Si quieres que el juego sea una
> sorpresa, no sigas leyendo: abre `index.html` y juega.

Leyenda: `[x]` hecho · `[ ]` pendiente · `[~]` parcial / mejorable

---

## 0. Documento de diseño

### 0.1 Premisa
- 1970, península de Kola. La Academia de Ciencias de la URSS lanza la
  **Misión Topolev**: el **KT-1 «Topolev»** (de *topo*), una perforadora
  subterránea autopropulsada, debe descender más allá de donde nadie ha llegado
  para averiguar el origen de la *anomalía acústica* (los "gritos" que captan
  los micrófonos del pozo — guiño a la leyenda del *Pozo al Infierno* de Kola).
- El jugador pilota el Topolev a través de **10 horizontes** (niveles)
  procedurales. Cada horizonte ≈ 1.226 m. El décimo termina a **12.262 m**
  (récord real del pozo de Kola), donde espera **La Cámara** (final).
- Moscú exige un **Plan Quinquenal** (cuota de mineral) en cada horizonte.
  Cumplirlo = **Orden** (medalla con ventaja permanente). Fallarlo =
  **Reprimenda**. Tres reprimendas = la misión se cancela (derrota: "Gulag").

### 0.2 Género y bucle
Roguelike por turnos de excavación (mezcla de *Boulder Dash* + *Motherload* +
gestión de recursos), con permadeath y botín procedural.

Bucle de horizonte: **descender → perforar / explorar / recoger mineral y
suministros → gestionar calor, combustible y casco → llegar a la Estación Relé
del fondo → vender / entregar cuota / reparar / mejorar módulos (drag & drop)
→ descender al siguiente horizonte**.

*Easy to learn*: flechas para moverse/perforar; cuanto más denso el glifo
(`░ ▒ ▓ █`), más duro. *Hard to master*: calor ambiental creciente, gases que
explotan si perforas en caliente, cantos rodados con física, agua que enfría
y apaga magma, gusanos atraídos por el ruido, economía cuota-vs-venta,
sinergias de módulos procedurales.

### 0.3 Recursos del Topolev
- **Casco** (HP). 0 = destrucción.
- **Combustible**. Moverse y perforar consume. 0 = varado (derrota).
- **Calor**. Sube al perforar; tiende hacia el *calor ambiental* (crece con la
  profundidad). ≥100 → daño al casco cada turno. Esperar enfría más. El agua
  enfría. El magma cercano calienta. El uranio en bodega irradia calor.
- **Bodega**: capacidad de mineral.
- **Dinamita**: carga de 3 turnos, radio 1 (rompe todo salvo lecho/hormigón).
- **Sonar**: revela un radio grande, cuesta combustible, hace ruido (atrae
  gusanos), recarga de 5 turnos.

### 0.4 Subsuelo (tiles)
| Tile | Glifo | Notas |
|---|---|---|
| Vacío / caverna | ` ` | transitable |
| Tierra | `░` | dureza 1 |
| Roca | `▒` | dureza 2 |
| Granito | `▓` | dureza 4 |
| Basalto | `█` gris | dureza 7, broca nivel 2 |
| Obsidiana | `▓` violeta | dureza 9, broca nivel 3 (nace de agua+magma) |
| Lecho rocoso | `#` | indestructible (bordes) |
| Hormigón | `═║╔╗` | paredes de la estación, indestructible |
| Canto rodado | `●` | cae, rueda, aplasta; se puede empujar en horizontal |
| Agua | `≈` azul | fluye; enfría; apaga magma → obsidiana + vapor |
| Magma | `≈~` rojo | intransitable, calienta; profundo |
| Gas | `°∙` verde | explota si perforas cerca con calor ≥ 50 o con dinamita; reacción en cadena |
| Hierro/Cobre/Oro/Uranio/Topolevita | `• ¤ $ § ◊` | mineral incrustado |
| Bidón | `Б` | +combustible |
| Caja de suministros | `?` | módulo procedural / dinamita / reparación |
| Estación | `★` | fin de horizonte |
| Gusano (Olgói-Jorjói) | `@ooo` | enemigo, excava tierra/roca, atraído por ruido |

### 0.5 Procedural
- Mapas: ruido fBm (dureza por estratos) + autómata celular (cavernas) +
  vetas de mineral por paseo aleatorio + bolsas de gas + lagos (agua/magma
  asentados con simulación) + cantos + suministros + sala de estación.
  Semilla reproducible. Comprobación de accesibilidad (BFS) y corredor de
  emergencia si hace falta.
- Módulos: generador de nombres soviéticos (tipo + modelo cirílico + epíteto),
  rareza (Estándar / Reforzado / Heroico / Experimental) y estadísticas
  escaladas por profundidad. Auxiliares con efectos especiales.
- Cuotas, telegramas y eventos (temblores) procedurales.

### 0.6 Estética
- Negro + naranja (variaciones), especiales: cian (topolevita/experimental),
  rojo (peligro/estación), verde (uranio/gas), azul (agua), dorado (oro).
- Todo lo visible es texto monoespaciado (canvas con `fillText` para el mapa y
  partículas; DOM monoespaciado con marcos de caracteres para la interfaz).
- Capa "moderna": rollovers, tooltips, drag & drop, partículas ASCII,
  interpolación de movimiento, sacudida de cámara, iluminación con caída,
  barras animadas, transiciones, efecto CRT opcional.

### 0.7 Arquitectura
Web estática sin build (abrir `index.html` funciona, sin módulos ES).
Espacio de nombres global `TP`.

```
index.html
css/style.css
js/util.js        RNG con semilla, ruido, helpers
js/data.js        tiles, minerales, textos, tablas
js/items.js       generador procedural de módulos + stats derivados
js/gen.js         generador de horizontes
js/audio.js       sintetizador WebAudio
js/particles.js   sistema de partículas ASCII
js/save.js        localStorage (partida, récords, opciones)
js/world.js       lógica de juego (turnos, física, IA, acciones)
js/render.js      render ASCII del mapa en canvas + cámara
js/ui.js          HUD, tooltips, drag & drop, pantallas, estación
js/main.js        arranque, bucle, input
```

---

## FASE 1 — Esqueleto técnico
- [x] 1.1 `index.html` con canvas de mapa, canvas de FX y capas DOM
- [x] 1.2 `css/style.css`: tema negro/naranja, tipografía monoespaciada, CRT
- [x] 1.3 `util.js`: RNG mulberry32 con semilla, hash, ruido de valor + fBm, helpers
- [x] 1.4 Bucle `requestAnimationFrame`, redimensionado a pantalla completa
- [x] 1.5 Máquina de estados de pantallas (título, instrucciones, archivo, opciones, juego, estación, fin)

## FASE 2 — Render ASCII
- [x] 2.1 Tabla de tiles con glifos/colores (`data.js`)
- [x] 2.2 Render de rejilla con cámara que sigue al jugador (lerp suave)
- [x] 2.3 Niebla de guerra: no visto / recordado (atenuado) / visible (luz con caída)
- [x] 2.4 Animación de tiles (magma, agua, gas, topolevita, uranio, cajas)
- [x] 2.5 Hormigón con autoconexión de caracteres de caja
- [x] 2.6 Rollover de celda (inversión) + regla de profundidad lateral

## FASE 3 — Generación procedural de horizontes
- [x] 3.1 Estratos por fBm con perfil por horizonte
- [x] 3.2 Cavernas por autómata celular
- [x] 3.3 Cantos rodados, agua y magma (asentados por simulación)
- [x] 3.4 Bolsas de gas, vetas de mineral por profundidad
- [x] 3.5 Bidones y cajas; sala de la estación; bordes de lecho
- [x] 3.6 Validación de accesibilidad + corredor de emergencia
- [x] 3.7 Cuota del horizonte según mineral disponible
- [x] 3.8 Horizonte final: La Cámara

## FASE 4 — Núcleo jugable
- [x] 4.1 Jugador: mover, perforar (dureza/potencia/nivel), orientación
- [x] 4.2 Combustible, calor (ambiental, espera, agua, magma, uranio), casco
- [x] 4.3 Gravedad del Topolev (se agarra a paredes; cae en el vacío; daño por caída)
- [x] 4.4 Física de cantos (caer, rodar, aplastar, empujar)
- [x] 4.5 Física de agua + reacción agua/magma → obsidiana + vapor
- [x] 4.6 Gas y explosiones en cadena; dinamita
- [x] 4.7 Sonar (revelar, ruido, recarga)
- [x] 4.8 Recogida: mineral a bodega, bidones, cajas (botín)
- [x] 4.9 Visión con línea de visión, memoria de mapa
- [x] 4.10 Registro de mensajes
- [x] 4.11 Condiciones de derrota (casco, combustible, reprimendas)

## FASE 5 — Amenazas
- [x] 5.1 Gusanos: despertar por ruido, BFS hacia el jugador, excavan, muerden
- [x] 5.2 Combate: embestir con la broca, cantos y explosiones les dañan
- [x] 5.3 Temblores (horizonte ≥ 4): derrumbes de techo

## FASE 6 — HUD e interacción
- [x] 6.1 Panel lateral ASCII: horizonte, profundidad, barras animadas
- [x] 6.2 Bodega, módulos equipados, dinamita/sonar, plan quinquenal, registro
- [x] 6.3 Tooltips (rollover) en mapa, módulos, minerales, botones
- [x] 6.4 Clic en celda adyacente = actuar; clic lejano = autoruta (BFS por celdas vistas)
- [x] 6.5 Drag & drop de módulos en el HUD (equipar / reciclar en campo)
- [x] 6.6 Controles táctiles básicos (cruceta en pantalla)

## FASE 7 — Ítems procedurales
- [x] 7.1 Generador de módulos (tipo, rareza, stats por profundidad, nombre)
- [x] 7.2 Stats derivados (módulos + medallas)
- [x] 7.3 Efectos especiales de auxiliares (10 efectos)
- [x] 7.4 Botín de cajas

## FASE 8 — Estación Relé
- [x] 8.1 Pantalla de estación con telegrama (máquina de escribir)
- [x] 8.2 Drag & drop de minerales a MERCADO (vender) o PLAN (cuota)
- [x] 8.3 Servicios: reparar, repostar, comprar dinamita
- [x] 8.4 Tienda procedural (3 módulos) + taller drag & drop + reciclar
- [x] 8.5 Resolución de cuota: Orden (ventaja) o Reprimenda
- [x] 8.6 Descender: transición animada y nuevo horizonte

## FASE 9 — Partículas y "juice"
- [x] 9.1 Sistema de partículas ASCII (espacio mundo y pantalla)
- [x] 9.2 Escombros, chispas, vapor, explosión, anillo de sonar, burbujas, ascuas
- [x] 9.3 Mineral volando al HUD, textos flotantes de daño/ganancia
- [x] 9.4 Sacudida de cámara, destellos, interpolación de cantos
- [x] 9.5 Hover de menús con chispas; transiciones de pantalla

## FASE 10 — Meta y pantallas
- [x] 10.1 Pantalla de título con logo ASCII animado y fondo procedural
- [x] 10.2 Instrucciones (pestañas: misión, controles, recursos, subsuelo, estación, consejos)
- [x] 10.3 Archivo (récords) y Opciones
- [x] 10.4 Briefing inicial (telegrama)
- [x] 10.5 Game over (causa + estadísticas) y final (La Cámara)
- [x] 10.6 Semilla personalizada / expedición del día

## FASE 11 — Guardado
- [x] 11.1 Serializar/deserializar partida completa en localStorage
- [x] 11.2 Autoguardado (cada N turnos, estación, al cerrar pestaña)
- [x] 11.3 Continuar desde el título; permadeath borra la partida
- [x] 11.4 Récords y opciones persistentes

## FASE 12 — Audio
- [x] 12.1 Sintetizador WebAudio (perforar, pasos, recoger, explosión, sonar, daño, UI, teletipo)
- [x] 12.2 Opción de sonido y volumen

## FASE 13 — QA y balance
- [x] 13.1 Prueba automatizada con Playwright (arranque, sin errores de consola, capturas)
- [x] 13.2 Simulación de generación de 100 semillas × 10 horizontes (accesibilidad)
- [ ] 13.3 Balance de economía y dificultad (primer ajuste hecho; requiere más partidas humanas)
- [x] 13.4 Rendimiento (render sólo del viewport)

## FASE 14 — Documentación
- [ ] 14.1 `README.md` (cómo jugar/ejecutar, sin spoilers)

---

## Ideas futuras (backlog)
- [ ] Modo infinito tras el final
- [ ] Más enemigos (sondas americanas del Proyecto Mohole, cristalinos)
- [ ] Artefactos de lore coleccionables (cintas de audio)
- [ ] Logros / desbloqueos entre partidas
- [ ] Música generativa
