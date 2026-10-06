/* =========================================================================
   VIRTUAL STORM ROULETTE — app.js
   Canvas 2D + GSAP. One canvas, one animation frame, one config object.

   Architecture
     CONFIG              every coordinate, size, scale and offset
     STATE               values GSAP animates; the renderer only reads them
     Assets              preloader + one-time blue tint canvases
     Renderer            draws the whole scene each frame
     AnimationController 30s IDLE / 5s SPIN cycle
     LightningController flashes synced to the storm video timeline
     DebugController     overlay + live layer alignment tools
     main()

   Coordinate system: always 1920 x 1080. CSS scales the stage, never the
   contents. Nothing here reads window.innerWidth.
   ========================================================================= */

const DEBUG_BUILD = false;

(function () {
'use strict';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;


/* =========================================================================
   1. CONFIG — the single source of truth for layout
   =========================================================================

   ASSET GEOMETRY (measured from the supplied PNGs, do not guess these):

     roulette_housing.png  900x900
         outer ring ellipse   center (448.5, 447.5)  a=442.2  b=429.3
         inner opening        center (446.2, 423.4)  a=310.3  b=289.2
         -> the opening sits 24px ABOVE the outer center: the ring is a 3D
            object seen slightly from above. The rotor must be anchored to
            the OPENING, which is why anchor uses (446.2, 423.4).

     roulette_rotor.png    900x900
         wheel circle         center (447.4, 442.0)  r=436.8
         hub hole             r=81.8
         pocket ring starts   r=272   outer number ring  r=355..420

     roulette_center.png   900x900
         turret disc ellipse  center (448.2, 494.3)  a=401.2  b=336.0
         -> the disc center is 44px BELOW the image center, and the artwork
            already carries its own 0.838 perspective.

   Each layer therefore needs two corrections:
     anchor     the visible geometric center, in source pixels
     aspectFix  1 / nativeAspect, which flattens the artwork back to a true
                circle BEFORE the group perspective is applied. Without it,
                the center piece would be squashed twice (0.838 * 0.74).
   ========================================================================= */

const CONFIG = {

    design: {
        width:  1920,
        height: 1080
    },

    assets: {
        path:    'assets/',
        logo:    'logo.png',
        housing: 'roulette_housing.png',
        rotor:   'roulette_rotor.png',
        center:  'roulette_center.png'
    },

    logo: {
        x:     25,
        y:     18,
        width: 500          // height follows the source aspect (900x300)
    },

    roulette: {

        centerX: 360,
        centerY: 500,

        size: 700,          // width in design units of a layer drawn at scale 1

        perspectiveY: 0.74, // vertical compression of the WHOLE group

        // Draw order is fixed: rotor -> center -> housing.
        // The housing is the bezel and must sit in front of the wheel edge.

        rotor: {
            scale:     0.735,
            offsetX:   0,
            offsetY:   0,
            aspectFix: 1.0114,          // 1 / 0.9887
            anchor:    [447.4, 442.0],
            source:    [900, 900],
            radius:    436.8            // used by the FX + debug guides
        },

        center: {
            scale:     0.49,
            offsetX:   0,
            offsetY:   0,
            aspectFix: 1.1940,          // 1 / 0.8375  (removes the baked-in perspective)
            anchor:    [448.2, 494.3],
            source:    [900, 900],
            radius:    401.2
        },

        housing: {
            scale:     1.0,
            offsetX:   0,
            offsetY:   0,
            aspectFix: 1.0302,          // 1 / 0.9707
            anchor:    [446.2, 423.4],  // the OPENING center, not the outer center
            source:    [900, 900],
            radius:    442.2,           // outer edge
            innerRadius: 310.3,         // opening edge
            rimCenter: [2.3, 24.1]      // outer-edge center, relative to the anchor
        }
    },

    /* ---------------------------------------------------------------------
       >>> CICLO DE LA RULETA <<<
       Este es el único sitio donde se ajusta. En reposo el canvas no genera
       ni un frame; cada `wait` ms la ruleta gira `duration` ms a `fps`, y al
       terminar el ticker se vuelve a dormir.
       --------------------------------------------------------------------- */
    rouletteAmbient: {
        wait:     30000,
        duration:  5000,
        fps:         30
    },

    timing: {
        idleDuration:  30,      // se toma de rouletteAmbient.wait
        spinDuration:  5,       // se toma de rouletteAmbient.duration
        accelDuration: 1.2,     // part of spinDuration spent accelerating
        minRotations:  5,
        maxRotations:  7,
        pockets:       37       // the rotor stops on a pocket boundary
    },

    fx: {
        /* The lit band on the bezel, as a fraction of the housing outer
           radius. 0.75 keeps the light entirely on the metal ring: the
           opening is off-centre, so its edge sits between 0.62 and 0.73 of
           the outer radius depending on the direction. */
        rimBandInner: 0.75,

        // A narrow light bar orbiting the housing rim. Geometry never moves.
        rimSweep:  { alpha: 0.34, period: 9,  color: '110, 190, 255' },
        goldSweep: { alpha: 0.22, period: 14, color: '255, 186,  96' },

        // Two fixed specular points on the rim that breathe with STATE.glow.
        specular:  { alpha: 0.30, radius: 120, points: [-38, 152] },

        lightning: {
            bloom:   0.34,   // white bloom re-drawn from the layer artwork
            tint:    0.55,   // blue multiply pass over the metal
            ambient: 0.10,   // wide veil over the stage
            tintColor: '#3aa0ff',
            tintResolution: 450   // half-res offscreen; ~0.8 MB per layer
        },

        glow: { period: 3.5 }
    },

    lightning: {
        syncToVideo: true,

        // Measured from storm_bg.mp4 (24 fps, 15.04 s) by frame luminance.
        // { t: seconds into the clip, i: relative strength 0..1 }
        events: [
            { t: 0.25,  i: 0.35 },
            { t: 1.13,  i: 0.45 },
            { t: 5.50,  i: 0.55 },
            { t: 5.92,  i: 0.40 },
            { t: 7.50,  i: 0.70 },
            { t: 8.87,  i: 1.00 },
            { t: 12.16, i: 0.95 },
            { t: 12.91, i: 0.90 }
        ],

        // Used only when syncToVideo is false or the video is not playing.
        fallback: { minGap: 3, maxGap: 9, minStrength: 0.4, maxStrength: 1 }
    },

    debug: {
        showGuides: true,
        nudgeStep:  1,
        scaleStep:  0.005,
        aspectStep: 0.005
    },

    // Bumped whenever debug edits geometry, so cached gradients rebuild.
    version: 0
};


/* =========================================================================
   2. STATE — GSAP writes here, the renderer reads here
   ========================================================================= */

const STATE = {
    mode:        'idle',   // 'idle' | 'spin'
    rotorAngle:  0,        // degrees, kept in 0..360 between spins
    rimSweep:    0,
    goldSweep:   0,
    glow:        0,
    lightning:   0,
    nextSpinAt:  0,        // performance.now() timestamp
    fps:         0,
    debug:       false,
    selected:    null      // 'housing' | 'rotor' | 'center'
};


/* =========================================================================
   3. ASSETS
   ========================================================================= */

const Assets = {

    img:  {},   // logo, housing, rotor, center
    tint: {},   // blue-multiplied copies used for lightning reflections

    load() {
        const A = CONFIG.assets;
        const jobs = ['logo', 'housing', 'rotor', 'center'].map(key =>
            new Promise((resolve, reject) => {
                const im = new Image();
                im.decoding = 'async';
                im.onload  = () => { Assets.img[key] = im; resolve(); };
                im.onerror = () => reject(new Error('Failed to load ' + A[key]));
                im.src = A.path + A[key];
            })
        );

        return Promise.all(jobs).then(() => Assets.buildTints());
    },

    /* One-time offscreen pass. Multiply the artwork by blue and restore its
       alpha, so a lightning flash adds colour in proportion to how bright the
       metal already is, instead of flooding a flat silhouette. */
    buildTints() {
        const L = CONFIG.fx.lightning;
        ['housing', 'rotor', 'center'].forEach(key => {
            const src = Assets.img[key];
            const w   = L.tintResolution;
            const h   = Math.round(w * src.height / src.width);

            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const g = c.getContext('2d');

            g.drawImage(src, 0, 0, w, h);
            g.globalCompositeOperation = 'multiply';
            g.fillStyle = L.tintColor;
            g.fillRect(0, 0, w, h);
            g.globalCompositeOperation = 'destination-in';
            g.drawImage(src, 0, 0, w, h);

            Assets.tint[key] = c;
        });
    }
};


/* =========================================================================
   4. RENDERER
   ========================================================================= */

const Renderer = {

    canvas: null,
    ctx:    null,

    /* Cached gradients. Rebuilt only when CONFIG.version changes, never
       inside the frame loop. */
    cache: { version: -1, rim: null, gold: null, spec: null, ambient: null, geom: null },

    init(canvas, uiCanvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
        this.ctx.imageSmoothingQuality = 'high';

        if (uiCanvas) {
            this.uiCtx = uiCanvas.getContext('2d', { alpha: true });
            this.uiCtx.imageSmoothingQuality = 'high';
        }

    },

    /* ---- geometry helpers ------------------------------------------------ */

    // design units per source pixel for a given layer
    unit(layer) {
        return CONFIG.roulette.size * layer.scale / layer.source[0];
    },

    buildCache() {
        const R = CONFIG.roulette;
        const F = CONFIG.fx;
        const u = this.unit(R.housing);

        /* The rim band is centred on the housing's OUTER circle, which sits
           below the opening the layer is anchored to. In local space the
           artwork is already normalised to a circle by aspectFix, so the
           vertical part of that offset is scaled the same way. */
        const geom = {
            rimOuter: R.housing.radius * u,
            rimInner: R.housing.radius * u * F.rimBandInner,
            hx: R.housing.offsetX + R.housing.rimCenter[0] * u,
            hy: R.housing.offsetY + R.housing.rimCenter[1] * u * R.housing.aspectFix
        };

        const ctx = this.ctx;
        const r = geom.rimOuter;

        // A single bright band. Rotating the context sweeps it around the rim.
        const rim = ctx.createLinearGradient(0, -r, 0, r);
        rim.addColorStop(0.00, 'rgba(' + F.rimSweep.color + ', 0)');
        rim.addColorStop(0.07, 'rgba(' + F.rimSweep.color + ', 0.85)');
        rim.addColorStop(0.13, 'rgba(' + F.rimSweep.color + ', 0.30)');
        rim.addColorStop(0.24, 'rgba(' + F.rimSweep.color + ', 0)');
        rim.addColorStop(1.00, 'rgba(' + F.rimSweep.color + ', 0)');

        const gold = ctx.createLinearGradient(0, -r, 0, r);
        gold.addColorStop(0.00, 'rgba(' + F.goldSweep.color + ', 0)');
        gold.addColorStop(0.10, 'rgba(' + F.goldSweep.color + ', 0.70)');
        gold.addColorStop(0.20, 'rgba(' + F.goldSweep.color + ', 0.18)');
        gold.addColorStop(0.34, 'rgba(' + F.goldSweep.color + ', 0)');
        gold.addColorStop(1.00, 'rgba(' + F.goldSweep.color + ', 0)');

        const sr = F.specular.radius;
        const spec = ctx.createRadialGradient(0, 0, 0, 0, 0, sr);
        spec.addColorStop(0.0, 'rgba(215, 236, 255, 0.95)');
        spec.addColorStop(0.4, 'rgba(140, 200, 255, 0.30)');
        spec.addColorStop(1.0, 'rgba(120, 180, 255, 0)');

        // Stage-space veil for the ambient part of a lightning strike.
        const ambient = ctx.createRadialGradient(
            R.centerX, R.centerY, 0,
            R.centerX, R.centerY, CONFIG.design.width * 0.62
        );
        ambient.addColorStop(0.0, 'rgba(120, 180, 255, 0.55)');
        ambient.addColorStop(0.5, 'rgba(70, 130, 220, 0.22)');
        ambient.addColorStop(1.0, 'rgba(30,  60, 130, 0)');

        this.cache = { version: CONFIG.version, rim, gold, spec, ambient, geom };
    },

    invalidate() {
        CONFIG.version++;
    },

    /* ---- frame -----------------------------------------------------------

       Sigue siendo UN SOLO canvas de 1920x1080. Lo que cambia es que ya no
       se reconstruye entero en cada frame:

         - la BANDA de la ruleta se limpia y se redibuja a 60 FPS;
         - la interfaz se queda donde está y cada sección solo se repinta
           cuando su contenido cambia, dentro de su rectángulo;
         - la luz ambiental se suma encima cada frame, restaurando antes solo
           las tiras que toca.

       Probar con dos canvas superpuestos salió peor: componer una segunda
       capa de 1920x1080 cuesta más de lo que ahorra.

       El fondo sigue siendo el <video>: no se dibuja dentro de ningún canvas,
       lo compone el navegador.
       ---------------------------------------------------------------------- */

    /* Todo lo que la ruleta y el logo pintan cabe en esta banda: por la
       derecha termina antes de que empiecen los paneles (x 720) y por abajo
       antes del panel de ÚLTIMO JACKPOT (y 799).
       El destello ambiental de un rayo sí cubre el escenario entero, y solo
       entonces se limpia completo. */
    sceneBand: { x: 0, y: 0, w: 714, h: 794 },
    stats: { scene: 0, sceneFull: 0 },

    render() {
        const ctx = this.ctx;

        if (this.cache.version !== CONFIG.version) this.buildCache();

        /* STATE.lightning se quedó a 0 para siempre: no hay reacción canvas
           a los relámpagos del vídeo. */
        const flash = false;

        if (flash) {
            /* El destello de un rayo sí cubre el escenario entero. Al
               limpiarlo todo hay que volver a componer la interfaz. */
            ctx.clearRect(0, 0, CONFIG.design.width, CONFIG.design.height);
            if (window.StormUI && window.StormUI.forceFullRepaint) {
                window.StormUI.forceFullRepaint();
            }
            this.stats.sceneFull++;
        } else {
            /* Mismo orden de composición de siempre: primero se limpia todo
               lo que se va a repintar, después la ruleta, y la interfaz
               encima. Limpiar las zonas de interfaz DESPUÉS de la ruleta
               borraría el borde del bombo que asoma bajo los paneles. */
            const b = this.sceneBand;
            ctx.clearRect(b.x, b.y, b.w, b.h);
            if (window.StormUI && window.StormUI.clearUI) window.StormUI.clearUI(ctx);
        }

        this.stats.scene++;

        /* Ya no hay destello ambiental ni reacción al rayo del vídeo: el
           movimiento ambiental lo pone storm_bg.mp4, no el canvas. */
        this.drawRoulette();
        this.drawLogo();

        /* Interfaz: solo las secciones cuyo contenido cambió, más la luz. */
        if (window.StormUI) window.StormUI.drawUI(ctx);

        if (STATE.debug) DebugController.draw(ctx);
    },

    drawLogo() {
        const im = Assets.img.logo;
        const L  = CONFIG.logo;
        this.ctx.drawImage(im, L.x, L.y, L.width, L.width * im.height / im.width);
    },

    /* The group: circular local space, then one vertical compression. */
    drawRoulette() {
        const ctx = this.ctx;
        const R   = CONFIG.roulette;

        ctx.save();
        ctx.translate(R.centerX, R.centerY);
        ctx.scale(1, R.perspectiveY);

        this.drawRotor();
        this.drawCenter();
        this.drawHousing();

        /* drawRouletteFX (rimSweep, goldSweep, glow, especulares) ya no se
           llama: eran efectos ambientales de canvas. */

        ctx.restore();
    },

    /* Transform order inside a layer, from the image outwards:
         aspectFix  -> flatten the artwork to a true circle
         rotate     -> only meaningful for the rotor
         offset     -> manual alignment, unaffected by rotation
       Canvas applies the LAST call first, so rotate() is issued before
       scale(). That is what keeps an already-elliptical asset from being
       rotated as an ellipse. */
    drawLayer(img, layer, angleDeg) {
        const ctx = this.ctx;
        const w = CONFIG.roulette.size * layer.scale;
        const h = w * layer.source[1] / layer.source[0];

        ctx.save();
        ctx.translate(layer.offsetX, layer.offsetY);
        if (angleDeg) ctx.rotate(angleDeg * DEG);
        ctx.scale(1, layer.aspectFix);
        ctx.drawImage(
            img,
            -layer.anchor[0] / layer.source[0] * w,
            -layer.anchor[1] / layer.source[1] * h,
            w, h
        );
        ctx.restore();
    },

    drawRotor()   { this.drawLayer(Assets.img.rotor,   CONFIG.roulette.rotor,   STATE.rotorAngle); },
    drawCenter()  { this.drawLayer(Assets.img.center,  CONFIG.roulette.center,  0); },
    drawHousing() { this.drawLayer(Assets.img.housing, CONFIG.roulette.housing, 0); },

    /* ---- idle lighting + lightning reaction ------------------------------ *
       Nothing here touches geometry. Only light moves.                       */
    drawRouletteFX() {
        const ctx  = this.ctx;
        const F    = CONFIG.fx;
        const geom = this.cache.geom;

        ctx.save();
        ctx.translate(geom.hx, geom.hy);
        ctx.globalCompositeOperation = 'lighter';

        // Clip once to the rim annulus; both sweeps and the speculars reuse it.
        ctx.beginPath();
        ctx.arc(0, 0, geom.rimOuter, 0, TAU);
        ctx.arc(0, 0, geom.rimInner, 0, TAU, true);
        ctx.clip();

        const box = geom.rimOuter * 2;

        // Blue sweep
        ctx.save();
        ctx.rotate(STATE.rimSweep * DEG);
        ctx.globalAlpha = F.rimSweep.alpha * (0.75 + 0.25 * STATE.glow);
        ctx.fillStyle = this.cache.rim;
        ctx.fillRect(-geom.rimOuter, -geom.rimOuter, box, box);
        ctx.restore();

        // Warm gold sweep, slower and running the other way
        ctx.save();
        ctx.rotate(-STATE.goldSweep * DEG);
        ctx.globalAlpha = F.goldSweep.alpha * (0.65 + 0.35 * (1 - STATE.glow));
        ctx.fillStyle = this.cache.gold;
        ctx.fillRect(-geom.rimOuter, -geom.rimOuter, box, box);
        ctx.restore();

        // Fixed specular points
        const rMid = (geom.rimOuter + geom.rimInner) * 0.5;
        ctx.globalAlpha = F.specular.alpha * (0.45 + 0.55 * STATE.glow);
        ctx.fillStyle = this.cache.spec;
        for (let i = 0; i < F.specular.points.length; i++) {
            const a = F.specular.points[i] * DEG;
            ctx.save();
            ctx.translate(Math.cos(a) * rMid, Math.sin(a) * rMid);
            ctx.fillRect(-F.specular.radius, -F.specular.radius,
                          F.specular.radius * 2, F.specular.radius * 2);
            ctx.restore();
        }

        ctx.restore();

        if (STATE.lightning > 0.002) this.drawLightningReflection();

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
    },

    drawLightningReflection() {
        const ctx = this.ctx;
        const R   = CONFIG.roulette;
        const L   = CONFIG.fx.lightning;
        const k   = STATE.lightning;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // Blue reflection over the metal, brightest where the metal is brightest.
        ctx.globalAlpha = k * L.tint;
        this.drawLayer(Assets.tint.housing, R.housing, 0);
        this.drawLayer(Assets.tint.center,  R.center,  0);
        this.drawLayer(Assets.tint.rotor,   R.rotor,   STATE.rotorAngle);

        // A touch of white bloom on top.
        ctx.globalAlpha = k * L.bloom;
        this.drawLayer(Assets.img.housing, R.housing, 0);
        this.drawLayer(Assets.img.center,  R.center,  0);

        ctx.restore();
    },

    /* The ambient veil is drawn in stage space, outside the group transform. */
    drawAmbientFlash() {
        const k = STATE.lightning;
        if (k <= 0.002) return;
        const ctx = this.ctx;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = k * CONFIG.fx.lightning.ambient;
        ctx.fillStyle = this.cache.ambient;
        ctx.fillRect(0, 0, CONFIG.design.width, CONFIG.design.height);
        ctx.restore();
    }
};


/* =========================================================================
   5. ANIMATION CONTROLLER — the 30s / 5s cycle
   ========================================================================= */

const AnimationController = {

    /* Un único setTimeout para la espera y una timeline para el giro.
       Nada de tweens infinitos, nada de delayedCall de GSAP (que obligaría a
       tener el ticker despierto sólo para contar el tiempo). */
    waitTimer: null,
    spinTL:    null,

    start() {
        this.startIdle();
    },

    /* --- REPOSO: 0 frames de canvas ------------------------------------- */
    startIdle() {
        const A = CONFIG.rouletteAmbient;

        STATE.mode = 'idle';
        STATE.nextSpinAt = performance.now() + A.wait;

        this.stopWait();
        this.waitTimer = setTimeout(() => {
            AnimationController.waitTimer = null;
            AnimationController.startSpin();
        }, A.wait);

        /* Un último frame con la ruleta ya quieta, y a dormir. */
        Ticker.renderOnce();
        Ticker.sleep();
    },

    stopWait() {
        if (this.waitTimer) { clearTimeout(this.waitTimer); this.waitTimer = null; }
    },

    /* --- GIRO: lo único que necesita FPS continuos ---------------------- */
    startSpin() {
        if (STATE.mode === 'spin') return;
        if (!HOST.active) return;              // la view no está en pantalla

        this.stopWait();

        const A = CONFIG.rouletteAmbient;
        const T = CONFIG.timing;
        const dur = A.duration / 1000;

        STATE.mode = 'spin';

        if (window.StormUI) window.StormUI.onSpinStart();

        // Total travel: 5-7 turns, landing on a pocket boundary.
        const step    = 360 / T.pockets;
        const turns   = T.minRotations + Math.floor(Math.random() * (T.maxRotations - T.minRotations + 1));
        const pockets = Math.floor(Math.random() * T.pockets);
        const total   = turns * 360 + pockets * step;

        /* Accelerate + decelerate, como siempre: la velocidad es continua en
           la unión porque d1/t1 === d2/t2 y las dos fases suman la duración
           exacta del giro. */
        const t1 = Math.min(T.accelDuration, dur * 0.5);
        const t2 = dur - t1;
        const d1 = total * (t1 / dur);
        const d2 = total - d1;

        if (this.spinTL) this.spinTL.kill();

        /* El ticker se despierta AQUÍ, a los FPS del giro, y sólo para esto. */
        Ticker.wake(A.fps);

        this.spinTL = gsap.timeline({
            onComplete: () => {
                STATE.rotorAngle = ((STATE.rotorAngle % 360) + 360) % 360;
                if (window.StormUI) window.StormUI.onSpinEnd(STATE.rotorAngle);
                AnimationController.spinTL = null;
                AnimationController.startIdle();          // pinta y duerme
            }
        });

        this.spinTL
            .to(STATE, { rotorAngle: '+=' + d1, duration: t1, ease: 'power2.in' })
            .to(STATE, { rotorAngle: '+=' + d2, duration: t2, ease: 'power2.out' });
    },

    /* --- Parada total: al salir de TABLE -------------------------------- */
    stop() {
        this.stopWait();
        if (this.spinTL) { this.spinTL.kill(); this.spinTL = null; }
        STATE.mode = 'idle';
    },

    secondsToNextSpin() {
        if (STATE.mode === 'spin') return 0;
        return Math.max(0, (STATE.nextSpinAt - performance.now()) / 1000);
    }
};


/* =========================================================================
   5b. TICKER — despierto sólo cuando hay algo que animar

   En reposo el canvas de TABLE no produce ni un frame. Cuando llega un dato
   nuevo del socket se pinta UN frame y se vuelve a dormir; cuando la ruleta
   gira, el ticker se despierta a 30 FPS durante esos segundos y se duerme al
   acabar.
   ========================================================================= */

const Ticker = {

    awake:   false,
    ready:   false,
    pending: 0,          // id del requestAnimationFrame de un frame suelto
    frames:  0,

    init() {
        gsap.ticker.add(() => {
            Ticker.frames++;
            Renderer.render();
        });
        this.ready = true;
        this.sleep();
    },

    wake(fps) {
        if (!this.ready) return;
        gsap.ticker.fps(fps || CONFIG.rouletteAmbient.fps);
        gsap.ticker.wake();
        this.awake = true;
    },

    sleep() {
        if (!this.ready) return;
        gsap.ticker.sleep();
        this.awake = false;
    },

    /* Un frame y ya. Es lo que usan las actualizaciones del socket. */
    renderOnce() {
        if (!this.ready || !HOST.active) return;
        if (this.awake) return;                 // ya se está pintando solo
        if (this.pending) return;               // ya hay uno encolado

        this.pending = requestAnimationFrame(() => {
            Ticker.pending = 0;
            if (!HOST.active) return;
            Ticker.frames++;
            Renderer.render();
        });
    },

    cancelPending() {
        if (this.pending) { cancelAnimationFrame(this.pending); this.pending = 0; }
    }
};


/* =========================================================================
   6. LIGHTNING CONTROLLER
   Reads video.currentTime once per frame. Never touches video pixels.
   ========================================================================= */

const LightningController = {

    video:  null,
    index:  0,
    lastT:  0,
    tl:     null,

    init(video) {
        this.video = video;
        if (!CONFIG.lightning.syncToVideo) this.scheduleFallback();
    },

    update() {
        if (!CONFIG.lightning.syncToVideo || !this.video) return;

        const t = this.video.currentTime;
        if (t < this.lastT - 0.05) this.index = 0;   // the clip looped
        this.lastT = t;

        const ev = CONFIG.lightning.events;
        while (this.index < ev.length && t >= ev[this.index].t) {
            this.flash(ev[this.index].i);
            this.index++;
        }
    },

    scheduleFallback() {
        const f = CONFIG.lightning.fallback;
        const gap = f.minGap + Math.random() * (f.maxGap - f.minGap);
        gsap.delayedCall(gap, () => {
            LightningController.flash(f.minStrength + Math.random() * (f.maxStrength - f.minStrength));
            LightningController.scheduleFallback();
        });
    },

    /* Strike shape: hard rise, a second weaker stroke, then a soft falloff. */
    flash(strength) {
        if (this.tl) this.tl.kill();   // a new strike takes over from wherever the last one faded to

        this.tl = gsap.timeline({ onComplete: () => { LightningController.tl = null; } });
        this.tl
            .to(STATE, { lightning: strength,        duration: 0.05, ease: 'power2.out' })
            .to(STATE, { lightning: strength * 0.25, duration: 0.09, ease: 'power1.in' })
            .to(STATE, { lightning: strength * 0.85, duration: 0.05, ease: 'power2.out' })
            .to(STATE, { lightning: 0,               duration: 0.55, ease: 'power2.in' });
    }
};


/* =========================================================================
   7. DEBUG CONTROLLER
   ========================================================================= */


const DebugController = {

    layers: { Digit1: 'housing', Digit2: 'rotor', Digit3: 'center' },

    init() {
        window.addEventListener('keydown', e => DebugController.onKey(e));
    },

    onKey(e) {
        const R = CONFIG.roulette;

        switch (e.code) {

            case 'Space':
                e.preventDefault();
                AnimationController.startSpin();
                return;

            case 'KeyD':
                if (!DEBUG_BUILD) return;
                STATE.debug = !STATE.debug;
                return;

            case 'KeyG':
                CONFIG.debug.showGuides = !CONFIG.debug.showGuides;
                return;

            case 'Digit1': case 'Digit2': case 'Digit3':
                STATE.selected = this.layers[e.code];
                STATE.debug = true;
                return;

            case 'KeyC':
                this.copyConfig();
                return;

            case 'Escape':
                STATE.selected = null;
                return;
        }

        const layer = STATE.selected ? R[STATE.selected] : null;
        const D = CONFIG.debug;
        const big = e.shiftKey ? 10 : 1;

        // Perspective is a group property, tunable with or without a selection.
        if (e.code === 'Comma')  { R.perspectiveY = round3(R.perspectiveY - 0.005 * big); Renderer.invalidate(); return; }
        if (e.code === 'Period') { R.perspectiveY = round3(R.perspectiveY + 0.005 * big); Renderer.invalidate(); return; }

        if (!layer) return;
        e.preventDefault();

        switch (e.code) {
            case 'ArrowLeft':  layer.offsetX -= D.nudgeStep * big; break;
            case 'ArrowRight': layer.offsetX += D.nudgeStep * big; break;
            case 'ArrowUp':    layer.offsetY -= D.nudgeStep * big; break;
            case 'ArrowDown':  layer.offsetY += D.nudgeStep * big; break;

            case 'Equal': case 'NumpadAdd':
                layer.scale = round3(layer.scale + D.scaleStep * big); break;
            case 'Minus': case 'NumpadSubtract':
                layer.scale = round3(layer.scale - D.scaleStep * big); break;

            case 'BracketLeft':
                layer.aspectFix = round3(layer.aspectFix - D.aspectStep * big); break;
            case 'BracketRight':
                layer.aspectFix = round3(layer.aspectFix + D.aspectStep * big); break;

            default: return;
        }

        Renderer.invalidate();   // rim geometry may have moved
    },

    /* Prints the tuned values in the exact shape of CONFIG.roulette so they
       can be pasted straight back into this file. */
    copyConfig() {
        const R = CONFIG.roulette;
        const layer = k => {
            const L = R[k];
            return '        ' + k + ': { scale: ' + L.scale +
                   ', offsetX: ' + L.offsetX + ', offsetY: ' + L.offsetY +
                   ', aspectFix: ' + L.aspectFix + ' },';
        };
        const out = [
            'roulette: {',
            '        centerX: ' + R.centerX + ', centerY: ' + R.centerY + ',',
            '        size: ' + R.size + ', perspectiveY: ' + R.perspectiveY + ',',
            layer('rotor'), layer('center'), layer('housing'),
            '}'
        ].join('\n');

        console.log(out);
        if (navigator.clipboard) navigator.clipboard.writeText(out).catch(() => {});
    },

    /* ---- overlay --------------------------------------------------------- */

    draw(ctx) {
        const R = CONFIG.roulette;

        if (CONFIG.debug.showGuides) this.drawGuides(ctx);

        const lines = [
            'MODE          ' + STATE.mode.toUpperCase(),
            'ROTOR ANGLE   ' + STATE.rotorAngle.toFixed(1) + '\u00B0',
            'NEXT SPIN     ' + AnimationController.secondsToNextSpin().toFixed(1) + ' s',
            'FPS           ' + STATE.fps.toFixed(0),
            '',
            'centerX       ' + R.centerX,
            'centerY       ' + R.centerY,
            'size          ' + R.size,
            'perspectiveY  ' + R.perspectiveY,
            'lightning     ' + STATE.lightning.toFixed(2)
        ];

        if (STATE.selected) {
            const L = R[STATE.selected];
            lines.push(
                '',
                'LAYER  ' + STATE.selected.toUpperCase(),
                '  scale       ' + L.scale,
                '  offsetX     ' + L.offsetX,
                '  offsetY     ' + L.offsetY,
                '  aspectFix   ' + L.aspectFix
            );
        }

        lines.push(
            '',
            'SPACE spin   D debug   G guides',
            '1/2/3 layer  arrows move  +/- scale',
            '[ ] aspect   , . perspective   C copy'
        );

        const x = 1450, y = 40, lh = 26;
        const w = 440;
        const h = lines.length * lh + 34;

        ctx.save();
        ctx.globalAlpha = 0.82;
        ctx.fillStyle = '#050a14';
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(110, 190, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        ctx.font = '17px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
        ctx.textBaseline = 'top';
        for (let i = 0; i < lines.length; i++) {
            const t = lines[i];
            ctx.fillStyle = t.startsWith('LAYER') ? '#ffd08a'
                          : (t.startsWith(' ') ? '#9fd0ff' : '#dceaff');
            ctx.fillText(t, x + 18, y + 18 + i * lh);
        }
        ctx.restore();
    },

    /* Guides live inside the group transform, so they show the true ellipses. */
    drawGuides(ctx) {
        const R = CONFIG.roulette;

        ctx.save();
        ctx.translate(R.centerX, R.centerY);
        ctx.scale(1, R.perspectiveY);
        ctx.lineWidth = 2;

        const ring = (key, color) => {
            const L = R[key];
            const u = Renderer.unit(L);
            ctx.save();
            ctx.translate(L.offsetX, L.offsetY);
            ctx.strokeStyle = color;
            ctx.globalAlpha = STATE.selected === key ? 1 : 0.35;

            if (key === 'housing') {
                // Outer edge, offset from the anchor; then the opening itself.
                ctx.save();
                ctx.translate(L.rimCenter[0] * u, L.rimCenter[1] * u * L.aspectFix);
                ctx.beginPath();
                ctx.arc(0, 0, L.radius * u, 0, TAU);
                ctx.stroke();
                ctx.restore();

                ctx.beginPath();
                ctx.ellipse(0, 0, L.innerRadius * u, 289.2 * u * L.aspectFix, 0, 0, TAU);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, L.radius * u, 0, TAU);
                ctx.stroke();
            }
            ctx.restore();
        };

        ring('housing', '#6ec8ff');
        ring('rotor',   '#ff9c6e');
        ring('center',  '#7dff9c');

        ctx.restore();

        // Axis crosshair in stage space
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(R.centerX - 40, R.centerY); ctx.lineTo(R.centerX + 40, R.centerY);
        ctx.moveTo(R.centerX, R.centerY - 40); ctx.lineTo(R.centerX, R.centerY + 40);
        ctx.stroke();
        ctx.restore();
    }
};

function round3(v) { return Math.round(v * 1000) / 1000; }


/* =========================================================================
   8. VIDEO — autoplay and a watchdog for multi-hour runs
   ========================================================================= */

const VideoController = {

    el:   null,
    hint: null,

    init(el, hint) {
        this.el = el;
        this.hint = hint;

        el.play().catch(() => { hint.hidden = false; });

        hint.addEventListener('click', () => {
            hint.hidden = true;
            el.play().catch(() => {});
        });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) VideoController.ensurePlaying();
        });

        // Cheap safety net: a stalled decoder on a set-top box should recover.
        setInterval(() => VideoController.ensurePlaying(), 5000);
    },

    ensurePlaying() {
        if (!HOST.active) return;          // la view está suspendida
        const v = this.el;
        if (v && v.paused) v.play().catch(() => {});
    }
};


