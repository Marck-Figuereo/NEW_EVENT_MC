////////////////////////////////////////////////////////////
// CANVAS - construccion de las dos paginas del bingo
//
//   'game'     sorteo: bombo, 60 casillas, jackpot, ultimo jackpot, tablero de
//              mejores cartones, tabla de premios, popups de ganadores.
//   'results'  SORTEOS: jackpot actual, hora, conteo, sorteos pasados,
//              proximos sorteos, sorteos especiales y ultimo jackpot.
////////////////////////////////////////////////////////////
var stage;
var canvasW = 0;

/* Colores de textos que dependen del diseño (TEMA se define en loader.js). Sacados de la
   maqueta de cada diseño: DEMP/arte.png lleva el conteo y el jackpot en dorado palido. */
const COLOR_TEMA = {
	DEMP: { conteo: '#f1d99b', jackpot: '#f1d99b' },
	CS:   { conteo: '#04ff00ca', jackpot: '#ffffffe0' }
};
function colorTema(clave) { return (COLOR_TEMA[typeof TEMA !== 'undefined' ? TEMA : 'DEMP'] || COLOR_TEMA.DEMP)[clave]; }
var canvasH = 0;

let jackpotAnimationFrame = null;
let jackpotRunning = false;
let jackpotMostrado = 0;          // ultimo monto pintado en la pantalla de SORTEOS

$.balls = {};
$.draw = {};

var safeZoneGuide = false;

var canvasContainer, gameContainer, resultScreenContainer, optionsContainer, infoContainer;
var popupContainer;
var popupTextNums = [];

var guideline, bg, transitionOverlay;
var drawDrumContainer, drawNumbersContainer, drawDrumBallsContainer, drawDrumBallContainer, drawContainer;
var itmDrum, itmDrumGlass, itmDrumGlassBonus, itmDrumHole, itemBgDrum, itemTime, itemJackpotInfo, itemJackpotResult, itemCardboard, itemTable;
var timeValueTxt, jkActualTxt, cuatroInfoTxt, lineaInfoTxt, dobleInfoTxt, bingoInfoTxt;
var txtJkTk, txtJkMt, txtJkMnt, txtJkDt;
var cartonInfoTexts = [];         // [{lugar, ticket, faltan}] x 12

var itemPopup = null;
var popupOverlay = null;
var popupTextID = null;
var popupTextAgencia = null;
var popupTextJK = null;

// Textos vivos de la pantalla de SORTEOS
var txtJk = null, txtTimeActual = null, txtCount = null;
var relojActual = { hora: '', conteo: '' };


function initGameCanvas(w, h) {
	const gameCanvas = document.getElementById("gameCanvas");
	gameCanvas.width = w;
	gameCanvas.height = h;

	canvasW = w;
	canvasH = h;
	stage = new createjs.Stage("gameCanvas", { antialias: false });

	createjs.Touch.disable(stage);
	stage.enableMouseOver(0);
	stage.mouseMoveOutside = false;

	createjs.Ticker.timingMode = createjs.Ticker.RAF_SYNCHED;
	createjs.Ticker.framerate = 60;
	createjs.Ticker.addEventListener("tick", tick);
}


/* La fuente bebas no trae tildes ni Ñ: un texto del panel como "DÍA DE LAS MADRES"
   saldria con letras de otra fuente. Se quitan los acentos antes de pintar. */
