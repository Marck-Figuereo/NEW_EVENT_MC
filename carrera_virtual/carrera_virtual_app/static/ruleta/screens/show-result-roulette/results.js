/* =========================================================================
   VIRTUAL STORM ROULETTE — results.js
   The RESULTADO DEL SORTEO screen.

   ------------------------------------------------------------------------
   THE SUPPLIED ARTWORK IS THE SOURCE OF TRUTH.
   results_overlay.png is drawn unchanged and carries every fixed label
   (RESULTADO DEL SORTEO, SORTEO, COLOR, PARIDAD, FILA, DOCENA, MITAD,
   MULTIPLICATIVOS GANADORES). Nothing here redraws, recolours or recreates
   it. The balls, the multiplier frame and the divider are the supplied PNGs.

   This file only:
     - composes those assets on a 1920x1080 stage,
     - lays the dynamic result data over them,
     - reveals a new draw with a short GSAP timeline,
     - adds one moving reflection that brightens the artwork itself.
   ------------------------------------------------------------------------

   Layers, drawn in this order into a single canvas:
     Z0  storm_bg.mp4          (a DOM <video>, never drawn into the canvas)
     Z1  winning ball          — behind the overlay, so its gold ring stays on top
     Z2  results_overlay.png   — unchanged
     Z3  draw number, winner number, result values
     Z4  multiplier items
     Z5  runtime reflection

   Slot geometry was measured from the overlay itself and is listed in
   CONFIG.slots, in 1920x1080 units.

   Public API:  StormResults.renderResult(data)
   ========================================================================= */

