/* ==========================================================================
   MONITOR DE VIDEO (intro y video del evento) - perros, caballos y gallos
   No cambia nada de la reproduccion: solo observa y deja constancia.

   1. Linea de tiempo de cada ciclo (consola, prefijo [VIDEO]):
        intro empezo / termino, espera por el resultado de la API, carrera empezo.
   2. Todo lo anormal en el momento en que pasa (prefijo [VIDEO]):
        stalled, waiting, error, abort, video pausado por el NAVEGADOR (no por el
        codigo), pestana oculta, sin internet.
   3. Quien toca el video: cada pause(), load() o cambio de src hecho por el
      codigo queda registrado con la funcion que lo llamo. Asi se puede probar
      si el codigo intervino o no.
   4. Diagnostico cuando un video se detiene (lo pide el vigilante de
      funcionamiento_p.js, prefijo [VIDEO-DIAG]): estado del video, datos
      descargados por delante, cuadros perdidos, socket, y un sondeo directo
      al servidor de videos (inicio del archivo y la parte donde se detuvo).
      Termina con una CAUSA en palabras y si el codigo intervino.
   Los ultimos 30 diagnosticos se guardan en el navegador (sobreviven a una
   recarga). En la consola:  diagnostico_video()   y   diagnostico_video.limpiar()
   ========================================================================== */
