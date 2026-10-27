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


//////////////////////// JACKPOT ANIMADO (pantalla SORTEOS) ////////////////////////

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
		txtJk.text = currency(currentNumber.toFixed(2));
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
	if (!isFinite(monto)) return;
	aumento_jack(jackpotMostrado, monto, 3000);
}

function actualizarRelojProgramacion(reloj) {
	if (reloj.hora != null) relojActual.hora = reloj.hora;
	if (reloj.conteo != null) relojActual.conteo = reloj.conteo;

	if (txtTimeActual) txtTimeActual.text = relojActual.hora;
	if (txtCount) txtCount.text = relojActual.conteo;
	requestRender();
}


//////////////////////// PANTALLA DE SORTEOS ////////////////////////

/* SORTEOS PASADOS: hasta 5. Siempre salen los 4 premios (el sorteo dura hasta el BINGO). */
const addPreviousDraw = (draws, previousDraw) => {

	const o = origen(previousDraw);
	const premio = v => currency(v);
	let s = 98;

	(draws || []).slice(0, 5).forEach(d => {
		resultScreenContainer.addChild(
			Object.assign(nuevoTexto("25px bebasregular", "#ffffffe0", "center", "alphabetic", "# " + d.sorteo), { x: o.x + 125, y: o.y + s }),
			Object.assign(nuevoTexto("25px bebasregular", "#ffffffe0", "center", "alphabetic", d.hora), { x: o.x + 300, y: o.y + s }),
			// El arte dice "Linea:" a la izquierda y "Cuatro:" a la derecha (el original los tenia cruzados)
			Object.assign(nuevoTexto("20px bebasregular", "#ffffffe0", "center", "alphabetic", premio(d.linea)), { x: o.x + 120, y: o.y + s + 35 }),
			Object.assign(nuevoTexto("20px bebasregular", "#ffffffe0", "center", "alphabetic", premio(d.cuatro)), { x: o.x + 360, y: o.y + s + 35 }),
			Object.assign(nuevoTexto("20px bebasregular", "#ffffffe0", "center", "alphabetic", premio(d.doble_linea)), { x: o.x + 160, y: o.y + s + 65 }),
			Object.assign(nuevoTexto("20px bebasregular", "#ffffffe0", "center", "alphabetic", premio(d.bingo)), { x: o.x + 360, y: o.y + s + 65 })
		);
		s += 117;
	});
};

/* PROXIMOS SORTEOS: hasta 5 (numero, fecha, hora). */
const addNextDraw = (draws, nextDraw) => {

	const o = origen(nextDraw);
	let s = 132;

	(draws || []).slice(0, 5).forEach(d => {
		resultScreenContainer.addChild(
			Object.assign(nuevoTexto("30px bebasregular", "#ffffffdc", "center", "alphabetic",
				`${d.sorteo}       ${d.fecha}       ${d.hora}`), { x: o.x + 265, y: o.y + s })
		);
		s += 112;
	});
};

/* SORTEOS ESPECIALES (panel de administracion): hasta 3; sin ninguno, el arte de "no hay". */
const addNextDrawSpecial = (info) => {

	const lista = (info || []).slice(0, 3);

	lista.forEach((esp, i) => {
		var item = new createjs.Bitmap(loader.getResult('itemDrawSpecial'));
		centerReg(item);
		item.x = canvasW * 0.82;
		item.y = [canvasH * 0.31, canvasH * 0.523, canvasH * 0.735][i];
		item.scaleX = item.scaleY = .24;

		const o = origen(item);

		const titulo = nuevoTexto("30px bebasregular", "#dca342", "left", "top", esp.titulo);
		titulo.maxWidth = 300;

		resultScreenContainer.addChild(item,
			Object.assign(titulo, { x: o.x + 150, y: o.y + 20 }),
			Object.assign(nuevoTexto("20px bebasregular", "#ffffffdc", "left", "top", esp.fecha), { x: o.x + 180, y: o.y + 60 }),
			Object.assign(nuevoTexto("20px bebasregular", "#ffffffdc", "left", "top", esp.hora), { x: o.x + 315, y: o.y + 60 }),
			Object.assign(nuevoTexto("20px bebasregular", "#ffffffdc", "left", "top", currency(esp.cuatro)), { x: o.x + 105, y: o.y + 117 }),
			Object.assign(nuevoTexto("20px bebasregular", "#ffffffdc", "left", "top", currency(esp.linea)), { x: o.x + 320, y: o.y + 117 }),
			Object.assign(nuevoTexto("20px bebasregular", "#ffffffdc", "left", "top", currency(esp.doble_linea)), { x: o.x + 135, y: o.y + 147 }),
			Object.assign(nuevoTexto("20px bebasregular", "#ffffffdc", "left", "top", currency(esp.bingo)), { x: o.x + 320, y: o.y + 147 })
		);
	});

	if (lista.length === 0) {
		var vacio = new createjs.Bitmap(loader.getResult('notDrawSpecial'));
		centerReg(vacio);
		vacio.x = canvasW * 0.82;
		vacio.y = canvasH * 0.52;
		vacio.scaleX = vacio.scaleY = .48;
		resultScreenContainer.addChild(vacio);
	}
};