(function () {
'use strict';

const TAU = Math.PI * 2;


/* =========================================================================
   1. CONFIG — every coordinate, measured from the supplied artwork
   ========================================================================= */

const CONFIG = {

    design: { width: 1920, height: 1080 },

    assets: {
        path: 'assets/results/',
        files: {
            overlay:    'results_overlay.png',
            ball_red:   'balls/ball_red.png',
            ball_black: 'balls/ball_black.png',
            ball_green: 'balls/ball_green.png',
            slot:       'multipliers/multiplier_slot_frame.png',
            divider:    'multipliers/multiplier_divider_vertical.png'
        },

        /* Visible content of assets that carry transparent margin, as
           [x0, y0, x1, y1] fractions. Drawing through these keeps every ball
           the same size on screen regardless of its own padding. */
        content: {
            ball_red:   [0.0917, 0.0805, 0.8988, 0.8660],
            ball_black: [0.0917, 0.0805, 0.8988, 0.8660],
            ball_green: [0.0917, 0.0805, 0.8988, 0.8660],
            slot:       [0.0205, 0.0235, 0.9756, 0.9238]
        }
    },

    slots: {
        /* The main circular opening in the overlay: the ball sits inside it
           and the overlay's ring is drawn afterwards, on top. */
        winner: { cx: 542.0, cy: 500.4, r: 166.5 },

        /* The plaque already reads "SORTEO | #0000". The baked glyphs are
           covered with a slice of the plaque's own clean interior — never
           with invented artwork — and the live number is drawn in their
           place. See patchDrawPlaque(). */
        draw: {
            glyph:  { x: 566, y: 174, w: 88, h: 48 },   // the baked "#0000" (with its halo)
            clean:  { x: 662, y: 174, w: 26, h: 48 },   // empty plaque interior
            /* Medido sobre results_overlay.png a 1920x1080:
                 placa      y 208..259  (centro 233.5)
                 divisoria  x 552..554
                 borde dcho x 716
               El hueco libre a la derecha de la divisoria es x 555..715, así
               que el número va centrado en 635. drawDrawNumber dibuja con
               baseline alfabética en center.y, por eso el ancla es el centro
               vertical más el descenso aproximado de la fuente. */
            center: { x: 635, y: 245 },                 // baseline anchor
            maxW:   132                                 // hueco libre menos aire
        },

        /* Info table: five rows, values to the right of the divider. */
        table: {
            /* Medido sobre results_overlay.png a 1920x1080:
                 divisoria vertical  x = 1223
                 separadores de fila y = 228,5 / 328,5 / 425 / 522,5 / 619,5 / 719
               Los centros de banda son los de abajo; antes estaban unos 25 px
               altos, por eso los valores salían por encima de sus etiquetas. */
            valueX: 1268,
            rowCentres: [278, 377, 474, 571, 669]
        },

        /* Usable band inside MULTIPLICATIVOS GANADORES, under its title. */
        multipliers: { x: 110, y: 828, w: 1700, h: 128 }
    },

    /* Where things sit inside one multiplier frame, as fractions of the
       frame's visible content. Measured from multiplier_slot_frame.png. */
    slot: {
        ratio: 1956 / 614,          // never stretched, never cropped
        ball:  { cx: 0.1590, cy: 0.5000, r: 0.1189 },
        value: { cx: 0.6560, cy: 0.5000, w: 0.5600 }
    },

    /* Item width is capped by the band height; the gap widens when there are
       fewer items so two never look marooned. */
    layout: {
        gapRatio: { 1: 0, 2: 0.45, 3: 0.30, 4: 0.16, 5: 0.09 },
        defaultGap: 0.12
    },

    font: {
        display: '"Bahnschrift", "DIN Alternate", "Oswald", "Arial Narrow", Arial, sans-serif'
    },

    color: {
        value:  '#eef5ff',
        rojo:   '#ff6b72',
        verde:  '#54e08a',
        negro:  '#d7e2f0',
        draw:   '#ffffff',
        winner: '#ffffff',
        empty:  '#7d8ea0'
    },

    fx: {
        reflectPeriod: 11,    // seconds for one pass of the reflection
        reflectDuty:   0.42,  // fraction of that pass it is visible at all
        reflectAlpha:  0.16,
        reveal: {
            overlay: 0.35, draw: 0.30, ball: 0.55,
            winner: 0.30, rows: 0.30, rowStagger: 0.07,
            mult: 0.40, multStagger: 0.09
        }
    }
};

const EMPTY = '—';


/* =========================================================================
   2. RESULT DATA
   Whatever the backend sends is displayed. Nothing is recomputed here: if a
   field is missing the screen shows a dash rather than inventing a value.
   ========================================================================= */

const RESULT = {
    draw_number: null,
    winner_number: null,
    color: null,
    parity: null,
    row: null,
    dozen: null,
    half: null,
    multipliers: [],
    /* true cuando el numero ganador multiplico en este sorteo (lo dice la API). */
    gold: false
};

/* Colour word -> ball asset. Accepts Spanish and English, any case. */
const BALLS = {
    rojo: 'ball_red',   red: 'ball_red',
    negro: 'ball_black', black: 'ball_black',
    verde: 'ball_green', green: 'ball_green'
};

/* Misma lista y misma regla que ui.js (GAME.colorOf). */
const RED_NUMBERS = new Set([
    1, 3, 5, 7, 9, 12, 14, 16, 18,
    19, 21, 23, 25, 27, 30, 32, 34, 36
]);

function colorOf(n) {
    if (n === null || n === undefined || n === '') return null;
    n = Number(n);
    if (!Number.isInteger(n) || n < 0 || n > 36) return null;
    if (n === 0) return 'verde';
    return RED_NUMBERS.has(n) ? 'rojo' : 'negro';
}

/* La bola se elige por NÚMERO. Antes mandaba el texto del color y, si no
   venía (los multiplicativos de prueba no lo traen), todo lo que no fuera
   0 salía NEGRO: el 23 x100 se pintaba con bola negra. El texto solo se
   usa si el número no es válido. */
function ballFor(colour, number) {
    const porNumero = colorOf(number);
    if (porNumero) return BALLS[porNumero];
    const key = String(colour == null ? '' : colour).trim().toLowerCase();
    if (BALLS[key]) return BALLS[key];
    return 'ball_black';
}

function shown(v) {
    if (v === null || v === undefined) return EMPTY;
    const s = String(v).trim();
    return s === '' ? EMPTY : s;
}


/* =========================================================================
   3. ANIMATED STATE — GSAP writes here, the renderer reads it
   ========================================================================= */

const A = {
    overlay: 0,
    draw:    0,
    ball:    0,
    ballPop: 0,
    winner:  0,
    rows:    [0, 0, 0, 0, 0],
    mults:   [],
    reflect: 0
};


/* =========================================================================
   4. ASSETS
   ========================================================================= */

const Assets = {
    img: {},
    ready: false,

    load() {
        const A2 = CONFIG.assets;
        const keys = Object.keys(A2.files);
        let left = keys.length;
        return new Promise(resolve => {
            keys.forEach(k => {
                const im = new Image();
                im.decoding = 'async';
                const done = () => { if (--left === 0) { Assets.ready = true; resolve(); } };
                im.onload = () => { Assets.img[k] = im; done(); };
                im.onerror = () => {
                    console.warn('[StormResults] asset not found:', A2.path + A2.files[k]);
                    done();
                };
                im.src = A2.path + A2.files[k];
            });
        });
    },

    has(k) { return !!this.img[k]; }
};

/* Draw an asset so its visible content exactly fills (x, y, w, h). */
function drawAsset(ctx, key, x, y, w, h, alpha) {
    const img = Assets.img[key];
    if (!img) return false;
    const c = CONFIG.assets.content[key];
    if (alpha !== undefined) { ctx.save(); ctx.globalAlpha = alpha; }
    if (!c) {
        ctx.drawImage(img, x, y, w, h);
    } else {
        const fw = w / (c[2] - c[0]);
        const fh = h / (c[3] - c[1]);
        ctx.drawImage(img, x - c[0] * fw, y - c[1] * fh, fw, fh);
    }
    if (alpha !== undefined) ctx.restore();
    return true;
}


/* =========================================================================
   5. HELPERS
   ========================================================================= */

function fitFont(ctx, text, max, px, weight) {
    let size = px;
    ctx.font = weight + ' ' + size + 'px ' + CONFIG.font.display;
    for (let pass = 0; pass < 2; pass++) {
        const w = ctx.measureText(text).width;
        if (w <= max || max <= 0) return size;
        size = Math.max(8, Math.floor(size * max / w));
        ctx.font = weight + ' ' + size + 'px ' + CONFIG.font.display;
    }
    if (ctx.measureText(text).width > max) ctx.font = weight + ' ' + size + 'px sans-serif';
    return size;
}

function ellipsize(ctx, text, max) {
    if (ctx.measureText(text).width <= max) return text;
    let t = String(text);
    while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
    return t + '…';
}

/* Colour a value only where the design calls for it. */
function valueColour(field, text) {
    if (field !== 'color' || text === EMPTY) return CONFIG.color.value;
    const k = text.trim().toLowerCase();
    if (k === 'rojo' || k === 'red') return CONFIG.color.rojo;
    if (k === 'verde' || k === 'green') return CONFIG.color.verde;
    if (k === 'negro' || k === 'black') return CONFIG.color.negro;
    return CONFIG.color.value;
}


/* =========================================================================
   6. LAYOUT — how many multipliers fit, and how big
   ========================================================================= */

function multiplierLayout(count) {
    const band = CONFIG.slots.multipliers;
    const ratio = CONFIG.slot.ratio;
    if (!count) return { items: [], dividers: [] };

    const gapRatio = CONFIG.layout.gapRatio[count] !== undefined
        ? CONFIG.layout.gapRatio[count]
        : CONFIG.layout.defaultGap;

    /* One item scale for every count: the artwork is never restyled per
       quantity, only resized and respaced. Capped by the band height so an
       item can never touch the panel border. */
    const maxByHeight = band.h * ratio;
    const byWidth = band.w / (count + (count - 1) * gapRatio);
    const itemW = Math.min(maxByHeight, byWidth);
    const itemH = itemW / ratio;
    const gap = itemW * gapRatio;

    const total = itemW * count + gap * (count - 1);
    const x0 = band.x + (band.w - total) / 2;         // always centred
    const y = band.y + (band.h - itemH) / 2;

    const items = [];
    const dividers = [];
    for (let i = 0; i < count; i++) {
        const x = x0 + i * (itemW + gap);
        items.push({ x: x, y: y, w: itemW, h: itemH });
        // Never a divider after the last item.
        if (i < count - 1) {
            dividers.push({ cx: x + itemW + gap / 2, cy: y + itemH / 2, h: itemH * 0.78 });
        }
    }
    return { items: items, dividers: dividers };
}


/* =========================================================================
   7. RENDERER
   ========================================================================= */

const Renderer = {

    canvas: null,
    ctx: null,
    overlayPatched: null,     // overlay with the baked "#0000" covered

    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
        this.ctx.imageSmoothingQuality = 'high';
    },

    /* The overlay ships with "#0000" drawn into it and must not be edited on
       disk, so the glyphs are covered at load time with a slice of the
       plaque's own empty interior, tiled across. No new artwork, no flat
       rectangle that would read as a patch. */
    patchDrawPlaque() {
        const img = Assets.img.overlay;
        if (!img) return;
        const D = CONFIG.slots.draw;

        const c = document.createElement('canvas');
        c.width = CONFIG.design.width;
        c.height = CONFIG.design.height;
        const g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, c.width, c.height);

        // Source rect in overlay pixels, so the slice keeps its own texture.
        const sx = D.clean.x / c.width * img.width;
        const sy = D.clean.y / c.height * img.height;
        const sw = D.clean.w / c.width * img.width;
        const sh = D.clean.h / c.height * img.height;

        /* The overlay is translucent by design, so the region has to be
           cleared before the clean slice goes down: painting a semi-opaque
           patch over the glyphs only tints them, it does not hide them.
           Clearing also preserves the plaque's intended translucency, so the
           storm still shows through exactly as it does elsewhere. */
        const px = D.glyph.x - 2;
        const pw = D.glyph.w + 6;
        g.clearRect(px, D.clean.y, pw, D.clean.h);

        /* Starts after the gold "|" separator at x 544-547, which is part of
           the design and must survive. */
        let x = px;
        const end = px + pw;
        while (x < end) {
            const w = Math.min(D.clean.w, end - x);
            g.drawImage(img, sx, sy, sw * (w / D.clean.w), sh,
                        x, D.clean.y, w, D.clean.h);
            x += w;
        }
        this.overlayPatched = c;
    },

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, CONFIG.design.width, CONFIG.design.height);
        if (!Assets.ready) return;

        this.drawWinnerBall(ctx);     // Z1 — behind the overlay
        this.drawOverlay(ctx);        // Z2 — the supplied artwork, unchanged
        this.drawGoldRing(ctx);       // borde dorado: solo si el ganador multiplico
        this.drawDrawNumber(ctx);     // Z3
        this.drawWinnerNumber(ctx);
        this.drawTable(ctx);
        this.drawMultipliers(ctx);    // Z4
        this.drawReflection(ctx);     // Z5
    },

    /* ---- Z1: the winning ball ------------------------------------------- */
    drawWinnerBall(ctx) {
        if (RESULT.winner_number === null || A.ball <= 0.001) return;
        const W = CONFIG.slots.winner;
        const key = ballFor(RESULT.color, RESULT.winner_number);

        // Sits inside the opening; the overlay's ring is drawn after it.
        const d = W.r * 2 * 0.92 * (0.86 + 0.14 * A.ball) * (1 + A.ballPop * 0.05);
        drawAsset(ctx, key, W.cx - d / 2, W.cy - d / 2, d, d, A.ball);
    },

    /* ---- Borde dorado del ganador que multiplica --------------------------
       La bola conserva su color (rojo / negro / verde); solo se le suma un aro
       dorado alrededor. Sin placa ni valor: el valor ya sale abajo. */
    drawGoldRing(ctx) {
        if (!RESULT.gold || RESULT.winner_number === null || A.ball <= 0.001) return;
        const W = CONFIG.slots.winner;
        const d = W.r * 2 * 0.92 * (0.86 + 0.14 * A.ball) * (1 + A.ballPop * 0.05);
        const grosor = d * 0.052;
        const radio = d / 2 + grosor * 0.36;

        ctx.save();
        ctx.globalAlpha = A.ball;

        // Resplandor suave por fuera del aro.
        ctx.shadowColor = 'rgba(255, 190, 60, 0.85)';
        ctx.shadowBlur = grosor * 1.6;
        ctx.strokeStyle = '#f0b445';
        ctx.lineWidth = grosor;
        ctx.beginPath();
        ctx.arc(W.cx, W.cy, radio, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Aro con brillo metalico (claro arriba, mas oscuro abajo).
        const g = ctx.createLinearGradient(W.cx, W.cy - radio, W.cx, W.cy + radio);
        g.addColorStop(0.00, '#fff3c4');
        g.addColorStop(0.28, '#ffd15c');
        g.addColorStop(0.55, '#e9a521');
        g.addColorStop(0.82, '#b9770e');
        g.addColorStop(1.00, '#f6c653');
        ctx.strokeStyle = g;
        ctx.lineWidth = grosor;
        ctx.beginPath();
        ctx.arc(W.cx, W.cy, radio, 0, Math.PI * 2);
        ctx.stroke();

        // Filos finos para que el aro se lea como un borde y no como un halo.
        ctx.lineWidth = Math.max(1, grosor * 0.10);
        ctx.strokeStyle = 'rgba(255, 248, 215, 0.85)';
        ctx.beginPath();
        ctx.arc(W.cx, W.cy, radio + grosor / 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(110, 66, 6, 0.80)';
        ctx.beginPath();
        ctx.arc(W.cx, W.cy, radio - grosor / 2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    },

    /* ---- Z2: the overlay, exactly as supplied ---------------------------- */
    drawOverlay(ctx) {
        const src = this.overlayPatched || Assets.img.overlay;
        if (!src) return;
        ctx.save();
        ctx.globalAlpha = A.overlay;
        ctx.drawImage(src, 0, 0, CONFIG.design.width, CONFIG.design.height);
        ctx.restore();
    },

    /* ---- Z3: draw number, in place of the baked "#0000" ------------------ */
    drawDrawNumber(ctx) {
        if (A.draw <= 0.001) return;
        const D = CONFIG.slots.draw;
        const n = RESULT.draw_number;
        const text = (n === null || n === undefined) ? EMPTY : '#' + n;

        ctx.save();
        ctx.globalAlpha = A.draw;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        fitFont(ctx, text, D.maxW, 34, '700');
        ctx.fillStyle = CONFIG.color.draw;
        ctx.fillText(text, D.center.x, D.center.y);
        ctx.restore();
    },

    drawWinnerNumber(ctx) {
        if (
            RESULT.winner_number === null ||
            A.winner <= 0.001
        ) {
            return;
        }

        const W = CONFIG.slots.winner;
        const text = String(RESULT.winner_number);

        ctx.save();
        ctx.globalAlpha = A.winner;

        const size = fitFont(
            ctx,
            text,
            W.r * 1.24,
            W.r * 1.15,
            '700'
        );

        const metrics = ctx.measureText(text);

        const valid =
            Number.isFinite(metrics.actualBoundingBoxLeft) &&
            Number.isFinite(metrics.actualBoundingBoxRight) &&
            Number.isFinite(metrics.actualBoundingBoxAscent) &&
            Number.isFinite(metrics.actualBoundingBoxDescent);

        ctx.fillStyle = CONFIG.color.winner;

        if (valid) {
            const left = metrics.actualBoundingBoxLeft;
            const right = metrics.actualBoundingBoxRight;
            const ascent = metrics.actualBoundingBoxAscent;
            const descent = metrics.actualBoundingBoxDescent;

            const x =
                W.cx -
                (left + right) / 2 +
                left;

            const y =
                W.cy +
                (ascent - descent) / 2;

            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(text, x, y);
        } else {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, W.cx, W.cy);
        }

        ctx.restore();
    },

    /* ---- Z3: the five result values -------------------------------------- */
    drawTable(ctx) {
        const T = CONFIG.slots.table;
        const fields = ['color', 'parity', 'row', 'dozen', 'half'];

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        for (let i = 0; i < fields.length; i++) {
            const a = A.rows[i];
            if (a <= 0.001) continue;
            const text = shown(RESULT[fields[i]]);
            ctx.globalAlpha = a;
            const size = fitFont(ctx, text, 500, 40, '600');
            ctx.fillStyle = text === EMPTY ? CONFIG.color.empty : valueColour(fields[i], text);
            // A short slide as each value lands.
            ctx.fillText(ellipsize(ctx, text, 500),
                         T.valueX + (1 - a) * 18,
                         T.rowCentres[i] + size * 0.35);
        }
        ctx.restore();
    },

    /* ---- Z4: the multiplier row ------------------------------------------ */
    drawMultipliers(ctx) {
        const list = RESULT.multipliers;
        if (!list || !list.length) return;          // no items: leave it empty
        const L = multiplierLayout(list.length);
        const S = CONFIG.slot;

        for (let i = 0; i < L.items.length; i++) {
            const a = A.mults[i] || 0;
            if (a <= 0.001) continue;
            const it = L.items[i];
            const m = list[i];

            ctx.save();
            ctx.globalAlpha = a;
            // Scale from the item's own centre so it never drifts.
            ctx.translate(it.x + it.w / 2, it.y + it.h / 2);
            ctx.scale(0.92 + 0.08 * a, 0.92 + 0.08 * a);
            ctx.translate(-(it.x + it.w / 2), -(it.y + it.h / 2));

            // Ball first, then the frame on top of it.
            const bx = it.x + it.w * S.ball.cx;
            const by = it.y + it.h * S.ball.cy;
            const bd = it.w * S.ball.r * 2 * 0.94;
            drawAsset(ctx, ballFor(m.color, m.number), bx - bd / 2, by - bd / 2, bd, bd);

            drawAsset(ctx, 'slot', it.x, it.y, it.w, it.h);

            // Roulette number over the ball.
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            const nText = shown(m.number);
            const nSize = fitFont(ctx, nText, bd * 0.62, bd * 0.46, '700');
            ctx.fillStyle = '#ffffff';
            ctx.fillText(nText, bx, by + nSize * 0.35);

            // Multiplier value in the right-hand panel.
            const vText = shown(m.value);
            const vSize = fitFont(ctx, vText, it.w * S.value.w * 0.86, it.h * 0.46, '700');
            ctx.fillStyle = '#ffe9b8';
            ctx.fillText(vText, it.x + it.w * S.value.cx, it.y + it.h * S.value.cy + vSize * 0.35);

            ctx.restore();
        }

        // Dividers scale with the items and never follow the last one.
        for (let i = 0; i < L.dividers.length; i++) {
            const a = Math.min(A.mults[i] || 0, A.mults[i + 1] || 0);
            if (a <= 0.001) continue;
            const d = L.dividers[i];
            const img = Assets.img.divider;
            if (!img) break;
            const h = d.h;
            const w = h * (img.width / img.height);
            ctx.save();
            ctx.globalAlpha = a * 0.9;
            ctx.drawImage(img, d.cx - w / 2, d.cy - h / 2, w, h);
            ctx.restore();
        }
    },

    /* ---- Z5: one moving reflection --------------------------------------
       No new artwork and no static flare: a narrow slab of the overlay is
       re-drawn additively over itself, so the metal already in the PNG
       simply brightens as the reflection passes. Only the slab is copied,
       not the whole image. */
    drawReflection(ctx) {
        const t = A.reflect % 1;
        if (t > CONFIG.fx.reflectDuty) return;
        const src = this.overlayPatched || Assets.img.overlay;
        if (!src) return;

        const k = t / CONFIG.fx.reflectDuty;
        const env = Math.sin(k * Math.PI) * A.overlay;
        if (env <= 0.02) return;

        const W = CONFIG.design.width, H = CONFIG.design.height;
        const span = 320;
        const centre = -span + k * (W + span * 2);
        const slabs = 5;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < slabs; i++) {
            const f = (i + 0.5) / slabs;
            const x = centre + (f - 0.5) * span;
            const w = span / slabs;
            if (x + w <= 0 || x >= W) continue;
            // Triangular profile, so the slab edges do not show.
            ctx.globalAlpha = env * CONFIG.fx.reflectAlpha * (1 - Math.abs(f - 0.5) * 2);
            const sx = Math.max(0, x) / W * src.width;
            const sw = Math.min(w, W - Math.max(0, x)) / W * src.width;
            if (sw <= 0) continue;
            ctx.drawImage(src, sx, 0, sw, src.height,
                          Math.max(0, x), 0, sw / src.width * W, H);
        }
        ctx.restore();
    }
};


