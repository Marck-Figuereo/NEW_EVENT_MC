# Bingo en el visor

## Cómo verlo

| URL | Qué hace |
|---|---|
| `/BINGO` | Producción: control del visor, WebSocket del juego y datos por `/games` (necesita el backend del bingo) |
| `/BINGO?test=1&venta=20&reiniciar=1` | Prueba: socket simulado y `data/sorteos_prueba_bingo.json`, sin backend |

Parámetros de prueba: `venta=20` (el primer sorteo cierra en 20 s), `intervalo=180` (segundos entre sorteos; en producción lo da el socket), `rapido=4` (animaciones x4), `reiniciar=1` (borra el estado guardado), `debug=1` (HUD).

## Cuándo llega cada cosa

1. **Tiempo** — WebSocket del juego, igual que los demás: `/ws/pos/grupos/<grupo>/games/<bingo>/countdown/` con `countdown.update` (`event_number`, `sorteo_id`, `state`, `seconds_left`, `server_time`, `sales_close_at`, `game_id`, `grupo_id`) y cada cuánto hay sorteo.
2. **Datos del sorteo** — dentro de los 10 s antes de empezar. El visor los pide en ese tramo (`realizar: 'bingo_sorteo'`) o los toma si el socket los empuja. Si al cierre no llegaron, espera 10 s más; si no llegan, muestra "Error al comenzar el sorteo / Espere el próximo sorteo".
3. **Cierre** (`seconds_left` 0 o `state` distinto de `selling`) — empieza la animación del sorteo.
4. **Pantalla SORTEOS** — `realizar: 'bingo_programacion'` al arrancar y después de cada sorteo. Si no trae `proximos`, se calculan con el cierre y el intervalo del socket.
5. **Jackpot** — `realizar: 'consulta_jackpots'` (ya existe) con el game_id del BINGO, cada 20 s en SORTEOS.

Un visor que se enciende con el sorteo ya empezado no lo retoma: espera al siguiente.

## Archivos

```
templates/pv_bingo.html                    escenario 1920x1080 (mismo esquema que pv_ruleta.html)
static/bingo/bingo_integration.css
static/bingo/cone_db_bingo.js              adaptador de datos (API por /games, o JSON con ?test=1). Marca: // >>> AJUSTAR CONTRATO
static/bingo/funcionamiento_bingo.js       ciclo por WebSocket: SORTEOS -> datos a 10 s -> SORTEO -> SORTEOS
views.py                                   realizar 'bingo_programacion' y 'bingo_sorteo'
helpers/display_api_client.py              get_bingo_schedule / get_bingo_draw (rutas PROPUESTAS)
static/bingo/data/sorteos_prueba_bingo.json   datos de PRUEBA (en produccion todo llega de la API)
static/bingo/screens/show-bingo/           el bingo en canvas (solo los assets que usa)
herramientas/bingo_generar_json.py         genera y valida el JSON de prueba
```

## Reglas

Todo lo del sorteo llega de la API: bolas, cartones, ganadores y montos. El visor no calcula
ganadores; solo revisa que los datos cuadren y, si algo no cuadra, lo avisa en consola
(sin esconder nada: manda lo que dice la API).

- Bolas distintas del 1 al 90, como máximo 60. El sorteo dura hasta el BINGO: siempre hay
  BINGO y es la última bola (BINGO en la bola 51 → llegan 51 bolas; el resto de casillas queda vacío).
- Siempre salen los 4 premios (CUATRO, LINEA, DOBLE_LINEA, BINGO).
- Cartón de 15 números (3 filas de 5).
- **CUATRO**: 4 números de una misma fila. **LINEA**: una fila. **DOBLE_LINEA**: dos filas. **BINGO**: cartón lleno.
- Cada premio sale una sola vez, en la primera bola en que algún cartón completa la figura. Si varios la completan en esa bola, se reparte.
- **JACKPOT** (solo del bingo, no se comparte con otros juegos): lo gana el cartón del BINGO si sale antes de la bola 60 (`limite_bola_jackpot: 59`); se muestra con su arte (`win_jackpot.png`). Si el BINGO sale en la bola 60 no hay JACKPOT: el monto se acumula para el siguiente sorteo, sin ningún aviso en pantalla.

## JSON (también es el contrato propuesto para la API)

```jsonc
{
  "config":   { "total_bolas": 60, "numero_min": 1, "numero_max": 90, "limite_bola_jackpot": 59,
                "intervalo_min": 10, "sorteo_inicial": 154 },
  "jackpot":  { "monto_actual": 35600, "monto_base": 10000, "aporte_por_sorteo": 1250,
                "ultimo": { "monto", "fecha": "YYYY-MM-DD", "lugar", "ticket" } },
  "historial": [ { "sorteo", "fecha", "hora": "HH:MM", "premios": { "cuatro", "linea", "doble_linea", "bingo" },
                   "jackpot": false } ],
  "sorteos_especiales": [ { "id", "titulo", "fecha", "hora", "premios": { ... } } ],   // panel de administración
  "sorteos": [ {
      "codigo": "P1", "premios": { ... },
      "bolas": [ hasta 60 números en orden de salida; el último es el del BINGO ],
      "ganadores": [ { "tipo": "CUATRO|LINEA|DOBLE_LINEA|BINGO|JACKPOT", "bola": 1..60, "numero_bola",
                       "lugar", "ticket", "numeros": [15], "monto" } ],
      "seguimiento": [ { "lugar", "ticket", "numeros": [15] } ]     // tablero "mejores cartones"
  } ]
}
```

- `bola` es la posición de salida (1..60), no el número de la bola. Así puede haber varios ganadores en la misma bola.
- `seguimiento`: el visor calcula en vivo cuántos números le faltan a cada cartón y muestra los 12 mejores.
- Los especiales se muestran solo si no han pasado: los 3 más cercanos.
- Los tickets llegan completos; el visor oculta los 6 primeros caracteres.

Los 5 sorteos de prueba rotan: P1 jackpot (BINGO en la bola 50), P2 jackpot con empate en LINEA (bola 51), P3 y P4 BINGO en la bola 60 (el jackpot se acumula; P4 con empate en LINEA), P5 jackpot (bola 56).

## Pendiente (backend)

- Dar de alta el juego `BINGO` (código y `game_url`) y asignarlo a los visores.
- WebSocket del countdown para el bingo, con cada cuánto hay sorteo (nombre del campo por confirmar: el visor acepta `interval_seconds` o lo deduce de dos cierres seguidos).
- Endpoints `api/core/display/bingo/schedule/` y `api/core/display/bingo/draw/` (rutas propuestas en `display_api_client.py`; se cambian ahí si el backend usa otras).
- Si los datos del sorteo se empujan por el socket: el `type` del mensaje (el visor acepta `bingo.draw`, `bingo.draw_data` o `draw.data`).
- Sorteos especiales en el panel de administración.

Detalle: la fuente Bebas no tiene tildes ni Ñ; el visor quita los acentos antes de pintar.