/* =========================================================================
   8b. HOST — suspensión de la view cuando no está activa

   El visor integrado muestra una sola pantalla a la vez. Esta pantalla no
   puede seguir renderizando ni decodificando video mientras está oculta.

   deactivate():  gsap.ticker.sleep()  -> se para el rAF, y con él el render,
                  las tweens ambientales y los delayedCall del ciclo idle.
                  El video se pausa y el watchdog deja de revivirlo.

   activate():    gsap.ticker.wake()   -> se reanuda exactamente el mismo
                  callback ya registrado. NUNCA se vuelve a registrar nada,
                  así que entrar y salir mil veces no acumula tickers,
                  intervals, listeners ni timelines.
   ========================================================================= */

const HOST = { active: true, ready: false, frames: 0 };

function applyHost() {
    if (!HOST.ready) return;

    if (window.StormUI && window.StormUI.setVisible) {
        window.StormUI.setVisible(HOST.active);
    }

    if (HOST.active) {
        VideoController.ensurePlaying();

        /* Pintar el estado actual una vez y arrancar la espera del giro.
           startIdle() ya deja el ticker dormido. */
        AnimationController.start();

    } else {
        /* Fuera de pantalla: se cancela el temporizador del próximo giro, se
           mata la timeline si estuviera girando y el ticker se duerme. */
        AnimationController.stop();
        Ticker.cancelPending();
        Ticker.sleep();
        if (VideoController.el) VideoController.el.pause();
    }
}