/* =========================================================================
   8. REVEAL — one timeline per draw, killed before the next
   ========================================================================= */

const Reveal = {
    tl: null,

    play() {
        const F = CONFIG.fx.reveal;

        // Never accumulate timelines: thousands of draws must not pile up.
        if (this.tl) { this.tl.kill(); this.tl = null; }
        gsap.killTweensOf(A);
        gsap.killTweensOf(A.rows);
        gsap.killTweensOf(A.mults);

        A.draw = 0; A.ball = 0; A.ballPop = 0; A.winner = 0;
        for (let i = 0; i < A.rows.length; i++) A.rows[i] = 0;
        for (let i = 0; i < A.mults.length; i++) A.mults[i] = 0;

        const tl = gsap.timeline();
        tl.to(A, { overlay: 1, duration: F.overlay, ease: 'power2.out' }, 0)
          .to(A, { draw: 1, duration: F.draw, ease: 'power2.out' }, 0.18)
          .to(A, { ball: 1, duration: F.ball, ease: 'back.out(1.6)' }, 0.26)
          .to(A, { ballPop: 1, duration: 0.18, ease: 'power2.out' }, 0.26)
          .to(A, { ballPop: 0, duration: 0.45, ease: 'power2.out' }, 0.44)
          .to(A, { winner: 1, duration: F.winner, ease: 'power2.out' }, 0.52)
          .to(A.rows, { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1,
                        duration: F.rows, ease: 'power2.out',
                        stagger: F.rowStagger }, 0.62);

        if (A.mults.length) {
            const targets = {};
            for (let i = 0; i < A.mults.length; i++) targets[i] = 1;
            targets.duration = F.mult;
            targets.ease = 'back.out(1.5)';
            targets.stagger = F.multStagger;
            tl.to(A.mults, targets, 0.86);
        }

        this.tl = tl;
    },

    /* El reflejo ambiental (repeat: -1) se ha eliminado: mantenía el ticker
       despierto para siempre solo para dar sensación de movimiento. Ese
       movimiento lo pone storm_bg.mp4 detrás. A.reflect se queda a 0. */
    startAmbient() {}
};


