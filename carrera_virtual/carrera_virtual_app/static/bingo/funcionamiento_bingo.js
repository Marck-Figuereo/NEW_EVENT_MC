/* =========================================================================
   BINGO — funcionamiento_bingo.js

   CONTROLADOR DEL CICLO (mismo papel que funcionamiento_roulette.js).
   No dibuja nada: le dice al canvas (window.BingoScreen) qué mostrar y cuándo.

       SORTEOS (venta + conteo)
         -> a 10 s del cierre: llegan / se piden los datos del sorteo
         -> cierre: SORTEO (bolas hasta el BINGO, ganadores, jackpot)
         -> bolas a la vista unos segundos -> SORTEOS -> ...

   El TIEMPO lo manda el WebSocket del juego, como en los demás juegos
   (countdown.update: event_number, sorteo_id, state, seconds_left,
   server_time, sales_close_at). Nunca se cuenta el cierre con el reloj local.
   Un sorteo se juega UNA sola vez: se protege por sorteo_id.

   /BINGO           producción: ControlVisor + WebSocket + /games
   /BINGO?test=1    prueba: socket simulado + data/sorteos_prueba_bingo.json
     &venta=20      el primer sorteo cierra en 20 s
     &intervalo=180 segundos entre sorteos (en producción lo da el socket)
     &rapido=4      animaciones 4 veces más rápidas
     &reiniciar=1   borra el estado guardado de la prueba
     &debug=1       HUD con el estado del ciclo
   ========================================================================= */

