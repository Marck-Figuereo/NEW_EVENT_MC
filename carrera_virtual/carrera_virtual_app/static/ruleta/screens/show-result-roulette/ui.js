/* =========================================================================
   VIRTUAL STORM ROULETTE — ui.js
   TV interface layer. Extends app.js; changes nothing inside it.

   Loaded BEFORE app.js. Exposes window.StormUI with four hooks that app.js
   calls: init(api), draw(ctx), onSpinStart(), onSpinEnd(angle).

   ------------------------------------------------------------------------
   THE SUPPLIED PNGs ARE THE ONLY DECORATIVE LAYER.
   Every frame, panel, jackpot bar, result ball, hot/cold strip and
   multiplier badge on screen is one of the approved assets under
   assets/ui/. Nothing decorative is drawn procedurally any more: there are
   no code-drawn frames, borders, cell backgrounds or gradients behind these
   sections.

   Everything that CHANGES is still rendered by this file on top of those
   shells: round, timer, statistics percentages, payout rows, jackpot names
   and amounts, hot/cold numbers, results, per-result multipliers and the
   last-jackpot fields. No dynamic value is baked into any image.

   The only pixels this file paints besides text are moving light: a shine
   crossing a jackpot bar, a glint along a panel edge, a pop on a new badge.
   ------------------------------------------------------------------------

   Slot geometry (where text goes inside each shell) was measured from the
   assets themselves and is stored as fractions, so a re-exported asset only
   needs its numbers updated in one place.
   ========================================================================= */
