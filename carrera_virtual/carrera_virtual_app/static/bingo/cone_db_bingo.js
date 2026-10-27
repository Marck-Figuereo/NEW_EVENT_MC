/* =========================================================================
   BINGO — cone_db_bingo.js

   ADAPTADOR DE DATOS (mismo papel que cone_db_roulette.js).
   No toca la pantalla: entrega objetos NORMALIZADOS a funcionamiento_bingo.js.

   Dos fuentes, igual que la ruleta:

     PRODUCCIÓN (/BINGO)          POST /games de Django con { realizar, device_token, game_id }.
                                  Django consulta la API (helpers/display_api_client.py).
     PRUEBA     (/BINGO?test=1)   data/sorteos_prueba_bingo.json, sin backend.

   TODO lo del sorteo lo manda la API: bolas, cartones, ganadores y montos.
   El visor no calcula ganadores. Solo revisa que los datos cuadren y, si algo
   no cuadra, lo AVISA en consola (no esconde nada: manda lo que dice la API).

   Cuándo llega cada cosa:
     - El tiempo (venta, cierre, cada cuánto hay sorteo): el WebSocket del juego,
       como en los demás juegos (funcionamiento_bingo.js).
     - Los datos del sorteo: dentro de los 10 s antes de empezar. Pueden llegar
       empujados por el socket (BingoDB.recibirSorteo) o pedidos por el visor
       en ese tramo (BingoDB.obtenerSorteo -> realizar 'bingo_sorteo').
     - La pantalla SORTEOS (anteriores, próximos, especiales, jackpot):
       realizar 'bingo_programacion', al arrancar y después de cada sorteo.

   Los puntos que dependen de nombres que todavía no ha definido el backend
   están marcados con

       // >>> AJUSTAR CONTRATO

   Reglas que se revisan (las mismas del generador de datos de prueba):
     - Bolas distintas del 1 al 90, como máximo 60.
     - El sorteo dura hasta el BINGO: siempre hay BINGO y es la última bola.
     - Cartón de 15 números (3 filas de 5).
     - CUATRO 4 de una fila | LINEA 1 fila | DOBLE_LINEA 2 filas | BINGO 15.
     - JACKPOT (solo del bingo, no se comparte con otros juegos): lo gana el
       cartón del BINGO si sale antes de la bola 60. Si el BINGO sale en la
       bola 60, no hay JACKPOT y el monto se acumula para el siguiente sorteo.
   ========================================================================= */

