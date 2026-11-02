# DEMP LottoView · Visor de loterías

## Cómo verlo

| URL | Qué hace |
|---|---|
| `/LOTERIA` | Rotación normal. Por ahora con datos de PRUEBA (simulados en `cone_db_loterias.js`). |
| `/LOTERIA?hora=20:40` | Simula esa hora (estados CIERRE / CIERRA EN / ESPERANDO / RESULTADO). |
| `/LOTERIA?fecha=2026-10-21&hora=20:38` | Simula día y hora. |
| `/LOTERIA?escena=horarios` | Fija una escena (`quinielas`, `modalidades`, `horarios`). Con `&pagina=2` fija la página de quinielas. |
| `/LOTERIA?demo=1` | Lanza solos resultados y jugadas QR de ejemplo. |

Teclado: `←` `→` cambia de escena · `R` resultado · `J` jugada QR.
A las 8:58 PM (simulado) salen juntos Leidsa, Kino, Pega 3 y Pool: `/LOTERIA?hora=20:57:50`.

## Archivos

```
templates/pv_loteria.html                     escenario 1920x1080, <base href="/static/loteria/">
static/loteria/css/visor_tv.css
static/loteria/js/config_visor.js             marca (DEMP LOTTOVIEW), QR, tiempos, api.url (null = prueba)
static/loteria/js/catalogo_loterias.js        casas, sorteos, cierres, horas, colores, logos, fondos, modalidades
static/loteria/js/cone_db_loterias.js         adaptador de datos (API o simulador). Marca: // >>> AJUSTAR CONTRATO
static/loteria/js/funcionamiento_visor.js     escenas, rotación, reloj, capas
static/loteria/js/vendor/qrcode.js            QR (MIT, Kazuhiko Arase)
static/loteria/img/  fonts/                   fondos, bolas, logos, marca/demp.svg, fuentes locales
views.py                                      def LOTERIA -> pv_loteria.html
urls.py                                       path('LOTERIA', ...)
```

`config_visor.js` se une a `window.VISOR_CONFIG` de la plantilla (trae `wsUrl` para `control_visor.js`), no lo reemplaza.

## Escenas

1. **Quinielas** en 3 páginas según `grupo` del catálogo: dominicanas · más loterías (Lotedom, King) · internacionales (NY, PR, Florida, Anguila con foto).
2. **Modalidades**: Super Kino TV, Loto · Súper Más, Pega 3 Más, Loto Pool, Loto Real.
3. **Horarios**: todos los sorteos del día por hora de cierre; se resaltan todas las que cierran a la próxima hora.

Capas: resultados nuevos (si llegan varios a la vez salen juntos en una pantalla) y jugada del QR
(`VisorTV.mostrarJugada({ nombre, numeros, loteria })`).

## Contrato propuesto para la API

```jsonc
{
  "server_time": "2026-10-23T14:35:10-04:00",
  "resultados": [
    { "id": "NN",   "fecha": "2026-10-22", "numeros": ["64","34","50"] },
    { "id": "LOTO", "fecha": "2026-10-21", "numeros": ["03","11","17","22","30","36"], "extras": { "mas": "05", "super_mas": "11" } }
  ]
}
```

Un objeto por sorteo/modalidad con su último resultado (`fecha` de hoy = RESULTADO).
Ids: `NN NM LN RM RN LT LK PD PN SD SN LD KD KN YD YN FD FN AD AM AT AN PR KINO LOTO PEGA3 POOL LOTOREAL`.

## Pendiente

- Dar de alta el juego `LOTERIA` (código y `game_url` = `/LOTERIA`) y asignarlo a los visores.
- Conectar `ControlVisor` (suspensión, revocación) como en bingo y ruleta: hoy la página no lo inicia porque los datos son de prueba.
- Endpoint de resultados (`realizar` en `/games`) y poner `api.url` en `config_visor.js`.
- Verificar horas de sorteo del catálogo; Puerto Rico no tiene hora (solo cierre 11:59 PM).
- Visor para celular (QR). El QR hoy lleva a https://dempinnovations.com/.