window.StormTable = {

    setHostActive(on) {
        HOST.active = !!on;
        applyHost();
    },

    get hostActive()  { return HOST.active; },
    get frames()      { return Ticker.frames; },

    /* Estado para el HUD de ?debug=1 */
    get tableState()  { return STATE.mode === 'spin' ? 'SPINNING' : 'IDLE'; },
    get tickerAwake() { return Ticker.awake; },
    get nextSpin()    { return AnimationController.secondsToNextSpin(); },

    /* Acceso de diagnóstico al estado de animación, para poder congelar la
       escena y comparar capturas. No lo usa el visor. */
    get animState()   { return STATE; },

    /* Contadores de repintado, para medir cuánto se repinta de verdad. */
    get renderStats() {
        const s = Object.assign({}, Renderer.stats);
        if (window.StormUI && window.StormUI.renderStats) {
            Object.assign(s, window.StormUI.renderStats);
        }
        s.frames = Ticker.frames;
        return s;
    },

    resetRenderStats() {
        Renderer.stats.scene = 0;
        Renderer.stats.sceneFull = 0;
        if (window.StormUI && window.StormUI.resetRenderStats) {
            window.StormUI.resetRenderStats();
        }
        Ticker.frames = 0;
    },
    get videoPaused() { return VideoController.el ? VideoController.el.paused : null; }
};