/* =========================================================================
   9. PUBLIC API
   ========================================================================= */

function renderResult(data) {
    const d = data || {};

    RESULT.draw_number   = d.draw_number   !== undefined ? d.draw_number   : null;
    RESULT.winner_number = d.winner_number !== undefined ? d.winner_number : null;
    /* El color que se escribe en la tabla también sale del número. */
    const colorNumero = colorOf(d.winner_number);
    RESULT.color  = colorNumero
        ? colorNumero.toUpperCase()
        : (d.color !== undefined ? d.color : null);
    RESULT.parity = d.parity !== undefined ? d.parity : null;
    RESULT.row    = d.row    !== undefined ? d.row    : null;
    RESULT.dozen  = d.dozen  !== undefined ? d.dozen  : null;
    RESULT.half   = d.half   !== undefined ? d.half   : null;

    RESULT.multipliers = Array.isArray(d.multipliers) ? d.multipliers.slice(0, 5) : [];

    /* El ganador multiplico: winning_multiplier solo llega con valor cuando la
       API lo marca activo (lo filtra cone_db_roulette.js). */
    RESULT.gold = d.winning_multiplier !== null && d.winning_multiplier !== undefined
               && Number(d.winning_multiplier) > 0;

    // The animated-alpha array follows the item count exactly.
    A.mults.length = RESULT.multipliers.length;
    for (let i = 0; i < A.mults.length; i++) A.mults[i] = 0;

    Reveal.play();

    /* La entrada del resultado es una animación real y corta: el ticker se
       despierta a 30 FPS mientras dura y se duerme en cuanto acaba. */
    Ticker.wake(30);

    if (Reveal.tl) {
        Reveal.tl.eventCallback('onComplete', () => {
            Ticker.sleep();
            Ticker.renderOnce();          // frame final ya quieto
        });
    }
}