(function () {
'use strict';

const RUTA_JSON = 'data/sorteos_prueba_bingo.json';
const CLAVE_PRUEBA = 'bingo_prueba:estado';
const CLAVE_JUEGO = 'game_id_bingo';      // lo guarda ControlVisor al resolver el juego BINGO

const ORDEN = ['CUATRO', 'LINEA', 'DOBLE_LINEA', 'BINGO', 'JACKPOT'];

/* Reglas por defecto (la API puede mandarlas en el sorteo o en la programación). */
const REGLAS = { total_bolas: 60, numero_min: 1, numero_max: 90, limite_bola_jackpot: 59 };


/* =========================================================================
   1. UTILIDADES
   ========================================================================= */

const pad = n => String(n).padStart(2, '0');

function fechaCorta(d) {
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
}

function hora12(d) {
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return pad(h) + ':' + pad(d.getMinutes()) + ' ' + ampm;
}

/* Fecha de la API: ISO completo ("2026-10-19T14:30:00-04:00") o fecha + hora sueltas. */
function aFecha(fecha, hora) {
    if (fecha instanceof Date) return fecha;
    const s = String(fecha || '');
    if (s.indexOf('T') > 0) { const d = new Date(s); if (!isNaN(d)) return d; }
    const f = s.split('-').map(Number);
    const h = String(hora || '00:00').split(':').map(Number);
    return new Date(f[0], (f[1] || 1) - 1, f[2] || 1, h[0] || 0, h[1] || 0);
}

function isoFecha(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function isoHora(d)  { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

/* Igual que el visor: se ocultan los primeros 6 caracteres del ticket. */
function ticketCorto(t) {
    const s = String(t == null ? '' : t);
    return s.length > 6 ? '***' + s.slice(6) : s;
}

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const ls = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };

function getCookie(name) {
    const partes = (document.cookie || '').split(';');
    for (let i = 0; i < partes.length; i++) {
        const c = partes[i].trim();
        if (c.substring(0, name.length + 1) === name + '=') return decodeURIComponent(c.substring(name.length + 1));
    }
    return null;
}

/* Transporte: POST /games con CSRF, igual que cone_db_roulette.js */
async function post(payload) {
    const r = await fetch('/games', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
            'X-CSRFToken': getCookie('csrftoken'),
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json'
        }
    });
    if (!r.ok) {
        const e = new Error('HTTP ' + r.status + ' en /games (' + payload.realizar + ')');
        e.status = r.status;
        try { e.cuerpo = await r.json(); } catch (_) {}
        throw e;
    }
    return r.json();
}

function base(realizar, extra) {
    return Object.assign({
        realizar: realizar,
        device_token: ls('dkg'),
        game_id: ls(CLAVE_JUEGO) || ls('game_id')
    }, extra || {});
}

const esperarMs = ms => new Promise(r => setTimeout(r, ms));


/* =========================================================================
   2. VALIDACIÓN (misma lógica que herramientas/bingo_generar_json.py)
   ========================================================================= */

const INF = 1e9;

/* Bola (1..60) en que el cartón completa cada figura. */
function bolaDeFiguras(numeros, posicion) {
    const filas = [numeros.slice(0, 5), numeros.slice(5, 10), numeros.slice(10, 15)]
        .map(f => f.map(n => posicion[n] || INF).sort((a, b) => a - b));
    const lineas = filas.map(f => f[4]).sort((a, b) => a - b);
    return {
        CUATRO: Math.min.apply(null, filas.map(f => f[3])),
        LINEA: lineas[0],
        DOBLE_LINEA: lineas[1],
        BINGO: lineas[2]
    };
}

/* Devuelve la lista de problemas. No quita ganadores: los datos de la API mandan. */
function validarSorteo(s, cfg) {
    const problemas = [];
    const bolas = Array.isArray(s.bolas) ? s.bolas : [];
    const maximo = cfg.total_bolas || 60;

    if (!bolas.length || bolas.length > maximo) problemas.push(bolas.length + ' bolas (deben ser de 1 a ' + maximo + ')');
    if (new Set(bolas).size !== bolas.length) problemas.push('bolas repetidas');
    if (bolas.some(b => !(b >= cfg.numero_min && b <= cfg.numero_max))) problemas.push('bola fuera de rango');

    const posicion = {};
    bolas.forEach((n, i) => { posicion[n] = i + 1; });

    const primera = {};
    (s.ganadores || []).forEach(g => {
        const nums = g.numeros || [];
        if (ORDEN.indexOf(g.tipo) < 0) { problemas.push('tipo desconocido ' + g.tipo); return; }
        if (nums.length !== 15 || new Set(nums).size !== 15) { problemas.push(g.ticket + ': cartón inválido'); return; }
        if (!(g.bola >= 1 && g.bola <= bolas.length)) { problemas.push(g.tipo + ' ' + g.ticket + ': bola ' + g.bola + ' fuera del sorteo'); return; }

        const figura = g.tipo === 'JACKPOT' ? 'BINGO' : g.tipo;
        const en = bolaDeFiguras(nums, posicion)[figura];
        if (en !== g.bola) {
            problemas.push(g.tipo + ' ' + g.ticket + ': completa en la bola ' + (en >= INF ? '(nunca)' : en) + ', el dato dice ' + g.bola);
        }
        if (primera[g.tipo] != null && primera[g.tipo] !== g.bola) problemas.push(g.tipo + ': ganadores en bolas distintas');
        if (primera[g.tipo] == null) primera[g.tipo] = g.bola;
    });

    ['CUATRO', 'LINEA', 'DOBLE_LINEA', 'BINGO'].forEach(t => {
        if (primera[t] == null) problemas.push('falta el ganador de ' + t);
    });

    if (primera.BINGO != null && primera.BINGO !== bolas.length) {
        problemas.push('el sorteo debe terminar en la bola del BINGO (' + primera.BINGO + '), trae ' + bolas.length + ' bolas');
    }

    const conJackpot = primera.BINGO != null && primera.BINGO <= cfg.limite_bola_jackpot;
    if (conJackpot && primera.JACKPOT == null) problemas.push('BINGO en la bola ' + primera.BINGO + ' y falta el JACKPOT');
    if (primera.JACKPOT != null && (!conJackpot || primera.JACKPOT !== primera.BINGO)) {
        problemas.push('JACKPOT en la bola ' + primera.JACKPOT + ' no cumple la regla (BINGO antes de la bola ' + maximo + ')');
    }

    return problemas;
}



/* =========================================================================
   3. NORMALIZACIÓN  (API -> lo que pinta el canvas)

   >>> AJUSTAR CONTRATO: los nombres son los del JSON de prueba, que es la
   propuesta entregada al backend. Si la API usa otros, se cambian SOLO aquí.
   ========================================================================= */

function normalizarUltimo(u) {
    if (!u) return null;
    return {
        monto: num(u.monto != null ? u.monto : u.amount),
        fecha: fechaCorta(aFecha(u.fecha || u.date)),
        lugar: u.lugar || u.place || '',
        ticket: ticketCorto(u.ticket)
    };
}

/* Datos de UN sorteo, tal como llegan de la API dentro de los 10 s previos. */
function normalizarSorteo(d, contexto) {
    if (!d) return null;
    const s = d.sorteo && typeof d.sorteo === 'object' ? d.sorteo : d;     // { sorteo: {...} } o plano
    const reglas = Object.assign({}, REGLAS, s.config || s.reglas || {});

    const problemas = validarSorteo(s, reglas);
    if (problemas.length) {
        console.warn('[DB bingo] sorteo ' + (s.sorteo || s.event_number || s.codigo || '?') +
                     ' con datos que no cuadran (se muestra igual):\n  - ' + problemas.join('\n  - '));
    }

    const jk = s.jackpot && typeof s.jackpot === 'object' ? s.jackpot : { monto: s.jackpot };
    const ganadores = (s.ganadores || []).map(g => ({
        tipo: g.tipo,
        bola: Number(g.bola),
        numero_bola: g.numero_bola,
        lugar: g.lugar,
        ticket: ticketCorto(g.ticket),
        ticket_completo: g.ticket,
        numeros: g.numeros,
        monto: g.monto != null ? num(g.monto) : (g.tipo === 'JACKPOT' ? num(jk.monto) : 0)
    }));

    return {
        sorteo: s.event_number != null ? s.event_number : (s.sorteo != null ? s.sorteo : (contexto && contexto.event_number)),
        sorteo_id: s.sorteo_id || (contexto && contexto.sorteo_id) || null,
        codigo: s.codigo || null,
        bolas: (s.bolas || []).map(Number),
        premios: s.premios || {},
        jackpot: num(jk.monto != null ? jk.monto : jk.monto_actual),
        ultimo_jackpot: normalizarUltimo(s.ultimo_jackpot || jk.ultimo),
        ganadores: ganadores,
        seguimiento: (s.seguimiento || []).map(c => ({ lugar: c.lugar, ticket: ticketCorto(c.ticket), numeros: c.numeros })),
        problemas: problemas
    };
}

/* Pantalla SORTEOS. `reloj` = { sorteo, cierre (ms), intervaloMs } del socket, para
   calcular los próximos si la API no los manda. */
function normalizarProgramacion(d, reloj) {
    d = d || {};
    const jk = d.jackpot || {};

    let proximos = (d.proximos || []).map(p => {
        const f = aFecha(p.fecha || p.scheduled_at, p.hora);
        return { sorteo: p.sorteo != null ? p.sorteo : p.event_number, fecha: fechaCorta(f), hora: hora12(f) };
    });
    if (!proximos.length && reloj && reloj.cierre && reloj.intervaloMs > 0 && reloj.sorteo != null) {
        for (let k = 0; k < 5; k++) {
            const f = new Date(reloj.cierre + k * reloj.intervaloMs);
            proximos.push({ sorteo: Number(reloj.sorteo) + k, fecha: fechaCorta(f), hora: hora12(f) });
        }
    }

    // Siempre salen los 4 premios: el sorteo dura hasta el BINGO
    const anteriores = (d.historial || d.anteriores || []).slice(0, 5).map(h => {
        const p = h.premios || {};
        return {
            sorteo: h.sorteo != null ? h.sorteo : h.event_number,
            hora: hora12(aFecha(h.fecha || h.resulted_at, h.hora)),
            cuatro: p.cuatro, linea: p.linea, doble_linea: p.doble_linea, bingo: p.bingo
        };
    });

    // Especiales del panel de administración: solo los que no han pasado, los 3 más cercanos
    const ahora = Date.now();
    const especiales = (d.sorteos_especiales || d.especiales || [])
        .map(e => Object.assign({}, e, { _cuando: aFecha(e.fecha || e.scheduled_at, e.hora) }))
        .filter(e => e._cuando.getTime() > ahora)
        .sort((a, b) => a._cuando - b._cuando)
        .slice(0, 3)
        .map(e => ({
            titulo: e.titulo,
            fecha: fechaCorta(e._cuando),
            hora: hora12(e._cuando),
            cuatro: (e.premios || {}).cuatro,
            linea: (e.premios || {}).linea,
            doble_linea: (e.premios || {}).doble_linea,
            bingo: (e.premios || {}).bingo
        }));

    return {
        jackpot: num(jk.monto_actual != null ? jk.monto_actual : jk.monto),
        ultimo_jackpot: normalizarUltimo(jk.ultimo || d.ultimo_jackpot),
        anteriores: anteriores,
        proximos: proximos,
        especiales: especiales
    };
}


/* =========================================================================
   4. MODO PRUEBA (?test=1): el JSON hace de API
   ========================================================================= */

const Prueba = {
    datos: null,
    estado: null,          // { firma, sorteo, cierre, jackpot, ultimo, historial }
    opciones: {},

    firma(d) { return [d.version, (d.sorteos || []).map(s => s.codigo + s.semilla).join(',')].join('|'); },

    guardar() { try { localStorage.setItem(CLAVE_PRUEBA, JSON.stringify(this.estado)); } catch (_) {} },

    async cargar(op) {
        this.opciones = op || {};
        const r = await fetch(RUTA_JSON + '?v=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) throw new Error('No se pudo cargar ' + RUTA_JSON + ' (HTTP ' + r.status + ')');
        const d = this.datos = await r.json();
        if (!d || !Array.isArray(d.sorteos) || !d.sorteos.length) throw new Error(RUTA_JSON + ' no tiene sorteos');

        d.sorteos.forEach(s => {
            const p = validarSorteo(s, Object.assign({}, REGLAS, d.config));
            if (p.length) BingoDB.problemas[s.codigo] = p;
        });

        let guardado = null;
        try { guardado = this.opciones.reiniciar ? null : JSON.parse(localStorage.getItem(CLAVE_PRUEBA) || 'null'); } catch (_) {}

        this.estado = guardado && guardado.firma === this.firma(d) ? guardado : {
            firma: this.firma(d),
            sorteo: d.config.sorteo_inicial || 1,
            cierre: null,
            jackpot: num((d.jackpot || {}).monto_actual),
            ultimo: (d.jackpot || {}).ultimo || null,
            historial: (d.historial || []).slice()
        };
        if (this.opciones.ventaSeg > 0) this.estado.cierre = null;
        this.guardar();
        console.log('[DB bingo] MODO PRUEBA: ' + d.sorteos.length + ' sorteos del JSON, jackpot ' + this.estado.jackpot);
    },

    /* Lo que en producción decide el servidor: cada cuánto hay sorteo. */
    intervaloMs() {
        if (this.opciones.intervaloSeg > 0) return this.opciones.intervaloSeg * 1000;
        return (this.datos.config.intervalo_min || 10) * 60000;
    },

    /* Reloj del socket simulado: sorteo en venta y su cierre. */
    reloj(ahora) {
        const iv = this.intervaloMs();
        const e = this.estado;
        if (!e.cierre) {
            if (this.opciones.ventaSeg > 0) e.cierre = ahora + this.opciones.ventaSeg * 1000;
            else { e.cierre = Math.ceil(ahora / iv) * iv; if (e.cierre - ahora < 60000) e.cierre += iv; }
            this.guardar();
        }
        // Cierres que pasaron con el visor apagado (se deja 5 s para el mensaje de "cerrado")
        while (e.cierre + 5000 < ahora) { e.cierre += iv; e.sorteo += 1; }
        return { sorteo: e.sorteo, cierre: e.cierre, intervaloMs: iv };
    },

    siguiente() {
        this.estado.sorteo += 1;
        this.estado.cierre += this.intervaloMs();
        this.guardar();
    },

    /* El jackpot crece durante la venta (aporte del sorteo repartido en el intervalo). */
    jackpot(ahora) {
        const aporte = num((this.datos.jackpot || {}).aporte_por_sorteo);
        const e = this.estado;
        const avance = e.cierre ? Math.min(1, Math.max(0, 1 - (e.cierre - ahora) / this.intervaloMs())) : 0;
        return Math.round((e.jackpot + aporte * avance) * 100) / 100;
    },

    /* Respuesta de 'bingo_sorteo' con la forma del contrato. */
    sorteo(numero) {
        const pool = this.datos.sorteos;
        const baseNum = this.datos.config.sorteo_inicial || 0;
        const s = pool[(((numero - baseNum) % pool.length) + pool.length) % pool.length];
        const jackpot = this.jackpot(this.estado.cierre || Date.now());
        const jk = s.ganadores.filter(g => g.tipo === 'JACKPOT');
        return {
            event_number: numero,
            sorteo_id: 'prueba-' + numero,
            codigo: s.codigo,
            config: this.datos.config,
            bolas: s.bolas,
            premios: s.premios,
            jackpot: { monto: jackpot },
            ultimo_jackpot: this.estado.ultimo,
            ganadores: s.ganadores.map(g => g.tipo === 'JACKPOT'
                ? Object.assign({}, g, { monto: Math.round(jackpot / jk.length * 100) / 100 }) : g),
            seguimiento: s.seguimiento
        };
    },

    /* Respuesta de 'bingo_programacion' con la forma del contrato. */
    programacion() {
        return {
            jackpot: { monto_actual: this.jackpot(Date.now()), ultimo: this.estado.ultimo },
            historial: this.estado.historial,
            sorteos_especiales: this.datos.sorteos_especiales
            // proximos: no se mandan -> se calculan con el intervalo del socket
        };
    },

    /* Lo que en producción hace el backend al terminar el sorteo. */
    registrar(sorteo, cierreMs) {
        const d = new Date(cierreMs || Date.now());
        const jk = sorteo.ganadores.find(g => g.tipo === 'JACKPOT');
        this.estado.historial.unshift({
            sorteo: sorteo.sorteo, fecha: isoFecha(d), hora: isoHora(d), premios: sorteo.premios, jackpot: !!jk
        });
        this.estado.historial = this.estado.historial.slice(0, 10);

        if (jk) {
            this.estado.ultimo = { monto: sorteo.jackpot, fecha: isoFecha(d), lugar: jk.lugar, ticket: jk.ticket_completo };
            this.estado.jackpot = num((this.datos.jackpot || {}).monto_base);
            console.log('[DB bingo] (prueba) jackpot ganado en el sorteo ' + sorteo.sorteo);
        } else {
            this.estado.jackpot = sorteo.jackpot;      // BINGO en la bola 60: se acumula
            console.log('[DB bingo] (prueba) jackpot acumulado: ' + sorteo.jackpot);
        }
        this.guardar();
    }
};


/* =========================================================================
   5. API DEL ADAPTADOR
   ========================================================================= */

const recibidos = {};      // datos de sorteos ya llegados, por sorteo_id o event_number
const pedidos = {};        // consultas en curso (una sola por sorteo)

const claveDe = ctx => String((ctx && (ctx.sorteo_id || ctx.event_number)) != null ? (ctx.sorteo_id || ctx.event_number) : '');

const BingoDB = {

    testMode: false,
    problemas: {},
    prueba: Prueba,

    async cargarPrueba(op) { await Prueba.cargar(op); },

    /* El socket (u otra vía) EMPUJA los datos del sorteo: se guardan hasta el cierre.
       >>> AJUSTAR CONTRATO: tipo del mensaje y dónde viene el sorteo dentro de él. */
    recibirSorteo(payload, contexto) {
        const s = normalizarSorteo(payload, contexto);
        if (!s || !s.bolas.length) return null;
        const k = String(s.sorteo_id || s.sorteo);
        recibidos[k] = s;
        if (s.sorteo != null) recibidos[String(s.sorteo)] = s;
        console.log('[DB bingo] datos del sorteo ' + s.sorteo + ' recibidos: ' + s.bolas.length + ' bolas, ' + s.ganadores.length + ' ganadores');
        return s;
    },

    /* Datos del sorteo: los ya recibidos o una consulta (una sola a la vez por sorteo).
       Reintenta hasta `hastaMs` (marca de tiempo) si la API aún no los tiene. */
    async obtenerSorteo(ctx, hastaMs) {
        const k = claveDe(ctx);
        if (recibidos[k] || recibidos[String(ctx.event_number)]) return recibidos[k] || recibidos[String(ctx.event_number)];
        if (pedidos[k]) return pedidos[k];

        pedidos[k] = (async () => {
            let intento = 0;
            do {
                try {
                    let crudo;
                    if (this.testMode) {
                        await esperarMs(300 + Math.random() * 500);          // como si viniera de la red
                        crudo = Prueba.sorteo(Number(ctx.event_number));
                    } else {
                        // >>> AJUSTAR CONTRATO: views.py -> realizar 'bingo_sorteo'
                        crudo = await post(base('bingo_sorteo', { sorteo_id: ctx.sorteo_id, event_number: ctx.event_number }));
                    }
                    const s = this.recibirSorteo(crudo, ctx);
                    if (s) return s;
                    console.warn('[DB bingo] el sorteo ' + ctx.event_number + ' todavía no tiene datos');
                } catch (e) {
                    console.warn('[DB bingo] datos del sorteo ' + ctx.event_number + ' no disponibles:', e.message);
                    if (e.status === 400 || e.status === 501) break;      // no se arregla reintentando
                }
                intento++;
                await esperarMs(1500);
            } while (Date.now() < (hastaMs || 0));
            return null;
        })();

        try { return await pedidos[k]; } finally { delete pedidos[k]; }
    },

    /* Pantalla SORTEOS. reloj: { sorteo, cierre, intervaloMs } del socket. */
    async consultarProgramacion(reloj) {
        try {
            const crudo = this.testMode
                ? Prueba.programacion()
                : await post(base('bingo_programacion'));          // >>> AJUSTAR CONTRATO
            return normalizarProgramacion(crudo, reloj);
        } catch (e) {
            console.warn('[DB bingo] programación no disponible:', e.message);
            return null;
        }
    },

    /* Monto vigente del jackpot del bingo (para que suba en la pantalla SORTEOS). */
    async consultarJackpot() {
        if (this.testMode) return Prueba.jackpot(Date.now());
        try {
            // Mismo endpoint que los demás juegos, con el game_id del BINGO:
            // el jackpot del bingo es propio, no se comparte.
            const r = await post(base('consulta_jackpots'));
            // >>> AJUSTAR CONTRATO: dónde viene el monto del jackpot del bingo
            const lista = Array.isArray(r) ? r : (r.jackpots || r.levels || r.results || []);
            const j = lista[0] || r;
            const monto = Number(j.amount != null ? j.amount : (j.monto_actual != null ? j.monto_actual : j.monto));
            return Number.isFinite(monto) ? monto : null;
        } catch (e) {
            return null;
        }
    },

    /* Evento vigente al arrancar o reconectar (misma acción que la ruleta). */
    async consultarEventoActual() {
        if (this.testMode) return null;
        try { return await post(base('display_current_event')); }
        catch (e) { console.warn('[DB bingo] evento actual no disponible:', e.message); return null; }
    },

    /* Fin del sorteo. En producción el historial y el jackpot los lleva la API. */
    registrarResultado(sorteo, cierreMs) {
        if (this.testMode) Prueba.registrar(sorteo, cierreMs);
    },

    olvidar(ctx) { delete recibidos[claveDe(ctx)]; delete recibidos[String(ctx.event_number)]; },

    validarSorteo: validarSorteo,
    normalizarSorteo: normalizarSorteo,
    ticketCorto: ticketCorto
};

window.BingoDB = BingoDB;


/* =========================================================================
   CONTRATO CON LA API  (lo que debe implementar el backend)

   1) WebSocket del juego (igual que los demás): /ws/pos/grupos/<grupo>/games/<bingo>/countdown/
        { type: 'countdown.update', event_number, sorteo_id, state: 'selling'|..., seconds_left,
          server_time, sales_close_at, game_id, grupo_id, ...cada cuánto hay sorteo }

   2) Datos del sorteo, dentro de los 10 s antes de empezar
      (empujados por el socket o por realizar 'bingo_sorteo' + sorteo_id):
        { event_number, sorteo_id, bolas:[hasta 60; la última es la del BINGO],
          premios:{ cuatro, linea, doble_linea, bingo },
          jackpot:{ monto }, ultimo_jackpot:{ monto, fecha, lugar, ticket },
          ganadores:[ { tipo, bola, numero_bola, lugar, ticket, numeros:[15], monto } ],
          seguimiento:[ { lugar, ticket, numeros:[15] } ] }

   3) realizar 'bingo_programacion' -> pantalla SORTEOS
        { jackpot:{ monto_actual, ultimo:{ monto, fecha, lugar, ticket } },
          historial:[ { sorteo, fecha, hora, premios:{...}, jackpot } ],
          proximos:[ { sorteo, fecha, hora } ],      (opcional: si no, se calculan con el socket)
          sorteos_especiales:[ { id, titulo, fecha, hora, premios:{...} } ] }

   4) realizar 'consulta_jackpots' (ya existe) con el game_id del BINGO.

   La forma de 2) y 3) es la de data/sorteos_prueba_bingo.json.
   ========================================================================= */

})();