//recent
(function () {
'use strict';

const TAU = Math.PI * 2;


/* =========================================================================
   1. CONFIG
   ========================================================================= */

const UI = {

    sections: {
        hotCold: true
    },

    color: {
        text:      '#eaf4ff',
        textDim:   '#93a9c0',
        gold:      '#f0b445',
        goldLight: '#ffd98a',
        accent:    '#5cc8ff',
        stormTint: '#3aa0ff',   // same blue app.js multiplies the wheel with

        rojoLabel:  '#ff9ea3', rojoValue:  '#ff8288',
        verdeLabel: '#5fe08a', verdeValue: '#3ee0c8',
        negroLabel: '#dbe6f5', negroValue: '#eaf4ff'
    },

    font: {
        /* No "-apple-system": a leading hyphen makes strict CSS font parsers
           reject the whole declaration, and a rejected assignment leaves
           ctx.font untouched, which silently defeats fitFont(). */
        display: '"Bahnschrift", "DIN Alternate", "Oswald", "Arial Narrow", Arial, sans-serif',
        body:    'system-ui, "Segoe UI", Roboto, Arial, sans-serif'
    },

    /* ---- the approved assets ------------------------------------------- */
    assets: {
        path: 'assets/ui/',

        files: {
            panel_round_timer:    'panels/panel_round_timer.png',
            panel_statistics:     'panels/panel_statistics.png',
            panel_jackpots:       'panels/panel_jackpots.png',
            panel_payout:         'panels/panel_payout.png',
            panel_last_jackpot:   'panels/panel_last_jackpot.png',
            panel_recent_numbers: 'panels/panel_recent_numbers.png',

            bar_gold:   'jackpots/jackpot_gold.png',
            bar_orange: 'jackpots/jackpot_orange.png',
            bar_blue:   'jackpots/jackpot_blue.png',
            bar_red:    'jackpots/jackpot_red.png',
            bar_green:  'jackpots/jackpot_green.png',
            bar_gray:   'jackpots/jackpot_gray.png',

            ball_red:   'results/ball_red.png',
            ball_black: 'results/ball_black.png',
            ball_green: 'results/ball_green.png',

            hot:  'hot_cold/hot_numbers.png',
            cold: 'hot_cold/cold_numbers.png',

            mult_50:  'multiplicativos/x50.png',
            mult_100: 'multiplicativos/x100.png',
            mult_150: 'multiplicativos/x150.png',
            mult_200: 'multiplicativos/x200.png',
            mult_300: 'multiplicativos/x300.png',
            mult_500: 'multiplicativos/x500.png'
        },

        /* Visible content box of assets that carry transparent margin or a
           soft outer glow, as [x0, y0, x1, y1] fractions. Drawing through
           these keeps every ball the same size on screen even though the
           artwork is not centred inside its own file. */
        content: {
            bar_orange: [0.0071, 0.0580, 0.9925, 0.9352],
            ball_red:   [0.0694, 0.0526, 0.9234, 0.9083],
            ball_black: [0.0718, 0.0558, 0.9219, 0.9067],
            ball_green: [0.0702, 0.0534, 0.9242, 0.9083],
            mult_50:    [0.2118, 0.1892, 0.7882, 0.7755],
            mult_100:   [0.2269, 0.1854, 0.7726, 0.7654],
            mult_150:   [0.1997, 0.1892, 0.8003, 0.7844],
            mult_200:   [0.1755, 0.1475, 0.8225, 0.7919],
            mult_300:   [0.2189, 0.2119, 0.7786, 0.7213],
            mult_500:   [0.1987, 0.2219, 0.8008, 0.7314]
        },

        /* The jackpots and payout frames share one square-ish artwork but
           need two different heights, so those two are 9-sliced: corners stay
           exactly as drawn and only the straight runs stretch. Every other
           panel is drawn whole, at its own aspect ratio. */
        slice: { l: 112, r: 112, t: 112, b: 112 },

        /* Where dynamic content goes inside each shell, in fractions of that
           shell's rectangle. Measured from the artwork. */
        slots: {
            roundTimer: {
                round: [0.035, 0.11, 0.365, 0.86],
                timer: [0.410, 0.11, 0.965, 0.86]
            },
            stats: {
                x0: 0.035, x1: 0.955,
                title: 0.062,
                rows: [
                    { y0: 0.100, y1: 0.285, div: [0.335, 0.635] },
                    { y0: 0.305, y1: 0.485, div: [0.335, 0.635] },
                    { y0: 0.505, y1: 0.715, div: [0.270, 0.500, 0.730] },
                    { y0: 0.740, y1: 0.945, div: [0.335, 0.635] }
                ]
            },
            /* Medido sobre panel_last_jackpot.png (2462x548):
                 caja interior   x 0.0378..0.9618   y 0.2263..0.8394
                 divisorias      x 0.2008 / 0.4986 / 0.7157
               Antes las divisorias del código (0.285/0.475/0.675) no coincidían
               con las del arte, y "Monto:" y "Fecha:" quedaban montados sobre
               la línea divisoria. */
            lastJp: {
                x0: 0.0378, x1: 0.9618, y0: 0.2263, y1: 0.8394,
                div: [0.2008, 0.4986, 0.7157]
            },
            hotcold: { c0: 0.2345, pitch: 0.1352, cy: 0.5095, rx: 0.0552, ry: 0.2714 },
            /* These two panels change height with the level count, so their
               interior is measured in pixels: a fraction that clears the
               border at 418px tall sits on top of it at 170px. */
            jackpots: { titleY: 46, top: 66, bottom: 22, insetX: 28 },
            payout:   { titleY: 54, top: 78, bottom: 26, insetX: 34 },
            /* Caja interior de panel_recent_numbers.png: y 0.0447..0.9475.
               La fila estaba alta y dejaba una franja vacía debajo. */
            recent: { cy: 0.470, inset: 0.018, badge: 0.790, badgeH: 0.150 }
        }
    },

    /* Native aspect ratios (w/h) of the panel artwork, so a panel is never
       stretched out of shape. */
    ratio: {
        roundTimer: 2145 / 459,
        stats:      1231 / 940,
        lastJp:     2172 / 536,
        recent:     2172 / 405,
        hotcold:    1023 / 210
    },

    layout: {
        colC: { x: 718,  w: 640 },
        colR: { x: 1368, w: 542 },

        topFrameY: 30,
        statsY:    180,
        hotcoldY:  690,

        jackpots: { y: 30, bottom: 782, headH: 0.085, gap: 10, minRow: 34, maxRow: 92 },
        payoutGap: 18,

        bottomY: 793,
        lastJp:  { x: 14,  w: 690 },
        recent:  { x: 718, w: 1192 }
    },

    /* The UI shares the roulette's lighting environment rather than running a
       decorative system of its own: the reflections below are driven by
       STATE.rimSweep / STATE.goldSweep / STATE.glow from app.js, and the
       storm reaction by the same STATE.lightning the wheel uses. These are
       reflection strengths, not cycle lengths — the timing already belongs
       to the roulette. */
    fx: {
        reflectBlue:   0.125,  // cool band crossing panel borders
        reflectGold:   0.095,  // warm band, running the other way
        reflectBar:    0.150,  // the same reflection over a jackpot plate
        reflectStrip:  0.110,  // over the hot/cold strips
        lightningTint: 0.40,   // blue-tinted artwork added during a strike
        lightningBall: 0.50
    },

    data: {
        currency: '$',
        historyShown: 16,
        statsWindow: 120,
        multiplierChance: 0.22,
        /* Only values with an approved badge asset are used by the demo.
           A feed may send anything; unknown values simply render no badge. */
        multiplierValues: [50, 100, 150, 200, 300, 500],
        jackpotWinChance: 0.06
    },

    version: 0
};

/* Jackpot tiers map to the six supplied bar surfaces. `ink` is the text
   colour that reads on that surface: the bright plates take dark engraved
   type, the deep ones take white. */
const THEMES = {
    gold:   { asset: 'bar_gold',   ink: '#2a1c02', inkSoft: 'rgba(255,240,200,0.45)', glow: '#ffcf6a' },
    orange: { asset: 'bar_orange', ink: '#2b1002', inkSoft: 'rgba(255,230,200,0.40)', glow: '#ff9a3c' },
    gray:   { asset: 'bar_gray',   ink: '#14181d', inkSoft: 'rgba(255,255,255,0.45)', glow: '#cfd8e4' },
    blue:   { asset: 'bar_blue',   ink: '#ffffff', inkSoft: 'rgba(0,0,0,0.45)',       glow: '#4aa8ff' },
    red:    { asset: 'bar_red',    ink: '#ffffff', inkSoft: 'rgba(0,0,0,0.45)',       glow: '#ff5a62' },
    green:  { asset: 'bar_green',  ink: '#ffffff', inkSoft: 'rgba(0,0,0,0.45)',       glow: '#3ddc6a' }
};
const THEME_ORDER = ['gold', 'orange', 'blue', 'red', 'gray', 'green'];
const ICON_ORDER = [
    'crown',
    'gem',
    'star',
    'spade',
    'club',
    'pip'
];
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

/* European wheel order, clockwise from 0 — matches roulette_rotor.png. */
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23,
               10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];


/* =========================================================================
   2. GAME DATA — the single source the renderer reads
   ========================================================================= */

const GAME = {
    round: 81,
    countdown: 0,
    countdownSource: 'host',    // 'host' = app.js spin timer, 'feed' = external
    feedCountdown: 0,
    feedAt: 0,
    spinning: false,

    /* levels: { key, name, icon, theme, amount, display, flash } */
    levels: [],

    /* results, newest first: { n, color, mult } */
    results: [],

    lastJackpot: {
        type:   'MEGA',
        ticket: '00000000',
        amount: 0,
        date:   '',
        place:  ''
    },

    hot:  [],
    cold: [],

    stats: {
        rojo: 0, verde: 0, negro: 0,
        low: 0, high: 0, par: 0, impar: 0,
        d1: 0, d2: 0, d3: 0,
        c1: 0, c2: 0, c3: 0,
        total: 0
    },

    /* Which cells the statistics panel shows, row by row. Reordering this
       array is all it takes to restructure the panel. `fill` paints the cell
       with a colour instead of the neutral surface. */
    statLayout: [
        [{ key: 'rojo',  label: 'ROJO',  fill: 'rojo'  },
         { key: 'verde', label: 'VERDE', fill: 'verde' },
         { key: 'negro', label: 'NEGRO', fill: 'negro' }],

        [{ key: 'c1',    label: '1RA FILA' },
         { key: 'c2',    label: '2DA FILA' },
         { key: 'c3',    label: '3RA FILA' }
        
        ],

        [
        { key: 'par',  label: 'PAR' },
        { key: 'impar', label: 'IMPAR' },
        { key: 'low',  label: '1-18' },
        { key: 'high', label: '19-36' }
         ],

        [{ key: 'd1',    label: '1-12' },
         { key: 'd2',    label: '13-24' },
         { key: 'd3',    label: '25-36' }]
    ],

    /* Numero directo: dos modalidades del ticket, arriba de la tabla.
       Sin multiplicativo paga 36 y no participa; con multiplicativo paga 27
       y participa en los multiplicativos de la ronda. */
    payoutDirecto: [
        { title: 'DIRECTO NORMAL',         value: '36 a 1', note: 'NO PARTICIPA EN MULTIPLICATIVOS', destacado: false },
        { title: 'DIRECTO MULTIPLICATIVO', value: '27 a 1', note: 'PARTICIPA EN MULTIPLICATIVOS',    destacado: true }
    ],

    /* Payout table (resto de apuestas). Split across two columns automatically. */
    payoutTable: [
        { label: 'ROJO / NEGRO',     value: '1 a 1' },
        { label: '1-18 / 19-36',     value: '1 a 1' },
        { label: 'PAR / IMPAR',      value: '1 a 1' },
        { label: '1RA FILA (1-12)',  value: '2 a 1' },
        { label: '2DA FILA (13-24)', value: '2 a 1' },
        { label: '3RA FILA (25-36)', value: '2 a 1' },
        { label: '1RA 12 (1-12)',    value: '2 a 1' },
        { label: '2DA 12 (13-24)',   value: '2 a 1' },
        { label: '3RA 12 (25-36)',   value: '2 a 1' }
    ],

    colorOf(n) {
        n = Number(n);

        if (n === 0) return 'verde';

        return RED_NUMBERS.has(n)
            ? 'rojo'
            : 'negro';
    },

    /* Percentages and hot/cold are derived from the result window unless a
       feed overrides them with setStatistics() / setHotCold(). */
    derived: { stats: true, hotcold: true },

    recompute() {
        const win = GAME.results.slice(0, UI.data.statsWindow);

        if (GAME.derived.stats) {
            const s = GAME.stats;
            for (const k in s) s[k] = 0;
            for (let i = 0; i < win.length; i++) {
                const n = Number(win[i].n);
                s.total++;
                s[GAME.colorOf(n)]++;
                if (n === 0) continue;
                if (n <= 18) s.low++; else s.high++;
                if (n % 2) s.impar++; else s.par++;
                if (n <= 12) s.d1++; else if (n <= 24) s.d2++; else s.d3++;
                const col = n % 3;
                if (col === 1) s.c1++; else if (col === 2) s.c2++; else s.c3++;
            }
        }

        if (GAME.derived.hotcold) {
            const counts = new Map();
            for (let i = 0; i < win.length; i++) {
                counts.set(win[i].n, (counts.get(win[i].n) || 0) + 1);
            }
            const all = [];
            for (let n = 0; n <= 36; n++) all.push({ n: n, count: counts.get(n) || 0 });
            all.sort((a, b) => b.count - a.count || a.n - b.n);
            GAME.hot = all.slice(0, 6).map(o => o.n);
            all.sort((a, b) => a.count - b.count || a.n - b.n);
            GAME.cold = all.slice(0, 6).map(o => o.n);
        }
    }
};


/* =========================================================================
   3. ANIMATED STATE — GSAP writes here, the renderer reads it
   ========================================================================= */

const A = {
    sweep:       0,     // 0..1 shine pass across the jackpot rows
    entry:       0,     // 1..0 arrival of the newest result chip
    multPop:     0,     // 0..1 pop as a new multiplier badge lands
    statPulse:   0,     // 1..0 wash down the statistics panel on a new round
    roundFlash:  0,
    timerUrgent: 0,
    jpFlash:     0      // 0..1 last-jackpot celebration wash
};



/* =========================================================================
   4. ASSETS + DRAW HELPERS
   ========================================================================= */

const UIA = {
    img: {},
    tint: {},
    ready: false,
    missing: [],

    load() {
        const A = UI.assets;
        const keys = Object.keys(A.files);
        let left = keys.length;
        const done = () => {
            if (--left > 0) return;
            UIA.buildTints();
            UIA.ready = true;
            Chrome.invalidate();
            Chrome.invalidateData();
        };
        keys.forEach(k => {
            const im = new Image();
            im.decoding = 'async';
            im.onload = () => { UIA.img[k] = im; done(); };
            im.onerror = () => {
                UIA.missing.push(A.files[k]);
                console.warn('[StormUI] asset not found:', A.path + A.files[k]);
                done();
            };
            im.src = A.path + A.files[k];
        });
    },

    /* Blue-tinted result balls, prepared once at half resolution. */
    buildTints() {
        ['ball_red', 'ball_black', 'ball_green'].forEach(k => {
            const im = this.img[k];
            if (!im) return;
            const c = document.createElement('canvas');
            c.width = Math.round(im.width / 2);
            c.height = Math.round(im.height / 2);
            const g = c.getContext('2d');
            g.drawImage(im, 0, 0, c.width, c.height);
            g.globalCompositeOperation = 'multiply';
            g.fillStyle = UI.color.stormTint;
            g.fillRect(0, 0, c.width, c.height);
            g.globalCompositeOperation = 'destination-in';
            g.drawImage(im, 0, 0, c.width, c.height);
            this.tint[k] = c;
        });
    },

    has(k) { return !!this.img[k]; }
};

/* A blue-multiplied copy of a canvas, alpha preserved. Built once and
   reused; never regenerated per frame. */
function tintCanvas(src) {
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = UI.color.stormTint;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(src, 0, 0);
    return c;
}

/* Draw an asset so its VISIBLE content exactly fills (x, y, w, h). Assets
   with transparent margin or an outer glow declare a content box; the image
   is scaled up around it so the glow spills outside the rect instead of
   eating into it. */
function drawAsset(ctx, key, x, y, w, h, alpha) {
    const img = UIA.img[key];
    if (!img) return false;
    const c = UI.assets.content[key];

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

/* 9-slice, used only for the two panels that share one artwork but need
   different heights. Corners are never scaled. */
function nineSlice(ctx, key, x, y, w, h) {
    const img = UIA.img[key];
    if (!img) return false;
    const s = UI.assets.slice;
    const iw = img.width, ih = img.height;

    /* The border must appear at the same proportion it has in the artwork.
       Keeping the slices at native pixel size would draw this frame's edge
       roughly 2.2x too heavy, because the panel renders at 542px from a
       1191px source. */
    const f = w / iw;
    const kx = (s.l + s.r) * f > w ? w / ((s.l + s.r) * f) : 1;
    const ky = (s.t + s.b) * f > h ? h / ((s.t + s.b) * f) : 1;
    const dl = s.l * f * kx, dr = s.r * f * kx, dt = s.t * f * ky, db = s.b * f * ky;
    const mw = iw - s.l - s.r, mh = ih - s.t - s.b;
    const dmw = w - dl - dr, dmh = h - dt - db;

    ctx.drawImage(img, 0, 0, s.l, s.t, x, y, dl, dt);
    ctx.drawImage(img, iw - s.r, 0, s.r, s.t, x + w - dr, y, dr, dt);
    ctx.drawImage(img, 0, ih - s.b, s.l, s.b, x, y + h - db, dl, db);
    ctx.drawImage(img, iw - s.r, ih - s.b, s.r, s.b, x + w - dr, y + h - db, dr, db);
    if (dmw > 0) {
        ctx.drawImage(img, s.l, 0, mw, s.t, x + dl, y, dmw, dt);
        ctx.drawImage(img, s.l, ih - s.b, mw, s.b, x + dl, y + h - db, dmw, db);
    }
    if (dmh > 0) {
        ctx.drawImage(img, 0, s.t, s.l, mh, x, y + dt, dl, dmh);
        ctx.drawImage(img, iw - s.r, s.t, s.r, mh, x + w - dr, y + dt, dr, dmh);
    }
    if (dmw > 0 && dmh > 0) {
        ctx.drawImage(img, s.l, s.t, mw, mh, x + dl, y + dt, dmw, dmh);
    }
    return true;
}

/* Appends a rounded rect as a SUBPATH. Callers that need two of them in one
   path (an annulus for the edge lights) must use this, not rr(): rr begins a
   new path and would silently discard the first rectangle. */
function rrPath(ctx, x, y, w, h, r) {
    const k = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
    ctx.moveTo(x + k, y);
    ctx.lineTo(x + w - k, y);
    ctx.arcTo(x + w, y, x + w, y + k, k);
    ctx.lineTo(x + w, y + h - k);
    ctx.arcTo(x + w, y + h, x + w - k, y + h, k);
    ctx.lineTo(x + k, y + h);
    ctx.arcTo(x, y + h, x, y + h - k, k);
    ctx.lineTo(x, y + k);
    ctx.arcTo(x, y, x + k, y, k);
    ctx.closePath();
}

function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    rrPath(ctx, x, y, w, h, r);
}

/* Letter-spaced text. Lives in cached chrome, so the per-glyph cost is paid
   once rather than every frame. */
function tracked(ctx, text, x, y, spacing, align) {
    let total = 0;
    for (let i = 0; i < text.length; i++) total += ctx.measureText(text[i]).width + spacing;
    total -= spacing;
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    const prev = ctx.textAlign;
    ctx.textAlign = 'left';
    for (let i = 0; i < text.length; i++) {
        ctx.fillText(text[i], cx, y);
        cx += ctx.measureText(text[i]).width + spacing;
    }
    ctx.textAlign = prev;
    return total;
}

/* Largest size at or below px that fits max. Amounts, place names and round
   numbers all vary in length, so nothing is allowed to assume it fits. */
function fitFont(ctx, text, max, px, weight, family) {
    let size = px;
    ctx.font = weight + ' ' + size + 'px ' + family;
    for (let pass = 0; pass < 2; pass++) {
        const w = ctx.measureText(text).width;
        if (w <= max || max <= 0) return size;
        size = Math.max(9, Math.floor(size * max / w));
        ctx.font = weight + ' ' + size + 'px ' + family;
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

/* Cheap text glow: low-alpha passes instead of shadowBlur, which is far too
   slow to run on every value at 60 FPS. */
function glowText(ctx, text, x, y, color, spread) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = color;
    const d = spread || 1.4;
    ctx.fillText(text, x - d, y);
    ctx.fillText(text, x + d, y);
    ctx.fillText(text, x, y - d);
    ctx.restore();
}

/* Type over the jackpot plates. White on a dark drop reads on all six
   surfaces; dark ink disappeared on the bright gold and silver ones. */
function engrave(ctx, text, x, y) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
    ctx.fillText(text, x + 1.5, y + 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y);
}

function money(v) {
    const s = Math.abs(Number(v) || 0).toFixed(2);
    const dot = s.indexOf('.');
    let int = s.slice(0, dot);
    const dec = s.slice(dot);
    let out = '';
    while (int.length > 3) { out = ',' + int.slice(-3) + out; int = int.slice(0, -3); }
    return UI.data.currency + int + out + dec;
}
function isDigitChar(ch) {
    return ch >= '0' && ch <= '9';
}
function getOdoDigitWidth(ctx) {
    let width = 0;

    for (let i = 0; i <= 9; i++) {
        width = Math.max(width, ctx.measureText(String(i)).width);
    }

    return width;
}

function measureOdoText(ctx, text) {
    const digitWidth = getOdoDigitWidth(ctx);

    return Array.from(text).reduce((total, ch) => {
        return total + (
            isDigitChar(ch)
                ? digitWidth
                : ctx.measureText(ch).width
        );
    }, 0);
}

function fitOdoFont(ctx, text, max, px, weight, family) {
    let size = px;

    for (let pass = 0; pass < 3; pass++) {
        ctx.font = `${weight} ${size}px ${family}`;

        const width = measureOdoText(ctx, text);

        if (width <= max || max <= 0) {
            return size;
        }

        size = Math.max(9, Math.floor(size * max / width));
    }

    return size;
}

function drawOdoGlyphInCell(ctx, ch, x, cellWidth, baseline) {
    const glyphWidth = ctx.measureText(ch).width;
    const centeredX = x + (cellWidth - glyphWidth) / 2;

    drawOdoGlyph(ctx, ch, centeredX, baseline);
}
function drawOdoGlyph(ctx, ch, x, baseline) {
    ctx.fillStyle = 'rgba(0,0,0,.62)';
    ctx.fillText(ch, x + 1.5, baseline + 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(ch, x, baseline);
}

function syncOdo(lv, text) {
    if (!lv._odo) {
        lv._odo = {
            text: text,
            cells: Array.from(text, ch => ({
                char: ch,
                from: null,
                to: null,
                start: 0,
                duration: 0
            }))
        };
        return;
    }

    if (lv._odo.text === text) return;

    const oldText = lv._odo.text;
    const now = performance.now();
    let rolling = false;

    const cells = Array.from(text, (ch, index) => {
        const oldIndex =
            oldText.length - text.length + index;

        const oldChar =
            oldIndex >= 0
                ? oldText[oldIndex]
                : '';

        const cell = {
            char: ch,
            from: null,
            to: null,
            start: 0,
            duration: 0
        };

        if (
            isDigitChar(oldChar) &&
            isDigitChar(ch) &&
            oldChar !== ch
        ) {
            cell.from = Number(oldChar);
            cell.to = Number(ch);
            cell.start = now;
            cell.duration = JackpotCounter.cfg.rollDuration;
            rolling = true;
        }

        return cell;
    });

    lv._odo = {
        text: text,
        cells: cells
    };

    if (rolling) {
        JackpotCounter.startRolling(
            now + JackpotCounter.cfg.rollDuration
        );
    }
}

function drawOdometer(ctx, lv, text, rightX, baseline, size) {
    syncOdo(lv, text);

    const chars = Array.from(text);
    const digitWidth = getOdoDigitWidth(ctx);

    const widths = chars.map(ch =>
        isDigitChar(ch)
            ? digitWidth
            : ctx.measureText(ch).width
    );

    let x = rightX - widths.reduce((a, b) => a + b, 0);

    const now = performance.now();
    const cellHeight = size * 1.08;
    const clipTop = baseline - size * 0.90;

    ctx.textAlign = 'left';

    for (let i = 0; i < chars.length; i++) {
        const cell = lv._odo.cells[i];
        const width = widths[i];

        ctx.save();

        if (cell && cell.from !== null && cell.start > 0) {
            const p = Math.min(
                1,
                Math.max(0, (now - cell.start) / cell.duration)
            );

            const eased = 1 - Math.pow(1 - p, 3);

            ctx.beginPath();
            ctx.rect(
                x - 2,
                clipTop,
                width + 4,
                size * 1.18
            );
            ctx.clip();

            drawOdoGlyphInCell(
                ctx,
                String(cell.from),
                x,
                width,
                baseline - eased * cellHeight
            );

            drawOdoGlyphInCell(
                ctx,
                String(cell.to),
                x,
                width,
                baseline + cellHeight - eased * cellHeight
            );
        } else {
            drawOdoGlyphInCell(
                ctx,
                chars[i],
                x,
                width,
                baseline
            );
        }

        ctx.restore();
        x += width;
    }
}   
function pct(part, total) { return total ? part / total * 100 : 0; }

function clockText(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

function themeOf(level, index) {
    return THEMES[level.theme] || THEMES[THEME_ORDER[index % THEME_ORDER.length]];
}

/* Multiplier badges exist only for the approved values. Anything else draws
   no badge rather than a substitute graphic. */
function multAsset(m) {
    const key = 'mult_' + m;
    return UIA.has(key) ? key : null;
}

function clockIcon(ctx, x, y, s) {
    ctx.lineWidth = Math.max(1.6, s * 0.13);
    ctx.beginPath();
    ctx.arc(x, y, s, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.55);
    ctx.lineTo(x, y);
    ctx.lineTo(x + s * 0.42, y + s * 0.2);
    ctx.stroke();
}

/* One shared context for measuring during layout. */
let scratchCtx = null;
function measureCtx() {
    if (!scratchCtx) {
        const c = document.createElement('canvas');
        c.width = 8; c.height = 8;
        scratchCtx = c.getContext('2d');
    }
    return scratchCtx;
}

/* Resolve a slot rectangle expressed in fractions of a panel. */
function slot(panel, x0, y0, x1, y1) {
    return {
        x: panel.x + panel.w * x0,
        y: panel.y + panel.h * y0,
        w: panel.w * (x1 - x0),
        h: panel.h * (y1 - y0)
    };
}


/* =========================================================================
   5. LAYOUT
   Panel rectangles follow the artwork's own aspect ratio so no shell is
   ever stretched out of shape.
   ========================================================================= */

const L = {};

function layout() {
    const l = UI.layout;
    const R = UI.ratio;

    /* ---- centre column -------------------------------------------------- */
    L.topFrame = { x: l.colC.x, y: l.topFrameY, w: l.colC.w, h: l.colC.w / R.roundTimer };
    L.round = slot(L.topFrame, UI.assets.slots.roundTimer.round[0], UI.assets.slots.roundTimer.round[1],
                               UI.assets.slots.roundTimer.round[2], UI.assets.slots.roundTimer.round[3]);
    L.timer = slot(L.topFrame, UI.assets.slots.roundTimer.timer[0], UI.assets.slots.roundTimer.timer[1],
                               UI.assets.slots.roundTimer.timer[2], UI.assets.slots.roundTimer.timer[3]);

    L.stats = { x: l.colC.x, y: l.statsY, w: l.colC.w, h: l.colC.w / R.stats };

    // Statistics cells come from the artwork's own baked rows and dividers.
    const S = UI.assets.slots.stats;
    L.statRows = [];
    for (let i = 0; i < S.rows.length && i < GAME.statLayout.length; i++) {
        const r = S.rows[i];
        const defs = GAME.statLayout[i];
        const edges = [S.x0].concat(r.div, [S.x1]);
        const row = { cells: [] };
        for (let j = 0; j < defs.length && j < edges.length - 1; j++) {
            const c = slot(L.stats, edges[j], r.y0, edges[j + 1], r.y1);
            c.def = defs[j];
            row.cells.push(c);
        }
        L.statRows.push(row);
    }

    /* ---- HOT / COLD ----------------------------------------------------- */
    const halfW = (l.colC.w - 14) / 2;
    const hcH = halfW / R.hotcold;
    L.hotBox  = { x: l.colC.x, y: l.hotcoldY, w: halfW, h: hcH };
    L.coldBox = { x: l.colC.x + halfW + 14, y: l.hotcoldY, w: halfW, h: hcH };
    L.hotSlots  = hcSlots(L.hotBox);
    L.coldSlots = hcSlots(L.coldBox);
    L.hotcold = { x: L.hotBox.x, y: L.hotBox.y, w: l.colC.w, h: hcH };

    /* ---- right column: jackpots ----------------------------------------- */
    const j = l.jackpots;
    const n = Math.max(1, GAME.levels.length);
    const J = UI.assets.slots.jackpots;

    const maxPanelH = 418;
    const chrome = J.top + J.bottom;
    let rh = (maxPanelH - chrome - (n - 1) * j.gap) / n;
    rh = Math.max(j.minRow, Math.min(j.maxRow, rh));
    const stackH = rh * n + j.gap * (n - 1);
    const panelH = Math.min(maxPanelH, stackH + chrome);

    L.jackpots = { x: l.colR.x, y: j.y, w: l.colR.w, h: panelH };

    const barX = L.jackpots.x + J.insetX;
    const barW = L.jackpots.w - J.insetX * 2;
    const startY = L.jackpots.y + J.top + (panelH - chrome - stackH) / 2;

    L.jpRows = [];
    for (let i = 0; i < n; i++) {
        L.jpRows.push({ x: barX, y: startY + i * (rh + j.gap), w: barW, h: rh });
    }

    /* ---- right column: payout ------------------------------------------- */
    const payTop = L.jackpots.y + L.jackpots.h + l.payoutGap;
    L.payout = { x: l.colR.x, y: payTop, w: l.colR.w, h: j.bottom - payTop };

    const P = UI.assets.slots.payout;
    const total = GAME.payoutTable.length;
    const leftN = Math.ceil(total / 2);
    const inX = L.payout.x + P.insetX;
    const inW = L.payout.w - P.insetX * 2;
    const colW = (inW - 16) / 2;

    /* Tarjetas del numero directo (una por modalidad) arriba de la tabla. */
    const dirN = (GAME.payoutDirecto || []).length;
    const dirH = dirN ? 104 : 0;
    const dirY = L.payout.y + P.top + 4;
    const dirW = dirN ? (inW - 16 * (dirN - 1)) / dirN : 0;
    L.payDirecto = (GAME.payoutDirecto || []).map((e, i) => ({ x: inX + i * (dirW + 16), y: dirY, w: dirW, h: dirH }));

    const pTop = dirN ? dirY + dirH + 10 : L.payout.y + P.top;
    const pBot = L.payout.y + L.payout.h - P.bottom;
    const maxRows = Math.max(leftN, total - leftN, 1);
    const rowH = Math.min(52, (pBot - pTop) / maxRows);
    const payY = pTop + ((pBot - pTop) - rowH * maxRows) / 2;

    L.payCols = [
        { x: inX, y: payY, w: colW, rowH: rowH, from: 0, to: leftN },
        { x: inX + colW + 16, y: payY, w: colW, rowH: rowH, from: leftN, to: total }
    ];

    /* ---- bottom row ------------------------------------------------------ */
    L.recent = { x: l.recent.x, y: l.bottomY, w: l.recent.w, h: l.recent.w / R.recent };
    const ljH = l.lastJp.w / R.lastJp;
    L.lastJp = {
        x: l.lastJp.x,
        y: l.bottomY + (L.recent.h - ljH) / 2,
        w: l.lastJp.w,
        h: ljH
    };
    // Aliases kept so the rest of the module and the API read the same names.
    L.history = L.recent;

    const RC = UI.assets.slots.recent;
    const count = Math.max(1, UI.data.historyShown);
    const innerX = L.recent.x + L.recent.w * RC.inset;
    const innerW = L.recent.w * (1 - RC.inset * 2);
    const pitch = innerW / count;
    L.chip = {
        count: count,
        pitch: pitch,
        innerX: innerX,
        innerW: innerW,
        r: Math.min(L.recent.h * 0.30, pitch * 0.46),
        x0: innerX + pitch / 2,
        cy: L.recent.y + L.recent.h * RC.cy,
        badgeY: L.recent.y + L.recent.h * RC.badge
    };

    /* ---- cache rectangles ------------------------------------------------ */
    L.chromeTop    = { x: 700, y: 14,  w: 1220, h: 786 };
    L.chromeBottom = { x: 6,   y: 786, w: 1910, h: 240 };
    L.dataRect     = {
        x: L.stats.x - 8,
        y: L.stats.y - 8,
        w: L.stats.w + 16,
        h: (UI.sections.hotCold ? L.hotcold.y + L.hotcold.h : L.stats.y + L.stats.h) - L.stats.y + 16
    };
}

function hcSlots(box) {
    const s = UI.assets.slots.hotcold;
    const out = [];
    for (let i = 0; i < 6; i++) {
        out.push({
            cx: box.x + box.w * (s.c0 + i * s.pitch),
            cy: box.y + box.h * s.cy,
            rx: box.w * s.rx,
            ry: box.h * s.ry
        });
    }
    return out;
}

/* Field columns of the ÚLTIMO JACKPOT panel, from the artwork's dividers. */
function lastJpColumns() {
    const s = UI.assets.slots.lastJp;
    const edges = [s.x0].concat(s.div, [s.x1]);
    const labels = ['Tipo:', 'Ticket:', 'Monto:', 'Fecha:'];
    const out = [];
    for (let i = 0; i < labels.length; i++) {
        const c = slot(L.lastJp, edges[i], s.y0, edges[i + 1], s.y1);
        c.label = labels[i];
        out.push(c);
    }
    return out;
}


/* =========================================================================
   6. CACHED CHROME
   The shells and every label that does not change are drawn once into
   offscreen surfaces. A normal frame then costs three drawImage calls for
   all of that.
   ========================================================================= */

const Chrome = {

    top: null, bottom: null, data: null,
    topTint: null, bottomTint: null,
    dirty: true, dataDirty: true,

    ensure() {
        if (this.dirty) { this.build(); this.dirty = false; this.dataDirty = true; }
        if (this.dataDirty) { this.buildData(); this.dataDirty = false; }
    },

    invalidate()     { this.dirty = true; },
    invalidateData() { this.dataDirty = true; },

    /* Surfaces are reused: the data cache is rebuilt once per round, and
       allocating a fresh canvas each time would hand the GC a few thousand
       full-size bitmaps over a night of running. */
    surfaceFor(rect, existing) {
        const w = Math.ceil(rect.w), h = Math.ceil(rect.h);
        let c, g;
        if (existing && existing.canvas.width === w && existing.canvas.height === h) {
            c = existing.canvas;
            g = existing.ctx;
            g.setTransform(1, 0, 0, 1, 0, 0);
            g.clearRect(0, 0, w, h);
        } else {
            c = document.createElement('canvas');
            c.width = w; c.height = h;
            g = c.getContext('2d');
        }
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.translate(-rect.x, -rect.y);
        g.imageSmoothingQuality = 'high';
        return { canvas: c, ctx: g, rect: rect };
    },

    build() {
        this.top    = this.surfaceFor(L.chromeTop, this.top);
        this.bottom = this.surfaceFor(L.chromeBottom, this.bottom);

        const t = this.top.ctx;
        t.textBaseline = 'alphabetic';
        this.drawRoundTimer(t);
        this.drawStats(t);
        if (UI.sections.hotCold) this.drawHotCold(t);
        this.drawJackpots(t);
        this.drawPayout(t);

        const b = this.bottom.ctx;
        b.textBaseline = 'alphabetic';
        this.drawLastJackpot(b);
        this.drawRecentBackground(b);



        /* Blue-tinted copies of everything just composed, for the storm
           reaction. Same idea as app.js buildTints(): multiply by blue, then
           restore the source alpha, so luminance survives and only the lit
           parts of the artwork answer the flash. */
        this.topTint    = tintCanvas(this.top.canvas);
        this.bottomTint = tintCanvas(this.bottom.canvas);
    },

    buildData() {
        this.data = this.surfaceFor(L.dataRect, this.data);
        const g = this.data.ctx;
        g.textBaseline = 'alphabetic';
        Live.drawStatValues(g);
        if (UI.sections.hotCold) Live.drawHotColdValues(g);
    },

    title(ctx, text, x, y, align) {
        ctx.font = '600 23px ' + UI.font.display;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = UI.color.gold;
        tracked(ctx, text, x, y + 0.5, 2.4, align);
        ctx.restore();
        ctx.fillStyle = UI.color.goldLight;
        tracked(ctx, text, x, y, 2.4, align);
    },

    /* ---- RONDA + PRÓXIMO SORTEO EN --------------------------------------- */
    drawRoundTimer(ctx) {
        const p = L.topFrame;
        drawAsset(ctx, 'panel_round_timer', p.x, p.y, p.w, p.h);

        ctx.fillStyle = UI.color.textDim;
        ctx.font = '600 19px ' + UI.font.display;
        tracked(ctx, 'RONDA', L.round.x + L.round.w / 2, L.round.y + L.round.h * 0.33, 2.2, 'center');
        tracked(ctx, 'PRÓXIMO SORTEO EN', L.timer.x + L.timer.w / 2, L.timer.y + L.timer.h * 0.33, 1.8, 'center');
    },

    /* ---- ESTADÍSTICAS: shell plus the fixed cell labels ------------------ */
    drawStats(ctx) {
        const p = L.stats;
        drawAsset(ctx, 'panel_statistics', p.x, p.y, p.w, p.h);

        this.title(ctx, 'ESTADÍSTICAS', p.x + p.w * 0.05,
                   p.y + p.h * UI.assets.slots.stats.title, 'left');

        for (const row of L.statRows) {
            for (const cell of row.cells) {
                const fill = cell.def.fill;
                ctx.fillStyle = fill ? UI.color[fill + 'Label'] : UI.color.textDim;
                ctx.textAlign = 'center';
                fitFont(ctx, cell.def.label, cell.w - 18, 20, '600', UI.font.display);
                ctx.fillText(cell.def.label, cell.x + cell.w / 2, cell.y + cell.h * 0.42);
            }
        }
        ctx.textAlign = 'left';
    },

    /* ---- HOT / COLD strips ------------------------------------------------ */
    drawHotCold(ctx) {
        drawAsset(ctx, 'hot',  L.hotBox.x,  L.hotBox.y,  L.hotBox.w,  L.hotBox.h);
        drawAsset(ctx, 'cold', L.coldBox.x, L.coldBox.y, L.coldBox.w, L.coldBox.h);
    },

    /* ---- JACKPOTS: frame, bars and the heading --------------------------- */
    drawJackpots(ctx) {
        const p = L.jackpots;
        nineSlice(ctx, 'panel_jackpots', p.x, p.y, p.w, p.h);
        this.title(ctx, 'JACKPOTS', p.x + p.w / 2, p.y + UI.assets.slots.jackpots.titleY, 'center');

        /* The bar surfaces are static between layout changes, so they are
           baked here; only the name and the amount stay live. */
        for (let i = 0; i < L.jpRows.length && i < GAME.levels.length; i++) {
            const r = L.jpRows[i];
            const th = themeOf(GAME.levels[i], i);
            drawAsset(ctx, th.asset, r.x, r.y, r.w, r.h);
        }
    },

    /* ---- TABLA DE PAGOS: frame plus the rows ----------------------------- */
    drawPayout(ctx) {
        const p = L.payout;
        nineSlice(ctx, 'panel_payout', p.x, p.y, p.w, p.h);
        this.title(ctx, 'TABLA DE PAGOS', p.x + p.w / 2, p.y + UI.assets.slots.payout.titleY, 'center');

        /* Numero directo: una tarjeta por modalidad del ticket. */
        (GAME.payoutDirecto || []).forEach((e, i) => {
            const r = L.payDirecto && L.payDirecto[i];
            if (!r) return;

            rr(ctx, r.x, r.y, r.w, r.h, 12);
            ctx.fillStyle = e.destacado ? 'rgba(240, 180, 69, 0.10)' : 'rgba(92, 200, 255, 0.07)';
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = e.destacado ? 'rgba(255, 217, 138, 0.75)' : 'rgba(92, 200, 255, 0.45)';
            ctx.stroke();

            const cx = r.x + r.w / 2;
            ctx.textAlign = 'center';

            ctx.fillStyle = e.destacado ? UI.color.goldLight : UI.color.text;
            fitFont(ctx, e.title, r.w - 20, 16, '700', UI.font.body);
            ctx.fillText(e.title, cx, r.y + 26);

            ctx.fillStyle = UI.color.goldLight;
            fitFont(ctx, e.value, r.w - 20, 34, '700', UI.font.display);
            ctx.fillText(e.value, cx, r.y + 66);

            ctx.fillStyle = e.destacado ? UI.color.gold : UI.color.textDim;
            fitFont(ctx, e.note, r.w - 18, 13, '600', UI.font.body);
            ctx.fillText(e.note, cx, r.y + 91);
        });

        /* Text only: the artwork has no cells, and drawing boxes here would
           turn a broadcast panel back into an HTML table. */
        for (const col of L.payCols) {
            for (let i = col.from; i < col.to; i++) {
                const e = GAME.payoutTable[i];
                const y = col.y + (i - col.from) * col.rowH + col.rowH * 0.66;

                ctx.textAlign = 'right';
                ctx.fillStyle = UI.color.goldLight;
                ctx.font = '600 17px ' + UI.font.body;
                const vw = ctx.measureText(e.value).width;
                ctx.fillText(e.value, col.x + col.w, y);

                ctx.textAlign = 'left';
                ctx.fillStyle = UI.color.textDim;
                fitFont(ctx, e.label, col.w - vw - 14, 17, '500', UI.font.body);
                ctx.fillText(e.label, col.x, y);
            }
        }
        ctx.textAlign = 'left';
    },

    /* ---- ÚLTIMO JACKPOT: shell plus the field labels --------------------- */
    drawLastJackpot(ctx) {
        const p = L.lastJp;
        drawAsset(ctx, 'panel_last_jackpot', p.x, p.y, p.w, p.h);
        this.title(ctx, 'ÚLTIMO JACKPOT', p.x + p.w * 0.045, p.y + p.h * 0.155, 'left');

        const cols = lastJpColumns();
        ctx.font = '500 16px ' + UI.font.body;
        for (const c of cols) {
            ctx.fillStyle = UI.color.textDim;
            ctx.fillText(c.label, c.x + c.w * 0.10, c.y + c.h * 0.34);
        }
    },

    /* ---- ÚLTIMOS NÚMEROS: shell plus the heading ------------------------- */
    drawRecentBackground(ctx) {
        const p = L.recent;

        drawAsset(
            ctx,
            'panel_recent_numbers',
            p.x,
            p.y,
            p.w,
            p.h
        );

        this.title(
            ctx,
            'ÚLTIMOS NÚMEROS',
            p.x + p.w * 0.045,
            p.y + p.h * 0.155,
            'left'
        );
    },
};


/* =========================================================================
   7. LIVE RENDERER — the values, plus moving light
   ========================================================================= */

const Live = {

    grad: { version: -1, shine: null, glint: null },

    /* =====================================================================
       RENDER POR SECCIONES

       Antes esta función recomponía TODA la interfaz en cada tick de GSAP:
       tres drawImage grandes de las superficies cacheadas más todos los
       textos vivos, 60 veces por segundo, aunque no hubiera cambiado un solo
       dato. Ahora:

         drawUI(ctx)  -> capa #ui. Solo redibuja las secciones cuyo contenido
                         cambió, y solo dentro de su rectángulo.
         drawFX(ctx)  -> capa #fx. Solo la luz ambiental, que sí se mueve.

       La geometría, los assets, los textos y las luces son exactamente los
       mismos: lo único que cambia es CUÁNDO y DÓNDE se repintan.
       ===================================================================== */

    /* Contadores para la auditoría de rendimiento. */
    stats: {
        uiFull: 0, light: 0,
        uiBlit: 0,
        round: 0, timer: 0, jackpots: 0, lastJp: 0, recent: 0, chrome: 0
    },

    /* Firma de lo que cada sección tiene pintado ahora mismo. */
    sig: {},

    /* Rectángulos de cada sección, con margen para glows y badges. */
    rects: null,
    rectsVersion: -1,

    buildRects() {
        const pad = (r, m) => ({
            x: Math.floor(r.x - m), y: Math.floor(r.y - m),
            w: Math.ceil(r.w + m * 2), h: Math.ceil(r.h + m * 2)
        });

        /* JACKPOTS no está aquí a propósito: sus importes suben de forma
           continua, así que su firma cambiaría en cada frame y escribir en la
           copia limpia 60 veces por segundo la volvería inútil (además de
           forzar una lectura-tras-escritura del mismo bitmap). Se dibuja
           directamente sobre el lienzo, encima de la copia limpia. */
        this.rects = {
            round:    pad(L.round,  26),
            timer:    pad(L.timer,  26),
            lastJp:   pad(L.lastJp, 20),
            recent:   pad(L.recent, 20)
        };

        this.rectsVersion = UI.version;
    },

    /* Lo que se ve en cada sección, resumido en una cadena barata.
       Si no cambia, no hay nada que repintar. */
    signature(key) {
        switch (key) {

            case 'round':
                return GAME.round + '|' + A.roundFlash.toFixed(2);

            case 'timer':
                return clockText(GAME.countdown) + '|' +
                       A.timerUrgent.toFixed(2) + '|' + (GAME.spinning ? 1 : 0);

            case 'jackpots': {
                let s = A.sweep.toFixed(2);
                for (let i = 0; i < GAME.levels.length; i++) {
                    const lv = GAME.levels[i];
                    s += '|' + money(lv.display) + ',' + lv.name +
                         ',' + (lv.flash || 0).toFixed(2);
                }
                return s;
            }

            case 'lastJp': {
                const j = GAME.lastJackpot || {};
                return [j.type, j.ticket, j.amount, j.place, j.date,
                        A.jpFlash.toFixed(2)].join('|');
            }

            case 'recent': {
                const r = GAME.results;
                let s = r.length + '|' + A.entry.toFixed(2) + '|' +
                        A.multPop.toFixed(2);
                for (let i = 0; i < Math.min(r.length, L.chip.count); i++) {
                    s += '|' + r[i].n + ',' + (r[i].mult || 0);
                }
                return s;
            }
        }
        return '';
    },

    /* Vuelve a pegar el trozo de chrome cacheado que hay bajo un rectángulo,
       para que al limpiar la sección no desaparezca su marco ni sus
       etiquetas fijas. */
    blitChrome(ctx, surface, r) {
        if (!surface) return;

        const s = surface.rect;
        const x0 = Math.max(r.x, s.x), y0 = Math.max(r.y, s.y);
        const x1 = Math.min(r.x + r.w, s.x + s.w);
        const y1 = Math.min(r.y + r.h, s.y + s.h);

        if (x1 <= x0 || y1 <= y0) return;

        ctx.drawImage(surface.canvas,
            x0 - s.x, y0 - s.y, x1 - x0, y1 - y0,
            x0,       y0,       x1 - x0, y1 - y0);
    },

    /* Interfaz compuesta, sin luz.

       Son dos superficies del tamaño exacto de las dos zonas de interfaz, la
       misma idea que ya usaba Chrome. Se componen solo cuando cambia un dato
       y luego se presentan con un drawImage cada una: exactamente el mismo
       número de operaciones que hacía el código anterior, pero sin volver a
       medir ni dibujar un solo texto. */
    cleanTop: null,
    cleanBottom: null,

    ensureClean() {
        if (this.cleanTop && this.cleanVersion === UI.version) return;
        this.cleanTop    = Chrome.surfaceFor(L.chromeTop, this.cleanTop);
        this.cleanBottom = Chrome.surfaceFor(L.chromeBottom, this.cleanBottom);
        this.cleanVersion = UI.version;
        this.stats.uiFull = 0;                 // hay que recomponer
    },

    clearUI(ctx) {
        const t = L.chromeTop, b = L.chromeBottom;
        ctx.clearRect(t.x, t.y, t.w, t.h);
        ctx.clearRect(b.x, b.y, b.w, b.h);
    },

    /* En qué superficie vive cada sección. */
    superficieDe(key) {
        return (key === 'round' || key === 'timer') ? this.cleanTop : this.cleanBottom;
    },

    repintarSeccion(key) {
        const r = this.rects[key];
        const g = this.superficieDe(key).ctx;

        g.save();
        g.beginPath();
        g.rect(r.x, r.y, r.w, r.h);
        g.clip();

        g.clearRect(r.x, r.y, r.w, r.h);

        this.blitChrome(g, Chrome.top,    r);
        this.blitChrome(g, Chrome.data,   r);
        this.blitChrome(g, Chrome.bottom, r);

        g.textBaseline = 'alphabetic';
        g.imageSmoothingQuality = 'high';

        if (key === 'round')  this.drawRound(g);
        if (key === 'timer')  this.drawTimer(g);
        if (key === 'lastJp') this.drawLastJackpot(g);
        if (key === 'recent') this.drawRecent(g);

        g.restore();

        this.stats[key]++;
    },

    /* Repintado completo de la capa de interfaz. Solo ocurre cuando cambia
       el layout, los assets o el contenido cacheado: en régimen normal,
       prácticamente nunca. */
    /* Composición completa de la interfaz. Solo ocurre cuando cambia el
       layout, los assets o el chrome cacheado: en régimen normal, una vez. */
    repintarTodo() {
        /* chromeTop y chromeBottom se solapan unos píxeles en vertical.
           Si las dos superficies pintasen ese solape, al presentarlas una
           encima de otra los píxeles semitransparentes se compondrían dos
           veces y la costura saldría más clara. Cada superficie se recorta a
           su parte: el solape es de la de abajo. */
        const corte = L.chromeBottom.y;

        const surfaces = [
            { s: this.cleanTop,    b: { x: L.chromeTop.x, y: L.chromeTop.y,
                                        w: L.chromeTop.w,
                                        h: Math.min(L.chromeTop.h, corte - L.chromeTop.y) } },
            { s: this.cleanBottom, b: L.chromeBottom }
        ];

        for (let i = 0; i < surfaces.length; i++) {
            const surf = surfaces[i].s;
            const bounds = surfaces[i].b;
            const g = surf.ctx;
            const r = surf.rect;

            g.save();
            g.clearRect(r.x, r.y, r.w, r.h);

            g.beginPath();
            g.rect(bounds.x, bounds.y, bounds.w, bounds.h);
            g.clip();

            g.textBaseline = 'alphabetic';
            g.imageSmoothingQuality = 'high';

            const t = Chrome.top;
            g.drawImage(t.canvas, t.rect.x, t.rect.y);
            const d = Chrome.data;
            g.drawImage(d.canvas, d.rect.x, d.rect.y);
            const b = Chrome.bottom;
            g.drawImage(b.canvas, b.rect.x, b.rect.y);

            this.drawRound(g);
            this.drawTimer(g);
            this.drawLastJackpot(g);
            this.drawRecent(g);

            g.restore();
        }

        this.stats.uiFull++;

        for (const k in this.rects) this.sig[k] = this.signature(k);
    },

    drawUI(ctx) {
        const eraChrome = Chrome.dirty || Chrome.dataDirty;

        this.ensureClean();
        Chrome.ensure();
        this.ensureGradients();

        if (!this.rects || this.rectsVersion !== UI.version) this.buildRects();

        /* --- 1. COMPOSICIÓN -------------------------------------------------
           Esta es la parte cara: assets, 9-slice, medir y dibujar textos,
           gradientes. Antes se ejecutaba entera 60 veces por segundo. Ahora
           solo cuando el contenido de una sección cambia de verdad, y se
           compone en una copia limpia fuera de pantalla. */
        if (eraChrome || this.stats.uiFull === 0) {
            if (eraChrome) this.stats.chrome++;
            this.repintarTodo();
        } else {
            for (const key in this.rects) {
                const s = this.signature(key);
                if (s === this.sig[key]) continue;
                this.sig[key] = s;
                this.repintarSeccion(key);
            }
        }

        /* --- 2. PRESENTACIÓN ------------------------------------------------
           Copiar el bitmap ya compuesto. Dos drawImage, sin volver a medir ni
           dibujar un solo texto. Además deja el lienzo limpio para que la luz
           del frame anterior no se acumule. */
        const t = this.cleanTop, b = this.cleanBottom;
        ctx.drawImage(t.canvas, t.rect.x, t.rect.y);
        ctx.drawImage(b.canvas, b.rect.x, b.rect.y);
        this.stats.uiBlit += 2;

        /* Los importes de los jackpots suben continuamente: se dibujan aquí,
           encima de la copia limpia. Es lo único de los datos que necesita
           los 60 FPS. */
        ctx.save();
        ctx.textBaseline = 'alphabetic';
        this.drawJackpots(ctx);
        ctx.restore();
        this.stats.jackpots++;

        /* --- 3. LUZ ---------------------------------------------------------
           Lo único de la interfaz que se mueve de verdad. Se suma con
           'lighter' sobre el mismo canvas, exactamente igual que antes. */
        ctx.save();
        ctx.textBaseline = 'alphabetic';
        /* drawLight (reflejos de paneles, glints, shines, sweeps, reacción
           al rayo, wash de estadísticas) ya no se llama: el movimiento
           ambiental lo pone storm_bg.mp4, no el canvas. */
        ctx.restore();

        this.stats.light++;
    },

    ensureGradients() {
        const g = this.grad;
        if (g.version === UI.version) return;
        g.version = UI.version;
        const ctx = Chrome.top.ctx;

        const sh = ctx.createLinearGradient(-70, 0, 70, 0);
        sh.addColorStop(0.00, 'rgba(255,255,255,0)');
        sh.addColorStop(0.45, 'rgba(255,255,255,0.20)');
        sh.addColorStop(0.55, 'rgba(255,255,255,0.20)');
        sh.addColorStop(1.00, 'rgba(255,255,255,0)');
        g.shine = sh;

        const gl = ctx.createLinearGradient(0, 0, 260, 0);
        gl.addColorStop(0.0, 'rgba(255,205,130,0)');
        gl.addColorStop(0.5, 'rgba(255,225,170,0.70)');
        gl.addColorStop(1.0, 'rgba(255,205,130,0)');
        g.glint = gl;

        /* Broad environmental reflections, built once at a fixed 400-unit
           width and scaled per panel. Wide and soft on purpose: a narrow
           head reads as a decorative spark, a broad ramp reads as a room
           light travelling over polished metal. */
        const band = (rgb) => {
            const lg = ctx.createLinearGradient(0, 0, 400, 0);
            lg.addColorStop(0.00, 'rgba(' + rgb + ', 0)');
            lg.addColorStop(0.30, 'rgba(' + rgb + ', 0.30)');
            lg.addColorStop(0.50, 'rgba(' + rgb + ', 0.80)');
            lg.addColorStop(0.70, 'rgba(' + rgb + ', 0.30)');
            lg.addColorStop(1.00, 'rgba(' + rgb + ', 0)');
            return lg;
        };
        // The same two colours the roulette rim uses.
        g.bandBlue = band('110, 190, 255');
        g.bandGold = band('255, 186, 96');

        /* Kept only for the data animations: the halo under a landing result
           and its multiplier badge. Not used for ambient light. */
        const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 34);
        rg.addColorStop(0.0, 'rgba(255,242,214,0.95)');
        rg.addColorStop(0.40, 'rgba(255,190,90,0.35)');
        rg.addColorStop(1.0, 'rgba(0,0,0,0)');
        g.sparkGold = rg;

        // Soft vertical band used for the statistics wash.
        const wash = (col) => {
            const lg = ctx.createLinearGradient(0, 0, 0, 120);
            lg.addColorStop(0.0, 'rgba(0,0,0,0)');
            lg.addColorStop(0.5, col);
            lg.addColorStop(1.0, 'rgba(0,0,0,0)');
            return lg;
        };
        g.washGold = wash('rgba(255,214,150,0.22)');

        const hb = ctx.createLinearGradient(0, 0, 150, 0);
        hb.addColorStop(0.0, 'rgba(255,255,255,0)');
        hb.addColorStop(0.5, 'rgba(255,255,255,0.16)');
        hb.addColorStop(1.0, 'rgba(255,255,255,0)');
        g.hcBand = hb;
    },

    drawRound(ctx) {
        const b = L.round;
        const text = String(GAME.round);
        ctx.save();
        ctx.textAlign = 'center';
        const size = fitFont(ctx, text, b.w - 34, Math.round(b.h * 0.46), '700', UI.font.display);
        const y = b.y + b.h * 0.82;
        if (A.roundFlash > 0.01) glowText(ctx, text, b.x + b.w / 2, y, UI.color.accent, 2);
        ctx.font = '700 ' + size + 'px ' + UI.font.display;
        ctx.fillStyle = '#dbeafe';
        ctx.fillText(text, b.x + b.w / 2, y);
        ctx.restore();
    },

    drawTimer(ctx) {
        const b = L.timer;
        const text = clockText(GAME.countdown);
        const urgent = A.timerUrgent;
        ctx.save();
        ctx.textAlign = 'left';
        const size = fitFont(ctx, text, b.w - 96, Math.round(b.h * 0.44), '700', UI.font.display);
        const tw = ctx.measureText(text).width;
        const ir = size * 0.36;
        const gx = b.x + (b.w - (ir * 2 + 14 + tw)) / 2;
        const y = b.y + b.h * 0.82;

        ctx.strokeStyle = urgent > 0.1 ? '#ff8a5c' : UI.color.gold;
        clockIcon(ctx, gx + ir, y - size * 0.33, ir);

        ctx.font = '700 ' + size + 'px ' + UI.font.display;
        ctx.fillStyle = urgent > 0.1
            ? 'rgb(255,' + Math.round(180 - 80 * urgent) + ',' + Math.round(150 - 90 * urgent) + ')'
            : UI.color.text;
        ctx.fillText(text, gx + ir * 2 + 14, y);
        ctx.restore();
    },

    /* ---- jackpot names and amounts, over the baked bar surfaces ---------- */
    drawJackpots(ctx) {
        for (let i = 0; i < L.jpRows.length && i < GAME.levels.length; i++) {
            const r = L.jpRows[i];
            const lv = GAME.levels[i];
            const th = themeOf(lv, i);

            ctx.save();
            ctx.translate(r.x, r.y);

            /* No white diagonal strip here any more: the plate's reflection
               is part of the environmental light pass in drawLight(), so it
               moves with the same sweeps as the wheel's rim. */

            // A local lift when this level's value has just been updated.
            if (lv.pulse > 0.01) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = lv.pulse * 0.22;
                ctx.fillStyle = '#ffe7bd';
                rr(ctx, 0, 0, r.w, r.h, Math.min(10, r.h * 0.22));
                ctx.fill();
                ctx.restore();
            }

            if (lv.flash > 0.01) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = lv.flash * 0.45;
                ctx.fillStyle = '#ffffff';
                rr(ctx, 0, 0, r.w, r.h, Math.min(10, r.h * 0.22));
                ctx.fill();
                ctx.restore();
            }

            const amount = money(lv.display);

            ctx.textAlign = 'right';

            const aSize = fitOdoFont(
                ctx,
                amount,
                r.w * 0.52,
                Math.min(30, r.h * 0.46),
                '700',
                UI.font.display
            );

            const aw = measureOdoText(ctx, amount);
            const base = r.h * 0.5 + aSize * 0.35;

            drawOdometer( ctx, lv, amount, r.w - r.w * 0.045, base, aSize);

            ctx.textAlign = 'left';
            const nameMax = Math.max(30, r.w * 0.9 - aw - 30);
            const nSize = fitFont(ctx, lv.name, nameMax, Math.min(26, r.h * 0.40), '700', UI.font.display);
            engrave(ctx, lv.name, r.w * 0.055, r.h * 0.5 + nSize * 0.35);

            ctx.restore();
        }
    },

    /* ---- statistics percentages (cached; redrawn once per round) --------- */
    drawStatValues(ctx) {
        const s = GAME.stats;
        for (const row of L.statRows) {
            for (const cell of row.cells) {
                const key = cell.def.key;

                const excluyeCero = [
                    'low', 'high',
                    'par', 'impar',
                    'd1', 'd2', 'd3',
                    'c1', 'c2', 'c3'
                ].includes(key);

                const totalEstadistica = excluyeCero
                    ? s.total - s.verde
                    : s.total;

                const text = pct(
                    s[key] || 0,
                    totalEstadistica
                ).toFixed(2) + '%';
                ctx.save();
                ctx.textAlign = 'center';
                const size = fitFont(ctx, text, cell.w - 20, Math.round(cell.h * 0.34), '700', UI.font.display);
                const tint = cell.def.fill ? UI.color[cell.def.fill + 'Value'] : UI.color.text;
                ctx.font = '700 ' + size + 'px ' + UI.font.display;
                const y = cell.y + cell.h * 0.82;
                glowText(ctx, text, cell.x + cell.w / 2, y, tint, 1.2);
                ctx.fillStyle = tint;
                ctx.fillText(text, cell.x + cell.w / 2, y);
                ctx.restore();
            }
        }
    },

    /* ---- hot / cold numbers, into the artwork's own slots ---------------- */
    drawHotColdValues(ctx) {
        this.hcNumbers(ctx, L.hotSlots, GAME.hot);
        this.hcNumbers(ctx, L.coldSlots, GAME.cold);
    },

    hcNumbers(ctx, slots, values) {
        ctx.save();
        ctx.textAlign = 'center';
        for (let i = 0; i < slots.length; i++) {
            const v = values[i];
            if (v === undefined || v === null) continue;
            const s = slots[i];
            const size = fitFont(ctx, String(v), s.rx * 1.5, s.ry * 0.95, '700', UI.font.display);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(String(v), s.cx, s.cy + size * 0.35);
        }
        ctx.restore();
    },

    /* ---- ÚLTIMO JACKPOT values ------------------------------------------- */
    drawLastJackpot(ctx) {
        const p = L.lastJp;
        const lj = GAME.lastJackpot;
        const cols = lastJpColumns();

        if (A.jpFlash > 0.01) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = A.jpFlash * 0.16;
            ctx.fillStyle = UI.color.gold;
            rr(ctx, p.x + p.w * 0.02, p.y + p.h * 0.08, p.w * 0.96, p.h * 0.84, 14);
            ctx.fill();
            ctx.restore();
        }

        /* Sin ganador conocido: guiones, no "**** 0000  $0.00". */
        const sinDato = lj.ticket === undefined || lj.ticket === null || lj.ticket === '';
        const values = sinDato ? [
            { text: '—', color: UI.color.gold },
            { text: '—', color: UI.color.text },
            { text: '—', color: UI.color.text },
            { text: '—', color: UI.color.text }
        ] : [
            { text: String(lj.type || ''), color: UI.color.gold },
            { text: ticketMask(lj.ticket), color: UI.color.text },
            { text: money(lj.amount),      color: UI.color.text },
            { text: String(lj.date || ''), color: UI.color.text }
        ];

        ctx.save();
        ctx.textAlign = 'left';
        for (let i = 0; i < cols.length; i++) {
            const c = cols[i];
            const v = values[i];
            fitFont(ctx, v.text, c.w * 0.80, 22, '700', UI.font.display);
            ctx.fillStyle = v.color;
            ctx.fillText(v.text, c.x + c.w * 0.10, c.y + c.h * 0.80);
        }

        /* Lugar rides on the heading line: the artwork gives this panel four
           columns and there is no fifth slot, but plenty of free width next
           to the title — and place names are the longest free text here. */
        const last = cols[cols.length - 1];
        ctx.textAlign = 'right';
        ctx.font = '500 16px ' + UI.font.body;
        ctx.fillStyle = UI.color.textDim;
        const ly = p.y + p.h * 0.185;
        const rx = last.x + last.w;
        ctx.font = '600 18px ' + UI.font.display;
        ctx.fillStyle = UI.color.text;
        const place = ellipsize(ctx, String(lj.place || ''), p.w * 0.42);
        ctx.fillText(place, rx, ly);
        const pw = ctx.measureText(place).width;
        ctx.font = '500 16px ' + UI.font.body;
        ctx.fillStyle = UI.color.textDim;
        ctx.fillText('Lugar:', rx - pw - 8, ly);
        ctx.restore();
    },

    /* ---- ÚLTIMOS NÚMEROS -------------------------------------------------- */
    drawRecent(ctx) {
        const chip = L.chip;
        const r = chip.r;
        const list = GAME.results;
        const strike = (api.state && api.state.lightning) || 0;

        ctx.save();
        ctx.textAlign = 'center';

        /* El carril está dimensionado para chip.count bolas. Cuando llegan
           menos, la fila se queda pegada a la izquierda con un hueco enorme a
           la derecha, así que se centra en el carril. */
        const visibles = Math.min(list.length, chip.count);
        const centrado = (chip.count - visibles) * chip.pitch / 2;

        for (let i = 0; i < chip.count; i++) {
            const res = list[i];
            if (!res) break;

            let x = chip.x0 + centrado + i * chip.pitch;
            let alpha = 1;
            let scale = 1;

            // The newest ball slides in and the strip shifts along with it.
            if (A.entry > 0.001) {
                x -= A.entry * chip.pitch;
                if (i === 0) {
                    alpha = 1 - A.entry;
                    scale = 0.72 + 0.28 * (1 - A.entry);
                }
            }
            if (x < chip.x0 + centrado - chip.pitch * 0.6) continue;

            const key = res.color === 'rojo' ? 'ball_red'
                      : res.color === 'verde' ? 'ball_green' : 'ball_black';
            const d = r * 2 * scale;

            drawAsset(ctx, key, x - d / 2, chip.cy - d / 2, d, d, alpha);

            // The balls are the glossiest thing down here, so they catch it.
            if (strike > 0.01 && UIA.tint[key]) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = alpha * strike * UI.fx.lightningBall;
                ctx.drawImage(UIA.tint[key], x - d / 2, chip.cy - d / 2, d, d);
                ctx.restore();
            }

            /* The freshest result settles in: a ring that expands and fades,
               plus a short halo under the ball. Only ever on index 0. */
            if (i === 0 && A.entry > 0.001) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = A.entry * 0.28;
                ctx.fillStyle = this.grad.sparkGold;
                ctx.translate(x, chip.cy);
                ctx.scale(d / 44, d / 44);
                ctx.fillRect(-34, -34, 68, 68);
                ctx.restore();

                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = A.entry * 0.55;
                ctx.strokeStyle = '#ffe6b0';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, chip.cy, d / 2 + 3 + A.entry * 14, 0, TAU);
                ctx.stroke();
                ctx.restore();
            }

            ctx.save();
            ctx.globalAlpha = alpha;
            const label = String(res.n);
            const size = fitFont(ctx, label, d * 0.64, d * 0.46, '700', UI.font.display);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, x, chip.cy + size * 0.35);
            ctx.restore();

            /* The multiplier belongs to this result alone. No multiplier
               means no badge — never inherited, never a banner. */
            if (res.mult) this.drawMultiplier(ctx, x, chip.badgeY, res.mult, alpha, i === 0);
        }

        ctx.restore();
    },

    drawMultiplier(ctx, cx, cy, mult, alpha, newest) {
        const key = multAsset(mult);
        if (!key) return;                    // no approved badge for this value

        const c = UI.assets.content[key];
        const ratio = ((c[2] - c[0]) * UIA.img[key].width) / ((c[3] - c[1]) * UIA.img[key].height);
        let h = L.recent.h * UI.assets.slots.recent.badgeH;

        /* The newest badge eases up to size and brightens once, rather than
           appearing fully formed. Older badges never animate. */
        let a = alpha;
        if (newest) {
            const grow = 1 - Math.min(1, A.entry);
            h *= 0.66 + 0.34 * grow + A.multPop * 0.10;
            a *= 0.25 + 0.75 * grow;
        }
        const w = h * ratio;

        if (newest && A.multPop > 0.01) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = A.multPop * 0.30;
            ctx.fillStyle = this.grad.sparkGold;
            ctx.translate(cx, cy);
            ctx.scale(w / 56, h / 30);
            ctx.fillRect(-34, -34, 68, 68);
            ctx.restore();
        }

        drawAsset(ctx, key, cx - w / 2, cy - h / 2, w, h, a);
    },

    /* ---- environmental light --------------------------------------------
       The UI sits in the roulette's lighting environment rather than running
       a decorative system of its own. STATE.rimSweep and STATE.goldSweep
       (the same values that drive the wheel's rim) move two broad
       reflections across the panel borders; STATE.glow breathes their
       strength; STATE.lightning adds the blue-tinted artwork pass. Nothing
       here is a travelling spark. */
    drawLight(ctx) {
        const st = api.state || {};
        const blue = (st.rimSweep != null ? st.rimSweep : 0) / 360;
        const gold = (st.goldSweep != null ? st.goldSweep : 0) / 360;
        const breath = 0.72 + 0.28 * (st.glow || 0);

        /* No hace falta restaurar nada antes: drawUI acaba de volcar la
           interfaz limpia sobre el lienzo, así que la luz del frame anterior
           ya no está. */

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        // Panel frames: the reflection is clipped to the metal border ring.
        for (let i = 0; i < REFLECT.length; i++) {
            const e = REFLECT[i];
            const p = L[e.key];
            if (!p) continue;

            ctx.save();
            ctx.beginPath();
            rrPath(ctx, p.x - 5, p.y - 5, p.w + 10, p.h + 10, e.r + 5);
            rrPath(ctx, p.x + e.band, p.y + e.band, p.w - e.band * 2, p.h - e.band * 2,
                   Math.max(1, e.r - e.band));
            ctx.clip('evenodd');

            this.sweepBand(ctx, p, blue + e.at, this.grad.bandBlue,
                           UI.fx.reflectBlue * breath * e.k, -0.45);
            // The warm family runs the other way, so they rarely coincide.
            this.sweepBand(ctx, p, -gold + e.at * 0.6, this.grad.bandGold,
                           UI.fx.reflectGold * breath * e.k, 0.38);
            ctx.restore();
        }

        // Jackpot plates: glossy material, so the same reflection crosses it.
        for (let i = 0; i < L.jpRows.length && i < GAME.levels.length; i++) {
            const r = L.jpRows[i];
            ctx.save();
            rr(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, Math.min(10, r.h * 0.22));
            ctx.clip();
            this.sweepBand(ctx, r, blue + i * 0.11, this.grad.bandBlue,
                           UI.fx.reflectBar * breath, -0.5);
            this.sweepBand(ctx, r, -gold + i * 0.07, this.grad.bandGold,
                           UI.fx.reflectBar * 0.8 * breath, 0.42);
            ctx.restore();
        }

        // Hot / cold strips.
        if (UI.sections.hotCold) {
            const strips = [L.hotBox, L.coldBox];
            for (let i = 0; i < strips.length; i++) {
                const b = strips[i];
                ctx.save();
                rr(ctx, b.x + 3, b.y + 3, b.w - 6, b.h - 6, 10);
                ctx.clip();
                this.sweepBand(ctx, b, (i ? blue : -gold) + i * 0.5,
                               i ? this.grad.bandBlue : this.grad.bandGold,
                               UI.fx.reflectStrip * breath, -0.4);
                ctx.restore();
            }
        }

        this.statWash(ctx);
        ctx.restore();

        this.lightningReflection(ctx, st);
    },

    /* One broad band, scaled from a cached 400-unit gradient and slanted so
       it reads as a reflection rather than a wipe. */
    sweepBand(ctx, p, phase, grad, alpha, slant) {
        /* Guard written as a positive test on purpose: `alpha <= 0.004` lets
           NaN through, and canvas silently ignores an invalid globalAlpha and
           keeps the previous one — which paints the reflection at full
           strength. A missing config value should draw nothing, not
           everything. */
        if (!(alpha > 0.004)) return;
        const t = ((phase % 1) + 1) % 1;
        /* Narrow enough that the border is genuinely dark between passes: a
           band as wide as the panel lights the whole frame at once and reads
           as a permanent glow rather than a reflection travelling over it. */
        const span = Math.min(420, Math.max(170, p.w * 0.34));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x - span + t * (p.w + span * 2), p.y);
        ctx.transform(1, 0, slant, 1, 0, 0);
        ctx.scale(span / 400, 1);
        ctx.fillStyle = grad;
        ctx.fillRect(0, -p.h, 400, p.h * 3);
        ctx.restore();
    },

    /* A single wash falling down the statistics panel when the round's
       percentages have just been recomputed. */
    statWash(ctx) {
        if (A.statPulse <= 0.01) return;
        const p = L.stats;
        const k = 1 - A.statPulse;
        ctx.save();
        rr(ctx, p.x + 6, p.y + 6, p.w - 12, p.h - 12, 14);
        ctx.clip();
        ctx.translate(p.x, p.y - 120 + k * (p.h + 120));
        ctx.globalAlpha = Math.sin(A.statPulse * Math.PI) * 0.85;
        ctx.fillStyle = this.grad.washGold;
        ctx.fillRect(0, 0, p.w, 120);
        ctx.restore();
    },

    /* Storm reaction, built the way app.js builds the wheel's: blue-tinted
       copies of the artwork, prepared once, added back over the original
       while STATE.lightning is high. Because the tint is a multiply that
       keeps the source luminance, bright metal edges pick the flash up
       strongly and dark surfaces stay dark. */
    lightningReflection(ctx, st) {
        const k = st.lightning || 0;
        if (k <= 0.01) return;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = k * UI.fx.lightningTint;
        if (Chrome.topTint) ctx.drawImage(Chrome.topTint, L.chromeTop.x, L.chromeTop.y);
        if (Chrome.bottomTint) ctx.drawImage(Chrome.bottomTint, L.chromeBottom.x, L.chromeBottom.y);
        ctx.restore();
    }
};