window.StormResults = {
    renderResult: renderResult,
    get data() { return RESULT; },
    config: CONFIG,

    /* --- control de suspensión desde el visor integrado --- */
    setHostActive(on) {
        HOST.active = !!on;
        applyHost();
    },
    get hostActive()  { return HOST.active; },
    get frames()      { return HOST.frames; },
    get videoPaused() { return VideoController.el ? VideoController.el.paused : null; }
};


/* =========================================================================
   10. VIDEO + MAIN
   ========================================================================= */

const VideoController = {
    el: null, hint: null,

    init(el, hint) {
        this.el = el;
        this.hint = hint;
        el.play().catch(() => { hint.hidden = false; });
        hint.addEventListener('click', () => { hint.hidden = true; el.play().catch(() => {}); });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) VideoController.ensurePlaying();
        });
        // The video must keep playing across every draw; never recreated.
        setInterval(() => VideoController.ensurePlaying(), 5000);
    },

    ensurePlaying() {
        if (!HOST.active) return;          // la view está suspendida
        if (this.el && this.el.paused) this.el.play().catch(() => {});
    }
};


/* =========================================================================
   10b. HOST — suspensión de la view cuando no está activa

   Mismo criterio que la pantalla principal:

     deactivate()  gsap.ticker.sleep()  -> se detiene el rAF, y con él el
                   render y la tween ambiental del reflejo. El video se pausa
                   y el watchdog de 5 s deja de revivirlo.

     activate()    gsap.ticker.wake()   -> se reanuda el MISMO callback ya
                   registrado. No se registra nada nuevo nunca, así que no se
                   acumulan tickers, intervals, listeners ni timelines.
   ========================================================================= */

