/* ==========================================================================
   CONTROL DEL VISOR EN TIEMPO REAL
   Guia "Integracion frontend: terminales y visores en tiempo real" (2026-10-09).

   Un solo coordinador por visor, comun a todos los juegos (perros, caballos,
   gallos y ruleta). No sabe nada de tablas, videos ni resultados: solo decide
   si el visor puede mostrar contenido.

   - Ticket y snapshot por Django (/games): el navegador nunca habla con la API
     por HTTP. device_type siempre "display".
   - Canal de control /ws/device-control/ con primer frame "authenticate".
   - device.ready / device.status / device.config_changed / device.suspended /
     device.revoked, con su "action" (refresh_config, show_blocked,
     login_required, pair_required).
   - Versiones por dispositivo (observada y aplicada), eventos sin repetir,
     recargas en serie, respuestas viejas descartadas.
   - Suspension: pantalla bloqueada, sin contenido ni countdown; el control y el
     heartbeat siguen vivos para enterarse de la reactivacion.
   - Reactivacion: el visor vuelve solo (recarga la pagina con can_operate true).
   - Revocacion confirmada: se borra la vinculacion y se vuelve al pairing (QR).
     Un 404 de contenido, un 4401/4403 o un fallo de red NUNCA borran el token.
   - Heartbeat del visor y respaldo REST mientras el control esta caido.
   - Reconexion con espera 1, 2, 4, 8, 16 y 30 s con variacion aleatoria.
   ========================================================================== */