/* Which panels catch the environmental reflection, how wide their metal
   border is, and a phase offset so they never all light at once. `k` scales
   a panel's response: the small strips need less. */
const REFLECT = [
    { key: 'topFrame', r: 16, band: 16, at: 0.00, k: 1.00 },
    { key: 'stats',    r: 18, band: 18, at: 0.13, k: 0.95 },
    { key: 'jackpots', r: 18, band: 18, at: 0.26, k: 1.00 },
    { key: 'payout',   r: 18, band: 18, at: 0.39, k: 0.95 },
    { key: 'lastJp',   r: 16, band: 15, at: 0.52, k: 1.00 },
    { key: 'recent',   r: 16, band: 15, at: 0.65, k: 1.00 },
    { key: 'hotBox',   r: 11, band: 10, at: 0.78, k: 0.75 },
    { key: 'coldBox',  r: 11, band: 10, at: 0.90, k: 0.75 }
];

/* Only the final four digits of a ticket are ever shown. */
function ticketMask(t) {
    const s = String(t == null ? '' : t).replace(/\s+/g, '');
    return '**** ' + (s.length > 4 ? s.slice(-4) : s);
}

/* =========================================================================
   9. DEMO FEED
   Everything in this section exists only so the screen has something to
   show. Delete it once a real backend calls StormUI.api.* — the renderer
   above reads GAME and nothing else.
   ========================================================================= */