const HOST = { active: true, ready: false, frames: 0 };

/* -------------------------------------------------------------------------
   TICKER BAJO DEMANDA

   Esta pantalla es estática. El ticker solo se despierta durante la
   animación de entrada del resultado y se vuelve a dormir al terminar.
   Fuera de eso el canvas no genera ni un frame: el fondo se mueve solo,
   porque es un <video>.
   ------------------------------------------------------------------------- */
const Ticker = {

    awake: false, ready: false, pending: 0,

    init() {
        gsap.ticker.add(() => { HOST.frames++; Renderer.render(); });
        this.ready = true;
        this.sleep();
    },

    wake(fps) {
        if (!this.ready) return;
        gsap.ticker.fps(fps || 30);
        gsap.ticker.wake();
        this.awake = true;
    },

    sleep() {
        if (!this.ready) return;
        gsap.ticker.sleep();
        this.awake = false;
    },

    /* Un frame suelto y a dormir. */
    renderOnce() {
        if (!this.ready || !HOST.active || this.awake || this.pending) return;
        this.pending = requestAnimationFrame(() => {
            Ticker.pending = 0;
            if (!HOST.active) return;
            HOST.frames++;
            Renderer.render();
        });
    },

    cancelPending() {
        if (this.pending) { cancelAnimationFrame(this.pending); this.pending = 0; }
    }
};