/* =========================================================================
   9. MAIN — one ticker drives everything
   ========================================================================= */

function main() {
    const canvas = document.getElementById('scene');
    const video  = document.getElementById('bg');
    const hint   = document.getElementById('tap-hint');

    Renderer.init(canvas);
    DebugController.init();
    VideoController.init(video, hint);

    Assets.load().then(() => {

        /* LightningController ya no se inicializa: no hay reacción canvas a
           los relámpagos del vídeo. Tampoco hay tweens ambientales. */

        if (window.StormUI) {
            window.StormUI.init({
                state: STATE,
                config: CONFIG,
                getCountdown: () => AnimationController.secondsToNextSpin(),

                /* Cualquier dato nuevo pide UN frame y nada más. */
                requestRender: () => Ticker.renderOnce()
            });
        }

        /* El callback de render se registra una sola vez y el ticker se
           duerme inmediatamente. A partir de aquí sólo se despierta durante
           el giro de la ruleta. */
        Ticker.init();

        HOST.ready = true;
        applyHost();

    }).catch(err => {
        console.error(err);
        const ctx = Renderer.ctx;
        ctx.fillStyle = '#ff6b6b';
        ctx.font = '28px ui-monospace, monospace';
        ctx.fillText('Asset failed to load: ' + err.message, 60, 980);
        ctx.fillText('Serve this folder over http://, not file://', 60, 1020);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}

})();