const showTextResult = (info, previousDraw, nextDraw, itemJkInfoResult) => {

	addPreviousDraw(info.anteriores, previousDraw);
	addNextDraw(info.proximos, nextDraw);
	addNextDrawSpecial(info.especiales);

	const ult = info.ultimo_jackpot;
	if (!ult) return;

	// Ultimo jackpot: un valor a la derecha de cada icono del arte (antes era un solo
	// texto separado con espacios, que se descuadraba con montos o lugares largos).
	// [valor, inicio y fin del hueco en fraccion del ancho del PNG]
	const o = origen(itemJkInfoResult);
	const ancho = itemJkInfoResult.getBounds().width * itemJkInfoResult.scaleX;
	[[ult.ticket, 0.285, 0.375], [currency(ult.monto), 0.445, 0.575], [ult.lugar, 0.635, 0.800], [ult.fecha, 0.875, 0.985]].forEach(c => {
		const t = nuevoTexto("30px bebasregular", "#ffffffdc", "left", "alphabetic", c[0]);
		t.x = o.x + ancho * c[1];
		t.y = o.y + 50;
		t.maxWidth = ancho * (c[2] - c[1]);
		resultScreenContainer.addChild(t);
	});
};

const showDinamic = (jackpot) => {

	txtJk = nuevoTexto("38px bebasregular", "#ffffffdc", "left", "alphabetic", '');
	txtJk.x = canvasW / 100 * 61;
	txtJk.y = canvasH / 100 * 10;

	txtTimeActual = nuevoTexto("38px bebasregular", "#ffffffdc", "left", "alphabetic", relojActual.hora);
	txtTimeActual.x = canvasW / 100 * 75.5;
	txtTimeActual.y = canvasH / 100 * 10;

	txtCount = nuevoTexto("38px bebasregular", "#ffffffdc", "left", "alphabetic", relojActual.conteo);
	txtCount.x = canvasW / 100 * 88;
	txtCount.y = canvasH / 100 * 10;

	resultScreenContainer.addChild(txtJk, txtTimeActual, txtCount);

	// El contador sube desde lo ultimo mostrado (o un 10% menos la primera vez)
	if (jackpot != null) {
		const desde = jackpotMostrado > 0 && jackpotMostrado <= jackpot ? jackpotMostrado : jackpot * 0.9;
		txtJk.text = currency(desde);
		aumento_jack(desde, jackpot, 10000);
	}
};

function buildResultScreen(resultsData) {

	detener_aumento_jack();
	resultScreenContainer.removeAllChildren();

	const datos = resultsData || {};

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

	if (resultsData) showTextResult(datos, previousDraw, nextDraw, itemJkInfoResult);

	showDinamic(resultsData ? datos.jackpot : null);
	requestRender();
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

	timeValueTxt = nuevoTexto("70px bebasregular", "#04ff00ca", "center", "alphabetic", "00");
	timeValueTxt.x = itemTime.x;
	timeValueTxt.y = itemTime.y + 25;

	jkActualTxt = nuevoTexto("55px bebasregular", "#ffffffe0", "left", "alphabetic", '');
	jkActualTxt.x = itemJackpotInfo.x - 30;
	jkActualTxt.y = itemJackpotInfo.y + 20;

	txtJkTk = Object.assign(nuevoTexto("22px bebasregular", "#ffffffe0", "center", "alphabetic"), { x: itemJackpotResult.x - 200, y: itemJackpotResult.y + 8 });
	txtJkMt = Object.assign(nuevoTexto("22px bebasregular", "#ffffffe0", "center", "alphabetic"), { x: itemJackpotResult.x - 75, y: itemJackpotResult.y + 8 });
	txtJkMnt = Object.assign(nuevoTexto("22px bebasregular", "#ffffffe0", "center", "alphabetic"), { x: itemJackpotResult.x + 65, y: itemJackpotResult.y + 8, maxWidth: 130 });
	txtJkDt = Object.assign(nuevoTexto("22px bebasregular", "#ffffffe0", "center", "alphabetic"), { x: itemJackpotResult.x + 200, y: itemJackpotResult.y + 8 });

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