function applyHost() {
    if (!HOST.ready) return;

    if (HOST.active) {
        VideoController.ensurePlaying();
        Ticker.renderOnce();              // un frame estático, sin bucle
    } else {
        Ticker.cancelPending();
        Ticker.sleep();
        if (Reveal.tl) { Reveal.tl.kill(); Reveal.tl = null; }
        if (VideoController.el) VideoController.el.pause();
    }
};

/* Demo feed. Delete this block once a backend calls
   StormResults.renderResult(). */
const DEMO = {
    base: {
        draw_number: 1234, winner_number: 23, color: 'ROJO', parity: 'IMPAR',
        row: '2DA FILA', dozen: '13-24', half: '19-36',
        multipliers: [
            { number: 23, value: 'x100', color: 'red' },
            { number: 12, value: 'x150', color: 'red' },
            { number: 1,  value: 'x50',  color: 'red' }
        ]
    },

    pool: [
        { number: 23, value: 'x100', color: 'red' },
        { number: 20, value: 'x50',  color: 'black' },
        { number: 0,  value: 'x500', color: 'green' },
        { number: 12, value: 'x150', color: 'red' },
        { number: 8,  value: 'x200', color: 'black' }
    ],

    withCount(n) {
        const d = JSON.parse(JSON.stringify(DEMO.base));
        d.multipliers = DEMO.pool.slice(0, n);
        return d;
    },

    keys() {
        window.addEventListener('keydown', e => {
            if (e.code >= 'Digit0' && e.code <= 'Digit5') {
                renderResult(DEMO.withCount(Number(e.code.slice(-1))));
            } else if (e.code === 'KeyR') {
                renderResult(Object.assign(DEMO.withCount(3), {
                    draw_number: 1240, winner_number: 23, color: 'ROJO',
                    parity: 'IMPAR', row: '2DA FILA', dozen: '13-24', half: '19-36'
                }));
            } else if (e.code === 'KeyB') {
                renderResult(Object.assign(DEMO.withCount(3), {
                    draw_number: 1241, winner_number: 20, color: 'NEGRO',
                    parity: 'PAR', row: '2DA FILA', dozen: '13-24', half: '19-36'
                }));
            } else if (e.code === 'KeyG') {
                renderResult(Object.assign(DEMO.withCount(2), {
                    draw_number: 1242, winner_number: 0, color: 'VERDE',
                    parity: null, row: null, dozen: null, half: null
                }));
            } else if (e.code === 'Space') {
                e.preventDefault();
                Reveal.play();
            }
        });
    }
};

function main() {
    const canvas = document.getElementById('scene');
    const video  = document.getElementById('bg');
    const hint   = document.getElementById('tap-hint');

    Renderer.init(canvas);
    VideoController.init(video, hint);

    Assets.load().then(() => {
        Renderer.patchDrawPlaque();
        Reveal.startAmbient();

        /* Start from the supplied sample so the screen is faithful before any
           backend is attached. The JSON file is authoritative; the inline copy
           is only a fallback for file:// where fetch is blocked. */
        fetch(CONFIG.assets.path + 'example_result.json')
            .then(r => r.json())
            .then(j => renderResult(j))
            .catch(() => renderResult(DEMO.base));

        DEMO.keys();

        /* El callback de render se registra una vez y el ticker se duerme.
           Solo despierta mientras dura la entrada del resultado. */
        Ticker.init();

        /* A partir de aquí el host puede suspender esta pantalla. */
        HOST.ready = true;
        applyHost();
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}

})();