(function () {
    'use strict';

    if (window.ControlVisor) return;

    /* ---------------- utilidades ---------------- */

    function cookie(nombre) {
        const partes = (document.cookie || '').split(';');
        for (let i = 0; i < partes.length; i++) {
            const c = partes[i].trim();
            if (c.substring(0, nombre.length + 1) === nombre + '=') return decodeURIComponent(c.substring(nombre.length + 1));
        }
        return null;
    }

    function log() {
        const args = Array.prototype.slice.call(arguments);
        args.unshift('[control]');
        console.log.apply(console, args);
    }

    const ESPERAS = [1, 2, 4, 8, 16, 30];                       // segundos
    const conVariacion = s => Math.round(s * 1000 * (0.8 + Math.random() * 0.4));

    /* Texto de cada causa de bloqueo (guia, seccion 8.2). */
    const MOTIVOS = {
        agency_inactive:     'Agencia inactiva',
        consortium_inactive: 'Consorcio inactivo',
        group_inactive:      'Grupo virtual inactivo',
        agency_blocked:      'Agencia bloqueada por administración',
        agency_unassigned:   'Visor sin agencia asignada',
        terminal_inactive:   'Terminal inactiva',
        terminal_unpaired:   'Terminal sin vinculación válida',
        display_inactive:    'Visor inactivo',
        display_pending:     'Visor pendiente de vinculación',
        display_revoked:     'Visor revocado',
        sin_juegos:          'No hay juegos autorizados para este visor'
    };
    const textoMotivo = m => MOTIVOS[m] || 'Visor no disponible';

    /* Juegos que puede mostrar esta pagina, segun su ruta. */
    const CODIGOS_PAGINA = {
        DOGS_6:   ['DOGS_6'],
        DOGS_8:   ['DOGS_8'],
        HORSES_7: ['HORSES_7'],
        ROOSTERS: ['ROOSTERS'],
        RULETA:   ['RULETA', 'ROULETTE'],
        ROULETTE: ['RULETA', 'ROULETTE']
    };

    const paginaActual = () => String(location.pathname || '').replace(/^\/+|\/+$/g, '').toUpperCase();

    /* ---------------- estado ---------------- */

    const S = {
        token:        null,     // device_token con el que arranco esta pagina (generacion)
        deviceId:     null,
        aplicada:     null,     // ultima config_version realmente aplicada
        observada:    null,     // mayor config_version vista en un evento
        snapshot:     null,
        conControl:   true,     // false si la API no tiene las rutas de control (501)
        iniciado:     false,
        modoBloqueado: false,   // la pagina arranco bloqueada: no corre contenido
        detenido:     false,
        opciones:     {},

        socket:       null,
        conectando:   false,
        autenticado:  false,
        ultimoMsg:    0,
        intentos:     0,
        tReconexion:  null,

        recargando:   null,     // promesa de la recarga en curso
        pendiente:    false,
        tRecarga:     null,

        eventos:      [],       // event_id ya procesados (acotado)
        tLatido:      null,
        latidoSeg:    30,
        tDestino:     null
    };

    const vigente = () => !S.detenido && S.token !== null && localStorage.getItem('dkg') === S.token;

    /* ---------------- REST por Django ---------------- */

    async function postVisor(datos) {
        const response = await fetch('/games', {
            method: 'POST',
            cache: 'no-store',
            body: JSON.stringify(datos),
            headers: {
                'X-CSRFToken': cookie('csrftoken'),
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/json'
            }
        });
        let cuerpo = null;
        try { cuerpo = await response.json(); } catch (_) { cuerpo = null; }
        return { status: response.status, ok: response.ok, cuerpo: cuerpo, retryAfter: response.headers.get('Retry-After') };
    }

    /* Resultado: {tipo:'ok', datos} | 'revocado' | 'sin_endpoint' | 'esperar' (con ms) | 'error' */
    async function control(realizar) {
        const token = S.token;
        let r;
        try {
            r = await postVisor({ realizar: realizar, device_token: token });
        } catch (e) {
            return { tipo: 'error', detalle: 'red' };
        }
        // La instalacion cambio de credencial mientras se esperaba: respuesta vieja
        if (token !== S.token || localStorage.getItem('dkg') !== token) return { tipo: 'vieja' };

        if (r.ok && r.cuerpo) return { tipo: 'ok', datos: r.cuerpo };
        if (r.status === 403 && r.cuerpo && r.cuerpo.code === 'device_revoked') return { tipo: 'revocado' };
        if (r.status === 501) return { tipo: 'sin_endpoint' };
        if (r.status === 429) {
            const ms = (Number(r.retryAfter) > 0 ? Number(r.retryAfter) * 1000 : 30000);
            return { tipo: 'esperar', ms: ms };
        }
        return { tipo: 'error', detalle: 'HTTP ' + r.status };
    }

    /* ---------------- pantalla bloqueada ---------------- */

    let capa = null;

    function mostrarBloqueo(motivos, titulo) {
        motivos = Array.isArray(motivos) && motivos.length ? motivos : ['display_inactive'];

        if (!capa) {
            capa = document.createElement('div');
            capa.id = 'control-visor-bloqueo';
            capa.style.cssText =
                'position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;' +
                'background:#05070d;color:#e8eef7;font-family:system-ui,Segoe UI,Arial,sans-serif;text-align:center;';
            capa.innerHTML =
                '<div style="max-width:70vw;padding:48px 64px;border:2px solid rgba(255,255,255,.18);border-radius:20px;' +
                'background:linear-gradient(180deg,#101727,#070b14);box-shadow:0 0 60px rgba(0,0,0,.6);">' +
                '<div style="font-size:72px;line-height:1;color:#f0b445;">&#9888;</div>' +
                '<div id="control-visor-titulo" style="margin-top:18px;font-size:44px;font-weight:700;"></div>' +
                '<div id="control-visor-motivo" style="margin-top:14px;font-size:30px;color:#c9d4e3;"></div>' +
                '<div id="control-visor-otros" style="margin-top:12px;font-size:20px;color:#8796ab;"></div>' +
                '</div>';
            (document.body || document.documentElement).appendChild(capa);
        }

        document.getElementById('control-visor-titulo').textContent = titulo || 'Visor suspendido';
        document.getElementById('control-visor-motivo').textContent = textoMotivo(motivos[0]);
        document.getElementById('control-visor-otros').textContent =
            motivos.length > 1 ? motivos.slice(1).map(textoMotivo).join(' · ') : '';
        capa.style.display = 'flex';
    }

    /* ---------------- recargas / navegacion seguras ---------------- */

    /* Evita un bucle de recargas si algo no cuadra: como maximo 5 por minuto. */
    function recargaPermitida() {
        const ahora = Date.now();
        let lista = [];
        try { lista = JSON.parse(sessionStorage.getItem('control_recargas') || '[]'); } catch (_) {}
        lista = lista.filter(t => ahora - t < 60000);
        if (lista.length >= 5) { log('demasiadas recargas seguidas; se espera'); return false; }
        lista.push(ahora);
        try { sessionStorage.setItem('control_recargas', JSON.stringify(lista)); } catch (_) {}
        return true;
    }

    function irA(destino, inmediato) {
        clearInterval(S.tDestino);
        const ir = () => {
            if (!recargaPermitida()) return false;
            if (destino) window.location.href = destino; else location.reload();
            return true;
        };
        if (inmediato) { ir(); return; }

        // Cambios de grupo, juego o pantalla: nunca en medio de un evento
        S.tDestino = setInterval(() => {
            let quieto = true;
            try { quieto = typeof ControlVisor.estaQuieto === 'function' ? !!ControlVisor.estaQuieto() : true; } catch (_) {}
            if (quieto && ir()) clearInterval(S.tDestino);
        }, 1000);
    }

    function desvincular(origen) {
        if (S.detenido) return;
        log('vinculacion revocada (' + origen + '): se vuelve al pairing');
        detenerTodo();
        try { localStorage.clear(); } catch (_) {}
        window.location.href = '/';
    }

    function detenerTodo() {
        S.detenido = true;
        clearTimeout(S.tReconexion);
        clearTimeout(S.tLatido);
        clearTimeout(S.tRecarga);
        clearInterval(S.tDestino);
        if (S.socket) { const s = S.socket; S.socket = null; try { s.close(); } catch (_) {} }
        if (typeof ControlVisor.alDetener === 'function') { try { ControlVisor.alDetener(); } catch (_) {} }
    }

    /* ---------------- aplicar snapshot ---------------- */

    function juegoDeLaPagina(snap) {
        const codigos = S.opciones.codigos || CODIGOS_PAGINA[paginaActual()] || [];
        const juegos = Array.isArray(snap.games) ? snap.games : null;
        if (!juegos || !codigos.length) return { conocido: false };
        let juego = juegos.find(j => j && codigos.indexOf(String(j.code || '').toUpperCase()) !== -1);
        // Si la API nombra el juego con otro codigo, vale el ID que el visor ya usaba
        if (!juego) {
            const guardado = String(localStorage.getItem(S.opciones.claveJuego || 'game_id'));
            juego = juegos.find(j => j && String(j.id) === guardado);
        }
        return { conocido: true, juego: juego || null };
    }

    /* Devuelve lo que la pagina debe hacer: 'ok' | 'bloqueado' | 'sin_juego' | 'navegando' */
    function aplicarSnapshot(snap, origen) {
        if (!snap || typeof snap !== 'object') return null;
        if (!vigente()) return null;

        if (snap.schema_version !== undefined && Number(snap.schema_version) !== 1) {
            log('schema_version no soportada:', snap.schema_version);
        }
        if (snap.device_type && snap.device_type !== 'display') { log('snapshot de otro tipo de dispositivo; se ignora'); return null; }
        if (S.deviceId !== null && snap.device_id !== undefined && Number(snap.device_id) !== Number(S.deviceId)) {
            log('snapshot de otro dispositivo; se ignora'); return null;
        }

        const version = Number(snap.config_version);
        if (S.aplicada !== null && Number.isFinite(version) && version < S.aplicada) {
            log('snapshot con version vieja (' + version + ' < ' + S.aplicada + '); se ignora'); return null;
        }

        if (snap.device_id !== undefined && snap.device_id !== null) S.deviceId = Number(snap.device_id);
        if (Number.isFinite(version)) {
            S.aplicada = version;
            if (S.observada === null || S.observada < version) S.observada = version;
            localStorage.setItem('version', String(version));
        }
        S.snapshot = snap;

        log('snapshot aplicado (' + origen + '): version', snap.config_version, 'can_operate', snap.can_operate, 'motivos', (snap.blocked_reasons || []).join(',') || '-');

        if (snap.lugar && snap.lugar.nombre) {
            localStorage.setItem('lugar', snap.lugar.nombre);
            const el = document.querySelectorAll('.txt_lgr');
            for (let i = 0; i < el.length; i++) el[i].textContent = snap.lugar.nombre;
        }

        const config  = snap.config || {};
        const gameUrl = String(config.game_url || '').replace(/^\/+/, '');
        const j       = juegoDeLaPagina(snap);

        /* 1. Suspension / inactividad: sin contenido, conservando vinculacion y control. */
        if (snap.can_operate === false) {
            mostrarBloqueo(snap.blocked_reasons);
            if (S.iniciado && !S.modoBloqueado) irA(null, true);     // se detiene el contenido que estaba corriendo
            return 'bloqueado';
        }

        /* 2. El visor tiene asignada otra pantalla. */
        if (gameUrl && gameUrl.toUpperCase() !== paginaActual()) {
            localStorage.setItem('url', gameUrl);
            log('pantalla asignada:', gameUrl);
            irA('/' + gameUrl, !S.iniciado || S.modoBloqueado);
            return 'navegando';
        }

        /* 3. Juego de esta pagina dentro de los juegos efectivos del visor. */
        if (j.conocido && !j.juego) {
            mostrarBloqueo(['sin_juegos'], 'Sin contenido autorizado');
            if (S.iniciado && !S.modoBloqueado) irA(null, true);
            return 'sin_juego';
        }

        /* 4. Estaba bloqueado y ya puede operar: el contenido vuelve solo, sin intervencion. */
        if (S.iniciado && S.modoBloqueado) {
            log('visor reactivado: se reinicia el contenido');
            irA(null, true);
            return 'navegando';
        }

        let recargar = false;

        if (j.juego) {
            const clave = S.opciones.claveJuego || 'game_id';
            if (String(localStorage.getItem(clave)) !== String(j.juego.id)) {
                localStorage.setItem(clave, String(j.juego.id));
                if (S.opciones.recargarSiCambiaJuego || S.iniciado) recargar = true;
            }
        }

        /* 5. Grupo virtual vigente (nunca lottery_group): define la URL del countdown. */
        if (snap.grupo && snap.grupo.id !== undefined && snap.grupo.id !== null) {
            if (String(localStorage.getItem('grupo')) !== String(snap.grupo.id)) {
                localStorage.setItem('grupo', String(snap.grupo.id));
                if (S.iniciado) recargar = true;
            }
        }

        if (recargar) {
            log('cambio de juego o grupo: se recarga la pantalla');
            irA(null, !S.iniciado);
            return 'navegando';
        }

        return 'ok';
    }

    /* ---------------- reconciliacion en serie ---------------- */

    function reconciliar(motivo) {
        if (!S.conControl || S.detenido) return Promise.resolve();
        if (S.recargando) { S.pendiente = true; return S.recargando; }

        S.recargando = (async () => {
            let vueltas = 0;
            do {
                S.pendiente = false;
                vueltas++;
                const r = await control('dispositivo_snapshot');

                if (r.tipo === 'revocado') { desvincular('snapshot 403'); return; }
                if (r.tipo === 'sin_endpoint') { S.conControl = false; return; }
                if (r.tipo === 'vieja') return;
                if (r.tipo !== 'ok') {
                    // No se marca version aplicada: se reintenta mas tarde
                    log('snapshot no disponible (' + motivo + '):', r.detalle || r.tipo);
                    clearTimeout(S.tRecarga);
                    S.tRecarga = setTimeout(() => reconciliar('reintento'), r.ms || 5000 + Math.random() * 3000);
                    return;
                }

                aplicarSnapshot(r.datos, motivo);

                // Llego otra senal durante la recarga, o el snapshot no alcanzo la version observada
                if (S.observada !== null && S.aplicada !== null && S.aplicada < S.observada && vueltas < 3) S.pendiente = true;
            } while (S.pendiente && vueltas < 3 && !S.detenido);
        })().finally(() => { S.recargando = null; });

        return S.recargando;
    }

    /* ---------------- mensajes device.* (control y countdown) ---------------- */

    function yaVisto(eventId) {
        if (!eventId) return false;
        if (S.eventos.indexOf(eventId) !== -1) return true;
        S.eventos.push(eventId);
        if (S.eventos.length > 200) S.eventos.splice(0, S.eventos.length - 200);
        return false;
    }

    function mismoDispositivo(msg) {
        if (msg.device_type && msg.device_type !== 'display') return false;
        if (msg.device_id !== undefined && msg.device_id !== null && S.deviceId !== null && Number(msg.device_id) !== S.deviceId) return false;
        return true;
    }

    /* Devuelve true si el mensaje era de control (la pagina no debe tratarlo como conteo). */
    function recibir(msg, origen) {
        if (!msg || typeof msg !== 'object') return false;
        const tipo = String(msg.type || '');
        if (tipo.indexOf('device.') !== 0) return false;
        if (!vigente()) return true;

        if (tipo === 'device.ready') {
            aplicarSnapshot(msg, origen + ' ready');
            return true;
        }

        /* Falla temporal del control: no es suspension ni revocacion. El servidor cierra
           con 1011 y el control se reconecta con ticket nuevo; la vinculacion se conserva. */
        if (tipo === 'device.unavailable') {
            log('control no disponible temporalmente (' + (msg.action || 'retry') + '): se reconecta sin tocar la vinculacion');
            return true;
        }

        if (tipo === 'device.status') {
            if (!mismoDispositivo(msg)) return true;
            const s = S.snapshot || {};
            const motivosAntes = (s.blocked_reasons || []).slice().sort().join(',');
            const motivosAhora = (msg.blocked_reasons || []).slice().sort().join(',');
            const version = Number(msg.config_version);
            if (Number.isFinite(version) && (S.observada === null || version > S.observada)) S.observada = version;
            if (msg.can_operate !== s.can_operate || motivosAntes !== motivosAhora ||
                (Number.isFinite(version) && (S.aplicada === null || version > S.aplicada))) {
                if (msg.can_operate === false) mostrarBloqueo(msg.blocked_reasons);
                reconciliar('status ' + origen);
            }
            return true;
        }

        const accion = String(msg.action || '');

        // Revocacion minima del chequeo periodico: sin event_id ni version
        if (tipo === 'device.revoked' && !msg.event_id) {
            if (origen === 'control') desvincular('control');
            else reconciliar('revocacion por countdown');      // se confirma por REST
            return true;
        }

        if (!mismoDispositivo(msg)) return true;
        if (yaVisto(msg.event_id)) return true;

        if (tipo === 'device.revoked' || accion === 'pair_required') {
            desvincular(tipo + ' ' + origen);
            return true;
        }

        const version = Number(msg.config_version);
        if (Number.isFinite(version) && S.aplicada !== null && version <= S.aplicada) {
            log('evento ' + tipo + ' con version ' + version + ' ya aplicada; se ignora');
            return true;
        }
        if (Number.isFinite(version) && (S.observada === null || version > S.observada)) S.observada = version;

        if (tipo === 'device.suspended' || accion === 'show_blocked') {
            mostrarBloqueo((msg.data || {}).blocked_reasons);
        }

        // refresh_config, login_required (el visor no tiene operador), show_blocked
        // y tipos desconocidos: se recupera el estado vigente por REST
        reconciliar(tipo + (accion ? ' / ' + accion : '') + ' ' + origen);
        return true;
    }

    /* ---------------- WebSocket de control ---------------- */

    function wsBase() {
        return String((window.VISOR_CONFIG || {}).wsUrl || '').replace(/\/+$/, '');
    }

    function programarReconexion(ms) {
        if (S.detenido || !S.conControl) return;
        clearTimeout(S.tReconexion);
        const espera = ms || conVariacion(ESPERAS[Math.min(S.intentos, ESPERAS.length - 1)]);
        S.intentos++;
        S.tReconexion = setTimeout(conectarControl, espera);
    }

    async function conectarControl() {
        if (S.detenido || !S.conControl || S.socket || !navigator.onLine) {
            if (!navigator.onLine && !S.detenido) programarReconexion();
            return;
        }
        if (!wsBase()) { log('WEBSOCKET_URL no configurado: control sin canal'); return; }

        if (S.conectando) return;
        S.conectando = true;
        let r;
        try { r = await control('dispositivo_ticket'); } finally { S.conectando = false; }
        if (r.tipo === 'revocado') { desvincular('ticket 403'); return; }
        if (r.tipo === 'sin_endpoint') { S.conControl = false; log('la API no tiene control de dispositivos; se sigue sin el'); return; }
        if (r.tipo === 'vieja' || S.detenido || S.socket) return;
        if (r.tipo !== 'ok') { programarReconexion(r.ms); return; }

        const t = r.datos;
        let ws;
        try { ws = new WebSocket(wsBase() + (t.websocket_path || '/ws/device-control/')); }
        catch (e) { programarReconexion(); return; }

        S.socket = ws;
        S.autenticado = false;

        ws.onopen = () => {
            logControl('conectado', ws.url);
            ws.send(JSON.stringify({ type: 'authenticate', ticket: t.ticket }));
        };

        S.ultimoMsg = Date.now();

        ws.onmessage = ev => {
            if (S.socket !== ws) return;
            S.ultimoMsg = Date.now();
            let msg;
            try { msg = JSON.parse(ev.data); } catch (_) { return; }
            logControl(msg, ws.url);
            if (msg && msg.type === 'device.ready') { S.autenticado = true; S.intentos = 0; }
            if (!recibir(msg, 'control')) log('mensaje de control desconocido:', msg && msg.type);
        };

        ws.onclose = ev => {
            logControl('cerrado, codigo ' + ev.code, ws.url);
            if (S.socket !== ws) return;
            S.socket = null;
            S.autenticado = false;
            if (S.detenido) return;
            log('control cerrado', ev.code);

            if (ev.code === 4403) {
                // La revalidacion de control rechazo la vinculacion: se confirma por REST
                reconciliar('control 4403').then(() => programarReconexion());
                return;
            }
            // 4401 (ticket rechazado), 1006, timeout...: ticket nuevo, sin tocar la vinculacion
            programarReconexion();
        };

        ws.onerror = () => { try { ws.close(); } catch (_) {} };
    }

    /* ---------------- heartbeat y respaldo ---------------- */

    async function latido() {
        if (S.detenido) return;
        try {
            const r = await postVisor({ realizar: 'display_heartbeat', device_token: S.token, config_version: S.aplicada });
            if (!vigente()) return;

            if (r.status === 404) {
                // Heartbeat 404: inactividad, credencial invalida u otro caso; lo decide el snapshot
                await reconciliar('heartbeat 404');
            } else if (r.status === 501) {
                S.latidoSeg = 300;
            } else if (r.ok && r.cuerpo) {
                const hb = r.cuerpo.heartbeat || r.cuerpo;
                const intervalo = Number(hb.heartbeat_interval_seconds);
                if (intervalo > 0) S.latidoSeg = intervalo;
                revisarLatido(hb);
            }

            // Control caido: el heartbeat tambien trae el snapshot (respaldo REST)
            if (S.conControl && !S.autenticado && !S.socket && !S.conectando) await reconciliar('respaldo sin control');

        } catch (e) {
            log('heartbeat no disponible');
        } finally {
            clearTimeout(S.tLatido);
            if (!S.detenido) S.tLatido = setTimeout(latido, S.latidoSeg * 1000);
        }
    }

    function revisarLatido(hb) {
        if (!hb || !S.conControl) return;
        const s = S.snapshot || {};
        const version = Number(hb.config_version);
        const motivosAntes = (s.blocked_reasons || []).slice().sort().join(',');
        const motivosAhora = (hb.blocked_reasons || []).slice().sort().join(',');
        if ((hb.can_operate !== undefined && hb.can_operate !== s.can_operate) || motivosAntes !== motivosAhora ||
            (Number.isFinite(version) && (S.aplicada === null || version > S.aplicada))) {
            if (Number.isFinite(version) && (S.observada === null || version > S.observada)) S.observada = version;
            reconciliar('heartbeat');
        }
    }

    /* ---------------- countdown (lo usan las paginas de cada juego) ---------------- */

    /* Antes de abrir el countdown: {modo:'auth', ticket} | {modo:'sin_auth'} | {modo:'esperar', ms} | {modo:'parar'} */
    async function ticketCountdown() {
        if (S.detenido || S.modoBloqueado) return { modo: 'parar' };
        if (S.snapshot && S.snapshot.can_operate === false) return { modo: 'parar' };
        /* Contrato final: la API exige autenticacion. Si no hay ticket (501 o falla),
           el countdown NO se abre anonimamente: se espera y se vuelve a intentar. */
        const r = await control('dispositivo_ticket');
        if (r.tipo === 'ok') return { modo: 'auth', ticket: r.datos.ticket };
        if (r.tipo === 'revocado') { desvincular('ticket countdown 403'); return { modo: 'parar' }; }
        if (r.tipo === 'vieja') return { modo: 'parar' };
        if (r.tipo === 'sin_endpoint') {
            log('la API no tiene la ruta del ticket: el countdown no se abre sin autenticacion; se reintenta en 30 s');
            return { modo: 'esperar', ms: conVariacion(30) };
        }
        return { modo: 'esperar', ms: r.ms || conVariacion(5) };
    }

    /* Mensaje recibido por el countdown (separacion estricta: aqui solo llegan countdown.*).
         'conteo'        countdown.update / countdown.empty
         'contexto'      countdown.context_changed (se reconcilia; el servidor cierra con 4403)
         'no_disponible' countdown.unavailable (el servidor cierra con 1011)
         'ignorar'       cualquier device.* (solo se procesan en el canal de control) u otro tipo */
    function mensajeCountdown(msg) {
        const tipo = String((msg && msg.type) || '');
        if (tipo === 'countdown.context_changed') { reconciliar('countdown.context_changed'); return 'contexto'; }
        if (tipo === 'countdown.unavailable') return 'no_disponible';
        if (tipo === 'countdown.update' || tipo === 'countdown.empty' || tipo === '') return 'conteo';
        if (tipo.indexOf('device.') === 0) log('mensaje ' + tipo + ' en el countdown: se ignora (solo vale en control)');
        else log('mensaje desconocido en el countdown:', tipo);
        return 'ignorar';
    }

    /* Cierre del countdown: 4403 = grupo/juego/suspension; se consulta el snapshot antes de volver.
       Devuelve la espera sugerida (ms) o null si no se debe reconectar. */
    async function cierreCountdown(codigo, intentos, retryAfter) {
        if (S.detenido) return null;
        // 1011 tras countdown.unavailable: se espera retry_after y se vuelve con ticket nuevo
        if (codigo === 1011) return conVariacion(Math.max(1, Number(retryAfter) || 3));
        if (codigo === 4403) {
            await reconciliar('countdown 4403');
            if (S.detenido || (S.snapshot && S.snapshot.can_operate === false)) return null;
            return conVariacion(Math.max(8, ESPERAS[Math.min(intentos, ESPERAS.length - 1)]));
        }
        return conVariacion(ESPERAS[Math.min(intentos, ESPERAS.length - 1)]);
    }

    /* ---------------- arranque ---------------- */

    /* opciones: { codigos:[...], claveJuego:'game_id', recargarSiCambiaJuego:bool }
       Devuelve: 'ok' | 'bloqueado' | 'sin_juego' | 'navegando' | 'sin_control' | 'sin_verificar' | 'sin_token' */
    async function iniciar(opciones) {
        S.opciones = opciones || {};
        S.token = localStorage.getItem('dkg');
        if (!S.token) return 'sin_token';

        let resultado = 'sin_verificar';
        const r = await control('dispositivo_snapshot');

        if (r.tipo === 'revocado') { desvincular('snapshot inicial 403'); return 'navegando'; }
        if (r.tipo === 'sin_endpoint') { S.conControl = false; resultado = 'sin_control'; log('la API no tiene control de dispositivos; visor sin control'); }
        else if (r.tipo === 'ok') resultado = aplicarSnapshot(r.datos, 'inicio') || 'ok';
        else log('snapshot inicial no disponible; se sigue y se reintenta');

        S.modoBloqueado = resultado === 'bloqueado' || resultado === 'sin_juego';
        S.iniciado = true;

        if (resultado !== 'navegando') {
            conectarControl();
            latido();
            if (resultado === 'sin_verificar') setTimeout(() => reconciliar('inicio sin snapshot'), 3000);
        }
        return resultado;
    }

    /* El servidor manda device.status cada ~30 s: si el canal calla mucho mas, esta muerto. */
    setInterval(() => {
        if (S.socket && S.autenticado && Date.now() - S.ultimoMsg > 75000) {
            log('control sin mensajes hace 75 s: se reconecta');
            const s = S.socket;
            S.socket = null; S.autenticado = false;
            try { s.onclose = null; s.close(); } catch (_) {}
            programarReconexion();
        }
    }, 5000);

    window.addEventListener('online', () => { if (S.iniciado) { reconciliar('online'); conectarControl(); } });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && S.iniciado) { reconciliar('visible'); conectarControl(); }
    });

    /* ---------------- consola: que trae cada WebSocket ---------------- */

    const ETQ_EVENTO  = ['%c[WS EVENTO] tiempo de venta, cierre e informacion del sorteo', 'color:#1a7f37;font-weight:bold'];
    const ETQ_CONTROL = ['%c[WS CONTROL] cambios del panel para este visor (no es el tiempo del sorteo)', 'color:#1f6feb;font-weight:bold'];

    const hora = iso => {
        if (!iso) return '-';
        const d = new Date(iso);
        return isNaN(d) ? String(iso) : d.toLocaleTimeString('es-DO', { hour12: false });
    };

    /* Socket del juego: /ws/pos/grupos/<grupo>/games/<juego>/countdown/ */
    function logEvento(data, url) {
        const donde = url ? '| ' + url : '';
        if (typeof data === 'string') { console.log(ETQ_EVENTO[0], ETQ_EVENTO[1], '|', data, donde); return; }
        const d = data || {};
        let resumen;
        if (d.type === 'countdown.update') {
            const abierto = d.state === 'selling';
            resumen = 'Sorteo ' + d.event_number + ' (' + (d.game_code || 'juego ' + d.game_id) + ') | ' +
                (abierto ? 'VENTA ABIERTA: cierra en ' + d.seconds_left + ' s' : 'VENTAS CERRADAS (' + (d.phase || d.state) + ')') +
                ' | cierre de venta ' + hora(d.sales_close_at) + ' | evento ' + hora(d.scheduled_at);
        } else if (d.type === 'countdown.empty') {
            resumen = 'Sin sorteo programado';
        } else if (d.type === 'countdown.unavailable') {
            resumen = 'DATOS DEL SORTEO NO DISPONIBLES (la API reintenta en ' + (d.retry_after || '?') + ' s)';
        } else if (d.type === 'countdown.context_changed') {
            resumen = 'CAMBIO DE CONTEXTO: se consulta la configuracion antes de volver a suscribirse';
        } else if (String(d.type || '').indexOf('device.') === 0) {
            resumen = d.type + ' no corresponde a este canal (solo control): se ignora';
        } else {
            resumen = d.type || '(sin type)';
        }
        console.log(ETQ_EVENTO[0], ETQ_EVENTO[1], '|', resumen, donde, d);
    }

    /* Socket de control: /ws/device-control/ */
    function logControl(msg, url) {
        const donde = url ? '| ' + url : '';
        if (typeof msg === 'string') { console.log(ETQ_CONTROL[0], ETQ_CONTROL[1], '|', msg, donde); return; }
        const m = msg || {};
        let resumen;
        if (m.type === 'device.ready')       resumen = 'autenticado: visor ' + m.device_id + ' "' + (m.name || '') + '" version ' + m.config_version + ' | puede operar: ' + m.can_operate;
        else if (m.type === 'device.status') resumen = 'estado cada ~30 s: version ' + m.config_version + ' | puede operar: ' + m.can_operate + ((m.blocked_reasons || []).length ? ' | motivos: ' + m.blocked_reasons.join(', ') : '');
        else                                 resumen = 'aviso del panel: ' + (m.type || '(sin type)') + (m.action ? ' / ' + m.action : '') + (m.config_version !== undefined ? ' | version ' + m.config_version : '');
        console.log(ETQ_CONTROL[0], ETQ_CONTROL[1], '|', resumen, donde, m);
    }

    const ControlVisor = window.ControlVisor = {
        logEvento: logEvento,
        logControl: logControl,
        iniciar: iniciar,
        reconciliar: reconciliar,
        recibir: recibir,
        ticketCountdown: ticketCountdown,
        mensajeCountdown: mensajeCountdown,
        cierreCountdown: cierreCountdown,
        mostrarBloqueo: mostrarBloqueo,
        textoMotivo: textoMotivo,
        get snapshot() { return S.snapshot; },
        get bloqueado() { return S.modoBloqueado || !!(S.snapshot && S.snapshot.can_operate === false); },
        get conControl() { return S.conControl; },
        get autenticado() { return S.autenticado; },
        /* La pagina del juego lo reemplaza: true cuando esta quieta en la tabla. */
        estaQuieto: () => true,
        alDetener: null,
        _estado: S
    };
})();
