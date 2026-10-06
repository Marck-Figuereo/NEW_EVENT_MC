/* =========================================================================
   VIRTUAL STORM ROULETTE — cone_db_roulette.js

   ADAPTADOR DE BACKEND.

   Se escribió leyendo cone_db_p.js y funcionamiento_p.js SOLO para respetar:

       - el endpoint POST /games
       - la clave 'realizar'
       - el CSRF por cookie (getCookie2)
       - las claves de localStorage: dkg, grupo, game_id, jk, lugar, version
       - QUÉ se consulta y CUÁNDO

   NO se inventa ningún endpoint nuevo.
   NO se copia nada del DOM viejo: aquí no se toca la pantalla.

   Cada consulta devuelve un objeto NORMALIZADO. Si el contrato real todavía
   no está cerrado, el punto exacto donde hay que ajustarlo está marcado con

       // >>> AJUSTAR CONTRATO

   Modo de prueba
   --------------
   RouletteDB.testMode = true  ->  no se llama al backend; se devuelven datos
   sintéticos para poder comprobar el ciclo completo en pantalla.
   Esto NUNCA se activa solo: lo enciende funcionamiento_roulette.js
   únicamente cuando la URL trae ?test=1.
   ========================================================================= */

(function () {
'use strict';


/* =========================================================================
   1. UTILIDADES (mismas que cone_db_p.js)
   ========================================================================= */

function getCookie2(name) {
    let cookieValue = null;

    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');

        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();

            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }

    return cookieValue;
}

function formatoTiempo(segundos) {
    segundos = Number(segundos) || 0;

    const min = Math.floor(segundos / 60);
    const sec = segundos % 60;

    return String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

const moneda = number => new Intl.NumberFormat('es-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
}).format(Number(number) || 0);

/* Los últimos 6 dígitos, igual que hacía el visor anterior. */
function ticketCorto(id) {
    const s = String(id === undefined || id === null ? '' : id);
    return s.length > 6 ? '******' + s.slice(-6) : s;
}


/* =========================================================================
   2. TRANSPORTE — POST /games con CSRF, tal cual el proyecto original
   ========================================================================= */

async function post(url, payload) {
    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
            'X-CSRFToken': getCookie2('csrftoken'),
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = new Error('HTTP ' + response.status + ' en ' + url);
        error.status = response.status;
        throw error;
    }

    return response.json();
}

const ls = k => localStorage.getItem(k);

const esperarMs = ms => new Promise(resolve => setTimeout(resolve, ms));

/* Token revocado o visor inactivo: se limpia y se vuelve a la activacion (QR). */
function volverAConfiguracion() {
    localStorage.clear();
    window.location.href = '/';
}

/* Aplica una configuracion del visor (display_config o heartbeat con config_changed). */
function aplicarConfiguracion(data) {
    if (!data || !data.config) return;

    const gameAnterior  = String(ls('game_id'));
    const grupoAnterior = String(ls('grupo'));

    localStorage.setItem('game_id', data.config.games);
    localStorage.setItem('grupo',   (data.grupo || {}).id);
    localStorage.setItem('version', data.config_version);
    localStorage.setItem('lugar',   (data.lugar || {}).nombre);

    const gameUrl = data.config.game_url;
    if (gameUrl && gameUrl !== ls('url')) {
        localStorage.setItem('url', gameUrl);
        window.location.href = '/' + gameUrl;
        return;
    }

    if (String(ls('game_id')) !== gameAnterior) { location.reload(); return; }

    if (String(ls('grupo')) !== grupoAnterior && typeof RouletteDB.onGrupoCambiado === 'function') {
        RouletteDB.onGrupoCambiado();
    }
}

/* Ganadores de jackpot ya anunciados en este visor (misma clave que los demas juegos). */
const CLAVE_JK_VISTOS = 'jk_ganadores_vistos';

function idGanadorJackpot(item) {
    const ev = (item && item.event) || {};
    if (ev.winner_id != null) return 'w:' + ev.winner_id;
    if (ev.sorteo_id)         return 'j:' + item.jackpot_id + ':' + ev.sorteo_id;
    return null;
}