const gs = () => window.gsap;

/* -------------------------------------------------------------------------
   MODO ESTÁTICO

   Esta pantalla ya no tiene un ticker permanente: en reposo no genera ni un
   frame. Por eso ninguna mutación de datos puede crear tweens de GSAP —
   crear una tween despierta el ticker y lo dejaría corriendo.

   Los valores de animación (A.roundFlash, A.entry, lv.flash...) se quedan
   por tanto a 0: el dato se aplica de golpe y se pide UN frame.
   ------------------------------------------------------------------------- */
function repintar() {
    if (api.requestRender) api.requestRender();
}

/* Se pone a true en cuanto el visor integrado alimenta esta pantalla con
   datos reales. A partir de ahí el giro ambiental de la ruleta es PURAMENTE
   VISUAL: no toca ronda, resultados, estadísticas ni jackpots.

   El modo demo aislado (abrir index.html sin visor) sigue funcionando igual
   que siempre, porque ahí nadie llama a estas APIs. */
/* Dentro del visor integrado (index_roulette.html) los datos llegan SOLO
   del feed: no se generan resultados ni último jackpot de demostración.
   Antes se veían 60 números aleatorios hasta la primera sincronización. */
const INTEGRADO = (() => {
    /* frameElement existe desde el primer instante; RouletteDB del padre
       todavía no, porque sus <script> van al final del <body>. */
    try { return !!(window.frameElement && window.frameElement.id === 'view-table'); }
    catch (_) { return window.parent !== window; }
})();