function sinAcentos(texto) {
	return String(texto == null ? '' : texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function nuevoTexto(font, color, align, baseline, text) {
	const t = new createjs.Text();
	t.font = font;
	t.color = color;
	t.textAlign = align || 'left';
	t.textBaseline = baseline || 'top';
	t.text = sinAcentos(text);
	return t;
}

/* Esquina superior izquierda de un bitmap centrado (para colocar textos sobre el PNG). */
function origen(bmp) {
	const b = bmp.getBounds();
	return { x: bmp.x - ((b.width * bmp.scaleX) / 2), y: bmp.y - ((b.height * bmp.scaleY) / 2) };
}


//////////////////////// PANTALLA DE SORTEOS ////////////////////////
//
// SORTEOS = jackpot actual, hora, conteo al proximo sorteo, sorteos anteriores,
// proximos sorteos, sorteos especiales y ultimo jackpot. El arte (PNG) trae las
// etiquetas y las tarjetas; aqui solo se escriben los datos en sus huecos.
//
// Movimiento (solo lo que explica un cambio de estado):
//   - Al volver de un sorteo el tablero AVANZA: cada tarjeta cambia su dato en cascada de
//     arriba hacia abajo (sale el viejo, entra el nuevo) y la tarjeta del sorteo recien
//     jugado se ilumina en dorado y se apaga. No se desplaza texto entre tarjetas: las
//     etiquetas vienen pintadas en el arte y el texto pasaria por encima de ellas.
//   - Primera vez o datos que cambian (p. ej. un especial nuevo del panel): fundido corto.
//   - El sorteo en venta (fila 1 de PROXIMOS) va en dorado; el conteo se pone dorado en
//     el ultimo minuto.
// Con "reducir movimiento" del sistema solo hay fundidos, sin desplazamiento.

const MOV_REDUCIDO = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

const DORADO = '#f2c356';
const BLANCO = '#ffffffdc';
const TENUE = '#ffffff73';          // guion de "sin dato" (contraste > 4.5:1 sobre el fondo oscuro)
const SIN_DATO = '—';

let programacionMostrada = null;    // ultimos datos pintados (para saber que cambio)
let ultimoCambio = null;            // diagnostico: que animo la ultima vez (BingoScreen.ultimoCambio)

/* El canvas de SORTEOS solo se redibuja cuando hace falta: mientras dura una animacion
   se pide redibujar cada cuadro hasta este instante (lo lee tick() en game.js). */
var renderHasta = 0;
function animarDurante(ms) {
	renderHasta = Math.max(renderHasta, performance.now() + ms / Math.max(0.1, TweenMax.globalTimeScale()));
	requestRender();
}

/* Numero de sorteo para las listas. Si es largo no cabe en su hueco: se muestran los
   ultimos 3 digitos, como en los ultimos sorteos de los demas juegos del visor. */
function numeroCorto(n) {
	const s = String(n == null ? '' : n);
	return s.length > 5 ? s.slice(-3) : s;
}

/* Texto con DIGITOS DE ANCHO FIJO. La fuente bebas tiene digitos de distinto ancho y un
   reloj o un conteo que cambia cada segundo "baila"; asi los numeros quedan quietos. */
const anchoDigito = {};
function medirDigito(font) {
	if (anchoDigito[font] == null) {
		let max = 0;
		for (let d = 0; d <= 9; d++) max = Math.max(max, new createjs.Text(String(d), font).getMeasuredWidth());
		anchoDigito[font] = max;
	}
	return anchoDigito[font];
}

function crearTabular(font, color, maxWidth, proporcional) {
	const c = new createjs.Container();
	c.font = font;
	c.color = color;
	c.maxWidth = maxWidth || 0;
	c.valor = null;

	c.setText = function (texto) {
		texto = sinAcentos(texto);
		if (texto === this.valor) return;
		this.valor = texto;
		this.removeAllChildren();

		if (proporcional) {
			// Un solo texto (la hora cambia una vez por minuto: no hace falta ancho fijo)
			const t = new createjs.Text(texto, this.font, this.color);
			t.textBaseline = 'alphabetic';
			this.addChild(t);
			const w = t.getMeasuredWidth();
			this.scaleX = this.maxWidth && w > this.maxWidth ? this.maxWidth / w : 1;
			return;
		}

		const wd = medirDigito(this.font);
		let x = 0;
		for (const ch of texto) {
			const t = new createjs.Text(ch, this.font, this.color);
			t.textBaseline = 'alphabetic';
			if (ch >= '0' && ch <= '9') { t.textAlign = 'center'; t.x = x + wd / 2; x += wd; }
			else { t.x = x; x += t.getMeasuredWidth(); }
			this.addChild(t);
		}
		this.scaleX = this.maxWidth && x > this.maxWidth ? this.maxWidth / x : 1;
	};

	c.setColor = function (color) {
		if (color === this.color) return;
		this.color = color;
		this.children.forEach(t => { t.color = color; });
	};

	return c;
}

/* Texto normal dentro de un hueco del arte: nunca se sale (se comprime si no cabe). */
function textoEnHueco(font, color, align, texto, x, y, maxWidth) {
	const vacio = texto == null || texto === '';
	const t = nuevoTexto(font, vacio ? TENUE : color, align, 'alphabetic', vacio ? SIN_DATO : texto);
	t.x = x;
	t.y = y;
	if (maxWidth) t.maxWidth = maxWidth;
	return t;
}

const monto = v => (v == null || v === '' || !isFinite(Number(v))) ? '' : currency(v);


//////////////////////// JACKPOT ANIMADO, HORA Y CONTEO ////////////////////////

const aumento_jack = (num_inicio, num_fn, duration) => {

	detener_aumento_jack();

	num_inicio = Number(num_inicio) || 0;
	num_fn = Number(num_fn) || 0;
	duration = duration || 10000;

	let startTime = performance.now();
	jackpotRunning = true;

	const easeOutQuad = t => t * (2 - t);

	function updateCount(timestamp) {
		if (!jackpotRunning || !txtJk) return;

		const progress = Math.min((timestamp - startTime) / duration, 1);
		const currentNumber = num_inicio + easeOutQuad(progress) * (num_fn - num_inicio);

		jackpotMostrado = currentNumber;
		txtJk.setText(currency(currentNumber.toFixed(2)));
		requestRender();

		if (progress < 1) {
			jackpotAnimationFrame = requestAnimationFrame(updateCount);
		} else {
			jackpotRunning = false;
			jackpotAnimationFrame = null;
		}
	}

	jackpotAnimationFrame = requestAnimationFrame(updateCount);
};

const detener_aumento_jack = () => {
	jackpotRunning = false;
	if (jackpotAnimationFrame !== null) {
		cancelAnimationFrame(jackpotAnimationFrame);
		jackpotAnimationFrame = null;
	}
};

function actualizarJackpotProgramacion(monto) {
	monto = Number(monto);
	if (!isFinite(monto) || !txtJk) return;
	// Un jackpot nunca se ve bajar en pantalla (ver buildResultScreen)
	aumento_jack(jackpotMostrado > 0 && jackpotMostrado <= monto ? jackpotMostrado : monto * 0.9, monto, 3000);
}

/* "hh:mm:ss" -> segundos (null si no hay dato) */
function segundosDe(conteo) {
	const p = String(conteo || '').split(':').map(Number);
	return p.length === 3 && p.every(isFinite) ? p[0] * 3600 + p[1] * 60 + p[2] : null;
}

function actualizarRelojProgramacion(reloj) {
	if (reloj.hora != null) relojActual.hora = reloj.hora;
	if (reloj.conteo != null) relojActual.conteo = reloj.conteo;

	if (txtTimeActual) txtTimeActual.setText(relojActual.hora || SIN_DATO);
	if (txtCount) {
		const seg = segundosDe(relojActual.conteo);
		txtCount.setText(seg == null ? '--:--:--' : relojActual.conteo);
		// Ultimo minuto de venta: el conteo pasa a dorado
		txtCount.setColor(seg == null ? TENUE : (seg > 0 && seg <= 60 ? DORADO : BLANCO));
	}
	requestRender();
}


//////////////////////// FILAS DE CADA LISTA ////////////////////////

// Posiciones medidas sobre el arte (unidades del canvas, desde la esquina del PNG)
const ANT = { paso: 117, base: 98,
	numero: 100, finNumero: 228, hora: 254, finHora: 479,
	izq1: 79, izq2: 110, finIzq: 244, der: 316, finDer: 479 };
const PROX = { paso: 112, base: 132, numero: 121, anchoNumero: 64, fecha: 239, anchoFecha: 140, hora: 389, anchoHora: 126 };

/* Una tarjeta de SORTEOS ANTERIORES (d = null: tarjeta sin datos). */
function filaAnterior(o, i, d) {
	const fila = new createjs.Container();
	const y = o.y + ANT.base + i * ANT.paso;
	const v = d || {};

	fila.addChild(
		textoEnHueco("25px bebasregular", BLANCO, 'left', d ? '# ' + numeroCorto(v.sorteo) : '', o.x + ANT.numero, y, ANT.finNumero - ANT.numero),
		textoEnHueco("25px bebasregular", BLANCO, 'left', v.hora, o.x + ANT.hora, y, ANT.finHora - ANT.hora),
		// El arte dice "Linea:" y "Doble Linea:" a la izquierda, "Cuatro:" y "Bingo:" a la derecha
		textoEnHueco("20px bebasregular", BLANCO, 'left', monto(v.linea), o.x + ANT.izq1, y + 35, ANT.finIzq - ANT.izq1),
		textoEnHueco("20px bebasregular", BLANCO, 'left', monto(v.doble_linea), o.x + ANT.izq2, y + 65, ANT.finIzq - ANT.izq2),
		textoEnHueco("20px bebasregular", BLANCO, 'left', monto(v.cuatro), o.x + ANT.der, y + 35, ANT.finDer - ANT.der),
		textoEnHueco("20px bebasregular", BLANCO, 'left', monto(v.bingo), o.x + ANT.der, y + 65, ANT.finDer - ANT.der)
	);
	return fila;
}

/* Una fila de PROXIMOS SORTEOS: numero | fecha | hora, centrados entre los separadores del arte.
   La fila 1 es el sorteo en venta: va en dorado. */
function filaProxima(o, i, d) {
	const fila = new createjs.Container();
	const y = o.y + PROX.base + i * PROX.paso;
	const v = d || {};
	const color = i === 0 ? DORADO : BLANCO;

	fila.addChild(
		textoEnHueco("30px bebasregular", color, 'center', d ? numeroCorto(v.sorteo) : '', o.x + PROX.numero, y, PROX.anchoNumero),
		textoEnHueco("30px bebasregular", color, 'center', v.fecha, o.x + PROX.fecha, y, PROX.anchoFecha),
		textoEnHueco("30px bebasregular", color, 'center', v.hora, o.x + PROX.hora, y, PROX.anchoHora)
	);
	return fila;
}

/* Una tarjeta de SORTEOS ESPECIALES (las crea el panel de administracion). */
function tarjetaEspecial(i, esp) {
	const fila = new createjs.Container();

	var item = new createjs.Bitmap(loader.getResult('itemDrawSpecial'));
	centerReg(item);
	item.x = canvasW * 0.82;
	item.y = [canvasH * 0.31, canvasH * 0.523, canvasH * 0.735][i];
	item.scaleX = item.scaleY = .24;

	const o = origen(item);
	const titulo = nuevoTexto("30px bebasregular", "#dca342", "left", "top", esp.titulo);
	titulo.maxWidth = 300;

	const dato = (texto, x, y, ancho) => Object.assign(
		nuevoTexto("20px bebasregular", texto ? BLANCO : TENUE, "left", "top", texto || SIN_DATO), { x: x, y: y, maxWidth: ancho });

	fila.addChild(item,
		Object.assign(titulo, { x: o.x + 150, y: o.y + 20 }),
		dato(esp.fecha, o.x + 180, o.y + 60, 98),
		dato(esp.hora, o.x + 315, o.y + 60, 130),
		dato(monto(esp.cuatro), o.x + 105, o.y + 117, 125),
		dato(monto(esp.linea), o.x + 320, o.y + 117, 135),
		dato(monto(esp.doble_linea), o.x + 135, o.y + 147, 120),
		dato(monto(esp.bingo), o.x + 320, o.y + 147, 135)
	);
	return fila;
}


//////////////////////// MOVIMIENTO ////////////////////////

const EASE = () => Power3.easeOut;

function entrar(obj, retraso, dy) {
	obj.alpha = 0;
	const fin = obj.y;
	if (!MOV_REDUCIDO && dy) obj.y = fin + dy;
	TweenMax.to(obj, 0.3, { alpha: 1, y: fin, delay: retraso || 0, ease: EASE(), onUpdate: requestRender });
}

function salir(obj, retraso) {
	TweenMax.to(obj, 0.15, { alpha: 0, delay: retraso || 0, ease: Power2.easeIn, onUpdate: requestRender,
		onComplete: () => { if (obj.parent) obj.parent.removeChild(obj); } });
}

/* Cambio de dato en una tarjeta: sale el viejo y entra el nuevo en el mismo sitio. */
function cambiar(viejo, nuevo, retraso) {
	if (viejo) { resultScreenContainer.addChild(viejo); salir(viejo, retraso); }
	entrar(nuevo, retraso + (viejo ? 0.15 : 0), MOV_REDUCIDO ? 0 : -6);
}

/* Baño dorado sobre la tarjeta del sorteo recien jugado: se enciende y se apaga. */
function brillo(x, y, w, h, retraso) {
	const s = new createjs.Shape();
	s.graphics.beginFill(DORADO).drawRoundRect(x, y, w, h, 14);
	s.alpha = 0;
	s.compositeOperation = 'lighter';
	resultScreenContainer.addChild(s);
	TweenMax.to(s, 0.35, { alpha: 0.16, delay: retraso, ease: EASE(), onUpdate: requestRender });
	TweenMax.to(s, 1.4, { alpha: 0, delay: retraso + 0.6, ease: Power2.easeInOut, onUpdate: requestRender,
		onComplete: () => { if (s.parent) s.parent.removeChild(s); } });
	animarDurante((retraso + 2.1) * 1000);
}

const mismo = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);
const claveDe = l => (l && l[0] && l[0].sorteo != null) ? String(l[0].sorteo) : null;


//////////////////////// ARMADO DE LA PANTALLA ////////////////////////

function buildResultScreen(resultsData) {

	detener_aumento_jack();
	resultScreenContainer.removeAllChildren();

	const datos = resultsData || {};
	const previo = programacionMostrada;
	programacionMostrada = resultsData ? JSON.parse(JSON.stringify(resultsData)) : null;

	var logo = new createjs.Bitmap(loader.getResult('logo'));
	centerReg(logo);
	logo.x = canvasW / 100 * 13; logo.y = canvasH / 100 * 7;
	logo.scaleX = logo.scaleY = .15;

	var itemJk = new createjs.Bitmap(loader.getResult('itemJk'));
	centerReg(itemJk);
	itemJk.x = canvasW / 100 * 64; itemJk.y = canvasH / 100 * 7;
	itemJk.scaleX = itemJk.scaleY = .11;

	var TimeR = new createjs.Bitmap(loader.getResult('TimeR'));
	centerReg(TimeR);
	TimeR.x = canvasW / 100 * 78; TimeR.y = canvasH / 100 * 7;
	TimeR.scaleX = TimeR.scaleY = .11;

	var countTime = new createjs.Bitmap(loader.getResult('countTime'));
	centerReg(countTime);
	countTime.x = canvasW / 100 * 91; countTime.y = canvasH / 100 * 7;
	countTime.scaleX = countTime.scaleY = .11;

	var previousDraw = new createjs.Bitmap(loader.getResult('previousDraw'));
	centerReg(previousDraw);
	previousDraw.x = canvasW / 100 * 18; previousDraw.y = canvasH / 100 * 50;
	previousDraw.scaleX = 0.45; previousDraw.scaleY = .483;

	var nextDraw = new createjs.Bitmap(loader.getResult('nextDraw'));
	centerReg(nextDraw);
	nextDraw.x = canvasW / 100 * 50; nextDraw.y = canvasH / 100 * 50;
	nextDraw.scaleX = nextDraw.scaleY = .45;

	var specialDraw = new createjs.Bitmap(loader.getResult('specialDraw'));
	centerReg(specialDraw);
	specialDraw.x = canvasW / 100 * 82; specialDraw.y = canvasH / 100 * 49.7;
	specialDraw.scaleX = specialDraw.scaleY = .472;

	var itemJkInfoResult = new createjs.Bitmap(loader.getResult('itemJkInfoResult'));
	centerReg(itemJkInfoResult);
	itemJkInfoResult.x = canvasW / 100 * 50; itemJkInfoResult.y = canvasH / 100 * 93;
	itemJkInfoResult.scaleX = .73; itemJkInfoResult.scaleY = .6;

	resultScreenContainer.addChild(countTime, TimeR, itemJk, previousDraw, nextDraw, specialDraw, itemJkInfoResult, logo);

	// ---------- SORTEOS ANTERIORES ----------
	const oa = origen(previousDraw);
	const anteriores = (datos.anteriores || []).slice(0, 5);
	const prevAnt = previo ? (previo.anteriores || []) : null;
	// Avanza si el que estaba primero ahora es el segundo (entro el sorteo recien jugado)
	const avanzaAnt = prevAnt && anteriores.length && claveDe(prevAnt) !== null &&
		claveDe(anteriores) !== claveDe(prevAnt) && anteriores[1] && String(anteriores[1].sorteo) === claveDe(prevAnt);
	const cambiaAnt = !prevAnt || !mismo(prevAnt.slice(0, 5), anteriores);

	for (let i = 0; i < 5; i++) {
		const fila = filaAnterior(oa, i, anteriores[i] || null);
		resultScreenContainer.addChild(fila);
		if (avanzaAnt) cambiar(filaAnterior(oa, i, prevAnt[i] || null), fila, i * 0.07);
		else if (cambiaAnt) entrar(fila, i * 0.05, MOV_REDUCIDO ? 0 : 8);
	}
	ultimoCambio = { avanzaAnteriores: !!avanzaAnt, cuando: Date.now() };
	// Tarjeta del sorteo recien jugado (medida sobre el arte)
	if (avanzaAnt) brillo(oa.x + 24, oa.y + 67, 466, 108, 0.15);

	// ---------- PROXIMOS SORTEOS ----------
	const on = origen(nextDraw);
	const proximos = (datos.proximos || []).slice(0, 5);
	const prevProx = previo ? (previo.proximos || []) : null;
	// Avanza si el que era segundo ahora es el primero (el primero ya se jugo)
	const avanzaProx = prevProx && prevProx[1] && proximos.length && String(proximos[0].sorteo) === String(prevProx[1].sorteo);
	const cambiaProx = !prevProx || !mismo(prevProx.slice(0, 5), proximos);

	for (let i = 0; i < 5; i++) {
		const fila = filaProxima(on, i, proximos[i] || null);
		resultScreenContainer.addChild(fila);
		if (avanzaProx) cambiar(filaProxima(on, i, prevProx[i] || null), fila, 0.1 + i * 0.07);
		else if (cambiaProx) entrar(fila, i * 0.05, MOV_REDUCIDO ? 0 : 8);
	}
	ultimoCambio.avanzaProximos = !!avanzaProx;

	// ---------- SORTEOS ESPECIALES ----------
	const especiales = (datos.especiales || []).slice(0, 3);
	const cambiaEsp = !previo || !mismo((previo.especiales || []).slice(0, 3), especiales);

	especiales.forEach((esp, i) => {
		const tarjeta = tarjetaEspecial(i, esp);
		resultScreenContainer.addChild(tarjeta);
		if (cambiaEsp) entrar(tarjeta, i * 0.08, MOV_REDUCIDO ? 0 : 10);
	});
	if (especiales.length === 0) {
		var vacio = new createjs.Bitmap(loader.getResult('notDrawSpecial'));
		centerReg(vacio);
		vacio.x = canvasW * 0.82;
		vacio.y = canvasH * 0.52;
		vacio.scaleX = vacio.scaleY = .48;
		resultScreenContainer.addChild(vacio);
		if (cambiaEsp && previo) entrar(vacio, 0, 0);
	}

	// ---------- ULTIMO JACKPOT ----------
	// Un valor a la derecha de cada icono del arte: [valor, inicio y fin del hueco en fraccion del PNG]
	const ult = datos.ultimo_jackpot || {};
	const oj = origen(itemJkInfoResult);
	const ancho = itemJkInfoResult.getBounds().width * itemJkInfoResult.scaleX;
	const filaUlt = new createjs.Container();
	[[ult.ticket, 0.285, 0.375], [monto(ult.monto), 0.445, 0.575], [ult.lugar, 0.635, 0.800], [ult.fecha, 0.875, 0.985]].forEach(c => {
		filaUlt.addChild(textoEnHueco("30px bebasregular", BLANCO, 'left', c[0], oj.x + ancho * c[1], oj.y + 50, ancho * (c[2] - c[1])));
	});
	resultScreenContainer.addChild(filaUlt);
	if (!previo || !mismo(previo.ultimo_jackpot, datos.ultimo_jackpot)) entrar(filaUlt, 0.2, 0);

	// ---------- JACKPOT, HORA Y CONTEO ----------
	txtJk = crearTabular("38px bebasregular", BLANCO, 140);
	txtJk.x = canvasW / 100 * 61;
	txtJk.y = canvasH / 100 * 10;

	txtTimeActual = crearTabular("38px bebasregular", BLANCO, 120, true);
	txtTimeActual.x = canvasW / 100 * 75.5;
	txtTimeActual.y = canvasH / 100 * 10;

	txtCount = crearTabular("38px bebasregular", BLANCO, 150);
	txtCount.x = canvasW / 100 * 88;
	txtCount.y = canvasH / 100 * 10;

	resultScreenContainer.addChild(txtJk, txtTimeActual, txtCount);
	actualizarRelojProgramacion({});

	const jackpot = resultsData && datos.jackpot != null && isFinite(Number(datos.jackpot)) ? Number(datos.jackpot) : null;
	if (jackpot != null) {
		// El contador sigue subiendo desde lo ultimo mostrado. Si el monto nuevo es menor (se gano
		// y volvio a la base) no se le ve bajar: arranca un 10% abajo de la base y sube.
		const desde = jackpotMostrado > 0 && jackpotMostrado <= jackpot ? jackpotMostrado : jackpot * 0.9;
		txtJk.setText(currency(desde));
		aumento_jack(desde, jackpot, 10000);
	} else {
		txtJk.setText(SIN_DATO);
		txtJk.setColor(TENUE);
	}

	animarDurante(1200);
}

/* Datos nuevos mientras la pantalla ya esta en SORTEOS (refresco periodico):
   si nada cambio no se toca nada; si cambio, se reconstruye y solo se anima lo distinto. */
function refrescarProgramacion(datos) {
	if (!datos) return false;
	const sinJackpot = d => Object.assign({}, d, { jackpot: null });
	if (programacionMostrada && mismo(sinJackpot(programacionMostrada), sinJackpot(datos))) {
		actualizarJackpotProgramacion(datos.jackpot);
		return false;
	}
	buildResultScreen(datos);
	return true;
}


//////////////////////// POPUPS ////////////////////////

function Nums_carton(nums, ticket, local, Popup, JK) {

	popupContainer.visible = true;
	popupContainer.removeAllChildren();

	popupTextJK = null;
	popupTextNums = [];

	itemPopup = new createjs.Bitmap(loader.getResult(Popup));
	centerReg(itemPopup);
	itemPopup.visible = true;
	popupOverlay.visible = true;

	popupContainer.alpha = 0;
	TweenMax.killTweensOf(popupContainer);
	TweenMax.to(popupContainer, 1.5, { alpha: 1 });

	popupTextID = nuevoTexto(JK ? "30px bebasregular" : "15px bebasregular", "#ffffffe0", "center", "alphabetic", ticket);
	popupTextAgencia = nuevoTexto(JK ? "20px bebasregular" : "15px bebasregular", "#ffffffe0", "center", "alphabetic", local);

	if (JK) {
		popupTextJK = nuevoTexto("50px bebasregular", "#f2c356ea", "center", "alphabetic", currency(nums));
	} else {
		(nums || []).forEach(n => popupTextNums.push(nuevoTexto("50px bebasregular", "#ffffffe0", "center", "top", n)));
	}

	popupContainer.addChild(popupOverlay, itemPopup, popupTextID, popupTextAgencia);
	if (popupTextJK) popupContainer.addChild(popupTextJK);
	popupTextNums.forEach(t => popupContainer.addChild(t));
}

//////////////////////// PAGINA DEL SORTEO ////////////////////////

function buildGameCanvas() {
	canvasContainer = new createjs.Container();

	gameContainer = new createjs.Container();
	gameContainer.visible = false;

	optionsContainer = new createjs.Container();
	drawDrumContainer = new createjs.Container();
	drawNumbersContainer = new createjs.Container();
	drawDrumBallsContainer = new createjs.Container();
	drawDrumBallContainer = new createjs.Container();
	drawContainer = new createjs.Container();
	infoContainer = new createjs.Container();
	popupContainer = new createjs.Container();
	popupContainer.visible = false;

	popupOverlay = new createjs.Shape();
	popupOverlay.graphics.beginFill("rgba(0,0,0,0.65)").drawRect(0, 0, canvasW, canvasH);

	transitionOverlay = new createjs.Shape();
	transitionOverlay.graphics.beginFill("#000").drawRect(0, 0, canvasW, canvasH);
	transitionOverlay.alpha = 0;
	transitionOverlay.visible = false;

	resultScreenContainer = new createjs.Container();
	resultScreenContainer.visible = false;

	bg = new createjs.Bitmap(loader.getResult('background'));
	bg.scaleX = canvasW / bg.image.width;
	bg.scaleY = canvasH / bg.image.height;

	// Conteo de bolas
	itemTime = new createjs.Bitmap(loader.getResult('itemTime'));
	centerReg(itemTime);
	itemTime.x = canvasW / 100 * 5.5; itemTime.y = canvasH / 100 * 81.7;
	itemTime.scaleX = itemTime.scaleY = 0.82;

	// Jackpot actual (solo del bingo)
	itemJackpotInfo = new createjs.Bitmap(loader.getResult('itemJackpotInfo'));
	centerReg(itemJackpotInfo);
	itemJackpotInfo.x = canvasW / 100 * 22.5; itemJackpotInfo.y = canvasH / 100 * 82;
	itemJackpotInfo.scaleX = .18; itemJackpotInfo.scaleY = .17;

	// Ultimo jackpot
	itemJackpotResult = new createjs.Bitmap(loader.getResult('itemJackpotResult'));
	centerReg(itemJackpotResult);
	itemJackpotResult.x = canvasW / 100 * 19; itemJackpotResult.y = canvasH / 100 * 93;
	itemJackpotResult.scaleX = 0.25; itemJackpotResult.scaleY = 0.26;

	// Mejores cartones
	itemCardboard = new createjs.Bitmap(loader.getResult('itemCardboard'));
	centerReg(itemCardboard);
	itemCardboard.x = canvasW / 100 * 49.5; itemCardboard.y = canvasH / 100 * 71;
	itemCardboard.scaleX = 0.33; itemCardboard.scaleY = 0.35;

	// 12 filas en 3 columnas (lugar / ticket / numeros que faltan). maxWidth evita que
	// un nombre largo se salga del recuadro.
	const oc = origen(itemCardboard);
	cartonInfoTexts = [];
	for (var i = 0; i < 12; i++) {
		const y = oc.y + 90 + i * 30;
		const fila = {
			lugar: Object.assign(nuevoTexto("20px bebasregular", "#fff", "left", "top", ''), { x: oc.x + 30, y: y, maxWidth: 150 }),
			ticket: Object.assign(nuevoTexto("20px bebasregular", "#fff", "left", "top", ''), { x: oc.x + 190, y: y, maxWidth: 70 }),
			faltan: Object.assign(nuevoTexto("20px bebasregular", "#fff", "left", "top", ''), { x: oc.x + 270, y: y, maxWidth: 95 })
		};
		cartonInfoTexts.push(fila);
	}

	// Tabla de premios
	itemTable = new createjs.Bitmap(loader.getResult('itemTable'));
	centerReg(itemTable);
	itemTable.x = canvasW / 100 * 80; itemTable.y = canvasH / 100 * 87;
	itemTable.scaleX = 0.29; itemTable.scaleY = .26;

	const ot = origen(itemTable);
	cuatroInfoTxt = Object.assign(nuevoTexto("30px bebasregular", "#ffffffe0", "left", "top"), { x: ot.x + 350, y: ot.y + 21 });
	lineaInfoTxt = Object.assign(nuevoTexto("30px bebasregular", "#ffffffe0", "left", "top"), { x: ot.x + 350, y: ot.y + 61 });
	dobleInfoTxt = Object.assign(nuevoTexto("30px bebasregular", "#ffffffe0", "left", "top"), { x: ot.x + 350, y: ot.y + 100 });
	bingoInfoTxt = Object.assign(nuevoTexto("30px bebasregular", "#ffffffe0", "left", "top"), { x: ot.x + 350, y: ot.y + 140 });

	timeValueTxt = nuevoTexto("70px bebasregular", colorTema('conteo'), "center", "alphabetic", "00");
	timeValueTxt.x = itemTime.x;
	timeValueTxt.y = itemTime.y + 25;

	jkActualTxt = nuevoTexto("55px bebasregular", colorTema('jackpot'), "left", "alphabetic", '');
	jkActualTxt.x = itemJackpotInfo.x - 30;
	jkActualTxt.y = itemJackpotInfo.y + 20;

	// Ultimo jackpot: TICKET | MONTO | LUGAR | FECHA, cada uno centrado entre los separadores
	// que trae pintados el PNG (la casilla mas ancha es la tercera: ahi va el lugar).
	const barra = (dx, ancho) => Object.assign(nuevoTexto("24px bebasregular", "#ffffffe0", "center", "alphabetic"),
		{ x: itemJackpotResult.x + dx, y: itemJackpotResult.y + 9, maxWidth: ancho });
	txtJkTk  = barra(-196, 104);
	txtJkMt  = barra(-72, 110);
	txtJkMnt = barra(69, 140);
	txtJkDt  = barra(203, 94);

	// Bombo
	itmDrumGlass = new createjs.Bitmap(loader.getResult('itmDrumGlass'));
	centerReg(itmDrumGlass);

	itmDrumGlassBonus = new createjs.Bitmap(loader.getResult('itmDrumGlassBonus1'));
	centerReg(itmDrumGlassBonus);
	itmDrumGlassBonus.visible = false;

	itmDrumHole = new createjs.Bitmap(loader.getResult('itmDrumHole'));
	centerReg(itmDrumHole);

	itemBgDrum = new createjs.Bitmap(loader.getResult('itemBgDrum'));
	centerReg(itemBgDrum);

	drawDrumContainer.addChild(drawDrumBallsContainer, itmDrumGlass, itmDrumGlassBonus, itmDrumHole);

	infoContainer.addChild(
		itemTime, itemJackpotInfo, itemJackpotResult, itemCardboard, itemTable,
		timeValueTxt, jkActualTxt, txtJkTk, txtJkMt, txtJkMnt, txtJkDt,
		cuatroInfoTxt, lineaInfoTxt, dobleInfoTxt, bingoInfoTxt
	);
	cartonInfoTexts.forEach(f => infoContainer.addChild(f.lugar, f.ticket, f.faltan));

	drawContainer.addChild(itemBgDrum, drawDrumContainer, drawNumbersContainer, drawDrumBallContainer, infoContainer, popupContainer);

	// 60 casillas donde caen las bolas
	for (var n = 0; n < TOTAL_SLOTS; n++) {

		$.draw['drop' + n] = new createjs.Container();
		$.draw['drop' + n].scaleX = $.draw['drop' + n].scaleY = .59;

		var ballMask = new createjs.Shape();
		ballMask.graphics.beginFill('red').drawCircle(0, 0, gameSettings.revealBallRadius / 2);
		$.draw['drop' + n].ballMask = ballMask;
		$.draw['drop' + n].mask = ballMask;

		$.draw['bonus' + n] = new createjs.Container();
		$.draw['bonus' + n].scaleX = $.draw['bonus' + n].scaleY = .16;
		$.draw['bonus' + n].visible = false;

		$.draw['placed' + n] = new createjs.Bitmap(loader.getResult('itemPlace'));
		centerReg($.draw['placed' + n]);
		$.draw['placed' + n].scaleX = $.draw['placed' + n].scaleY = .8;

		drawNumbersContainer.addChild($.draw['placed' + n], $.draw['drop' + n], $.draw['bonus' + n]);
	}

	guideline = new createjs.Shape();

	gameContainer.addChild(drawContainer);

	canvasContainer.addChild(bg, gameContainer, resultScreenContainer, guideline, transitionOverlay);
	stage.addChild(canvasContainer);

	changeViewport(viewport.isLandscape);
}


function changeViewport(isLandscape) {
	stageW = landscapeSize.w;
	stageH = landscapeSize.h;
	contentW = landscapeSize.cW;
	contentH = landscapeSize.cH;

	canvasW = stageW;
	canvasH = stageH;

	changeCanvasViewport();
}

function changeCanvasViewport() {
	if (canvasContainer != undefined) {
		stage.scaleX = stage.scaleY = dpr;

		if (safeZoneGuide) {
			guideline.graphics.clear().setStrokeStyle(2).beginStroke('red')
				.drawRect((stageW - contentW) / 2, (stageH - contentH) / 2, contentW, contentH);
		}
		bg.visible = true;
	}
}

function resizeCanvas() {
	// El layout del sorteo se coloca siempre (antes solo si curPage era 'game', y la
	// primera vez que se entraba al sorteo las casillas salian en 0,0 hasta un resize).
	if (canvasContainer != undefined && drawDrumContainer) resizeGameLayout();
}

function removeGameCanvas() {
	stage.autoClear = true;
	stage.removeAllChildren();
	stage.update();
	createjs.Ticker.removeEventListener("tick", tick);
}

function centerReg(obj) {
	if (obj.image == undefined) return;
	obj.regX = obj.image.naturalWidth / 2;
	obj.regY = obj.image.naturalHeight / 2;
}