/* ---------------------------------------------------------------------
   Numero ganador y multiplicativos de la ruleta en el resultado de la API.
   >>> AJUSTAR CONTRATO: la guia no describe el resultado de la ruleta.
   Se prueban las claves mas probables; cuando se confirme el formato real,
   se deja solo la correcta.
   --------------------------------------------------------------------- */
function numeroGanador(item) {
    const r = (item && item.result) || {};
    const odds = ((item && item.settlement) || {}).result_odds || [];
    const candidatos = [
        r.winner_number, r.number, r.winner, r.result_key,
        Array.isArray(r.positions) ? r.positions[0] : undefined,
        odds[0] && odds[0].selection_key
    ];
    for (const c of candidatos) {
        const n = Number(c);
        if (c !== undefined && c !== null && c !== '' && Number.isInteger(n) && n >= 0 && n <= 36) return n;
    }
    return null;
}

function multiplicadoresDe(item) {
    const r = (item && item.result) || {};
    const st = (item && item.settlement) || {};
    const lista = [item && item.multipliers, item && item.multiplicadores, r.multipliers, r.multiplicadores, st.multipliers]
        .find(Array.isArray) || [];
    return lista.map(m => ({
        number: Number(m.number ?? m.numero ?? m.selection_key),
        multiplier: Number(m.multiplier ?? m.multiplicador ?? String(m.value || m.label || '').replace(/\D/g, ''))
    }));
}


/* =========================================================================
   3. RULETA — descripción de un número
   Se usa para alimentar la pantalla de resultados que ya existe
   (results.js espera color / parity / row / dozen / half en español).
   ========================================================================= */

const ROJOS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

function describirNumero(n) {
    n = Number(n);

    if (!Number.isFinite(n) || n < 0 || n > 36) {
        return { color: null, parity: null, row: null, dozen: null, half: null };
    }

    if (n === 0) {
        return { color: 'VERDE', parity: null, row: null, dozen: null, half: null };
    }

    const resto = n % 3;

    return {
        color:  ROJOS.indexOf(n) !== -1 ? 'ROJO' : 'NEGRO',
        parity: n % 2 === 0 ? 'PAR' : 'IMPAR',
        row:    resto === 1 ? '1RA FILA' : resto === 2 ? '2DA FILA' : '3RA FILA',
        dozen:  n <= 12 ? '1-12' : n <= 24 ? '13-24' : '25-36',
        half:   n <= 18 ? '1-18' : '19-36'
    };
}

function colorCorto(n) {
    const d = describirNumero(n);
    return d.color === 'ROJO' ? 'red' : d.color === 'NEGRO' ? 'black' : 'green';
}

/* ui.js (StormUI.api.setJackpots) espera que cada nivel traiga icon y theme.
   Se usan los mismos pares ya aprobados en el panel de jackpots del ZIP,
   para no cambiar el aspecto del visor principal. */
const ICONOS = ['crown', 'gem', 'star', 'spade', 'club', 'pip'];
const TEMAS  = ['gold', 'amber', 'blue', 'red', 'silver', 'purple'];

function decorarNivel(nivel, i) {
    return Object.assign({
        icon:  ICONOS[i % ICONOS.length],
        theme: TEMAS[i % TEMAS.length],
        rate:  1
    }, nivel);
}


/* =========================================================================
   4. DATOS DE PRUEBA (SOLO ?test=1)
   ========================================================================= */
const MULTIPLICADORES_VALIDOS =
    new Set([50, 100, 150, 200, 300, 500]);

function normalizarMultiplicadores(lista) {
    if (!Array.isArray(lista)) return [];

    const vistos = new Set();

    return lista
        .map(item => {
            const number = Number(
                item.number ??
                item.numero ??
                item.n
            );

            const multiplier = Number(
                item.multiplier ??
                item.multiplicador ??
                item.mult ??
                item.value
            );

            if (
                !Number.isInteger(number) ||
                number < 0 ||
                number > 36 ||
                !MULTIPLICADORES_VALIDOS.has(multiplier)
            ) {
                return null;
            }

            /* Un número solo puede tener UN multiplicativo por sorteo. */
            if (vistos.has(number)) return null;
            vistos.add(number);

            return {
                number,
                multiplier,
                value: 'x' + multiplier,
                /* El color sale del número, no de un texto recibido.
                   results.js lo usa para la bola de cada multiplicativo. */
                color: colorCorto(number)
            };
        })
        .filter(Boolean);
}


