const MULTIPLICADORES_VALIDOS = new Set([50, 100, 150, 200, 300, 500]);

function pintarMultiplicadoresVideo(lista, box) {
    if (!box) return;

    box.textContent = '';

    const vistos = new Set();

    const datos = (Array.isArray(lista) ? lista : [])
        .map(item => ({
            number: Number(item.number),
            multiplier: Number(
                item.multiplier ??
                String(item.value || '').replace(/\D/g, '')
            )
        }))
        .filter(item =>
            Number.isInteger(item.number) &&
            item.number >= 0 &&
            item.number <= 36 &&
            MULTIPLICADORES_VALIDOS.has(item.multiplier)
        )
        .filter(item => {
            /* Un multiplicativo por número, igual que el adaptador y el intro. */
            if (vistos.has(item.number)) return false;

            vistos.add(item.number);
            return true;
        });

    for (const item of datos) {
        const row = document.createElement('div');
        row.className = 'video-multiplier-row';

        const color = RouletteDB.colorCorto(item.number);

        const ball = document.createElement('img');
        ball.className = 'video-multiplier-ball';
        ball.src =
            'screens/show-result-roulette/assets/ui/results/ball_' +
            color + '.png';

        const number = document.createElement('span');
        number.className = 'video-multiplier-number';
        number.textContent = String(item.number);

        const multiplier = document.createElement('img');
        multiplier.className = 'video-multiplier-art';
        multiplier.src =
            'screens/show-result-roulette/assets/ui/multiplicativos/x' +
            item.multiplier + '.png';

        multiplier.alt = 'x' + item.multiplier;

        row.append(ball, number, multiplier);
        box.appendChild(row);
    }
}

/* =========================================================================
   VIRTUAL STORM ROULETTE — funcionamiento_roulette.js

   CONTROLADOR DEL CICLO. No dibuja nada.

       PANTALLA PRINCIPAL -> INTRO -> VIDEO -> [JACKPOT] -> [BONO]
       -> RESULTADO -> PANTALLA PRINCIPAL -> ...

   Cada pantalla ya existe y se usa tal cual:

       PRINCIPAL / RESULTADO   screens/show-result-roulette/  (ZIP entregado)
       INTRO                   screens/show-intro-roulette/   (ZIP entregado)
       JACKPOT                 title_jk.png    + show_jackpots.png
       BONO                    title_bono.png  + show_bono.png
       VIDEO                   assets/video.mp4

   El TIEMPO lo manda el WebSocket, nunca un temporizador local:

       data.seconds_left   -> contador real que muestra el visor principal
       data.event_number   -> ronda; una ronda = un solo ciclo
       data.table_odds_id  -> sincronización de cuotas

   Este archivo se escribió leyendo funcionamiento_p.js SOLO para respetar
   ese funcionamiento. Nada de su DOM ni de su diseño se copió.
   ========================================================================= */