let FEED = INTEGRADO;

const DEMO_LEVELS = [
    { key: 'MEGA',  name: 'MEGA',  icon: 'crown', theme: 'gold',   amount: 351162.36, rate: 4.10 },
    { key: 'GRAND', name: 'GRAND', icon: 'gem',   theme: 'amber',  amount: 156368.00, rate: 2.35 },
    { key: 'MAJOR', name: 'MAJOR', icon: 'star',  theme: 'blue',   amount:  11326.22, rate: 0.55 },
    { key: 'MINOR', name: 'MINOR', icon: 'spade', theme: 'red',    amount:  26125.65, rate: 0.95 },
    { key: 'MINI',  name: 'MINI',  icon: 'club',  theme: 'silver', amount:   3235.35, rate: 0.22 },
    { key: 'STORM', name: 'STORM', icon: 'pip',   theme: 'purple', amount:  74210.00, rate: 1.40 }
];

const Demo = {

    init() {
        applyLevels(DEMO_LEVELS.slice(0, 5));

        if (INTEGRADO) {
            /* Los niveles de demostración solo existen para que el visor
               sepa que la pantalla arrancó. El primer setJackpots() real
               los sustituye DE GOLPE (sin contar desde el monto demo). */
            GAME.levelsDemo = true;

            /* Sin números inventados: la tira, las estadísticas y el último
               jackpot quedan vacíos hasta que el visor los entregue. */
            GAME.results = [];
            GAME.lastJackpot = { type: '', ticket: '', amount: null, date: '', place: '' };
            GAME.recompute();
            rebuild();
            return;
        }

        for (let i = 0; i < 60; i++) {
            const n = WHEEL[Math.floor(Math.random() * WHEEL.length)];
            GAME.results.push({
                n: n,
                color: GAME.colorOf(n),
                mult: Math.random() < UI.data.multiplierChance ? pickMult() : 0
            });
        }
        GAME.lastJackpot = {
            type: 'MEGA', ticket: '99204827', amount: 312450,
            date: todayString(), place: 'Naco'
        };
        GAME.recompute();

        rebuild();

        /* startAnimations() y growJackpots() ya no existen.

           growJackpots subía los importes con una tween encadenada por
           delayedCall que no terminaba nunca: mantenía el ticker despierto
           y cambiaba el importe 30-60 veces por segundo. Los jackpots
           reales llegan del backend por setJackpots(). */
    },

    onSpinStart() {
        GAME.spinning = true;

        /* Giro ambiental: no es un sorteo. */
        if (FEED) { repintar(); return; }

        setRound(GAME.round + 1);
    },

    /* The result is read from the rotor angle, so the strip always agrees
       with the wheel. A real feed would call api.pushResult instead. */
    onSpinEnd(angleDeg) {
        GAME.spinning = false;

        /* Giro ambiental: solo cambió STATE.rotorAngle. Ni número ganador,
           ni multiplicadores, ni jackpots, ni estadísticas. */
        if (FEED) { repintar(); return; }

        const n = numberAtTop(angleDeg);
        const mult = Math.random() < UI.data.multiplierChance ? pickMult() : 0;
        pushResult(n, mult);

        if (Math.random() < UI.data.jackpotWinChance) {
            registerJackpotWin(GAME.levels[Math.floor(Math.random() * GAME.levels.length)].key);
        }
    },

    tick() {
        if (GAME.countdownSource === 'host') {
            GAME.countdown = api.getCountdown ? api.getCountdown() : 0;
        } else {
            GAME.countdown = Math.max(0, GAME.feedCountdown - (performance.now() - GAME.feedAt) / 1000);
        }
        const urgent = !GAME.spinning && GAME.countdown <= 5 && GAME.countdown > 0;
        A.timerUrgent = urgent ? (0.5 + 0.5 * Math.sin(GAME.countdown * Math.PI * 2)) : 0;
    }
};