const TEST = {
    data: null,
    currentEvent: 1240,

    async load() {
        if (this.data) return this.data;

        const response = await fetch(
            'data/sorteos_prueba.json?v=1',
            { cache: 'no-store' }
        );

        if (!response.ok) {
            throw new Error('No se pudo cargar sorteos_prueba.json');
        }

        this.data = await response.json();

        if (
            !Array.isArray(this.data.sorteos) ||
            this.data.sorteos.length !== 15
        ) {
            throw new Error('El JSON debe contener exactamente 15 sorteos');
        }

        this.currentEvent = Number(
            this.data.start_event ||
            this.data.sorteos[0].event_number
        );

        const problemas = validarDatosPrueba(this.data);
        if (problemas.length) {
            console.warn('[DB] sorteos_prueba.json tiene ' + problemas.length +
                         ' incoherencia(s):\n  - ' + problemas.join('\n  - '));
        }

        return this.data;
    },

    /* Sorteo EXACTO del JSON (sin dar la vuelta a la lista), o null. */
    exacto(eventNumber) {
        const n = Number(eventNumber);
        return this.data.sorteos.find(item => Number(item.event_number) === n) || null;
    },

    select(eventNumber) {
        const n = Number(eventNumber);
        if (Number.isFinite(n)) {
            this.currentEvent = n;
        }
    },

    draw(eventNumber = this.currentEvent) {
        const lista = this.data.sorteos;
        /* null / '' no son un sorteo: Number(null) daría 0 y se elegiría
           otro sorteo al dar la vuelta a la lista. */
        const recibido = (eventNumber === null || eventNumber === undefined || eventNumber === '')
            ? NaN
            : Number(eventNumber);

        const evento = Number.isFinite(recibido)
            ? recibido
            : this.currentEvent;

        let index = lista.findIndex(item =>
            Number(item.event_number) === evento
        );

        if (index < 0) {
            const inicio = Number(
                this.data.start_event ||
                lista[0].event_number
            );

            index = ((evento - inicio) % lista.length + lista.length)
                % lista.length;
        }

        const sorteo = JSON.parse(
            JSON.stringify(lista[index])
        );

        sorteo.event_number = evento;
        sorteo.table_odds_id =
            sorteo.table_odds_id || 9000 + evento;

        sorteo.resultado = sorteo.resultado || {};
        sorteo.resultado.draw_number = evento;

        return sorteo;
    }
};


/* Estadísticas con las mismas reglas que ui.js (GAME.recompute):
   el 0 cuenta para rojo/verde/negro y para el total, y para nada más.
   hot  = más frecuentes (empate: número menor)
   cold = menos frecuentes (empate: número menor) */
function calcularEstadisticas(historial) {
    const s = {
        rojo: 0, verde: 0, negro: 0,
        low: 0, high: 0, par: 0, impar: 0,
        d1: 0, d2: 0, d3: 0,
        c1: 0, c2: 0, c3: 0,
        total: 0
    };
    const conteo = new Map();

    historial.forEach(item => {
        const n = Number(item.n);
        conteo.set(n, (conteo.get(n) || 0) + 1);
        s.total++;
        s[describirNumero(n).color.toLowerCase()]++;
        if (n === 0) return;
        if (n <= 18) s.low++; else s.high++;
        if (n % 2) s.impar++; else s.par++;
        if (n <= 12) s.d1++; else if (n <= 24) s.d2++; else s.d3++;
        const col = n % 3;
        if (col === 1) s.c1++; else if (col === 2) s.c2++; else s.c3++;
    });

    const todos = [];
    for (let n = 0; n <= 36; n++) todos.push({ n: n, c: conteo.get(n) || 0 });
    s.hot  = todos.slice().sort((a, b) => b.c - a.c || a.n - b.n).slice(0, 6).map(o => o.n);
    s.cold = todos.slice().sort((a, b) => a.c - b.c || a.n - b.n).slice(0, 6).map(o => o.n);
    return s;
}