(function () {
    'use strict';
    if (window.MonitorVideo) return;

    const CLAVE = 'diag_video', MAX_REPORTES = 30, MAX_EVENTOS = 40;
    const NOMBRE = { intro: 'INTRO', evento: 'CARRERA' };
    const EVENTOS = ['loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'playing', 'waiting', 'stalled',
                     'suspend', 'pause', 'ended', 'error', 'abort', 'emptied', 'seeking', 'seeked'];
    const RED = ['EMPTY (sin archivo)', 'IDLE (no esta descargando)', 'LOADING (descargando)', 'NO_SOURCE (sin fuente valida)'];
    const LISTO = ['HAVE_NOTHING (sin datos)', 'HAVE_METADATA (solo cabecera)', 'HAVE_CURRENT_DATA (solo el cuadro actual)',
                   'HAVE_FUTURE_DATA (hay datos por delante)', 'HAVE_ENOUGH_DATA (suficientes datos)'];
    const ERRORES = { 1: 'Descarga abortada', 2: 'Error de red al descargar el video',
                      3: 'Error al decodificar: archivo danado o falla del decodificador/GPU',
                      4: 'Formato no soportado o archivo no encontrado' };

    const hora = () => { const d = new Date(); return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0'); };
    const seg = ms => Math.round(ms / 100) / 10;
    const archivo = s => String(s || '').split('?')[0].split('/').slice(-2).join('/');
    const est = new WeakMap();
    let enVigilante = false;   // acciones del vigilante de funcionamiento_p.js (recuperacion), no del flujo normal
    const nombreDe = v => (est.get(v) || {}).nombre || 'VIDEO';

    function pila() {
        const l = String(new Error().stack || '').split('\n').slice(1)
            .map(s => s.trim()).filter(s => s && s.indexOf('monitor_video.js') === -1);
        return l.slice(0, 3).map(s => s.replace(/^at /, '').replace(/\(?https?:\/\/[^/]+\/static\/js\//, '(').replace(/\?v=\d+/, '')).join(' <- ');
    }

    function anotar(v, tipo, extra) {
        const st = est.get(v); if (!st) return;
        st.eventos.push({ hora: hora(), t: performance.now(), evento: tipo, segundo: +v.currentTime.toFixed(2), extra: extra || undefined });
        if (st.eventos.length > MAX_EVENTOS) st.eventos.shift();
    }

    function seguir(v) {
        if (!v || est.has(v)) return;
        const st = { nombre: NOMBRE[v.id] || v.id, eventos: [], ultimoDato: performance.now(), datos: 0,
                     codigo: [], srcDesde: performance.now(), jugando: false, primerPlaying: null };
        est.set(v, st);
        v.addEventListener('progress', () => { st.ultimoDato = performance.now(); st.datos++; });
        EVENTOS.forEach(ev => v.addEventListener(ev, () => {
            anotar(v, ev);
            if (ev === 'playing') {
                st.jugando = true;
                if (st.primerPlaying === null) { st.primerPlaying = performance.now(); alEmpezar(v); }
            }
            if (ev === 'ended') st.jugando = false;
            const visible = v.style.opacity == 1;
            if (!visible || !v.getAttribute('src')) return;          // video fuera de pantalla: no interesa
            if (ev === 'stalled')  console.log('[VIDEO] ' + st.nombre + ': stalled (el navegador lleva ~3 s sin recibir datos) en el segundo ' + v.currentTime.toFixed(2) + ' - ' + archivo(v.src));
            if (ev === 'waiting' && st.primerPlaying !== null) console.log('[VIDEO] ' + st.nombre + ': waiting (esperando datos) en el segundo ' + v.currentTime.toFixed(2));
            if (ev === 'error')    console.warn('[VIDEO] ' + st.nombre + ': ERROR ' + (v.error ? v.error.code + ' ' + (ERRORES[v.error.code] || '') + ' ' + (v.error.message || '') : '') + ' - ' + archivo(v.src));
            if (ev === 'pause' && !v.ended) {
                const porCodigo = st.codigo.some(c => c.accion === 'pause()' && performance.now() - c.t < 300);
                if (!porCodigo) console.warn('[VIDEO] ' + st.nombre + ': PAUSADO POR EL NAVEGADOR (no por el codigo) en el segundo ' + v.currentTime.toFixed(2) + (document.hidden ? ' - la pestana esta oculta' : ''));
            }
        }));
    }

    /* Quien toca el video desde el codigo */
    function envolver(nombre, accion) {
        const orig = HTMLMediaElement.prototype[nombre];
        HTMLMediaElement.prototype[nombre] = function () {
            const st = est.get(this);
            if (st) { st.codigo.push({ t: performance.now(), hora: hora(), accion: accion, segundo: +this.currentTime.toFixed(2), desde: enVigilante ? 'vigilante' : pila(), vigilante: enVigilante });
                      if (st.codigo.length > 15) st.codigo.shift(); anotar(this, accion + ' (codigo)'); }
            return orig.apply(this, arguments);
        };
    }
    envolver('pause', 'pause()');
    envolver('load', 'load()');
    const dSrc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
    if (dSrc && dSrc.set) Object.defineProperty(HTMLMediaElement.prototype, 'src', {
        configurable: true, enumerable: dSrc.enumerable, get: dSrc.get,
        set: function (valor) {
            const st = est.get(this);
            if (st) {
                st.codigo.push({ t: performance.now(), hora: hora(), accion: 'src = ' + archivo(valor), segundo: +this.currentTime.toFixed(2), desde: enVigilante ? 'vigilante' : pila(), vigilante: enVigilante, durante: st.primerPlaying !== null });
                if (st.codigo.length > 15) st.codigo.shift();
                st.srcDesde = performance.now(); st.primerPlaying = null; st.ultimoDato = performance.now(); st.datos = 0;
                anotar(this, 'src (codigo)', archivo(valor));
            }
            return dSrc.set.call(this, valor);
        }
    });

    /* Linea de tiempo del ciclo */
    const ciclo = { introInicio: null, introFin: null, apiMs: null, apiDesde: null };
    function marca(nombre, datos) {
        const ahora = performance.now();
        if (nombre === 'intro_inicio') { ciclo.introInicio = ahora; ciclo.introFin = null; ciclo.apiMs = null; console.log('[VIDEO] intro empezo: ' + archivo(datos)); }
        if (nombre === 'intro_fin') {
            ciclo.introFin = ahora;
            console.log('[VIDEO] intro termino (' + datos + ')' + (ciclo.introInicio ? ' despues de ' + seg(ahora - ciclo.introInicio) + ' s' : ''));
        }
        if (nombre === 'api_resultados') {
            ciclo.apiMs = datos.ms;
            const esp = ciclo.introFin ? seg(ahora - ciclo.introFin) : null;
            console.log('[VIDEO] resultado de la API: ' + (datos.ok ? 'recibido' : 'NO LLEGO') + ' en ' + seg(datos.ms) + ' s' +
                        (datos.adelantado ? ' (consulta adelantada durante el intro)' : '') +
                        (esp !== null ? '; despues del fin del intro se espero ' + esp + ' s' : ''));
        }
    }
    function alEmpezar(v) {
        const st = est.get(v);
        if (st.nombre !== 'CARRERA' || v.style.opacity != 1) return;
        const carga = seg(performance.now() - st.srcDesde);
        let txt = '[VIDEO] carrera empezo a verse ' + carga + ' s despues de pedir el archivo ' + archivo(v.src);
        if (ciclo.introFin) {
            const hueco = seg(performance.now() - ciclo.introFin);
            txt += '; pantalla quieta entre el fin del intro y la carrera: ' + hueco + ' s';
            if (hueco > 2) console.warn(txt + ' -> intro QUIETO ' + hueco + ' s (' + (ciclo.apiMs !== null ? 'API de resultados ' + seg(ciclo.apiMs) + ' s, ' : '') + 'carga del video ' + carga + ' s)');
            else console.log(txt);
            ciclo.introFin = null;
            return;
        }
        console.log(txt);
    }

    /* Sondeo directo al servidor de videos */
    async function pedir(url, rango, ms) {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms), i = performance.now();
        try {
            const r = await fetch(url, { headers: { Range: 'bytes=' + rango }, cache: 'no-store', signal: ctl.signal });
            const b = await r.arrayBuffer();
            return { ok: r.ok, estado: r.status, ms: Math.round(performance.now() - i), bytes: b.byteLength,
                     total: Number((r.headers.get('Content-Range') || '').split('/')[1]) || null };
        } catch (e) {
            const tiempo = ctl.signal.aborted;
            const r = { ok: false, ms: Math.round(performance.now() - i), error: tiempo ? 'sin respuesta en ' + ms / 1000 + ' s' : String(e && e.message || e) };
            if (!tiempo) {   // bloqueado por el navegador (CORS / red local): al menos saber si el servidor contesta
                try {
                    const c2 = new AbortController(), t2 = setTimeout(() => c2.abort(), ms);
                    await fetch(url, { mode: 'no-cors', headers: { Range: 'bytes=' + rango }, cache: 'no-store', signal: c2.signal });
                    clearTimeout(t2); r.contesta = true; r.nota = 'el navegador no deja leer la respuesta (CORS), pero el servidor contesto';
                } catch (e2) { r.contesta = false; r.nota = 'tampoco contesta sin CORS: ' + String(e2 && e2.message || e2); }
            }
            return r;
        } finally { clearTimeout(t); }
    }
    async function sondear(v) {
        const url = v.currentSrc || v.src;
        if (!url) return null;
        const inicio = await pedir(url, '0-65535', 6000);
        let posicion = null;
        if (inicio.total && isFinite(v.duration) && v.duration > 0) {
            const off = Math.max(0, Math.min(inicio.total - 262144, Math.floor(inicio.total * v.currentTime / v.duration)));
            posicion = await pedir(url, off + '-' + (off + 262143), 6000);
            posicion.desde_byte = off;
        }
        return { inicio, posicion };
    }

    function clasificar(v, d, s, foto) {
        const st = est.get(v), ahora = foto.t;
        // Intervencion = pause(), load() o cambio de src del flujo normal MIENTRAS el video ya se
        // estaba viendo (poner el src al empezar el ciclo es lo normal; lo del vigilante es la recuperacion)
        const tocado = st.codigo.filter(c => ahora - c.t < 30000 && !c.vigilante &&
                                        (c.accion.indexOf('src') === 0 ? c.durante : st.primerPlaying !== null && c.t > st.primerPlaying));
        const codigo = tocado.length ? 'SI: ' + tocado.map(c => c.accion + ' en ' + c.desde).join(' | ') : 'NO: el codigo no pauso, recargo ni cambio este video mientras se veia';
        let causa;
        // Falta de datos: el navegador aviso waiting/stalled desde el ultimo playing, o no tiene
        // datos para avanzar (readyState < 3), o hace rato que no llega nada mientras descarga.
        const faltan = foto.esperando || foto.readyState < 3 || d.por_delante_s < 0.5 ||
                       (d.red.indexOf('LOADING') === 0 && d.seg_sin_datos >= 2.5);
        if (foto.error) causa = 'ERROR ' + foto.error;
        else if (foto.oculta) causa = 'PESTANA OCULTA O MINIMIZADA: Chrome frena los videos en segundo plano';
        else if (foto.pausado && !foto.terminado && !foto.pausaVigilante) causa = tocado.some(c => c.accion === 'pause()') ? 'PAUSADO POR EL CODIGO' : 'PAUSADO POR EL NAVEGADOR (no por el codigo)';
        else if (faltan) {
            const i = s && s.inicio, p = s && s.posicion;
            if (!s) causa = 'FALTAN DATOS DEL VIDEO y no tiene direccion';
            else if (i.error && /sin respuesta/.test(i.error)) causa = 'EL SERVIDOR DE VIDEOS NO RESPONDE (' + i.error + ')';
            else if (i.estado >= 400) causa = 'EL SERVIDOR DE VIDEOS RESPONDIO ' + i.estado + ' para este archivo';
            else if (p && !p.ok && /sin respuesta/.test(p.error || '')) causa = 'EL SERVIDOR NO ENTREGA LA PARTE DEL ARCHIVO DONDE SE DETUVO (byte ' + p.desde_byte + '): archivo danado/incompleto o disco lento';
            else if (i.ok && (!p || p.ok)) causa = d.red.indexOf('LOADING') === 0
                ? 'LA DESCARGA DE ESTE VIDEO SE QUEDO COLGADA: el servidor responde a pedidos nuevos (' + i.ms + ' ms) pero no termina de enviar este (' + d.seg_sin_datos + ' s sin datos)'
                : 'EL NAVEGADOR DEJO DE PEDIR DATOS DEL VIDEO (red: ' + d.red + ') aunque el servidor responde (' + i.ms + ' ms)';
            else if (i.contesta === false) causa = 'EL SERVIDOR DE VIDEOS NO CONTESTA (' + (i.nota || i.error) + ')';
            else causa = 'FALTAN DATOS DEL VIDEO; el sondeo al servidor no es concluyente (' + (i.nota || i.error) + ')';
        } else causa = 'HAY ' + d.por_delante_s + ' s DESCARGADOS Y EL NAVEGADOR NO ESPERA DATOS, PERO LA IMAGEN NO AVANZA: decodificador/GPU o equipo sobrecargado' +
                       (d.cuadros ? ' (cuadros perdidos ' + d.cuadros.perdidos + ' de ' + d.cuadros.total + ')' : '');
        return { causa, codigo };
    }

    async function diagnosticar(v, motivo) {
        const st = est.get(v); if (!st) return null;
        const ahora = performance.now(), ct = v.currentTime, rangos = [];
        // Foto del momento (antes de que el vigilante haga play(), recargue o pause)
        const ultimoPlaying = st.eventos.map(e => e.evento).lastIndexOf('playing');
        const ultimaPausa = st.codigo.filter(c => c.accion === 'pause()').slice(-1)[0];
        const foto = { t: ahora, readyState: v.readyState, pausado: v.paused, terminado: v.ended, oculta: document.hidden,
                       error: v.error ? v.error.code + ': ' + (ERRORES[v.error.code] || '') + (v.error.message ? ' (' + v.error.message + ')' : '') : null,
                       esperando: st.eventos.slice(ultimoPlaying + 1).some(e => e.evento === 'waiting' || e.evento === 'stalled'),
                       pausaVigilante: !!(ultimaPausa && ultimaPausa.vigilante && ahora - ultimaPausa.t < 1000) };
        let delante = 0;
        for (let i = 0; i < v.buffered.length; i++) {
            const a = v.buffered.start(i), b = v.buffered.end(i);
            rangos.push(a.toFixed(1) + '-' + b.toFixed(1));
            if (ct >= a - 0.05 && ct <= b) delante = b - ct;
        }
        const q = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : null;
        const d = {
            hora: hora(), video: st.nombre, motivo: motivo, archivo: archivo(v.src),
            segundo: +ct.toFixed(2), duracion: isFinite(v.duration) ? +v.duration.toFixed(2) : null,
            pausado: v.paused, terminado: v.ended,
            listo: LISTO[v.readyState] || v.readyState, red: RED[v.networkState] || v.networkState,
            error: v.error ? v.error.code + ' ' + (ERRORES[v.error.code] || '') + ' ' + (v.error.message || '') : null,
            descargado: rangos.join(', ') || 'nada', por_delante_s: +delante.toFixed(2),
            seg_sin_datos: seg(ahora - st.ultimoDato), avisos_de_datos: st.datos,
            cuadros: q ? { total: q.totalVideoFrames, perdidos: q.droppedVideoFrames, corruptos: q.corruptVideoFrames || 0 } : null,
            pestana_visible: !document.hidden, internet: navigator.onLine,
            socket_ultimo_mensaje_s: typeof window.ws_ultimo_mensaje === 'number' ? seg(Date.now() - window.ws_ultimo_mensaje) : null,
            memoria_mb: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null
        };
        const s = await sondear(v);
        d.sondeo_servidor = s;
        d.navegador_esperando_datos = foto.esperando;
        const c = clasificar(v, d, s, foto);
        d.CAUSA = c.causa; d.CODIGO_INTERVINO = c.codigo;
        d.acciones_del_codigo = st.codigo.slice(-6).map(x => x.hora + ' ' + x.accion + ' (segundo ' + x.segundo + ') <- ' + x.desde);
        d.ultimos_eventos = st.eventos.slice(-15).map(e => e.hora + ' ' + e.evento + ' @' + e.segundo + (e.extra ? ' ' + e.extra : ''));
        console.warn('[VIDEO-DIAG] ' + st.nombre + ' detenido en el segundo ' + d.segundo + ' (' + d.archivo + ') -> CAUSA: ' + d.CAUSA + ' | CODIGO: ' + d.CODIGO_INTERVINO);
        console.log('[VIDEO-DIAG] detalle ' + JSON.stringify(d));
        try {
            const l = JSON.parse(localStorage.getItem(CLAVE) || '[]'); l.push(d);
            localStorage.setItem(CLAVE, JSON.stringify(l.slice(-MAX_REPORTES)));
        } catch (e) {}
        return d;
    }

    window.diagnostico_video = function () {
        let l = []; try { l = JSON.parse(localStorage.getItem(CLAVE) || '[]'); } catch (e) {}
        if (!l.length) { console.log('[VIDEO-DIAG] sin diagnosticos guardados'); return []; }
        l.forEach(d => console.log('[VIDEO-DIAG] ' + d.hora + ' ' + d.video + ' segundo ' + d.segundo + ' ' + d.archivo + ' -> ' + d.CAUSA + ' | CODIGO: ' + d.CODIGO_INTERVINO));
        return l;
    };
    window.diagnostico_video.limpiar = function () { try { localStorage.removeItem(CLAVE); } catch (e) {} };

    document.addEventListener('visibilitychange', () => console.log('[VIDEO] pestana ' + (document.hidden ? 'OCULTA (Chrome puede frenar los videos)' : 'visible')));
    window.addEventListener('offline', () => console.log('[VIDEO] sin internet'));
    window.addEventListener('online',  () => console.log('[VIDEO] internet de vuelta'));

    function iniciar() { seguir(document.getElementById('intro')); seguir(document.getElementById('evento')); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();

    // El vigilante ejecuta sus recuperaciones aqui dentro para que queden marcadas como suyas
    function vigilante(fn) { enVigilante = true; try { return fn(); } finally { enVigilante = false; } }

    window.MonitorVideo = { diagnosticar, marca, seguir, vigilante };
})();