function pickMult() {
    const v = UI.data.multiplierValues;
    return v[Math.floor(Math.random() * v.length)];
}

/* Which pocket sits under 12 o'clock after the rotor has turned angleDeg. */
function numberAtTop(angleDeg) {
    const step = 360 / WHEEL.length;
    const k = Math.round((((-angleDeg / step) % WHEEL.length) + WHEEL.length)) % WHEEL.length;
    return WHEEL[k];
}


/* =========================================================================
   10. MUTATIONS — the one place data enters, used by both the demo feed and
   the public API. Each invalidates only what it actually changed.
   ========================================================================= */

function rebuild() {
    layout();
    UI.version++;
    Chrome.invalidate();
}

/* =========================================================================
   CONTADOR PROGRESIVO DE JACKPOTS

   El importe sube poco a poco hasta el objetivo que manda el backend. No
   inventa dinero: solo interpola entre lo que ya se mostraba y el target.

   Un SOLO temporizador para todos los niveles, a baja frecuencia. No usa
   gsap.to, gsap.delayedCall ni gsap.ticker: despertar el ticker de TABLE
   sería justo lo que se quiere evitar. Cada actualización pide un frame
   suelto por la vía event-driven que ya existe.
   ========================================================================= */

const JackpotCounter = {

    
    /* >>> Único sitio donde se ajusta <<< */
    cfg: {
        duration: 210000,   // ms de referencia para llegar al objetivo
        interval:    90,   // ms de referencia entre pasos visibles
        rollDuration: 70,  // ms de rodada de cada dígito
        rollFps:      30,   // tope de FPS mientras ruedan los dígitos
        resolution:   60,   // ms del reloj interno (no pinta si nada cambia)

        /* Cada nivel tiene su propio ritmo, para que no suban
           coordinados:
             dur  -> fracción de `duration`. Todas quedan por encima de los
                     180 s de una ronda, así el contador nunca se detiene
                     antes de que llegue el objetivo siguiente.
             paso -> fracción de `interval`.
           Además cada paso lleva una variación de ±30 % (determinista, no
           aleatoria), y cada nivel arranca con un desfase distinto. */
        perfiles: [
            { dur: 0.80, paso: 0.80 },   // 1º (MEGA)   192 s, ~560 ms
            { dur: 0.88, paso: 1.06 },   // 2º (MAYOR)  211 s, ~740 ms
            { dur: 0.84, paso: 0.93 },   // 3º (MENOR)  202 s, ~650 ms
            { dur: 0.93, paso: 1.19 },   // 4º (MINI)   223 s, ~830 ms
            { dur: 0.86, paso: 1.00 },
            { dur: 0.90, paso: 0.87 }
        ],
        variacion: 0.30
    },

    /* Pseudoaleatorio determinista en [0, 1): mismo nivel y mismo paso dan
       siempre el mismo valor. Solo decide el RITMO visual, nunca un monto. */
    ruido(a, b) {
        const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
        return x - Math.floor(x);
    },

    perfil(lv) {
        const lista = this.cfg.perfiles;
        return lista[(lv._idx || 0) % lista.length];
    },

    /* Cuándo le toca al nivel su siguiente paso visible. */
    programarPaso(lv, now, inicial) {
        const base = this.cfg.interval * this.perfil(lv).paso;
        lv._paso = (lv._paso || 0) + 1;
        const r = this.ruido(lv._idx + 1, lv._paso);
        lv._next = inicial
            ? now + base * (0.15 + 0.85 * r)                          // desfase de arranque
            : now + base * (1 - this.cfg.variacion + 2 * this.cfg.variacion * r);
    },

    timer:   null,
    visible: true,          // TABLE en pantalla

    rollFrame: null,
    rollUntil: 0,

    startRolling(until) {
        this.rollUntil = Math.max(this.rollUntil, until);

        if (!this.visible || this.rollFrame) return;

        const frame = (ts) => {
            this.rollFrame = null;

            if (!this.visible) return;

            /* Como los niveles ya no ruedan a la vez, casi siempre hay alguno
               rodando: se limita a rollFps para no disparar el consumo. */
            if (!this._lastRoll || ts - this._lastRoll >= 1000 / this.cfg.rollFps - 2) {
                this._lastRoll = ts;
                repintar();
            }

            if (performance.now() < this.rollUntil) {
                this.rollFrame = requestAnimationFrame(frame);
            } else {
                this.rollUntil = 0;
            }
        };

        this.rollFrame = requestAnimationFrame(frame);
    },

    stopRolling() {
        if (this.rollFrame) {
            cancelAnimationFrame(this.rollFrame);
        }

        this.rollFrame = null;
        this.rollUntil = 0;
    },


    easeOutQuad(t) { return t * (2 - t); },

    /* Fija el objetivo de un nivel.

       - primera carga o importe menor (jackpot ganado y reiniciado):
         se aplica de golpe, sin contar hacia atrás;
       - importe mayor: arranca desde lo que se está mostrando ahora, así
         un target nuevo a mitad de camino no produce ningún salto. */
    setTarget(lv, target, instant) {
        const t = Number(target) || 0;

        if (instant || t <= lv.display) {
            lv._odo = null;
            lv.amount  = t;
            lv.display = t;
            lv._from   = null;
            lv._t0     = null;
            return;
        }

        /* Mismo objetivo que ya se está persiguiendo (las sincronizaciones
           repiten el importe): se sigue la curva en curso, sin reiniciarla. */
        if (lv._t0 != null && t === lv.amount) {
            this.start();
            return;
        }

        const now = performance.now();
        lv._from = lv.display;
        lv._t0   = now;
        lv._dur  = this.cfg.duration * this.perfil(lv).dur;
        lv.amount = t;
        this.programarPaso(lv, now, true);

        this.start();
    },

    /* Avanza SOLO los niveles a los que les toca paso. Cada nivel va a su
       ritmo; si ninguno cambió, no se pide ningún frame.
       todos = true -> ponerse al día de golpe (al volver a pantalla). */
    tick(todos) {
        const now = performance.now();
        let quedan = false;
        let cambio = false;

        /* Nunca dos niveles en la misma vuelta del reloj: si coinciden, solo
           avanza el que lleva más tiempo esperando; el resto, en la vuelta
           siguiente (60 ms después). */
        let elegido = null;
        if (!todos) {
            for (let i = 0; i < GAME.levels.length; i++) {
                const lv = GAME.levels[i];
                if (lv._t0 == null || now < lv._next) continue;
                if (!elegido || lv._next < elegido._next) elegido = lv;
            }
        }

        for (let i = 0; i < GAME.levels.length; i++) {
            const lv = GAME.levels[i];
            if (lv._t0 == null) continue;

            if (!todos && lv !== elegido) { quedan = true; continue; }

            const p = Math.min((now - lv._t0) / lv._dur, 1);

            if (p >= 1) {
                lv.display = lv.amount;        // exacto, sin arrastre decimal
                lv._t0 = null;
                lv._from = null;
            } else {
                lv.display = lv._from + this.easeOutQuad(p) * (lv.amount - lv._from);
                this.programarPaso(lv, now, false);
                quedan = true;
            }
            cambio = true;
        }

        if (cambio) repintar();                 // un frame y a dormir

        if (!quedan) this.stop();
    },

    pendientes() {
        for (let i = 0; i < GAME.levels.length; i++) {
            if (GAME.levels[i]._t0 != null) return true;
        }
        return false;
    },

    start() {
        if (this.timer || !this.visible) return;
        if (!this.pendientes()) return;
        this.timer = setInterval(() => JackpotCounter.tick(false), this.cfg.resolution);
    },

    stop() {
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
    },

    /* TABLE oculta: cero actualizaciones visuales. El progreso NO se pierde:
       _t0 sigue ahí, así que al volver se calcula el valor que toca a partir
       del tiempo transcurrido y se sigue desde ese punto. */
    setVisible(on) {
        this.visible = !!on;

        if (!this.visible) {
            this.stop();
            this.stopRolling();
            return;
        }

        if (this.pendientes()) {
            this.tick(true);    // ponerse al día de una vez
            this.start();
        }
    }
};