(function () {
'use strict';

const params = new URLSearchParams(location.search);
const TEST_MODE = params.get('test') === '1';

const CONFIG = {
    datosAntesSeg: 10,             // los datos del sorteo llegan dentro de los 10 s antes de empezar
    esperaDatosMs: 10000,          // tras el cierre se sigue esperando los datos hasta 10 s más
    alertaMs: 12000,               // aviso "Error al comenzar el sorteo"
    esperaTrasSorteoMs: 15000,     // bolas en pantalla al terminar, antes de volver a SORTEOS
    sincroJackpotMs: 20000,        // cada cuánto sube el jackpot en SORTEOS
    sinDatosMs: 5000,              // sin countdown en 5 s -> el conteo se muestra sin datos
    socket: { host: '127.0.0.1:8500', reintento: 1000 },

    velocidad: Math.max(1, Number(params.get('rapido')) || 1),
    ventaSeg: Number(params.get('venta')) || 0,
    intervaloSeg: Number(params.get('intervalo')) || 0,
    reiniciar: params.get('reiniciar') === '1',
    debug: params.get('debug') === '1'
};

const STATE = {
    vista: 'boot',          // boot | programacion | esperando_datos | sorteo | espera
    ciclando: false,
    sorteos: {},            // { clave: { estado, cuando, ctx, datos } }  venta | datos | ciclo | finalizado | omitido
    reloj: null,            // { sorteo, sorteo_id, cierre (ms locales), intervaloMs, segundos, abierto }
    ultimoCierre: null,     // para deducir el intervalo entre sorteos si el socket no lo manda
    ultimoConteo: 0,
    sinDatos: false,
    sorteoActual: null
};

const el = {
    stage:  document.getElementById('stage'),
    bingo:  document.getElementById('view-bingo'),
    alerta: document.getElementById('bingo-alerta'),
    alertaTitulo: document.getElementById('bingo-alerta-titulo'),
    alertaTexto: document.getElementById('bingo-alerta-texto'),
    hint:   document.getElementById('tap-hint'),
    hud:    document.getElementById('flow-hud')
};

let pantalla = null;    // window.BingoScreen del iframe


/* ---------------------------------------------------------------- escala */

function escalar() {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    el.stage.style.setProperty('--s', s);
}
window.addEventListener('resize', escalar);
escalar();


/* --------------------------------------------------------------- utilidades */

const esperar = ms => new Promise(r => setTimeout(r, ms / CONFIG.velocidad));
const pad = n => String(n).padStart(2, '0');

function conteo(segundos) {
    if (segundos == null) return '--:--:--';
    const h = Math.floor(segundos / 3600), m = Math.floor((segundos % 3600) / 60), s = segundos % 60;
    return pad(h) + ':' + pad(m) + ':' + pad(s);
}

function horaActual() {
    const d = new Date();
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return pad(h) + ':' + pad(d.getMinutes()) + ' ' + ampm;
}

function alerta(titulo, texto) {
    el.alertaTitulo.textContent = titulo || '';
    el.alertaTexto.textContent = texto || '';
    el.alerta.hidden = !titulo;
}

function setVista(v) { STATE.vista = v; hud(); }

/* Espera a que el iframe exponga BingoScreen y termine de cargar sus assets. */
function listo(iframe) {
    return new Promise(resolve => {
        const t0 = performance.now();
        (function check() {
            let win = null;
            try { win = iframe.contentWindow; } catch (_) {}
            if (win && win.BingoScreen && win.BingoScreen.listo) return resolve(win.BingoScreen);
            if (performance.now() - t0 > 60000) {
                console.warn('[bingo] la pantalla no arrancó a tiempo');
                return resolve(win && win.BingoScreen || null);
            }
            setTimeout(check, 100);
        })();
    });
}


/* --------------------------------------------------------------- reloj del servidor */

/* Igual que la ruleta: restante = sales_close_at - (server_time + tiempo local
   transcurrido). Sin server_time se usa seconds_left tal cual. */
const Reloj = {
    base: null,
    actualizar(d) {
        const servidor = Date.parse(d.server_time);
        const cierre   = Date.parse(d.sales_close_at);
        this.base = (d.state === 'selling' && Number.isFinite(servidor) && Number.isFinite(cierre))
            ? { recibido: performance.now(), servidor: servidor, cierre: cierre } : null;
    },
    restante(d) {
        if (d.state && d.state !== 'selling') return 0;
        if (this.base) return Math.max(0, (this.base.cierre - (this.base.servidor + performance.now() - this.base.recibido)) / 1000);
        const s = Number(d.seconds_left);
        return Number.isFinite(s) ? Math.max(0, s) : 0;
    },
    limpiar() { this.base = null; }
};

/* Cada cuánto hay sorteo: lo manda el socket, como en los demás juegos.
   >>> AJUSTAR CONTRATO: nombre del campo. Si no viene, se deduce de dos cierres seguidos. */
function intervaloDe(d) {
    const seg = Number(d.interval_seconds ?? d.draw_interval_seconds ?? d.round_seconds ?? d.frequency_seconds);
    if (Number.isFinite(seg) && seg > 0) return seg * 1000;
    const min = Number(d.interval_minutes ?? d.frequency_minutes);
    if (Number.isFinite(min) && min > 0) return min * 60000;
    return STATE.reloj ? STATE.reloj.intervaloMs : 0;
}


/* --------------------------------------------------------------- vistas */

/* forzar: la llama el final del ciclo. Fuera del ciclo no pisa un sorteo que ya empezó. */
async function mostrarProgramacion(forzar) {
    const datos = await BingoDB.consultarProgramacion(STATE.reloj);
    if (STATE.ciclando && !forzar) return;
    setVista('programacion');
    pantalla.mostrarProgramacion(datos);
    pintarConteo();
}

function pintarConteo() {
    if (!pantalla || STATE.vista !== 'programacion') return;
    const r = STATE.reloj;
    const seg = r && !STATE.sinDatos ? Math.max(0, Math.ceil((r.cierre - Date.now()) / 1000)) : null;
    pantalla.actualizarReloj({ hora: horaActual(), conteo: conteo(seg) });
}

async function sincroJackpot() {
    if (!pantalla || STATE.vista !== 'programacion') return;
    const monto = await BingoDB.consultarJackpot();
    if (monto != null && STATE.vista === 'programacion') pantalla.actualizarJackpot(monto);
}


/* --------------------------------------------------------------- el ciclo */

function marcarSorteo(clave, estado) {
    const st = STATE.sorteos[clave] || (STATE.sorteos[clave] = {});
    st.estado = estado;
    st.cuando = Date.now();
    console.log('[flow] sorteo', clave, '->', estado);
    return st;
}

const Ciclo = {

    async ejecutar(clave) {
        if (STATE.ciclando) return;
        const st = STATE.sorteos[clave];
        STATE.ciclando = true;
        STATE.sorteoActual = st.ctx.event_number;
        marcarSorteo(clave, 'ciclo');

        const cierre = st.ctx.cierre || Date.now();

        try {
            // Datos del sorteo: ya pedidos en los 10 s previos, o se piden ahora
            if (STATE.vista === 'programacion') pantalla.actualizarReloj({ hora: horaActual(), conteo: conteo(0) });
            setVista('esperando_datos');
            const sorteo = await (st.datos || BingoDB.obtenerSorteo(st.ctx, Date.now() + CONFIG.esperaDatosMs));

            if (!sorteo) {
                console.error('[flow] el sorteo ' + st.ctx.event_number + ' no tiene datos: no se juega');
                marcarSorteo(clave, 'omitido');
                alerta('Error al comenzar el sorteo', 'Espere el próximo sorteo.');
                await esperar(CONFIG.alertaMs);
                alerta('');
                return;
            }

            console.log('[flow] ===== sorteo ' + sorteo.sorteo + ' ===== ' + sorteo.bolas.length + ' bolas | ' +
                        sorteo.ganadores.map(g => g.tipo + '@' + g.bola).join(' '));

            setVista('sorteo');
            const completo = await pantalla.jugarSorteo(sorteo);

            if (completo) {
                BingoDB.registrarResultado(sorteo, cierre);
                marcarSorteo(clave, 'finalizado');
                setVista('espera');
                await esperar(CONFIG.esperaTrasSorteoMs);
            } else {
                console.warn('[flow] el sorteo ' + sorteo.sorteo + ' se interrumpió');
            }

        } catch (e) {
            console.error('[flow] fallo en el sorteo ' + clave + ':', e);

        } finally {
            BingoDB.olvidar(st.ctx);
            STATE.sorteoActual = null;
            await mostrarProgramacion(true);
            STATE.ciclando = false;
            console.log('[flow] ===== fin del sorteo ' + st.ctx.event_number + ' =====');
        }
    }
};


/* --------------------------------------------------------------- entrada del WebSocket */

const claveSorteo = d => String(d.sorteo_id || ('evento-' + d.event_number));

function marcarConteo() { STATE.ultimoConteo = Date.now(); STATE.sinDatos = false; }

function onCountdown(data, origen = 'ws') {
    if (!data) return;
    const tipo = data.type || 'countdown.update';

    if (tipo === 'countdown.empty' || data.state === 'no_event') {
        if (origen !== 'rest') marcarConteo();
        Reloj.limpiar();
        STATE.reloj = null;
        pintarConteo();
        return;
    }
    if (tipo !== 'countdown.update') return;

    // Un mensaje de otro grupo o de otro juego no cuenta
    if (!TEST_MODE) {
        const grupo = localStorage.getItem('grupo');
        if (data.grupo_id != null && grupo && String(data.grupo_id) !== String(grupo)) return;
        const juego = localStorage.getItem('game_id_bingo') || localStorage.getItem('game_id');
        if (data.game_id != null && juego && String(data.game_id) !== String(juego)) return;
    }

    if (origen !== 'rest') marcarConteo();
    if (data.event_number === undefined || data.event_number === null) return;

    const abierto = !data.state || data.state === 'selling';
    const d = Object.assign({}, data, { state: abierto ? 'selling' : data.state });
    Reloj.actualizar(d);
    const restante = Reloj.restante(d);
    const segundos = Math.ceil(restante);
    const clave = claveSorteo(data);

    const ctx = {
        event_number: data.event_number,
        sorteo_id: data.sorteo_id || null,
        cierre: Date.now() + restante * 1000
    };

    if (abierto) {
        // Intervalo entre sorteos: el del socket o, si no viene, la distancia entre dos cierres
        let iv = intervaloDe(data);
        const anterior = STATE.ultimoCierre;
        if (!iv && anterior && String(anterior.event_number) !== String(data.event_number)) {
            iv = Math.round((ctx.cierre - anterior.cierre) / 1000) * 1000;
        }
        STATE.ultimoCierre = { event_number: data.event_number, cierre: ctx.cierre };
        STATE.reloj = { sorteo: data.event_number, sorteo_id: ctx.sorteo_id, cierre: ctx.cierre, intervaloMs: iv, segundos: segundos, abierto: true };
    } else if (STATE.reloj) {
        STATE.reloj.segundos = 0;
    }

    pintarConteo();
    hud();

    let st = STATE.sorteos[clave];

    if (abierto && segundos > 0) {
        if (!st) st = marcarSorteo(clave, 'venta');
        st.ctx = ctx;

        // Dentro de los 10 s previos: se piden los datos (si el socket ya los empujó, no hay consulta)
        if (segundos <= CONFIG.datosAntesSeg && st.estado === 'venta') {
            marcarSorteo(clave, 'datos');
            st.datos = BingoDB.obtenerSorteo(ctx, ctx.cierre + CONFIG.esperaDatosMs);
        }
        return;
    }

    // Ventas cerradas o cero: empieza el sorteo
    if (!st) {
        // El visor no vio la venta de este sorteo (se encendió con el sorteo ya empezado):
        // no se sabe en qué bola va, así que se espera al siguiente.
        st = marcarSorteo(clave, 'omitido');
        st.ctx = ctx;
        console.log('[flow] el sorteo ' + data.event_number + ' ya empezó al encender el visor: se espera el siguiente');
        return;
    }
    if (['venta', 'datos'].indexOf(st.estado) === -1 || STATE.ciclando) return;
    Ciclo.ejecutar(clave);
}


/* --------------------------------------------------------------- socket real */

let socketActual = null, socketReintentos = 0, socketTemporizador = null, socketPidiendo = false, socketConectoAntes = false;
let retryAfter = 0;

function urlSocket() {
    const base = String((window.VISOR_CONFIG || {}).wsUrl || ('ws://' + CONFIG.socket.host)).replace(/\/+$/, '');
    return base + '/ws/pos/grupos/' + localStorage.getItem('grupo') + '/games/' +
           (localStorage.getItem('game_id_bingo') || localStorage.getItem('game_id')) + '/countdown/';
}

/* >>> AJUSTAR CONTRATO: si el backend empuja los datos del sorteo por el socket,
   aquí va el type del mensaje y dónde viene el sorteo. */
function esDatosDeSorteo(m) {
    return m && (m.type === 'bingo.draw' || m.type === 'bingo.draw_data' || m.type === 'draw.data');
}

async function recuperarEvento() {
    const evento = await BingoDB.consultarEventoActual();
    if (!evento || evento.event_number == null) return;
    const d = Object.assign({ type: 'countdown.update' }, evento);
    if (!d.state) d.state = (!d.phase || d.phase === 'sales_open') ? 'selling' : 'in_progress';
    onCountdown(d, 'rest');
}

async function conectarSocket() {
    if (!navigator.onLine) { clearTimeout(socketTemporizador); socketTemporizador = setTimeout(conectarSocket, CONFIG.socket.reintento); return; }
    if (socketActual && (socketActual.readyState === WebSocket.OPEN || socketActual.readyState === WebSocket.CONNECTING)) return;
    if (socketPidiendo) return;
    clearTimeout(socketTemporizador);

    // Ticket de dispositivo nuevo en cada conexión y primer frame "authenticate" (igual que la ruleta)
    socketPidiendo = true;
    let acceso = { modo: 'sin_auth' };
    try { if (window.ControlVisor) acceso = await ControlVisor.ticketCountdown(); } finally { socketPidiendo = false; }
    if (acceso.modo === 'parar') return;
    if (acceso.modo === 'esperar') { socketTemporizador = setTimeout(conectarSocket, acceso.ms); return; }

    let ws;
    try { ws = new WebSocket(urlSocket()); }
    catch (e) { socketTemporizador = setTimeout(conectarSocket, CONFIG.socket.reintento); return; }
    socketActual = ws;

    ws.onopen = () => {
        if (acceso.modo === 'auth') ws.send(JSON.stringify({ type: 'authenticate', ticket: acceso.ticket }));
        console.log('[flow] socket del bingo conectado:', ws.url);
        if (socketConectoAntes) recuperarEvento();       // se pudo perder un mensaje
        socketConectoAntes = true;
    };

    ws.onmessage = ev => {
        let data;
        try { data = JSON.parse(ev.data); } catch (_) { return; }
        if (window.ControlVisor) ControlVisor.logEvento(data, ws.url);

        if (esDatosDeSorteo(data)) {
            BingoDB.recibirSorteo(data.data || data.sorteo || data, { event_number: data.event_number, sorteo_id: data.sorteo_id });
            return;
        }

        const tipo = window.ControlVisor ? ControlVisor.mensajeCountdown(data) : 'conteo';
        if (tipo === 'contexto') { STATE.sinDatos = true; pintarConteo(); setTimeout(() => { if (socketActual === ws) ws.close(); }, 5000); return; }
        if (tipo === 'no_disponible') { retryAfter = Number(data.retry_after) || 3; STATE.sinDatos = true; pintarConteo(); return; }
        if (tipo !== 'conteo') return;

        socketReintentos = 0;
        onCountdown(data);
    };

    ws.onclose = async evento => {
        if (socketActual !== ws) return;
        socketActual = null;
        const espera = window.ControlVisor
            ? await ControlVisor.cierreCountdown(evento.code, socketReintentos, retryAfter)
            : Math.min(1000 * Math.pow(2, socketReintentos), 15000);
        retryAfter = 0;
        socketReintentos++;
        if (espera === null) return;
        clearTimeout(socketTemporizador);
        socketTemporizador = setTimeout(conectarSocket, espera);
    };

    ws.onerror = () => ws.close();
}

window.addEventListener('online', () => { if (!TEST_MODE) conectarSocket(); });

/* Salud del countdown: sin mensajes en 5 s, el conteo se muestra sin datos (no se inventa). */
setInterval(() => {
    if (TEST_MODE || STATE.vista !== 'programacion' || !STATE.ultimoConteo) return;
    if (Date.now() - STATE.ultimoConteo > CONFIG.sinDatosMs && !STATE.sinDatos) {
        STATE.sinDatos = true;
        Reloj.limpiar();
        console.warn('[flow] sin countdown del bingo en ' + CONFIG.sinDatosMs / 1000 + ' s');
        pintarConteo();
    }
}, 1000);


/* --------------------------------------------------------------- socket simulado (?test=1) */

/* Emite los MISMOS mensajes que el backend: el ciclo se dispara por el mismo onCountdown(). */
function socketSimulado() {
    console.log('[flow] MODO PRUEBA: socket simulado, datos de data/sorteos_prueba_bingo.json');
    const P = BingoDB.prueba;

    setInterval(() => {
        const ahora = Date.now();
        const r = P.reloj(ahora);
        const base = {
            type: 'countdown.update',
            event_number: r.sorteo,
            sorteo_id: 'prueba-' + r.sorteo,
            server_time: new Date(ahora).toISOString(),
            sales_close_at: new Date(r.cierre).toISOString(),
            interval_seconds: r.intervaloMs / 1000
        };

        if (ahora < r.cierre) {
            onCountdown(Object.assign(base, { state: 'selling', seconds_left: Math.ceil((r.cierre - ahora) / 1000) }), 'ws');
        } else if (ahora < r.cierre + 3000) {
            onCountdown(Object.assign(base, { state: 'in_progress', seconds_left: 0 }), 'ws');
        } else {
            P.siguiente();      // empieza la venta del siguiente
        }
    }, 1000);
}


/* --------------------------------------------------------------- HUD */

function hud() {
    if (!CONFIG.debug) return;
    el.hud.hidden = false;
    const r = STATE.reloj || {};
    el.hud.textContent = [
        'BINGO ' + (TEST_MODE ? '(PRUEBA)' : '') + '  vista: ' + STATE.vista + (STATE.sorteoActual ? '  (sorteo ' + STATE.sorteoActual + ')' : ''),
        'en venta: ' + (r.sorteo != null ? r.sorteo : '-') + '  cierra en ' + conteo(r.cierre ? Math.max(0, Math.ceil((r.cierre - Date.now()) / 1000)) : null) +
            '  intervalo ' + (r.intervaloMs ? r.intervaloMs / 1000 + ' s' : '?'),
        'velocidad x' + CONFIG.velocidad,
        Object.keys(BingoDB.problemas).length ? 'datos con problemas: ' + Object.keys(BingoDB.problemas).join(', ') : 'datos revisados'
    ].join('\n');
}


/* --------------------------------------------------------------- arranque */

el.hint.addEventListener('click', () => { el.hint.hidden = true; if (pantalla) pantalla.reanudarAudio(); });

async function main() {

    BingoDB.testMode = TEST_MODE;

    if (TEST_MODE) {
        try {
            await BingoDB.cargarPrueba({ ventaSeg: CONFIG.ventaSeg, intervaloSeg: CONFIG.intervaloSeg, reiniciar: CONFIG.reiniciar });
        } catch (e) {
            console.error('[bingo] datos de prueba no disponibles:', e);
            alerta('Bingo no disponible', 'No se pudieron cargar los datos de prueba.');
            return;
        }
    } else {
        // Visor sin vincular: a la activación (QR), igual que los demás juegos
        if (!localStorage.getItem('dkg')) { location.href = '/'; return; }

        // Estado del visor antes de mostrar nada: suspendido, revocado, juego o grupo nuevos
        if (window.ControlVisor) {
            ControlVisor.estaQuieto = () => STATE.vista === 'programacion' && !STATE.ciclando;
            const estado = await ControlVisor.iniciar({ claveJuego: 'game_id_bingo' });
            if (estado === 'navegando' || estado === 'bloqueado' || estado === 'sin_juego') return;
        }
    }

    pantalla = await listo(el.bingo);
    if (!pantalla) { alerta('Bingo no disponible', 'La pantalla del bingo no cargó.'); return; }

    el.bingo.classList.add('is-active');
    pantalla.setHostActive(true);
    if (CONFIG.velocidad > 1) pantalla.setVelocidad(CONFIG.velocidad);

    // Audio bloqueado: el botón se ofrece unos segundos (en el kiosco no aparece)
    try {
        const ctx = el.bingo.contentWindow.createjs.WebAudioPlugin.context;
        if (ctx && ctx.state === 'suspended') { el.hint.hidden = false; setTimeout(() => { el.hint.hidden = true; }, 15000); }
    } catch (_) {}

    if (TEST_MODE) {
        socketSimulado();
    } else {
        await recuperarEvento();          // estado inicial antes del primer mensaje del socket
        conectarSocket();
    }

    await mostrarProgramacion();

    setInterval(pintarConteo, 1000);
    setInterval(sincroJackpot, CONFIG.sincroJackpotMs);
}


/* API mínima para diagnóstico. No se usa para saltar pantallas. */
window.BingoFlow = {
    get vista() { return STATE.vista; },
    get estado() { return STATE; },
    config: CONFIG,
    testMode: TEST_MODE,
    onCountdown: d => onCountdown(d, 'ws'),
    /* Solo prueba: cierra ya el sorteo en venta */
    cerrarYa() { if (TEST_MODE && BingoDB.prueba.estado) BingoDB.prueba.estado.cierre = Date.now() + 1000; }
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
else main();

})();