(function () {
'use strict';


/* =========================================================================
   1. CONFIGURACIÓN
   ========================================================================= */

const CONFIG = {

    /* ---------------------------------------------------------------------
       >>> AQUÍ SE CAMBIAN LOS VIDEOS DEFINITIVOS <<<

       Hoy apunta al video de prueba entregado: assets/video.mp4

       Cuando el backend devuelva su propio nombre en
       consulta_resultados -> data['selected_video'],
       ese valor gana y se resuelve contra videoBase.
       --------------------------------------------------------------------- */
    videoSorteo: 'assets/video.mp4',
    videoBase:   'assets/',

    /* VIDEO REAL DEL SORTEO: el nombre llega de la API (selected_video) y se busca en
       http://localhost:3000/RULETA/nombre_video.mp4, igual que los demas juegos
       (solo cambia la carpeta). Si no llega nombre, se usa el video por numero. */
    videoApiBase: 'http://localhost:3000/RULETA/',

    /* VIDEO SEGÚN EL NÚMERO GANADOR
       Carpeta con un video por número: NN_A.webm (00_A.webm ... 36_A.webm).
       Si el backend manda selected_video, ese gana. Si el archivo del número
       no existe o falla, se reproduce videoSorteo para no cortar el ciclo. */
    videosPorNumero: 'assets/videos/',
    videoVariante:   'A',
    videoExtension:  '.webm',

    socket: {
        host:  '127.0.0.1:8500',
        reintento: 1000
    },

    /* Segundos restantes en los que se re-sincronizan cuotas e historial.
       Mismo criterio que funcionamiento_p.js (60 y 120). */
    marcasSincro: [120, 60],

   ciclo: {
        roundSeconds: 180,

        introMs: 10000,
        jackpotMs: 15000,
        bonusMs: 15000,
        resultMs: 20000
    },
};


const params   = new URLSearchParams(location.search);
const TEST_MODE = params.get('test') === '1';

const DEBUG_BUILD = false;
const DEBUG = DEBUG_BUILD && params.get('debug') === '1';

/* Solo para medir rendimiento: mantiene la pantalla principal en pantalla. */
const HOLD_TABLE = params.get('hold') === 'table';




/* =========================================================================
   2. ESTADO
   ========================================================================= */

const STATE = {
    vista: 'boot',          // boot | table | intro | video | jackpot | bonus | result
    ronda: null,            // event_number en curso
    segundos: null,         // seconds_left del socket
    tableOddsId: null,

    rondaEjecutada: null,   // event_number cuyo ciclo ya se disparó
    rondaSincronizada: {},  // { event_number: [marcas ya usadas] }
    ciclando: false,

    listeners: []
};

function setVista(v) {
    STATE.vista = v;
    hud();
    STATE.listeners.forEach(f => { try { f(v); } catch (_) {} });
}


/* =========================================================================
   3. NODOS
   ========================================================================= */

const el = {
    stage:    document.getElementById('stage'),
    panelBg:  document.getElementById('panel-bg'),
    panelVeil:document.getElementById('panel-veil'),

    videoMultipliers: document.getElementById('video-multipliers'),

    table:    document.getElementById('view-table'),
    intro:    document.getElementById('view-intro'),
    video:    document.getElementById('view-video'),
    jackpot:  document.getElementById('view-jackpot'),
    bonus:    document.getElementById('view-bonus'),
    result:   document.getElementById('view-result'),

    hint:     document.getElementById('tap-hint'),
    hud:      document.getElementById('flow-hud'),

    jkType:   document.getElementById('jk-type'),
    jkPlace:  document.getElementById('jk-place'),
    jkTicket: document.getElementById('jk-ticket'),
    jkAmount: document.getElementById('jk-amount'),

    bnTicket: document.getElementById('bn-ticket'),
    bnAmount: document.getElementById('bn-amount')
};

const VISTAS = [el.table, el.intro, el.video, el.jackpot, el.bonus, el.result];


/* =========================================================================
   4. ESCALADO DEL ESCENARIO 1920x1080
   ========================================================================= */

function escalar() {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    el.stage.style.setProperty('--s', s);
}

window.addEventListener('resize', escalar);
escalar();


/* =========================================================================
   5. COMPATIBILIDAD DE CÓDEC (no toca ningún archivo original)

   Los tres videos entregados son H.264. Chrome normal los reproduce.
   Algunas builds de Chromium sin códecs propietarios no. En ese caso —y
   SOLO en ese caso— se usa la copia WebM de codec_fallback/, que se generó
   a partir de esos mismos MP4. En Chrome nunca se ejecuta.
   ========================================================================= */

const SIN_H264 = !document.createElement('video')
    .canPlayType('video/mp4; codecs="avc1.42E01E"');

const FALLBACK = {
    'video.mp4':             'codec_fallback/video.webm',
    'storm_bg.mp4':          'codec_fallback/storm_bg.webm',
    'background_1080p.mp4':  'codec_fallback/background_1080p.webm'
};

function resolverVideo(ruta, prefijo) {
    if (!SIN_H264) return ruta;

    const nombre = String(ruta).split('/').pop();
    const alt = FALLBACK[nombre];

    return alt ? (prefijo || '') + alt : ruta;
}

/* Se aplica a los <video> que viven dentro de los iframes originales. */
function parchearCodec(doc, prefijo) {
    if (!SIN_H264 || !doc) return;

    doc.querySelectorAll('video').forEach(v => {
        const alt = resolverVideo(v.getAttribute('src') || '', prefijo);
        if (alt !== v.getAttribute('src')) {
            v.setAttribute('src', alt);
            v.load();
            v.play().catch(() => {});
        }
    });
}

if (SIN_H264) {
    console.warn('[flow] Navegador sin H.264: se usan las copias WebM de codec_fallback/.');
}


/* =========================================================================
   6. VISIBILIDAD **Y EJECUCIÓN** DE LAS CAPAS

   opacity/visibility solo esconden. Cada iframe es una aplicación completa,
   con su propio GSAP, su propio render loop y su propio video: si no se le
   dice nada, sigue trabajando detrás de la pantalla que sí se ve.

   Por eso mostrar() no cambia solo la visibilidad: también decide quién
   puede ejecutarse. En ningún instante hay más de una aplicación canvas
   trabajando.
   ========================================================================= */

/* vista del ciclo -> qué iframe puede ejecutarse */
const ACTIVIDAD = {
    boot:    { table: false, intro: false, result: false },
    table:   { table: true,  intro: false, result: false },
    intro:   { table: false, intro: true,  result: false },
    video:   { table: false, intro: false, result: false },
    jackpot: { table: false, intro: false, result: false },
    bonus:   { table: false, intro: false, result: false },
    result:  { table: false, intro: false, result: true  }
};

function hostDe(win, prop) {
    const api = win && win[prop];
    return api && typeof api.setHostActive === 'function' ? api : null;
}

function aplicarActividad(nombreVista) {
    const plan = ACTIVIDAD[nombreVista] || ACTIVIDAD.boot;

    const t = hostDe(Puente.tableWin,  'StormTable');
    const i = hostDe(Puente.introWin,  'RouletteMultipliers');
    const r = hostDe(Puente.resultWin, 'StormResults');

    if (t) t.setHostActive(plan.table);
    if (i) i.setHostActive(plan.intro);
    if (r) r.setHostActive(plan.result);

    /* Al reactivar TABLE se le entrega de golpe lo que se acumuló mientras
       estuvo suspendida: ronda, contador, jackpots, historial y resultados. */
    if (plan.table) Puente.volcarFeed();
}

/* Qué vista del ciclo corresponde a cada capa. */
function nombreDe(vista) {
    if (vista === el.table)   return 'table';
    if (vista === el.intro)   return 'intro';
    if (vista === el.video)   return 'video';
    if (vista === el.jackpot) return 'jackpot';
    if (vista === el.bonus)   return 'bonus';
    if (vista === el.result)  return 'result';
    return 'boot';
}

function mostrar(vista, conFondo) {

    const mostrarMults =
    vista === el.video &&
    el.videoMultipliers &&
    el.videoMultipliers.children.length > 0;

    if (el.videoMultipliers) {
        el.videoMultipliers.classList.toggle('is-active', mostrarMults);
        el.videoMultipliers.setAttribute(
            'aria-hidden',
            mostrarMults ? 'false' : 'true'
        );
    }


    VISTAS.forEach(v => v.classList.toggle('is-active', v === vista));

    el.panelBg.classList.toggle('is-active', !!conFondo);
    el.panelVeil.classList.toggle('is-active', !!conFondo);

    if (conFondo) el.panelBg.play().catch(() => {});
    else          el.panelBg.pause();

    /* El video del sorteo solo decodifica durante su propia fase. */
    if (vista !== el.video && !el.video.paused) el.video.pause();

    /* Y aquí es donde se suspenden de verdad las views inactivas. */
    aplicarActividad(nombreDe(vista));
}


/* =========================================================================
   6b. AUDITORÍA DE ACTIVIDAD

   No se fía de una bandera: cuenta frames REALES durante una ventana en
   cada iframe. Si un render loop sigue vivo detrás, aquí se ve.

   Desde la consola:  await auditarActividad()
   ========================================================================= */

function auditarActividad(ms) {
    ms = ms || 400;

    const apps = [
        ['TABLE ', hostDe(Puente.tableWin,  'StormTable')],
        ['INTRO ', hostDe(Puente.introWin,  'RouletteMultipliers')],
        ['RESULT', hostDe(Puente.resultWin, 'StormResults')]
    ];

    const t0 = apps.map(a => (a[1] ? a[1].frames : 0));

    return new Promise(resolve => setTimeout(() => {

        const lineas = ['VIEW = ' + STATE.vista.toUpperCase()];

        apps.forEach((a, k) => {
            const api = a[1];

            if (!api) { lineas.push(a[0] + '  (sin API)'); return; }

            const fps = Math.round((api.frames - t0[k]) / (ms / 1000));

            lineas.push(
                a[0] +
                '  host activo: ' + (api.hostActive ? 'sí' : 'no') +
                ' | frames/s: ' + String(fps).padStart(3) +
                ' | video pausado: ' + api.videoPaused
            );
        });

        lineas.push('VIDEO    pausado: ' + el.video.paused +
                    ' | t=' + el.video.currentTime.toFixed(2));
        lineas.push('PANEL-BG pausado: ' + el.panelBg.paused);

        const txt = lineas.join('\n');
        console.log('[act] ' + txt.split('\n').join('\n[act] '));

        resolve(txt);
    }, ms));
}

window.auditarActividad = auditarActividad;


/* =========================================================================
   6b. AUDITORÍA DE RESOLUCIÓN REAL

   Imprime el framebuffer efectivo de cada canvas y la resolución realmente
   decodificada de cada video. Sirve para comprobar que nada trabaja por
   encima de 1920x1080 y que devicePixelRatio no está inflando el render
   target por detrás.
   ========================================================================= */

function auditarResolucion() {
    const filas = [];

    const canvasDe = (iframe, sel, nombre) => {
        try {
            const c = iframe.contentDocument.querySelector(sel);
            if (c) filas.push(nombre + ' canvas  ' + c.width + 'x' + c.height);
        } catch (_) {}
    };

    const videoDe = (v, nombre) => {
        if (!v) return;
        filas.push(nombre + ' video   ' + (v.videoWidth || '?') + 'x' +
                   (v.videoHeight || '?') + '   ' +
                   String(v.currentSrc).split('/').slice(-2).join('/'));
    };

    canvasDe(el.table,  '#scene',    'TABLE ');
    canvasDe(el.intro,  '#fxCanvas', 'INTRO ');
    canvasDe(el.result, '#scene',    'RESULT');

    try { videoDe(el.table.contentDocument.querySelector('#bg'),  'TABLE '); } catch (_) {}
    try { videoDe(el.intro.contentDocument.querySelector('#backgroundVideo'), 'INTRO '); } catch (_) {}
    try { videoDe(el.result.contentDocument.querySelector('#bg'), 'RESULT'); } catch (_) {}

    videoDe(el.video,   'SORTEO');
    videoDe(el.panelBg, 'JK/BN ');

    console.log('[res] devicePixelRatio = ' + window.devicePixelRatio +
                '\n[res] ' + filas.join('\n[res] '));

    return filas;
}

window.auditarResolucion = auditarResolucion;

function esperar(ms) {
    return new Promise(r => setTimeout(r, ms));
}

/* Espera a que un iframe exponga su API pública Y a que TERMINE su propio
   arranque.

   Es imprescindible: los tres proyectos declaran su API al parsear el script,
   pero cargan sus assets después. Si se les alimenta antes de tiempo,
   su propio arranque pisa los datos del feed:

     ui.js       -> StormUI.init() llama a Demo.init(), que reemplaza niveles,
                    últimos números y último jackpot.
     results.js  -> main() hace fetch de example_result.json y llama a
                    renderResult() con el ejemplo.

   Por eso cada pantalla trae aquí su propia condición de "ya arrancó". */
function listo(iframe, prop, prefijo, arranco) {
    return new Promise(resolve => {
        const t0 = performance.now();
        let parcheado = false;

        (function check() {
            let win = null;

            try { win = iframe.contentWindow; } catch (_) {}

            if (win && win[prop]) {

                if (!parcheado) {
                    parcheado = true;
                    try { parchearCodec(win.document, prefijo); } catch (_) {}
                }

                let ok = false;
                try { ok = !arranco || arranco(win); } catch (_) {}

                if (ok) {
                    /* El aviso de autoplay del proyecto original ya no aplica:
                       el visor integrado gestiona la reproducción. */
                    try {
                        const h = win.document.getElementById('tap-hint');
                        if (h) h.hidden = true;
                    } catch (_) {}

                    return resolve(win);
                }
            }

            if (performance.now() - t0 > 40000) {
                console.warn('[flow] ' + prop + ' no arrancó a tiempo.');
                return resolve(win || null);
            }

            setTimeout(check, 80);
        })();
    });
}

const Puente = {
    tableWin:  null,   // window.StormUI      (visor principal)
    introWin:  null,   // window.RouletteMultipliers
    resultWin: null,   // window.StormResults

    /* Estadísticas y HOT/COLD del JSON. Igual que el resto del feed, se
       guardan y se aplican cuando TABLE está activa, DESPUÉS del historial
       (setResults recalcula; así nada pisa los valores del JSON). */
    setStatistics(stats, total) {
        if (!stats) return;
        this.feed.estadisticas = { stats: stats, total: total };
        this.volcarFeed();
    },

    setHotCold(hot, cold) {
        if (!Array.isArray(hot) || !Array.isArray(cold)) return;
        this.feed.hotCold = { hot: hot, cold: cold };
        this.volcarFeed();
    },

    async init() {
        const r = await Promise.all([

            /* Demo.init() ya corrió: los niveles existen. */
            listo(el.table, 'StormUI', '../../',
                w => w.StormUI.api.data.levels.length > 0),

            /* app.js del intro expone la API antes de preloadAssets(). */
            listo(el.intro, 'RouletteMultipliers', '../../', null),

            /* main() ya pintó example_result.json. */
            listo(el.result, 'StormResults', '../../',
                w => w.StormResults.data.draw_number !== null)
        ]);

        this.tableWin  = r[0];
        this.introWin  = r[1];
        this.resultWin = r[2];

        /* El intro arranca su demo solo al cargar. Se apaga hasta que
           el ciclo lo pida de verdad. */
        if (this.introWin && this.introWin.RouletteMultipliers) {
            try { this.introWin.RouletteMultipliers.hide(); } catch (_) {}
        }
    },

    /* --- visor principal ------------------------------------------------

       CUIDADO: varias funciones de StormUI.api crean tweens de GSAP
       (setRound anima roundFlash, setLastJackpot anima jpFlash, pushResult
       anima la tira). Crear una tween DESPIERTA el ticker de ese iframe.

       Si se alimentara la pantalla principal mientras está suspendida, el
       socket la resucitaría una vez por segundo y la suspensión no serviría
       de nada. Por eso el feed se guarda aquí y solo se vuelca cuando TABLE
       vuelve a estar activa.
       -------------------------------------------------------------------- */

    tableApi() {
        return this.tableWin && this.tableWin.StormUI && this.tableWin.StormUI.api;
    },

    tableActiva() {
        const t = hostDe(this.tableWin, 'StormTable');
        return !!(t && t.hostActive);
    },

    /* Último estado conocido + lo que quedó pendiente de aplicar. */
    feed: {
        ronda: null, rondaAplicada: null,
        segundos: null,
        jackpots: null, ultimo: null, historial: null,
        historialAceptado: false,
        estadisticas: null, hotCold: null,
        resultados: [],
        /* setHistorial(lista, true) lo vacía. Antes no existía y esa línea
           lanzaba TypeError: el historial y las estadísticas del JSON nunca
           llegaban a la pantalla principal después de un sorteo. */
        liveResultados: []
    },

    volcarFeed() {
        const a = this.tableApi();
        if (!a || !this.tableActiva()) return;

        const f = this.feed;

        if (f.jackpots)  { a.setJackpots(f.jackpots);   f.jackpots = null; }
        if (f.ultimo)    { a.setLastJackpot(f.ultimo);  f.ultimo = null; }
        if (f.historial) { a.setResults(f.historial);   f.historial = null; }

        while (f.resultados.length) {
            const r = f.resultados.shift();
            a.pushResult(r.n, r.mult);
        }

        /* Después del historial: los valores del JSON mandan. */
        if (f.estadisticas && typeof a.setStatistics === 'function') {
            a.setStatistics(f.estadisticas.stats, f.estadisticas.total);
            f.estadisticas = null;
        }
        if (f.hotCold && typeof a.setHotCold === 'function') {
            a.setHotCold(f.hotCold.hot, f.hotCold.cold);
            f.hotCold = null;
        }

        /* setRound crea una tween: solo cuando la ronda cambia de verdad. */
        if (f.ronda !== null && f.ronda !== f.rondaAplicada) {
            a.setRound(f.ronda);
            f.rondaAplicada = f.ronda;
        }

        if (f.segundos !== null) a.setRemainingTime(f.segundos);
    },

    setRonda(n) {
        if (n === null || n === undefined) return;
        this.feed.ronda = n;
        this.volcarFeed();
    },

    setSegundos(s) {
        this.feed.segundos = s;

        /* setRemainingTime solo asigna campos, no crea tweens: no despierta
           nada. Aun así solo se aplica con TABLE activa. */
        this.volcarFeed();
    },

    setJackpots(niveles) {
        if (!niveles || !niveles.length) return;
        this.feed.jackpots = niveles;
        this.volcarFeed();
    },

    setUltimoJackpot(info) {
        if (!info) return;
        this.feed.ultimo = info;
        this.volcarFeed();
    },

    setHistorial(lista, forzar = false) {
        if (historialCongelado) return;      // sorteo que no pudo mostrarse: ver recargaPorFallo()
        if (!Array.isArray(lista) || !lista.length) return;

        if (forzar) {
            this.feed.historial = lista.slice();
            this.feed.historialAceptado = true;
            this.feed.liveResultados.length = 0;
            this.feed.resultados.length = 0;
            this.volcarFeed();
            return;
        }

        if (this.feed.historialAceptado) return;

        this.feed.historialAceptado = true;
        this.feed.historial = lista;
        this.volcarFeed();
    },

    pushResultado(n, mult) {
        if (historialCongelado) return;
        this.feed.resultados.push({ n: n, mult: mult || 0 });
        this.volcarFeed();
    },

    /* --- intro ---------------------------------------------------------- */

    /* show-intro-roulette/app.js expone RouletteMultipliers ANTES de terminar
       su preloadAssets(). Si se le llama a play() antes de tiempo, revienta en
       images.multipliers[...]. Se espera a que su último asset (x500.png) esté
       descargado, sin tocar app.js. */
    introListo() {
        const win = this.introWin;
        if (!win) return Promise.resolve(false);

        return new Promise(resolve => {
            const t0 = performance.now();

            (function check() {
                let ok = false;

                try {
                    ok = win.performance
                        .getEntriesByType('resource')
                        .some(r => r.name.indexOf('x500.png') !== -1 && r.responseEnd > 0);
                } catch (_) {}

                if (ok) return resolve(true);
                if (performance.now() - t0 > 30000) return resolve(false);

                setTimeout(check, 100);
            })();
        });
    },

    async reproducirIntro(multiplicadores) {
        const api = this.introWin && this.introWin.RouletteMultipliers;

        if (!api) return;

        await this.introListo();

        const lista = (multiplicadores && multiplicadores.length)
            ? multiplicadores
            : [];

        // const tl = lista.length ? api.play(lista) : api.play();
        const tl = api.play(lista);

        return new Promise(resolve => {
            let hecho = false;
            const fin = () => { if (!hecho) { hecho = true; resolve(); } };

            if (tl && tl.eventCallback) {
                tl.eventCallback('onComplete', fin);
                setTimeout(fin, (tl.duration() + 2) * 1000);   // red de seguridad
            } else {
                setTimeout(fin, CONFIG.ciclo.introMs);
            }
        });
    },

    ocultarIntro() {
        const api = this.introWin && this.introWin.RouletteMultipliers;
        if (api) { try { api.hide(); } catch (_) {} }
    },

    /* --- resultado ------------------------------------------------------ */

    pintarResultado(data) {
        const api = this.resultWin && this.resultWin.StormResults;
        if (api) api.renderResult(data);
    }
};


/* =========================================================================
   8. PANTALLAS DE JACKPOT Y BONO

   Solo se rellenan huecos. Los PNG no se modifican.
   ========================================================================= */

/* Un nombre de lugar largo ("SUCURSAL NORTE", "PLAZA LUPERON") no puede
   desbordar su celda. Se reduce el tamaño solo lo justo para que quepa; si
   entra al tamaño de diseño, no se toca nada. */
function ajustarTexto(nodo, tamBase) {
    nodo.style.fontSize = tamBase + 'px';

    let tam = tamBase;

    while (tam > 22 && nodo.scrollWidth > nodo.clientWidth) {
        tam -= 2;
        nodo.style.fontSize = tam + 'px';
    }
}

function pintarJackpot(jk) {
    el.jkType.textContent   = String(jk.tipo || 'JACKPOT').toUpperCase();
    el.jkPlace.textContent  = String(jk.lugar || '—').toUpperCase();
    el.jkTicket.textContent = RouletteDB.ticketCorto(jk.ticket);
    el.jkAmount.textContent = RouletteDB.moneda(jk.monto);

    ajustarTexto(el.jkType,   62);
    ajustarTexto(el.jkPlace,  54);
    ajustarTexto(el.jkTicket, 56);
    ajustarTexto(el.jkAmount, 66);
}

function pintarBono(bn) {
    el.bnTicket.textContent = RouletteDB.ticketCorto(bn.ticket);
    el.bnAmount.textContent = RouletteDB.moneda(bn.monto);

    ajustarTexto(el.bnTicket, 66);
    ajustarTexto(el.bnAmount, 74);
}


/* =========================================================================
   9. VIDEO DEL SORTEO

   Tiene que reproducirse de verdad: play(), currentTime avanzando y 'ended'.
   ========================================================================= */

/* =========================================================================
   ALERTAS DEL VISOR
   - Video del sorteo no disponible: aviso y de vuelta a la tabla.
   - Sin conexión: SOLO con el visor quieto en la tabla. Si el internet se va
     durante el intro, el video, el jackpot, el bono o el resultado, el ciclo
     sigue y la alerta sale al volver a la tabla (si la conexión sigue caída).
   ========================================================================= */
/* Sorteo que no pudo mostrarse: el aviso queda en pantalla y los ultimos numeros y
   las estadisticas NO cambian (el cliente veria aparecer un numero que nunca vio
   salir). Pasado ESPERA_RECARGA_FALLO se actualiza todo POR DETRAS del aviso
   (historial, estadisticas y jackpots) y recien entonces se quita: el cliente vuelve
   a una tabla ya al dia, sin recargar la pagina. Nunca interrumpe un sorteo. */
const ESPERA_RECARGA_FALLO = 60000;   // 1 minuto
let historialCongelado = false;
let recargaPendiente = null;

function recargaPorFallo() {
    historialCongelado = true;
    if (recargaPendiente) return;

    const desde = Date.now();

    recargaPendiente = setInterval(() => {
        if (Date.now() - desde < ESPERA_RECARGA_FALLO) return;
        if (STATE.vista !== 'table' || STATE.ciclando) return;
        if (typeof alertaConexion !== 'undefined' && alertaConexion) return;

        clearInterval(recargaPendiente);
        recargaPendiente = null;
        actualizarTrasFallo();
    }, 1000);
}

/* Se descongela y se pide todo de nuevo con el aviso encima; al terminar, se quita. */
async function actualizarTrasFallo() {
    historialCongelado = false;
    try {
        await sincronizar(STATE.tableOddsId, false);           // jackpots
        const hist = await RouletteDB.consultarHistorial();    // ya trae el sorteo fallido
        if (hist) Puente.setHistorial(hist, true);             // numeros y estadisticas
        await new Promise(r => setTimeout(r, 800));            // que termine de pintar
    } catch (e) { console.warn('[flow] actualizacion tras el sorteo fallido:', e.message); }

    if (!alertaConexion) Alerta.ocultar();
    console.log('[flow] sorteo fallido: historial y estadisticas actualizados, aviso retirado');
}

/* Empieza un sorteo nuevo antes de que se cumpliera la espera: se suelta el
   congelamiento y se quita el aviso. */
function soltarFallo() {
    if (!historialCongelado) return;
    clearInterval(recargaPendiente);
    recargaPendiente = null;
    historialCongelado = false;
    if (!alertaConexion) Alerta.ocultar();
}

const Alerta = {
    caja: null,
    temporizador: null,

    crear() {
        if (this.caja) return;

        const fondo = document.createElement('div');
        fondo.id = 'visor-alerta';
        fondo.style.cssText =
            'position:fixed;inset:0;z-index:99999;display:none;align-items:center;' +
            'justify-content:center;background:rgba(2,6,14,0.78);';

        fondo.innerHTML =
            '<div style="min-width:560px;max-width:70vw;padding:44px 56px;text-align:center;' +
            'border:2px solid rgba(255,217,138,0.75);border-radius:18px;' +
            'background:linear-gradient(180deg,#0b1a33,#050b18);' +
            'box-shadow:0 0 60px rgba(58,160,255,0.35);font-family:system-ui,Segoe UI,Arial,sans-serif;">' +
            '<div style="font-size:64px;line-height:1;color:#ffd98a;">&#9888;</div>' +
            '<div id="visor-alerta-titulo" style="margin-top:14px;font-size:40px;font-weight:700;color:#eaf4ff;"></div>' +
            '<div id="visor-alerta-texto" style="margin-top:12px;font-size:24px;color:#93a9c0;"></div>' +
            '</div>';

        document.body.appendChild(fondo);
        this.caja = fondo;
    },

    mostrar(titulo, texto, ms = 0) {
        this.crear();
        clearTimeout(this.temporizador);

        document.getElementById('visor-alerta-titulo').textContent = titulo;
        document.getElementById('visor-alerta-texto').textContent = texto || '';
        this.caja.style.display = 'flex';

        if (ms > 0) this.temporizador = setTimeout(() => this.ocultar(), ms);
    },

    ocultar() {
        clearTimeout(this.temporizador);
        if (this.caja) this.caja.style.display = 'none';
    }
};

let wsUltimoMensaje = Date.now();   // ultimo mensaje recibido del WebSocket
let wsCaidoDesde    = Date.now();   // null mientras el WebSocket esta abierto
let alertaConexion  = false;

function sinConexion() {
    if (!navigator.onLine) return true;

    const ahora = Date.now();

    if (wsCaidoDesde) return ahora - wsCaidoDesde > 8000;    // cerrado y sin lograr reconectar
    return ahora - wsUltimoMensaje > 20000;                  // abierto pero sin mensajes
}

function revisarConexion() {
    if (TEST_MODE) return;

    const caida  = sinConexion();
    const quieto = STATE.vista === 'table' && !STATE.ciclando;

    if (caida && !alertaConexion && quieto) {
        alertaConexion = true;
        Alerta.mostrar('Sin conexión a internet', 'Reconectando...');

    } else if (!caida && alertaConexion) {
        alertaConexion = false;
        Alerta.ocultar();

        /* Sorteo fallido pendiente: vuelve su aviso. */
        if (historialCongelado) { Alerta.mostrar('Error al comenzar el sorteo', 'Espere el próximo sorteo.'); return; }

        /* Volvio la conexion: jackpots al dia. */
        sincronizar(STATE.tableOddsId, false);
    }
}

setInterval(revisarConexion, 1000);


const Video = {

    /* Rutas que fallaron al precargar (en modo prueba no se vuelven a intentar). */
    fallidos: new Set(),

    /* 23 -> 'assets/videos/23_A.webm'   |   7 -> 'assets/videos/07_A.webm' */
    porNumero(numero) {
        if (numero === null || numero === undefined || numero === '') return null;
        const n = Number(numero);
        if (!Number.isInteger(n) || n < 0 || n > 36) return null;
        return CONFIG.videosPorNumero + String(n).padStart(2, '0') + '_' +
               CONFIG.videoVariante + CONFIG.videoExtension;
    },

    respaldo() {
        return resolverVideo(CONFIG.videoSorteo, '');
    },

    /* Empieza a descargar el video del sorteo mientras corre el intro, para
       que al llegar su turno arranque sin espera. */
    precargar(selectedVideo) {
        const v = el.video;
        const src = this.ruta(selectedVideo);
        if (this.fallidos.has(src) || v.getAttribute('src') === src) return;

        v.addEventListener('error', () => {
            if (v.getAttribute('src') === src) {
                console.warn('[flow] no se pudo cargar ' + src);
                Video.fallidos.add(src);
            }
        }, { once: true });

        v.setAttribute('src', src);
        v.load();
    },

    ruta(selectedVideo) {
        if (!selectedVideo) return resolverVideo(CONFIG.videoSorteo, '');

        /* Modo prueba: los videos del JSON viven en assets/; con carpeta se usan tal cual. */
        if (TEST_MODE) {
            const prueba = String(selectedVideo);
            return resolverVideo(prueba.indexOf('/') !== -1 ? prueba : CONFIG.videoBase + prueba, '');
        }

        /* Produccion: selected_video es un identificador o ruta relativa de la API
           (ej. "36_D.webm" o "roulette/012356153.mp4"). Solo cuenta el nombre del
           archivo: siempre se busca en la carpeta RULETA. */
        const nombre = String(selectedVideo).split('?')[0].split('/').pop();

        /* Produccion: nombre de la API -> http://localhost:3000/RULETA/nombre.mp4 */
        const archivo = /\.[a-z0-9]{2,4}$/i.test(nombre) ? nombre : nombre + '.mp4';
        return CONFIG.videoApiBase + archivo;
    },

    reproducir(selectedVideo, duracionMs = null) {
        const v = el.video;
        let src = this.ruta(selectedVideo);

        /* Devuelve true si el video se reprodujo y false si no existe o no se pudo leer.
           En produccion NO hay video de prueba: el ciclo avisa y vuelve a la tabla. */
        if (this.fallidos.has(src)) {
            if (!TEST_MODE) {
                this.fallidos.delete(src);      // se vuelve a intentar en el proximo sorteo
                return Promise.resolve(false);
            }
            src = this.respaldo();
        }

        return new Promise(resolve => {

            let terminado = false;
            let guardia = null;

            const limpiar = () => {
                v.removeEventListener('ended', onEnded);
                v.removeEventListener('playing', onPlaying);
                v.removeEventListener('error', onError);
                if (guardia) clearTimeout(guardia);
            };

            const fin = (ok) => {
                if (terminado) return;
                terminado = true;
                limpiar();
                resolve(ok !== false);
            };

            /* Mientras el video corre se preparan JACKPOT y BONO.
               Mismo momento que en funcionamiento_p.js:
                   video_event.addEventListener('playing', ...)

               'playing' puede repetirse tras cada rebuffer: las consultas se
               lanzan UNA sola vez por ronda. */
            let consultado = false;

            const onPlaying = () => {
                if (consultado) return;
                consultado = true;

                console.log('[flow] video reproduciéndose:', src);

                Ciclo.consultaJackpot = RouletteDB.consultarGanadorJackpot(Ciclo.ronda, Ciclo.sorteo);
                Ciclo.consultaBono    = RouletteDB.consultarBonos(Ciclo.ronda, Ciclo.sorteo);

                /* Red de seguridad: si 'ended' nunca llega, se sigue igual. */
                /* Duracion: la de la API (ms) si llego; si no, la del archivo. */
                const dur = duracionMs > 0 ? duracionMs / 1000
                          : Number.isFinite(v.duration) ? v.duration : 30;
                guardia = setTimeout(() => fin(true), (dur + 15) * 1000);
            };

            const onEnded = () => {
                console.log('[flow] video terminado en', v.currentTime.toFixed(2), 's');
                fin();
            };

            const onError = () => {
                /* Produccion: sin video de prueba. Se avisa y se vuelve a la tabla. */
                if (!TEST_MODE) {
                    console.warn('[flow] no se pudo reproducir ' + src);
                    fin(false);
                    return;
                }

                /* Modo prueba: el video del número no existe o no se puede leer:
                   se pasa al video general, una sola vez. */
                const respaldo = Video.respaldo();
                if (src !== respaldo) {
                    console.warn('[flow] no se pudo reproducir ' + src + '; se usa ' + respaldo);
                    Video.fallidos.add(src);
                    src = respaldo;
                    v.setAttribute('src', src);
                    v.load();
                    v.play().catch(() => {});
                    return;
                }

                console.error('[flow] error de video:', v.error && v.error.message);

                /* Si el video falla, el ciclo no se queda colgado:
                   se preparan las consultas y se continúa. */
                if (!Ciclo.consultaJackpot) {
                    Ciclo.consultaJackpot = RouletteDB.consultarGanadorJackpot(Ciclo.ronda, Ciclo.sorteo);
                    Ciclo.consultaBono    = RouletteDB.consultarBonos(Ciclo.ronda, Ciclo.sorteo);
                }

                setTimeout(() => fin(true), 500);
            };

            v.addEventListener('playing', onPlaying);
            v.addEventListener('ended', onEnded);
            v.addEventListener('error', onError);

            v.muted = true;

            /* Si ya es el video precargado no se vuelve a pedir: solo se
               rebobina. Cambiar src + load() abortaría la descarga en curso. */
            const actual = v.getAttribute('src');

            if (actual !== src) {
                v.setAttribute('src', src);
                v.load();
            }

            try { v.currentTime = 0; } catch (_) {}

            v.play().catch(err => {
                /* Solo un bloqueo real de autoplay muestra el botón; un
                   archivo que no carga lo resuelve onError con el respaldo. */
                if (err && err.name === 'NotAllowedError') {
                    console.warn('[flow] autoplay bloqueado:', err.message);
                    el.hint.hidden = false;
                }
            });
        });
    }
};


/* =========================================================================
   10. EL CICLO
   ========================================================================= */

const Ciclo = {

    consultaJackpot: null,
    consultaBono:    null,
    ronda:           null,     // event_number del ciclo en curso
    sorteo:          null,     // sorteo_id del ciclo en curso (para el bono)

    

    /* --- PASO 1 / 9 : PANTALLA PRINCIPAL -------------------------------- */
    async mostrarTabla() {
        setVista('table');
        Puente.ocultarIntro();
        mostrar(el.table, false);
    },

    async mostrarIntro(multiplicadores) {
        setVista('intro');
        mostrar(el.intro, false);

        await Puente.reproducirIntro(
            Array.isArray(multiplicadores)
                ? multiplicadores
                : []
        );
    },

    /* --- PASO 5 : VIDEO DEL SORTEO --------------------------------------- */
    async mostrarVideo(selectedVideo, multiplicadores, duracionMs = null) {
        setVista('video');

        pintarMultiplicadoresVideo( multiplicadores, el.videoMultipliers);

        mostrar(el.video, false);

        const reproducido = await Video.reproducir(selectedVideo, duracionMs);

        Puente.ocultarIntro();

        return reproducido;
    },

    /* --- PASO 7 : JACKPOT ------------------------------------------------ */
    async mostrarJackpot(jk) {
        setVista('jackpot');
        pintarJackpot(jk);
        mostrar(el.jackpot, true);
        await esperar(CONFIG.ciclo.jackpotMs);
    },

    /* --- PASO 7 : BONO --------------------------------------------------- */
    async mostrarBonos(lista) {
        const bonos = Array.isArray(lista)
            ? lista
            : lista
                ? [lista]
                : [];

        const mostrados = new Set();

        for (const bn of bonos) {
            /* Un ticket = un evento. Mismo ticket repetido no se vuelve a
               mostrar, aunque cambie el monto. */
            if (!bn || bn.ticket === undefined || bn.ticket === null) continue;
            const clave = String(bn.ticket);

            if (mostrados.has(clave)) continue;

            mostrados.add(clave);

            setVista('bonus');
            pintarBono(bn);
            mostrar(el.bonus, true);

            await esperar(CONFIG.ciclo.bonusMs);
        }
    },

    /* --- PASO 8 : RESULTADO ---------------------------------------------- */
    async mostrarResultado(resultado) {
        setVista('result');

        /* Primero se reactiva la pantalla y después se le pasan los datos:
           así la animación de revelado corre con su ticker ya despierto. */
        mostrar(el.result, false);
        Puente.pintarResultado(resultado);

        await esperar(CONFIG.ciclo.resultMs);
    },


    /* =====================================================================
       CICLO COMPLETO DE UNA RONDA
       ===================================================================== */
    async ejecutar(eventNumber, sorteoId = null) {
    if (STATE.ciclando) return;

    STATE.ciclando = true;
    Ciclo.ronda = eventNumber;
    Ciclo.sorteo = sorteoId;
    Ciclo.consultaJackpot = null;
    Ciclo.consultaBono = null;

    /* El sorteo del JSON se fija aquí también, no solo desde el socket. */
    if (TEST_MODE) RouletteDB.seleccionarSorteo(eventNumber);

    console.log('[flow] ===== ciclo de la ronda', eventNumber, '=====');

    /* Si quedo el aviso de un sorteo fallido, el sorteo nuevo se ve sin el. */
    soltarFallo();

    try {
        const ronda =
            await RouletteDB.consultarResultados(eventNumber, sorteoId);

        /* Guia de ruleta, seccion 18: si tras los reintentos no llego el resultado
           de ESTE sorteo, no se muestra intro ni video ni un resultado viejo;
           el finally devuelve la tabla y se espera el siguiente cierre. */
        if (!TEST_MODE && !(ronda && ronda.resultado)) {
            console.warn('[flow] sin resultado de la ronda', eventNumber, '; se vuelve a la tabla');
            return;
        }

        if (ronda && ronda.sorteo_id) Ciclo.sorteo = ronda.sorteo_id;

        const multiplicadores =
            Array.isArray(ronda && ronda.multiplicadores)
                ? ronda.multiplicadores
                : [];

        const resultado =
            ronda && ronda.resultado
                ? ronda.resultado
                : null;

        /* MULTIPLICATIVOS GANADORES = exactamente la misma lista que ven el
           intro y el video (mismo orden, un multiplicativo por número).
           Se fija aquí para que no dependa de lo que traiga el adaptador:
           una versión anterior de cone_db_roulette.js dejaba solo el del
           número ganador. */
        if (resultado) {
            const vistos = new Set();
            resultado.multipliers = multiplicadores
                .map(m => ({
                    number: Number(m.number),
                    multiplier: Number(m.multiplier ?? String(m.value || '').replace(/\D/g, ''))
                }))
                .filter(m =>
                    Number.isInteger(m.number) && m.number >= 0 && m.number <= 36 &&
                    MULTIPLICADORES_VALIDOS.has(m.multiplier) &&
                    !vistos.has(m.number) && vistos.add(m.number)
                )
                .slice(0, 5)
                .map(m => ({
                    number: m.number,
                    multiplier: m.multiplier,
                    value: 'x' + m.multiplier,
                    color: RouletteDB.colorCorto(m.number)
                }));
        }

        /* Video: el que mande el backend; si no manda ninguno, el del
           número ganador (assets/videos/NN_A.webm). */
        /* Produccion: solo el video que manda la API (selected_video).
           Modo prueba: si el JSON no trae video, el del número ganador. */
        const selectedVideo = TEST_MODE
            ? (ronda && ronda.selected_video
                ? ronda.selected_video
                : Video.porNumero(resultado && resultado.winner_number))
            : ((ronda && ronda.selected_video) || null);

        if (selectedVideo) Video.precargar(selectedVideo);

        await Ciclo.mostrarIntro(multiplicadores);

        console.log('[flow] video del sorteo:', selectedVideo ? Video.ruta(selectedVideo) : '(la API no envio video)',
                    'duracion API (ms):', ronda && ronda.tiempo_video);

        const videoOk = (selectedVideo || TEST_MODE)
            ? await Ciclo.mostrarVideo(selectedVideo, multiplicadores, ronda && ronda.tiempo_video)
            : false;

        /* El video no existe o no se pudo reproducir: alerta y de vuelta a la tabla
           (el finally la muestra). El numero ganador NO se agrega a los ultimos
           numeros: quedan como estaban y el visor se recarga solo a los 2-3 minutos. */
        if (!videoOk && !TEST_MODE) {
            Puente.ocultarIntro();

            recargaPorFallo();

            /* El mensaje no menciona el video ni de donde sale. */
            /* Se queda en pantalla hasta que todo se actualiza (1 minuto). */
            Alerta.mostrar('Error al comenzar el sorteo', 'Espere el próximo sorteo.');
            return;
        }

        let jk = Ciclo.consultaJackpot
            ? await Ciclo.consultaJackpot
            : null;

        /* El ganador puede acreditarse segundos despues del resultado:
           segunda consulta al terminar el video (guia, secciones 13 y 14). */
        if (!jk && !TEST_MODE) {
            jk = await RouletteDB.consultarGanadorJackpot(Ciclo.ronda, Ciclo.sorteo);
        }

        const bonosRespuesta = Ciclo.consultaBono
            ? await Ciclo.consultaBono
            : [];

        const bonos = Array.isArray(bonosRespuesta)
            ? bonosRespuesta
            : bonosRespuesta
                ? [bonosRespuesta]
                : [];

        if (jk && jk.ticket !== undefined && jk.ticket !== null) {
            await Ciclo.mostrarJackpot(jk);
        }

        if (bonos.length > 0) {
            await Ciclo.mostrarBonos(bonos);
        }

                /* RESULTADO */
        if (resultado) {
            await Ciclo.mostrarResultado(resultado);

            /*
                * En producción se agrega el resultado vivo.
                * En modo prueba el historial completo viene del JSON.
                */
            if (
                !TEST_MODE &&
                resultado.winner_number !== null
            ) {
                const m = resultado.multipliers &&
                    resultado.multipliers.find(x =>
                        Number(x.number) ===
                        Number(resultado.winner_number)
                    );

                Puente.pushResultado(
                    resultado.winner_number,
                    resultado.winning_multiplier !== undefined
                        ? Number(resultado.winning_multiplier || 0)
                        : m ? Number(
                        m.multiplier ?? String(m.value).replace(/\D/g, '')
                    ) : 0
                );
            }
        }

        /*
            * EXACTAMENTE AQUÍ:
            * después del resultado y antes del catch.
            */
        if (TEST_MODE) {
            /* Historial del sorteo recién jugado: su primer elemento es el
               ganador que se acaba de mostrar. */
            const historial = await RouletteDB.consultarHistorial(eventNumber);

            if (historial) {
                Puente.setHistorial(historial, true);
            }

            const estadisticas = await RouletteDB.consultarEstadisticas(eventNumber);

            if (estadisticas) {
                const {
                    hot,
                    cold,
                    ...stats
                } = estadisticas;

                Puente.setStatistics(
                    stats,
                    estadisticas.total
                );

                Puente.setHotCold(hot, cold);
            }

            /* ÚLTIMO JACKPOT tal como queda después de este sorteo. */
            const jpDespues = await RouletteDB.consultarJackpots(eventNumber, true);

            if (jpDespues) {
                if ( Array.isArray(jpDespues.niveles) && jpDespues.niveles.length) Puente.setJackpots(jpDespues.niveles);
                
                if (jpDespues.ultimo) Puente.setUltimoJackpot(jpDespues.ultimo);
                
            }
        }

    } catch (e) {
        console.error('[flow] fallo en el ciclo:', e);

    } finally {
        await Ciclo.mostrarTabla();
        STATE.ciclando = false;

        console.log(
            '[flow] ===== fin del ciclo',
            eventNumber,
            '====='
        );
    }
}
};


/* =========================================================================
   11. SINCRONIZACIÓN DE CUOTAS / JACKPOTS / HISTORIAL
   ========================================================================= */
let syncVersion = 0;

async function sincronizar(tableOddsId, cargarHistorial = false) {
    const version = ++syncVersion;

    try {
        /* La ruleta no usa consulta_tabla: su pago es fijo (guia de ruleta). */

        const jp =    await RouletteDB.consultarJackpots(STATE.ronda);

        if (version !== syncVersion) return;

        if (jp) {
            Puente.setJackpots(jp.niveles);
            Puente.setUltimoJackpot(jp.ultimo);
        }

        /*
         * El historial solamente hidrata la pantalla inicialmente.
         * No debe reemplazar resultados vivos durante la ronda.
         */
        if (!cargarHistorial) return;

        /* En prueba, la pantalla inicial muestra lo que había ANTES del
           sorteo que se está esperando (su resultado aún no salió). */
        if (TEST_MODE) {
            const previo = await RouletteDB.consultarEstadoPrevio(STATE.ronda);
            if (version !== syncVersion || !previo) return;

            Puente.setHistorial(previo.historial);

            if (previo.estadisticas) {
                const { hot, cold, ...stats } = previo.estadisticas;
                Puente.setStatistics(stats, previo.estadisticas.total);
                Puente.setHotCold(hot, cold);
            }
            return;
        }

        const hist = await RouletteDB.consultarHistorial();

        if (version !== syncVersion) return;

        if (hist) {
            Puente.setHistorial(hist);
        }

    } catch (e) {
        console.warn('[flow] sincronizar:', e.message);
    }
}


/* =========================================================================
   12. ENTRADA DEL WEBSOCKET

   Único punto donde se decide que empieza el ciclo.
   Nunca se cuenta hacia atrás en local: se obedece seconds_left.
   ========================================================================= */

function onCountdown(data) {

    /* Sin evento programado: no trae ronda, tabla ni segundos. */
    if (!data || data.type === 'countdown.empty' || data.state === 'no_event') return;

    /* El WebSocket manda DOS sorteos mezclados mientras corre el video: el que se
       esta reproduciendo (state "in_progress", seconds_left 0) y el siguiente que ya
       esta en venta (state "selling"). La pantalla (RONDA y contador) solo sigue al
       sorteo EN VENTA; el mensaje del sorteo en curso solo sirve para arrancar su
       ciclo si todavia no se ha reproducido. */
    if (data.state && data.state !== 'selling') {
        if (Number(data.seconds_left) === 0 &&
            data.event_number !== undefined && data.event_number !== null &&
            STATE.rondaEjecutada !== data.event_number && !STATE.ciclando) {

            console.log('[flow] sorteo en curso (' + data.state + ') de la ronda ' + data.event_number + ': se reproduce');
            STATE.rondaEjecutada = data.event_number;
            Ciclo.ejecutar(data.event_number, data.sorteo_id || null);
        }
        return;
    }

    const ronda    = data.event_number;
    const segundos = Number(data.seconds_left);

    const rondaAnterior = STATE.ronda;

    const nuevaRonda =
        rondaAnterior === null ||
        rondaAnterior === undefined ||
        String(rondaAnterior) !== String(ronda);

    if (
        TEST_MODE &&
        typeof RouletteDB.seleccionarSorteo === 'function'
    ) {
        RouletteDB.seleccionarSorteo(ronda);
    }

    /* Diagnostico: cada vez que cambia la ronda se escribe el mensaje tal como llego.
       Dentro de un mismo sorteo_id la ronda no deberia cambiar. */
    if (nuevaRonda) {
        const mismoSorteo = data.sorteo_id && data.sorteo_id === STATE.sorteo;
        console[mismoSorteo ? 'warn' : 'log'](
            '[flow] WS ronda ' + rondaAnterior + ' -> ' + ronda +
            (mismoSorteo ? ' (CAMBIO DENTRO DEL MISMO SORTEO)' : ''), JSON.stringify(data));
    }

    STATE.ronda       = ronda;
    STATE.segundos    = segundos;
    STATE.tableOddsId = data.table_odds_id;
    STATE.sorteo      = data.sorteo_id || null;

    if (nuevaRonda) {
        void sincronizar(data.table_odds_id, false);
    }

    /* El visor principal muestra el contador y la ronda del servidor. */
    Puente.setRonda(ronda);
    Puente.setSegundos(segundos);

    hud();

    /* --- re-sincronización en las marcas configuradas ------------------- */
    const marcas = STATE.rondaSincronizada[ronda] || (STATE.rondaSincronizada[ronda] = []);

    if (CONFIG.marcasSincro.indexOf(segundos) !== -1 && marcas.indexOf(segundos) === -1) {
        marcas.push(segundos);
        sincronizar(data.table_odds_id, false);
    }

    /* --- PASO 3 : el contador llega a 0 --------------------------------- */
    if (segundos !== 0) return;

    console.log('[flow] seconds_left=0 recibido para la ronda ' + ronda);

    /* UNA RONDA, UN SOLO CICLO.
       El socket puede repetir seconds_left = 0 muchas veces. */
    if (STATE.rondaEjecutada === ronda) return;
    if (STATE.ciclando) return;

    STATE.rondaEjecutada = ronda;

    /* Se pasa el sorteo que cerro: el WebSocket anuncia enseguida el siguiente. */
    Ciclo.ejecutar(ronda, STATE.sorteo);
}


/* =========================================================================
   13. SOCKET REAL
   ========================================================================= */

let socketActual = null;
let socketConectoAntes = false;

/* Estado inicial o recuperacion tras reconectar (guia de ruleta, secciones 7 y 19):
   una sola consulta del evento actual, nunca polling. La pantalla solo toma el
   sorteo EN VENTA; el conteo por segundo sigue llegando por el WebSocket. */
async function recuperarEvento() {
    const evento = await RouletteDB.consultarEventoActual();
    if (!evento) return;

    console.log('[flow] evento actual:', evento.event_number, evento.phase);

    if (evento.phase && evento.phase !== 'sales_open') return;
    if (evento.event_number === undefined || evento.event_number === null) return;

    STATE.ronda       = evento.event_number;
    STATE.tableOddsId = evento.table_odds_id;
    STATE.sorteo      = evento.sorteo_id || null;

    Puente.setRonda(evento.event_number);
}

/* Cambio de configuracion (grupo o juego): canal nuevo y bootstrap de la ruleta
   otra vez -> evento actual, jackpots e historial (guia, seccion 6). */
async function bootstrapRuleta() {
    reconectarSocket();

    await recuperarEvento();

    const jp = await RouletteDB.consultarJackpots(STATE.ronda);
    if (jp) {
        Puente.setJackpots(jp.niveles);
        Puente.setUltimoJackpot(jp.ultimo);
    }

    const hist = await RouletteDB.consultarHistorial();
    if (hist) Puente.setHistorial(hist, true);
}
let socketReintentos = 0;
let socketTemporizador = null;

function urlSocket() {
    /* WEBSOCKET_URL la inyecta Django en la plantilla (guia sin Redis). */
    const base = String((window.VISOR_CONFIG || {}).wsUrl || ('ws://' + CONFIG.socket.host)).replace(/\/+$/, '');
    return base + '/ws/pos/grupos/' + localStorage.getItem('grupo') +
                  '/games/' + (localStorage.getItem('game_id_ruleta') || localStorage.getItem('game_id')) + '/countdown/';
}

function conectarSocket() {

    if (!navigator.onLine) {
        console.warn('[flow] sin conexión; reintentando.');
        clearTimeout(socketTemporizador);
        socketTemporizador = setTimeout(conectarSocket, CONFIG.socket.reintento);
        return;
    }

    /* Una sola conexión activa. */
    if (socketActual && (socketActual.readyState === WebSocket.OPEN || socketActual.readyState === WebSocket.CONNECTING)) return;

    clearTimeout(socketTemporizador);

    const url = urlSocket();
    let ws;

    try {
        ws = new WebSocket(url);
    } catch (e) {
        socketTemporizador = setTimeout(conectarSocket, CONFIG.socket.reintento);
        return;
    }

    socketActual = ws;

    ws.onopen = () => {
        socketReintentos = 0;
        wsCaidoDesde = null;
        wsUltimoMensaje = Date.now();
        console.log('[flow] socket conectado:', url);

        /* Reconexion: se pudo perder un mensaje. Evento actual, una sola vez (guia 19). */
        if (socketConectoAntes) recuperarEvento();
        socketConectoAntes = true;
    };

    ws.onmessage = ev => {
        wsUltimoMensaje = Date.now();
        let data;
        try { data = JSON.parse(ev.data); } catch (_) { return; }
        onCountdown(data);
    };

    /* Reconexión con espera incremental: 1, 2, 4, 8 y máximo 15 segundos. */
    ws.onclose = () => {
        if (socketActual !== ws) return;
        socketActual = null;
        if (!wsCaidoDesde) wsCaidoDesde = Date.now();

        const espera = Math.min(1000 * Math.pow(2, socketReintentos), 15000);
        socketReintentos++;

        clearTimeout(socketTemporizador);
        socketTemporizador = setTimeout(conectarSocket, espera);
    };

    ws.onerror = () => ws.close();
}

/* Cambio de grupo (heartbeat con config_changed): se abre la conexión del grupo nuevo. */
function reconectarSocket() {
    const anterior = socketActual;
    socketActual = null;
    if (anterior) { anterior.onclose = null; anterior.close(); }
    socketReintentos = 0;
    conectarSocket();
}

window.addEventListener('online', conectarSocket);


/* =========================================================================
   14. TEST_MODE  —  index_roulette.html?test=1

   Sustituye ÚNICAMENTE la fuente del tiempo. No hay atajos:
   emite los mismos mensajes que emitiría el backend y el ciclo se dispara
   por el mismo onCountdown() de producción.
   ========================================================================= */

function socketSimulado() {

    console.log('[flow] TEST_MODE: socket simulado. Backend real desactivado.');

    /* La primera ronda simulada es el start_event del JSON (antes estaba
       fija en 1240 y no se enteraba si el JSON empezaba en otra). */
    let ronda    = RouletteDB.eventoInicialPrueba() || 1240;
    let tabla    = RouletteDB.tablaDePrueba(ronda) || (8000 + ronda);
    /* CONFIG.ciclo.roundSeconds (180 s) por ronda.
       Esto es SOLO ?test=1: en producción el tiempo lo manda seconds_left. */
    let segundos = CONFIG.ciclo.roundSeconds;
    let cerosEnviados = 0;

    /* ?hold=table  ->  el contador nunca llega a 0, así que la pantalla
       principal se queda en pantalla indefinidamente. Solo sirve para medir
       rendimiento: no cambia nada del ciclo, únicamente deja de disparar el
       final de ronda. */
    if (HOLD_TABLE) {
        console.log('[flow] hold=table: la pantalla principal se mantiene visible.');
        segundos = CONFIG.ciclo.roundSeconds;
    }

    setInterval(() => {

        if (HOLD_TABLE) {
            segundos = segundos > 1 ? segundos - 1 : 180;
            onCountdown({ table_odds_id: tabla, seconds_left: segundos, event_number: ronda });
            return;
        }

        /* Mientras el ciclo corre, el servidor seguiría mandando ceros de
           esa misma ronda. Es justo lo que hay que aguantar sin repetir. */
        if (STATE.ciclando) {
            onCountdown({ table_odds_id: tabla, seconds_left: 0, event_number: ronda });
            return;
        }

        if (segundos > 0) {
            segundos -= 1;
            onCountdown({ table_odds_id: tabla, seconds_left: segundos, event_number: ronda });
            return;
        }

        /* seconds_left = 0 repetido a propósito: el guard por event_number
           tiene que impedir que el ciclo arranque dos veces. */
        if (cerosEnviados < 3) {
            cerosEnviados += 1;
            onCountdown({ table_odds_id: tabla, seconds_left: 0, event_number: ronda });
            return;
        }

        /* Ronda siguiente */
        ronda += 1;
        tabla = RouletteDB.tablaDePrueba(ronda) || (tabla + 1);
        segundos = CONFIG.ciclo.roundSeconds;
        cerosEnviados = 0;

        onCountdown({ table_odds_id: tabla, seconds_left: segundos, event_number: ronda });

    }, 1000);
}


/* =========================================================================
   15. HUD  (?debug=1)
   ========================================================================= */

/* FPS reales de canvas por pantalla: se miden contando frames entre dos
   lecturas del HUD, no con una bandera. */
const HUD_FPS = { t: 0, table: 0, intro: 0, result: 0, out: { table: 0, intro: 0, result: 0 } };

function medirFps() {
    const ahora = performance.now();
    const dt = (ahora - HUD_FPS.t) / 1000;

    const leer = (win, prop) => {
        const api = win && win[prop];
        return api && typeof api.frames === 'number' ? api.frames : 0;
    };

    const f = {
        table:  leer(Puente.tableWin,  'StormTable'),
        intro:  leer(Puente.introWin,  'RouletteMultipliers'),
        result: leer(Puente.resultWin, 'StormResults')
    };

    if (HUD_FPS.t && dt > 0.1) {
        HUD_FPS.out.table  = Math.round((f.table  - HUD_FPS.table)  / dt);
        HUD_FPS.out.intro  = Math.round((f.intro  - HUD_FPS.intro)  / dt);
        HUD_FPS.out.result = Math.round((f.result - HUD_FPS.result) / dt);
    }

    HUD_FPS.t = ahora;
    HUD_FPS.table = f.table;
    HUD_FPS.intro = f.intro;
    HUD_FPS.result = f.result;

    return HUD_FPS.out;
}

function hud() {
    if (!DEBUG) return;

    const fps = medirFps();
    const t = Puente.tableWin && Puente.tableWin.StormTable;

    const lineas = [
        'VIEW        : ' + STATE.vista.toUpperCase(),
        'RONDA       : ' + STATE.ronda,
        'SECONDS LEFT: ' + STATE.segundos
    ];

    if (t) {
        lineas.push(
            'TABLE       : ' + (t.hostActive ? t.tableState : 'SUSPENDIDA'),
            'CANVAS FPS  : ' + fps.table,
            'TICKER      : ' + (t.tickerAwake ? 'AWAKE' : 'SLEEPING'),
            'NEXT SPIN   : ' + Math.round(t.nextSpin) + 's'
        );
    }

    lineas.push(
        'INTRO FPS   : ' + fps.intro,
        'RESULT FPS  : ' + fps.result,
        'VIDEO       : ' + el.video.currentTime.toFixed(2) + ' / ' +
            (Number.isFinite(el.video.duration) ? el.video.duration.toFixed(2) : '—')
    );

    el.hud.hidden = false;
    el.hud.textContent = lineas.join('\n');
}

if (DEBUG) setInterval(hud, 500);


/* =========================================================================
   16. ARRANQUE
   ========================================================================= */

el.hint.addEventListener('click', () => {
    el.hint.hidden = true;
    el.video.play().catch(() => {});
    el.panelBg.play().catch(() => {});
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (STATE.vista === 'video' && el.video.paused) el.video.play().catch(() => {});
});


async function main() {

    RouletteDB.testMode = TEST_MODE;
    
    if (TEST_MODE) {
        await RouletteDB.cargarDatosPrueba();
    }

    /* Precarga del video del sorteo. */
    /* El video de prueba (assets/video.mp4) solo se carga en modo prueba (?test=1).
       En produccion el unico video es el que manda la API. */
    if (TEST_MODE) el.video.setAttribute('src', resolverVideo(CONFIG.videoSorteo, ''));

    /* El fondo compartido de JACKPOT/BONO es storm_bg.mp4 del ZIP. */
    if (SIN_H264) {
        el.panelBg.setAttribute('src', resolverVideo('storm_bg.mp4', ''));
        el.panelBg.load();
    }

    await Puente.init();

    /* PASO 1: lo primero que se ve es la PANTALLA PRINCIPAL. */
    await Ciclo.mostrarTabla();

    /* Auditoría de resolución real de trabajo y de actividad. */
    setTimeout(() => { auditarResolucion(); auditarActividad(); }, 1500);

    /* Primera carga de cuotas / jackpots / historial.
       Si el backend no responde, el visor NO se queda bloqueado: el ciclo
       depende del socket, no de estas consultas. */
    try {
        if (!TEST_MODE) await RouletteDB.resolverJuego();
        await sincronizar(null, true);
    } catch (e) {
        console.warn('[flow] sincronización inicial fallida:', e.message);
    }

    if (TEST_MODE) {
        socketSimulado();

        /* SOLO ?test=1: se simula que el backend va informando importes de
           jackpot cada vez mayores, para poder ver interpolar al contador.
           El primero llega pronto (5 s) porque si no, durante los primeros
           20 segundos los importes se ven completamente quietos.
           En producción los targets llegan únicamente por consulta_jackpots. */
        const sincroJackpotsTest = () => {
            if (STATE.vista !== 'table') return;
            sincronizar(STATE.tableOddsId, false);
        };

        setTimeout(sincroJackpotsTest, 5000);
        setInterval(sincroJackpotsTest, 20000);

    } else {
        /* Guia 5.4 y 5.5: configuracion al iniciar y heartbeat periodico. */
        RouletteDB.onGrupoCambiado = bootstrapRuleta;
        await RouletteDB.confirmarConfiguracion();
        RouletteDB.enviarHeartbeat();

        /* Estado inicial: evento actual antes del primer mensaje del WebSocket. */
        await recuperarEvento();

        conectarSocket();
    }
}


/* API mínima para diagnóstico externo. No se usa para saltar pantallas. */
window.RouletteFlow = {
    get vista()  { return STATE.vista; },
    get estado() { return STATE; },
    config: CONFIG,
    testMode: TEST_MODE,
    onVista(cb) { STATE.listeners.push(cb); },

    /* Solo para revisar el encaje de los textos sobre los PNG. */
    pintarJackpot: jk => pintarJackpot(jk),
    pintarBono:    bn => pintarBono(bn)
};


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}

})();