/*
 * En la primera carga real no existe todavía un importe anterior del JSON
 * desde el cual interpolar. Este umbral crea únicamente el punto visual de
 * partida; el objetivo final continúa siendo exactamente el amount del JSON.
 *
 * 0.995 = comienza 0.5 % por debajo del objetivo.
 */
const JACKPOT_START_RATIO = 0.995;

function valorInicialJackpot(amount) {
    const objetivo = Number(amount) || 0;

    if (objetivo <= 0) return 0;

    return objetivo * JACKPOT_START_RATIO;
}

function applyLevels(list) {
    /* El primer feed real llega después de los niveles demo. No se debe
       interpolar desde los importes inventados del demo; se usa un umbral
       calculado desde el objetivo real que llegó del JSON. */
    const primerFeedReal = GAME.levelsDemo === true;
    const previos = primerFeedReal ? [] : (GAME.levels || []);

    GAME.levels = list.slice(0, 6).map((d, i) => {
        const amt = Number(d.amount != null ? d.amount : d.seed) || 0;
        const key = d.key || d.name || ('L' + i);

        /* Si el nivel ya existía se conserva lo que se está mostrando, para
           que una actualización del backend no reinicie el contador. */
        const antes = previos.find(l => l.key === key);

        const lv = {
            key:     key,
            name:    d.name || d.key || ('NIVEL ' + (i + 1)),
            icon:    d.icon || ICON_ORDER[i % ICON_ORDER.length],
            theme:   d.theme || THEME_ORDER[i % THEME_ORDER.length],
            rate:    d.rate || 1,
            amount:  amt,
            display:
                primerFeedReal && !antes
                    ? valorInicialJackpot(amt)
                    : antes
                        ? antes.display
                        : amt,
            flash:   0,
            pulse:   0,
            _from:   null,
            _t0:     null,
            _odo: null,
            _idx:    i,
            _dur:    JackpotCounter.cfg.duration
        };

        /* Un nivel que ya existía conserva su curva en curso: si el backend
           repite el mismo objetivo, el contador sigue sin reiniciarse. */
        if (antes && antes._t0 != null) {
            lv.amount = antes.amount;
            lv._from  = antes._from;
            lv._t0    = antes._t0;
            lv._dur   = antes._dur;
            lv._next  = antes._next;
            lv._paso  = antes._paso;
            lv._odo   = antes._odo;
        }

        /* Primera carga real: comienza desde el umbral visual y sube hasta
           el importe real del JSON. Los niveles nuevos que aparezcan después
           sí se muestran instantáneamente porque no tienen valor anterior. */
        const animarDesdeUmbral =
            primerFeedReal &&
            !antes &&
            lv.display < amt;

        JackpotCounter.setTarget(
            lv,
            amt,
            !animarDesdeUmbral && !antes
        );

        return lv;
    });

    /* setTarget() se ejecuta dentro del map(), cuando GAME.levels todavía
       apunta al array anterior, así que el arranque del temporizador se pide
       aquí, ya con los niveles nuevos en su sitio. Sin esto la primera
       actualización no llegaba a interpolar nunca. */
    JackpotCounter.start();

    rebuild();
}