/* Revisa que el JSON de prueba sea coherente consigo mismo. No corrige
   nada: solo avisa en consola. */
function validarDatosPrueba(data) {
    const out = [];
    const lista = data.sorteos || [];

    lista.forEach((s, i) => {
        const tag = '#' + s.event_number;
        const r = s.resultado || {};
        const w = Number(r.winner_number);
        const info = describirNumero(w);

        ['color', 'parity', 'row', 'dozen', 'half'].forEach(k => {
            if ((r[k] ?? null) !== info[k]) out.push(tag + ' resultado.' + k + ' = ' + r[k] + ' (por número: ' + info[k] + ')');
        });

        const activos = normalizarMultiplicadores(s.multiplicadores || []);
        /* resultado.multipliers = todos los multiplicativos del sorteo */
        const esperados = activos.map(m => m.number + 'x' + m.multiplier).join(',');
        const recibidos = normalizarMultiplicadores(r.multipliers || []).map(m => m.number + 'x' + m.multiplier).join(',');
        if (esperados !== recibidos) out.push(tag + ' resultado.multipliers = [' + recibidos + '] (esperado [' + esperados + '])');

        const h = Array.isArray(s.historial) ? s.historial : [];
        if (h.length !== 15) out.push(tag + ' historial tiene ' + h.length + ' elementos (deben ser 15)');
        if (h.length && Number(h[0].n) !== w) out.push(tag + ' historial[0] = ' + h[0].n + ' (ganador ' + w + ')');
        if (h.length) {
            const propio = activos.find(m => m.number === w);
            const mh = Number(h[0].multiplier) || 0;
            if (mh !== (propio ? propio.multiplier : 0)) {
                out.push(tag + ' historial[0].multiplier = ' + mh + ' (el ganador ' + (propio ? 'tiene x' + propio.multiplier : 'no tiene multiplicativo') + ')');
            }
        }

        if (s.estadisticas) {
            const calc = calcularEstadisticas(h);
            Object.keys(calc).forEach(k => {
                if (JSON.stringify(s.estadisticas[k]) !== JSON.stringify(calc[k])) {
                    out.push(tag + ' estadisticas.' + k + ' = ' + JSON.stringify(s.estadisticas[k]) + ' (historial: ' + JSON.stringify(calc[k]) + ')');
                }
            });
        } else {
            out.push(tag + ' sin estadisticas');
        }

        const tickets = (s.bonos || []).map(b => String(b.ticket));
        if (new Set(tickets).size !== tickets.length) out.push(tag + ' bonos con ticket repetido');

        if (s.jackpot && s.jackpot.ticket != null && s.jackpots) {
            const nivel = (s.jackpots.niveles || []).find(x => x.key === s.jackpot.tipo);
            if (!nivel) out.push(tag + ' jackpot.tipo ' + s.jackpot.tipo + ' no existe en jackpots.niveles');
            else if (Math.abs(Number(nivel.amount) - Number(s.jackpot.monto)) > 0.005) {
                out.push(tag + ' jackpot.monto ' + s.jackpot.monto + ' distinto del nivel ' + nivel.key + ' (' + nivel.amount + ')');
            }
        }

        /* jackpots.ultimo no puede anunciar el ganador de un sorteo futuro */
        const ult = s.jackpots && s.jackpots.ultimo;
        if (!ult || ult.ticket === undefined || ult.ticket === null) {
            out.push(tag + ' sin jackpots.ultimo: el panel ÚLTIMO JACKPOT quedaría vacío');
        }
        if (ult && ult.ticket != null) {
            lista.slice(i + 1).forEach(f => {
                if (f.jackpot && String(f.jackpot.ticket) === String(ult.ticket)) {
                    out.push(tag + ' jackpots.ultimo anuncia el ganador de #' + f.event_number + ' antes de que ocurra');
                }
            });
        }

        const prev = lista[i - 1];
        if (prev && prev.jackpots && s.jackpots) {
            (s.jackpots.niveles || []).forEach(lv => {
                const antes = (prev.jackpots.niveles || []).find(x => x.key === lv.key);
                if (antes && Number(lv.amount) <= Number(antes.amount)) {
                    out.push(tag + ' jackpot ' + lv.key + ' no crece (' + antes.amount + ' -> ' + lv.amount + ')');
                }
            });
        }
    });

    if (lista.length !== 15) out.push('hay ' + lista.length + ' sorteos (deben ser 15)');
    return out;
}

