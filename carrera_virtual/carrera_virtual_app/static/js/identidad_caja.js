/* ==========================================================================
   IDENTIDAD DE LA CAJA (ODROID) EN EL HEARTBEAT
   Guia "Racing - Identidad del visor en el heartbeat" (API DEMP V2.2.2.7.6).

   - Se lee UNA vez por carga de pagina, en segundo plano, de la imagen de la caja:
       GET http://127.0.0.1:3000/demp-identity.json
       {"schema":"demp.identity/v1","mac":"00:1e:06:ab:cd:12","image_version":"20261115194516"}
   - Se suma al heartbeat que ya envia el visor (control_visor.js, cone_db_p.js y
     cone_db_roulette.js) como device_mac e image_version. No crea otro temporizador.
   - Si el primer heartbeat sale antes de terminar la lectura, los campos van en el siguiente.
   - Imagen antigua, navegador sin caja o lectura fallida: no se envia nada extra y el
     heartbeat sigue igual que siempre (la API conserva la ultima identidad conocida).
     Nunca se inventa una MAC ni una version.
   ========================================================================== */
(function () {
    'use strict';

    if (window.IdentidadCaja) return;

    const URL_IDENTIDAD = 'http://127.0.0.1:3000/demp-identity.json';
    const LIMITE_MS     = 2000;
    const MAC           = /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i;

    let campos = {};

    async function leer() {
        const control = new AbortController();
        const espera  = setTimeout(() => control.abort(), LIMITE_MS);
        try {
            const r = await fetch(URL_IDENTIDAD, { cache: 'no-store', credentials: 'omit', signal: control.signal });
            if (!r.ok) return {};
            const d = await r.json();
            if (!d || d.schema !== 'demp.identity/v1') return {};

            const f = {};
            if (typeof d.mac === 'string' && MAC.test(d.mac)) f.device_mac = d.mac.toLowerCase();
            if (typeof d.image_version === 'string' && d.image_version.length > 0 && d.image_version.length <= 50) f.image_version = d.image_version;
            return f;
        } catch (e) {
            return {};
        } finally {
            clearTimeout(espera);
        }
    }

    const lectura = leer().then(f => {
        campos = f;
        console.log('[identidad] ' + (f.device_mac ? 'caja ' + f.device_mac + ' imagen ' + (f.image_version || '-') : 'sin identidad local (se envia el heartbeat habitual)'));
        return f;
    });

    window.IdentidadCaja = {
        /* Cuerpo del heartbeat + device_mac / image_version cuando se conocen */
        con(cuerpo) { return Object.assign({}, cuerpo, campos); },
        campos() { return Object.assign({}, campos); },
        lectura
    };
})();