function setRound(n) {
    GAME.round = n;
    A.roundFlash = 0;
    repintar();
}

function pushResult(n, mult) {
    GAME.results.unshift({ n: n, color: GAME.colorOf(n), mult: mult || 0 });
    if (GAME.results.length > UI.data.statsWindow) GAME.results.length = UI.data.statsWindow;
    GAME.recompute();
    Chrome.invalidateData();          // one cache rebuild per round, not per frame

    A.statPulse = 0;
    A.entry = 0;
    A.multPop = 0;
    repintar();
}

function registerJackpotWin(key, info) {
    const lv = GAME.levels.find(l => l.key === key);
    if (!lv) return;

    GAME.lastJackpot = {
        type:   (info && info.type)   || lv.name,
        ticket: (info && info.ticket) || randomTicket(),
        amount: (info && info.amount) != null ? info.amount : lv.amount,
        date:   (info && info.date)   || todayString(),
        place:  (info && info.place)  || GAME.lastJackpot.place
    };

    lv.flash = 0;
    A.jpFlash = 0;

    lv.amount = lv.amount * 0.06 + 500;
    lv.display = lv.amount;
    repintar();
}

/* A short local lift on one jackpot plate when its value changes. */
function pulseLevel(lv) {
    if (!lv) return;
    lv.pulse = 0;               // sin pulso: la pantalla es estática
}

function randomTicket() {
    return String(Math.floor(10000000 + Math.random() * 89999999));
}

function todayString() {
    const d = new Date();
    const p = v => (v < 10 ? '0' : '') + v;
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
}


/* =========================================================================
   11. PUBLIC API + DEMO KEYS
   ========================================================================= */

const api = { state: null, config: null, getCountdown: null, requestRender: null };

window.StormUI = {

    init(hostApi) {
        api.state = hostApi.state;
        api.config = hostApi.config;
        api.getCountdown = hostApi.getCountdown;
        api.requestRender = hostApi.requestRender;
        UIA.load();
        Demo.init();
        bindKeys();
    },

    /* Capa de interfaz: solo repinta lo que cambió. */
    drawUI(ctx) {
        Demo.tick();
        Live.drawUI(ctx);
    },

    /* Compatibilidad con el punto de entrada anterior. */
    draw(ctx) {
        Demo.tick();
        Live.drawUI(ctx);
    },

    /* TABLE entra o sale de pantalla. Con TABLE oculta el contador de
       jackpots deja de generar actualizaciones; al volver se pone al día
       con el tiempo transcurrido y sigue. */
    setVisible(on) { JackpotCounter.setVisible(on); },

    /* Configuración del contador de jackpots (duration / interval). */
    get jackpotCounter() { return JackpotCounter.cfg; },

    /* Limpia las dos zonas de interfaz. app.js la llama ANTES de dibujar la
       ruleta, para conservar el mismo orden de composición de siempre:
       primero se limpia, luego se pinta la ruleta y encima la interfaz. */
    clearUI(ctx) { Live.clearUI(ctx); },

    /* Obliga a recomponer la capa de interfaz entera en el próximo frame.
       Lo usa app.js cuando un rayo obliga a limpiar el canvas completo. */
    forceFullRepaint() { Live.stats.uiFull = 0; },

    /* Contadores de repintado, para la auditoría de rendimiento. */
    get renderStats() { return Live.stats; },

    resetRenderStats() {
        const s = Live.stats;
        for (const k in s) s[k] = 0;
    },

    onSpinStart() { Demo.onSpinStart(); },
    onSpinEnd(angle) { Demo.onSpinEnd(angle); },

    /* ---------------------------------------------------------------------
       FEED HOOKS — everything a backend needs. Nothing here rebuilds the
       screen unless the geometry actually changed.

         StormUI.api.setRound(482)
         StormUI.api.setRemainingTime(105)
         StormUI.api.setJackpots([{ key:'MEGA', name:'MEGA', amount:351162.36 }, ...])
         StormUI.api.setJackpotAmount('MEGA', 351999.10)
         StormUI.api.setStatistics({ rojo: 47, negro: 49, ... }, 100)
         StormUI.api.setHotCold([32,15,19,4,21,2], [26,3,35,12,28,7])
         StormUI.api.setPayoutTable([{ label:'DIRECTO', value:'27 a 1' }, ...])
         StormUI.api.pushResult(23, 100)      // multiplier optional
         StormUI.api.setResults([{ n:23, multiplier:100 }, { n:26 }, ...])
         StormUI.api.setLastJackpot({ type, ticket, amount, date, place })
       --------------------------------------------------------------------- */
    api: {

        setRound(n) { FEED = true; setRound(n); },

        /* Seconds until the next draw. Switches the timer off the host clock. */
        setRemainingTime(seconds) {
            FEED = true;
            GAME.countdownSource = 'feed';
            GAME.feedCountdown = Math.max(0, Number(seconds) || 0);
            GAME.feedAt = performance.now();

            /* Un mensaje del socket = una actualización visual. Si el
               segundo mostrado no cambia, drawUI no repinta nada. */
            repintar();
        },
        useHostTimer() { GAME.countdownSource = 'host'; },

        /* levels: [{ key, name, icon, theme, amount, rate }] — 1 to 6.
           The panel re-flows and the chrome cache rebuilds itself. */
        setJackpots(list) {
            FEED = true;
            applyLevels(list);
            GAME.levelsDemo = false;
            repintar();
        },

        setJackpotAmount(key, amount) {
            const lv = GAME.levels.find(l => l.key === key);
            if (!lv) return;
            JackpotCounter.setTarget(lv, amount, false);
            repintar();
        },

        /* Counts or percentages, whatever `total` implies. Stops deriving
           them from the result strip. */
        setStatistics(stats, total) {
            GAME.derived.stats = false;
            Object.assign(GAME.stats, stats);
            if (total != null) GAME.stats.total = total;
            Chrome.invalidateData();
            repintar();                     // pedir el frame que lo muestra
        },
        deriveStatistics() { GAME.derived.stats = true; GAME.recompute(); Chrome.invalidateData(); },

        setHotCold(hot, cold) {
            GAME.derived.hotcold = false;
            GAME.hot = (hot || []).slice(0, 6);
            GAME.cold = (cold || []).slice(0, 6);
            Chrome.invalidateData();
            repintar();
        },
        deriveHotCold() { GAME.derived.hotcold = true; GAME.recompute(); Chrome.invalidateData(); },

        setPayoutTable(list) {
            GAME.payoutTable = list.slice();
            rebuild();
        },

        /* One result. mult is null / 0 / omitted when there was none. */
        pushResult(n, mult) { pushResult(n, mult || 0); },

        /* Replace the whole strip, newest first. */
        setResults(list) {
            FEED = true;
            GAME.results = list.map(r => ({
                n: r.n,
                color: GAME.colorOf(r.n),
                mult: r.multiplier || r.mult || 0
            }));
            GAME.recompute();
            Chrome.invalidateData();
            repintar();
        },

        /* { type, ticket, amount, date, place } — only the last four ticket
           digits are ever rendered. */
        setLastJackpot(info) {
            FEED = true;
            Object.assign(GAME.lastJackpot, info);
            A.jpFlash = 0;
            repintar();
        },

        registerJackpotWin(key, info) { registerJackpotWin(key, info); },

        showHotCold(on) {
            UI.sections.hotCold = !!on;
            rebuild();
        },

        get data() { return GAME; }
    }
};

/* Demo keys. Deliberately avoids every key app.js already uses
   (SPACE, D, G, C, 1/2/3, arrows, +/-, [ ], , . and Esc). */
function bindKeys() {
    window.addEventListener('keydown', e => {
        switch (e.code) {
            case 'KeyJ': {                       // cycle 1..6 jackpot levels
                const n = (GAME.levels.length % 6) + 1;
                applyLevels(DEMO_LEVELS.slice(0, n));
                break;
            }
            case 'KeyH':                         // result without a multiplier
                pushResult(WHEEL[Math.floor(Math.random() * WHEEL.length)], 0);
                break;
            case 'KeyM':                         // result carrying a multiplier
                pushResult(WHEEL[Math.floor(Math.random() * WHEEL.length)], pickMult());
                break;
            case 'KeyK':                         // fire a jackpot win
                registerJackpotWin(GAME.levels[Math.floor(Math.random() * GAME.levels.length)].key);
                break;
            case 'KeyT':                         // toggle the HOT/COLD strip
                UI.sections.hotCold = !UI.sections.hotCold;
                rebuild();
                break;
        }
    });
}

})();