function normalizarHistorial(lista) {
    return (lista || [])
        .map(item => {
            const bruto =
                item.multiplier ??
                item.multiplicador ??
                item.value ??
                0;

            return {
                n: Number(item.n ?? item.number),
                multiplier: Number(
                    String(bruto).replace(/[^0-9.-]/g, '')
                ) || 0
            };
        })
        .filter(item =>
            Number.isInteger(item.n) &&
            item.n >= 0 &&
            item.n <= 36
        );
}

/* Bonos de prueba: sin tickets repetidos. */
function bonosUnicos(lista) {
    const vistos = new Set();
    return (Array.isArray(lista) ? lista : []).filter(b => {
        if (!b || b.ticket === undefined || b.ticket === null) return false;
        const k = String(b.ticket);
        if (vistos.has(k)) return false;
        vistos.add(k);
        return true;
    }).map(b => ({ ...b }));
}


/* =========================================================================
   5. API PÚBLICA
   ========================================================================= */

const RouletteDB = {

    testMode: false,

    async cargarDatosPrueba() {
        if (this.testMode) {
            await TEST.load();
        }
    },

    /* SOLO PRUEBA: primera ronda y table_odds_id según el JSON. */
    eventoInicialPrueba() {
        return this.testMode && TEST.data
            ? Number(TEST.data.start_event || TEST.data.sorteos[0].event_number)
            : null;
    },

    tablaDePrueba(eventNumber) {
        return this.testMode && TEST.data
            ? Number(TEST.draw(eventNumber).table_odds_id) || null
            : null;
    },

    seleccionarSorteo(eventNumber) {
        if (this.testMode) {
            TEST.select(eventNumber);
        }
    },

    /* Diagnóstico de los datos de prueba (consola). */
    validarDatosPrueba() {
        return TEST.data ? validarDatosPrueba(TEST.data) : ['JSON no cargado'];
    },
    calcularEstadisticas,

    /* Utilidades que también usa el controlador */
    moneda,
    formatoTiempo,
    getCookie2,
    ticketCorto,
    describirNumero,
    colorCorto,


    /* ---------------------------------------------------------------------
       display_config — refresca la configuración del display.
       Igual que confirmar_configuracion() de cone_db_p.js
       --------------------------------------------------------------------- */
    async confirmarConfiguracion() {
        if (this.testMode) return true;

        try {
            const data = await post('/games', {
                realizar: 'display_config',
                device_token: ls('dkg')
            });

            if (data.config_version != ls('version')) aplicarConfiguracion(data);

            return true;

        } catch (e) {
            if (e.status === 404) volverAConfiguracion();
            console.warn('[DB] confirmarConfiguracion:', e.message);
            return false;
        }
    },

    /* ---------------------------------------------------------------------
       display_heartbeat (guia 5.5): cada heartbeat_interval_seconds.
       Si cambia config_version, Django devuelve la configuracion nueva.
       --------------------------------------------------------------------- */
    heartbeatSegundos: 30,

    async enviarHeartbeat() {
        if (this.testMode) return;

        try {
            const data = await post('/games', {
                realizar: 'display_heartbeat',
                device_token: ls('dkg'),
                config_version: ls('version')
            });

            const intervalo = Number(((data || {}).heartbeat || {}).heartbeat_interval_seconds);
            if (intervalo > 0) this.heartbeatSegundos = intervalo;

            if (data.config_changed) aplicarConfiguracion(data.config);

        } catch (e) {
            if (e.status === 404) await this.confirmarConfiguracion();     // se confirma antes de sacar al visor
            else if (e.status === 501) this.heartbeatSegundos = 300;       // la API aun no tiene heartbeat
            else console.warn('[DB] heartbeat:', e.message);

        } finally {
            setTimeout(() => this.enviarHeartbeat(), this.heartbeatSegundos * 1000);
        }
    },

    /* ---------------------------------------------------------------------
       consulta_tabla — cuotas de la mesa para el table_odds_id vigente.
       Devuelve el objeto crudo; quien lo pinta es el visor principal.
       --------------------------------------------------------------------- */
    async consultarTabla(tableOddsId) {
        if (this.testMode) return {};

        try {
            return await post('/games', {
                realizar: 'consulta_tabla',
                table_odds_id: tableOddsId
            });

        } catch (e) {
            console.warn('[DB] consultarTabla:', e.message);
            return null;
        }
    },


    /* ---------------------------------------------------------------------
       consulta_jackpots — montos actuales + último ganador.
       --------------------------------------------------------------------- */
    /* En prueba:
         niveles -> los del sorteo (sorteo.jackpots antes que la raíz);
         ultimo  -> el último ganador conocido ANTES de este sorteo, es decir
                    el del sorteo anterior (o el de la raíz para el primero).
                    Así el panel no anuncia un jackpot que todavía no salió.
       despuesDelSorteo = true -> ultimo del propio sorteo (ya se jugó). */
    async consultarJackpots(eventNumber, despuesDelSorteo = false) {
        if (this.testMode) {
            const sorteo = TEST.draw(eventNumber);
            const fuente =
                sorteo.jackpots ||
                TEST.data.jackpots ||
                {};

            let ultimo;
            if (despuesDelSorteo) {
                ultimo = fuente.ultimo;
            } else {
                const anterior = TEST.exacto(sorteo.event_number - 1);
                ultimo = anterior
                    ? (anterior.jackpots || {}).ultimo
                    : (TEST.data.jackpots || {}).ultimo;
            }

            return {
                niveles: (fuente.niveles || []).map(decorarNivel),
                ultimo: ultimo && ultimo.ticket != null ? { ...ultimo } : null
            };
        }

        try {
            const data = await post('/games', {
                realizar: 'consulta_jackpots',
                device_token: ls('dkg'),
                game_id: ls('game_id')
            });

            const lista = Array.isArray(data && data.jackpots) ? data.jackpots : [];

            /* Un nivel por jackpot, en el orden de la API (ya viene por prioridad). */
            const niveles = lista.slice(0, 6).map(j => ({
                key:    String(j.jackpot_id),
                name:   String(j.level_name || j.name || 'JACKPOT').toUpperCase(),
                amount: Number(j.current_amount) || 0
            })).map(decorarNivel);

            /* ULTIMO JACKPOT: el ganador mas reciente entre los jackpots del visor. */
            const conGanador = lista.filter(j => j.last_winner_at);
            const reciente = conGanador.sort((a, b) => String(b.last_winner_at).localeCompare(String(a.last_winner_at)))[0];

            return {
                niveles: niveles,
                ultimo: reciente ? {
                    type:   String(reciente.level_name || reciente.name || 'JACKPOT').toUpperCase(),
                    ticket: reciente.last_winner_ticket_id,
                    amount: Number(reciente.last_winner_amount) || 0,
                    place:  reciente.last_winner_lugar,
                    date:   String(reciente.last_winner_at).slice(0, 10).split('-').reverse().join('/')
                } : null
            };

        } catch (e) {
            console.warn('[DB] consultarJackpots:', e.message);
            return null;
        }
    },


    /* ---------------------------------------------------------------------
       history_results — últimos números para el visor principal.
       --------------------------------------------------------------------- */
    async consultarHistorial(eventNumber) {
        if (this.testMode) {
            return normalizarHistorial(TEST.draw(eventNumber).historial);
        }

        try {
            const data = await post('/games', {
                realizar: 'history_results',
                game_id:  ls('game_id'),
                device_token: ls('dkg')
            });

            return (data.results || []).map(r => {
                const n = numeroGanador(r);
                const propio = multiplicadoresDe(r).find(m => m.number === n);
                return { n: n, multiplier: propio ? propio.multiplier : 0 };
            }).filter(r => Number.isInteger(r.n));

        } catch (e) {
            console.warn('[DB] consultarHistorial:', e.message);
            return null;
        }
    },

    async consultarEstadisticas(eventNumber) {
        if (this.testMode) {
            const sorteo = TEST.draw(eventNumber);
            return sorteo.estadisticas ? { ...sorteo.estadisticas } : null;
        }

        return null;
    },

    /* SOLO PRUEBA — lo que la pantalla principal debe mostrar ANTES de que
       se juegue `eventNumber`: el historial y las estadísticas del sorteo
       anterior. Para el primer sorteo del JSON no hay anterior: se usan los
       14 resultados previos de su propio historial (sin su resultado, que
       todavía no ha salido) y las estadísticas se calculan de esa misma
       lista. Nada es aleatorio. */
    async consultarEstadoPrevio(eventNumber) {
        if (!this.testMode) return null;

        const actual = TEST.draw(eventNumber);
        const anterior = TEST.exacto(actual.event_number - 1);

        if (anterior) {
            return {
                historial: normalizarHistorial(anterior.historial),
                estadisticas: anterior.estadisticas ? { ...anterior.estadisticas } : null
            };
        }

        const historial = normalizarHistorial((actual.historial || []).slice(1));
        return {
            historial: historial,
            estadisticas: calcularEstadisticas(historial)
        };
    },


    /* ---------------------------------------------------------------------
       consulta_resultados — el resultado de la ronda que se va a transmitir.
       En funcionamiento_p.js esto se pedía JUSTO ANTES del intro y devolvía
       data['selected_video']. Aquí se conserva ese momento y esa clave.
       --------------------------------------------------------------------- */
    async consultarResultados(eventNumber, sorteoId = null) {
        if (this.testMode) {
            const sorteo = TEST.draw(eventNumber);
            const resultado = sorteo.resultado || {};

            const numero = Number(resultado.winner_number);
            const valido = Number.isInteger(numero) && numero >= 0 && numero <= 36;

            /* Multiplicativos DISPONIBLES del sorteo: los mismos para el
               intro, el video y el panel lateral. */
            const activos = normalizarMultiplicadores(
                sorteo.multiplicadores || []
            );

            /* MULTIPLICATIVOS GANADORES (pantalla final) = TODOS los
               multiplicativos del sorteo, los mismos del intro y del video,
               como en el diseño aprobado. */
            const ganadores = activos;

            /* Color, paridad, fila, docena y mitad salen del número. */
            const info = valido ? describirNumero(numero) : {};

            return {
                event_number: sorteo.event_number,
                table_odds_id: sorteo.table_odds_id,
                selected_video: sorteo.selected_video || null,

                multiplicadores: activos,

                resultado: {
                    draw_number: sorteo.event_number,
                    winner_number: valido ? numero : null,
                    color:  info.color  ?? null,
                    parity: info.parity ?? null,
                    row:    info.row    ?? null,
                    dozen:  info.dozen  ?? null,
                    half:   info.half   ?? null,
                    multipliers: ganadores.map(m => ({ ...m }))
                }
            };
        }

        /* El resultado del sorteo que cerro puede tardar unos segundos en
           publicarse: se reintenta cada 2 s (maximo 20 s) hasta que
           results[0] sea ese sorteo, para no reproducir otro. */
        const inicio = Date.now();
        let data = null;

        while (true) {
            try {
                data = await post('/games', {
                    realizar: 'consulta_resultados',
                    game_id:  ls('game_id'),
                    device_token: ls('dkg')
                });
            } catch (e) {
                console.warn('[DB] consultarResultados:', e.message);
                data = null;
            }

            const esEste = data && (
                (sorteoId && data.sorteo_id) ? data.sorteo_id === sorteoId
                                             : String(data.event_number) === String(eventNumber)
            );

            if (esEste) break;

            if (Date.now() - inicio + 2000 > 20000) {
                console.warn('[DB] el resultado de la ronda ' + eventNumber + ' no llego a tiempo', data);
                return null;
            }

            await esperarMs(2000);
        }

        const numero = numeroGanador(data);
        const info = describirNumero(numero);
        const mults = normalizarMultiplicadores(multiplicadoresDe(data));

        return {
            event_number:   data.event_number,
            sorteo_id:      data.sorteo_id,
            table_odds_id:  data.table_odds_id,
            selected_video: data.selected_video || null,
            multiplicadores: mults,
            resultado: {
                draw_number:   data.event_number,
                winner_number: numero,
                color:  info.color,
                parity: info.parity,
                row:    info.row,
                dozen:  info.dozen,
                half:   info.half,
                multipliers: mults.slice(0, 5)
            }
        };
    },


    /* ---------------------------------------------------------------------
       consulta_gandores_jack — ¿hay ganador de JACKPOT en esta ronda?

       Devuelve el objeto del ganador, o null si no hay.
       El visor solo muestra la pantalla cuando esto NO es null.

       Igual que el original, un mismo ticket no se muestra dos veces:
       se recuerda en localStorage('w_j').
       --------------------------------------------------------------------- */
    async consultarGanadorJackpot(eventNumber) {
        if (this.testMode) {
            const jk = TEST.draw(eventNumber).jackpot;
            /* null / sin ticket = no hubo jackpot en este sorteo */
            return jk && jk.ticket != null ? { ...jk } : null;
        }

        try {
            const data = await post('/games', {
                realizar: 'consulta_gandores_jack',
                device_token: ls('dkg'),
                game_id: ls('game_id')
            });

            if (!data || !Array.isArray(data.events)) return null;

            const primeraVez = ls(CLAVE_JK_VISTOS) === null;
            let vistos = [];
            try { vistos = JSON.parse(ls(CLAVE_JK_VISTOS)) || []; } catch (_) { vistos = []; }

            const nuevos = data.events.filter(item => {
                const id = idGanadorJackpot(item);
                return id && vistos.indexOf(id) === -1;
            });

            nuevos.forEach(item => vistos.push(idGanadorJackpot(item)));
            localStorage.setItem(CLAVE_JK_VISTOS, JSON.stringify(vistos.slice(-50)));

            /* Primer arranque del visor: se registran sin anunciarlos. */
            if (primeraVez || !nuevos.length) return null;

            const item = nuevos[0];
            const ev = item.event || {};

            return {
                tipo:   String(item.level_name || item.name || 'JACKPOT').toUpperCase(),
                lugar:  ev.winner_lugar,
                ticket: ev.ticket_code,
                monto:  Number(ev.winner_amount) || 0,
                fecha:  ev.selected_at
            };

        } catch (e) {
            console.warn('[DB] consultarGanadorJackpot:', e.message);
            return null;
        }
    },


    /* ---------------------------------------------------------------------
       consulta_bonos — ¿hay ganador de BONO en esta ronda?
       Devuelve el objeto del ganador, o null.
       --------------------------------------------------------------------- */
    async consultarBonos(eventNumber, sorteoId = null) {
        if (this.testMode) {
            return bonosUnicos(TEST.draw(eventNumber).bonos);
        }

        if (!sorteoId) return [];
        if (ls('id_b') === String(sorteoId)) return [];     // este sorteo ya se mostro

        const inicio = Date.now();

        while (true) {
            try {
                const data = await post('/games', {
                    realizar: 'consulta_bonos',
                    device_token: ls('dkg'),
                    game_id: ls('game_id'),
                    sorteo_id: sorteoId
                });

                const mismo = data && (!data.sorteo_id || data.sorteo_id === sorteoId);

                if (mismo && data.has_bonus_event && Array.isArray(data.winners) && data.winners.length) {
                    localStorage.setItem('id_b', String(sorteoId));

                    /* Un solo ganador de bono por localidad y sorteo. */
                    const g = data.winners[0];
                    return [{ ticket: g.masked_ticket_code || g.short_code, monto: Number(g.bonus_amount) || 0 }];
                }

            } catch (e) {
                /* 400 / 404 / 501: la API rechazo la consulta; reintentar no cambia nada. */
                if (e.status === 400 || e.status === 404 || e.status === 501) return [];
                console.warn('[DB] consultarBonos:', e.message);
            }

            if (Date.now() - inicio + 2000 > 10000) return [];

            await esperarMs(2000);
        }
    }
};


window.RouletteDB = RouletteDB;

})();