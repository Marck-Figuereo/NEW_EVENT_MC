////////////////////////////////////////////////////////////
// GAME - sorteo del BINGO (60 bolas del 1 al 90)
//
// Los datos ya NO estan escritos aqui: llegan del visor en jugarSorteo(sorteo):
//
// Todo lo manda la API (bolas, cartones, ganadores): esta pantalla no calcula
// ganadores, solo muestra lo que llega.
//
//   {
//     sorteo: 154,
//     bolas: [hasta 60 numeros distintos 1..90, en el orden en que salen].
//            El sorteo termina en la bola del BINGO: si el BINGO sale en la 51,
//            llegan 51 bolas y las casillas restantes quedan vacias.
//     premios: { cuatro, linea, doble_linea, bingo },
//     jackpot: 35600,                  // acumulado actual (exclusivo del bingo)
//     ultimo_jackpot: { monto, fecha, lugar, ticket },
//     ganadores: [ { tipo, bola, lugar, ticket, numeros[15], monto } ],
//         tipo: CUATRO | LINEA | DOBLE_LINEA | BINGO | JACKPOT
//         bola: 1..60 = en que bola (orden de salida) completa la figura
//     seguimiento: [ { lugar, ticket, numeros[15] } ],   // tablero "mejores cartones"
//   }
//
// JACKPOT: si el BINGO sale antes de la bola 60 llega tambien un ganador JACKPOT
// en esa misma bola y se muestra su popup (win_jackpot.png). Si el BINGO sale en
// la bola 60 no hay JACKPOT: el monto se acumula y no se muestra ningun aviso.
//
// Antes los ganadores se indexaban por NUMERO de bola (draw_api.cartones[88]):
// no permitia dos ganadores en la misma bola. Ahora es una lista con la bola.
////////////////////////////////////////////////////////////


//////////////////////// TIEMPOS ////////////////////////

const TOTAL_SLOTS = 60;                // casillas en pantalla (10 columnas x 6)

const BONUS_SUSPENSE_SECONDS = 4;      // bola marcada antes de mostrar el carton
const BONUS_POPUP_SECONDS = 4;         // carton ganador en pantalla
const JACKPOT_POPUP_SECONDS = 12;      // ganador del jackpot en pantalla
const HIDE_POPUP_SECONDS = 1.2;        // desvanecido del popup

// Figura -> arte (mismos assets del proyecto original)
const ARTE_FIGURA = {
	CUATRO:      { assetId: 'itemSelectBonus1', drumGlassId: 'itmDrumGlassBonus1', popUp: 'itemPopup_cuatro', color: '#36eb22e0' },
	LINEA:       { assetId: 'itemSelectBonus2', drumGlassId: 'itmDrumGlassBonus2', popUp: 'itemPopup_line',   color: '#3195ed' },
	DOBLE_LINEA: { assetId: 'itemSelectBonus3', drumGlassId: 'itmDrumGlassBonus3', popUp: 'itemPopup_lineD',  color: '#ff3737' },
	BINGO:       { assetId: 'itemSelectBonus4', drumGlassId: 'itmDrumGlassBonus4', popUp: 'itemPopup_bingo',  color: '#f2c356ea' },
	JACKPOT:     { assetId: 'itemSelectBonus4', drumGlassId: 'itmDrumGlassBonus4', popUp: 'itemPopup_jackpot', color: '#f2c356ea' }
};
const ORDEN_FIGURAS = ['CUATRO', 'LINEA', 'DOBLE_LINEA', 'BINGO', 'JACKPOT'];

let currentDrawData = null;


//////////////////////// AJUSTES DEL JUEGO ////////////////////////

const ballAssets = [];
for (let i = 1; i <= 8; i++) {
	ballAssets.push({
		big:    'assets/DEMP/balls/item_ball_b_' + i + '.png',
		reveal: 'assets/DEMP/balls/item_ball_r_' + i + '.png',
		drum:   'assets/DEMP/balls/item_ball_' + i + '.png'
	});
}

const gameSettings = {
	drumBallRadius: 30,
	revealBallRadius: 88,
	bigBallRadius: 226,

	revealSpeed: 1,
	delaySpeed: .2,
	winSpeed: .5,
};

$.editor = { enable: false };

const gameData = {
	paused: true,
	drawing: false,
	numbers: [],
	revealNumbers: [],
	revealIndex: 0
};

// Color de la bola segun el numero (8 colores, cubre 1..90)
gameData.colors = [
	[1, 9, 17, 25, 33, 41, 49, 57, 65, 73, 81, 89],
	[2, 10, 18, 26, 34, 42, 50, 58, 66, 74, 82, 90],
	[3, 11, 19, 27, 35, 43, 51, 59, 67, 75, 83],
	[4, 12, 20, 28, 36, 44, 52, 60, 68, 76, 84],
	[5, 13, 21, 29, 37, 45, 53, 61, 69, 77, 85],
	[6, 14, 22, 30, 38, 46, 54, 62, 70, 78, 86],
	[7, 15, 23, 31, 39, 47, 55, 63, 71, 79, 87],
	[8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88],
];

const rotateData = {
	speed: .03,
	normalSpeed: .03,
	revealSpeed: .06,
	angle: 0,
	depth: 10,
	scale: .90,
	radiusX: 0,
	radiusY: 70,
};

const DEPTH_SORT_INTERVAL = 2;
var drumBalls = [];
var drumDepthOrder = [];
var drumDepthFrame = 0;


//////////////////////// UTILIDADES ////////////////////////

function sortOnObject(array, object, rev) {
	array.sort(function (a, b) {
		var a1 = a[object], b1 = b[object];
		if (a1 == b1) return 0;
		if (rev) return a1 < b1 ? 1 : -1;
		return a1 > b1 ? 1 : -1;
	});
	return array;
}

function isEven(n) { return n % 2 === 0; }

function randomIntFromInterval(min, max) {
	return Math.floor(Math.random() * (max - min + 1) + min);
}

const currency = function (number) {
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(number) || 0);
};

function shuffleArray(array) {
	for (var i = array.length - 1; i > 0; i--) {
		var j = Math.floor(Math.random() * (i + 1));
		var temp = array[i]; array[i] = array[j]; array[j] = temp;
	}
}

/* Espera que respeta TweenMax.globalTimeScale y que se corta si el sorteo se cancela. */
let tokenSorteo = 0;

function espera(segundos, token) {
	return new Promise(function (resolve) {
		TweenMax.delayedCall(segundos, function () { resolve(token === tokenSorteo); });
	});
}

function cancelarSorteo() {
	tokenSorteo++;
	gameData.paused = true;
	gameData.drawing = false;
	stopSoundLoop('soundDrum');
}


//////////////////////// RENDER ////////////////////////

var renderActive = true;
var renderOnce = false;

function requestRender() { renderOnce = true; }
function startRender() { renderActive = true; requestRender(); }
function stopRender() { renderActive = false; requestRender(); }

function tick(event) {

	// El visor decide que vista trabaja: con el host inactivo no se pinta nada.
	if (window.BingoScreen && !BingoScreen.hostActive) return;

	if (resultScreenContainer && resultScreenContainer.visible) {
		if (renderOnce) {
			stage.update(event);
			renderOnce = false;
			BingoScreen.frames++;
		}
		return;
	}

	updateGame(event.delta);

	if (renderActive || renderOnce) {
		stage.update(event);
		renderOnce = false;
		BingoScreen.frames++;
	}
}

function buildGameButton() {
	// Bolas decorativas del bombo: 36 numeros al azar del 1 al 90
	var todos = [];
	for (var n = 1; n <= 90; n++) todos.push(n);
	shuffleArray(todos);
	gameData.numbers = todos.slice(0, 36);

	buildDrumBalls();
}


//////////////////////// PAGINAS ////////////////////////

var curPage = '';

function goPage(page) {
	curPage = page;

	if (gameContainer) gameContainer.visible = (page == 'game');
	if (resultScreenContainer) resultScreenContainer.visible = (page == 'results');

	if (page == 'game') {
		startRender();
	}

	if (page == 'results') {
		stopSoundLoop('soundDrum');
		stopRender();
	}

	resizeCanvas();
	requestRender();
}


//////////////////////// BOMBO / POPUPS ////////////////////////

function showDrumGlassBonus(drumGlassId) {
	if (!itmDrumGlassBonus || !itmDrumGlass) return;

	itmDrumGlass.visible = false;
	itmDrumGlassBonus.image = loader.getResult(drumGlassId);
	itmDrumGlassBonus.visible = true;
	itmDrumGlassBonus.alpha = 0;

	TweenMax.to(itmDrumGlassBonus, 1.5, { alpha: 1 });
}

function resetDrumGlassBonus() {
	if (!itmDrumGlassBonus || !itmDrumGlass) return;

	TweenMax.killTweensOf(itmDrumGlassBonus);
	itmDrumGlassBonus.visible = false;
	itmDrumGlass.visible = true;
}

function hidePopupCarton() {
	if (!popupContainer || !popupContainer.visible) return;

	TweenMax.killTweensOf(popupContainer);

	TweenMax.to(popupContainer, HIDE_POPUP_SECONDS, {
		alpha: 0,
		ease: Power2.easeIn,
		onComplete: function () {
			popupContainer.visible = false;
			popupContainer.removeAllChildren();
			popupContainer.alpha = 1;

			popupTextNums = [];
			itemPopup = null;
			popupTextID = null;
			popupTextAgencia = null;
			popupTextJK = null;
		}
	});
}

/* Popup del ganador. Mismas posiciones que el proyecto original sobre sus PNG. */
function exitBonus(tipo_bns, dts) {

	if (tipo_bns == 'itemPopup_jackpot') {

		Nums_carton(dts.monto, dts.ticket, dts.lugar, 'itemPopup_jackpot', true);

		itemPopup.x = canvasW / 2;
		itemPopup.y = canvasH / 2;
		itemPopup.scaleX = itemPopup.scaleY = 0.5;

		let b = itemPopup.getBounds();
		let x0 = itemPopup.x - ((b.width * itemPopup.scaleX) / 2);
		let y0 = itemPopup.y - ((b.height * itemPopup.scaleY) / 2);

		popupTextID.x = x0 + 170;      popupTextID.y = y0 + 320;
		popupTextJK.x = x0 + 415;      popupTextJK.y = y0 + 328;
		popupTextAgencia.x = x0 + 655; popupTextAgencia.y = y0 + 315;

	} else {

		Nums_carton(dts.numeros, dts.ticket, dts.lugar, tipo_bns, false);

		itemPopup.x = canvasW / 2;
		itemPopup.y = canvasH / 2;
		itemPopup.scaleX = itemPopup.scaleY = 0.5;

		let b = itemPopup.getBounds();
		let x0 = itemPopup.x - ((b.width * itemPopup.scaleX) / 2);
		let y0 = itemPopup.y - ((b.height * itemPopup.scaleY) / 2);

		popupTextID.x = x0 + 250;      popupTextID.y = y0 + 435;
		popupTextAgencia.x = x0 + 510; popupTextAgencia.y = y0 + 435;

		// 3 filas de 5 numeros
		for (var i = 0; i < popupTextNums.length; i++) {
			popupTextNums[i].x = x0 + 195 + (i % 5) * 107;
			popupTextNums[i].y = y0 + 155 + Math.floor(i / 5) * 70;
		}
	}

	popupOverlay.graphics.clear().beginFill("rgba(0,0,0,0.65)").drawRect(0, 0, canvasW, canvasH);
}


//////////////////////// TABLERO DE MEJORES CARTONES ////////////////////////

/* Recalcula cuantos numeros le faltan a cada carton seguido y pinta los 12 mejores. */
function actualizarSeguimiento() {
	if (!cartonInfoTexts.length) return;

	const salidas = new Set(gameData.revealNumbers.slice(0, gameData.revealIndex));
	const lista = ((currentDrawData && currentDrawData.seguimiento) || []).map(function (c) {
		const faltan = (c.numeros || []).filter(function (n) { return !salidas.has(n); });
		return { lugar: c.lugar, ticket: c.ticket, faltan: faltan };
	});

	lista.sort(function (a, b) {
		return a.faltan.length - b.faltan.length || String(a.ticket).localeCompare(String(b.ticket));
	});

	for (var i = 0; i < cartonInfoTexts.length; i++) {
		const fila = cartonInfoTexts[i];
		const c = lista[i];

		if (!c) {
			fila.lugar.text = fila.ticket.text = fila.faltan.text = '';
			continue;
		}

		const n = c.faltan.length;
		const color = n <= 1 ? '#fcc65b' : '#fff';

		fila.lugar.text = sinAcentos(c.lugar);
		fila.ticket.text = c.ticket;
		fila.faltan.text = n === 0 ? 'BINGO' : n <= 4 ? c.faltan.join('  ') : 'FALTAN ' + n;
		fila.lugar.color = fila.ticket.color = fila.faltan.color = color;
	}
}


//////////////////////// INICIO DEL SORTEO ////////////////////////

function prepararSorteo(result) {

	// Informacion fija del sorteo
	const ult = result.ultimo_jackpot || {};
	txtJkTk.text = ult.ticket || '';
	txtJkMt.text = ult.monto != null ? currency(ult.monto) : '';
	txtJkMnt.text = sinAcentos(ult.lugar || '');
	txtJkDt.text = ult.fecha || '';

	jkActualTxt.text = currency(result.jackpot);

	const p = result.premios || {};
	cuatroInfoTxt.text = currency(p.cuatro);
	lineaInfoTxt.text = currency(p.linea);
	dobleInfoTxt.text = currency(p.doble_linea);
	bingoInfoTxt.text = currency(p.bingo);

	// Antes los colores de los premios ganados se quedaban del sorteo anterior
	cuatroInfoTxt.color = lineaInfoTxt.color = dobleInfoTxt.color = bingoInfoTxt.color = jkActualTxt.color = '#ffffffe0';

	resetDrumGlassBonus();
	if (popupContainer) {
		TweenMax.killTweensOf(popupContainer);
		popupContainer.visible = false;
		popupContainer.removeAllChildren();
		popupContainer.alpha = 1;
	}

	gameData.revealNumbers = (result.bolas || []).slice(0, TOTAL_SLOTS);
	gameData.revealIndex = 0;

	if (timeValueTxt) timeValueTxt.text = "00";

	for (var n = 0; n < TOTAL_SLOTS; n++) {
		if ($.draw['bonus' + n]) {
			$.draw['bonus' + n].removeAllChildren();
			$.draw['bonus' + n].visible = false;
		}
		if ($.draw['drop' + n]) $.draw['drop' + n].removeAllChildren();
	}

	drawDrumBallContainer.removeAllChildren();

	// Bolas del bombo de vuelta a su sitio (al final se acomodan abajo)
	TweenMax.killTweensOf(drawDrumBallsContainer);
	drawDrumBallsContainer.rotation = 0;
	drumBalls.forEach(function (b) { TweenMax.killTweensOf(b); b.rotation = randomIntFromInterval(-45, 45); });

	actualizarSeguimiento();
}

/* Ganadores agrupados por bola (1..60), en el orden en que se muestran. */
function ganadoresPorBola(lista) {
	const mapa = {};
	(lista || []).forEach(function (g) {
		const b = Number(g.bola);
		if (!(b >= 1 && b <= TOTAL_SLOTS) || !ARTE_FIGURA[g.tipo]) {
			console.warn('[bingo] ganador ignorado (bola o tipo invalido):', g);
			return;
		}
		(mapa[b] = mapa[b] || []).push(g);
	});
	Object.keys(mapa).forEach(function (b) {
		mapa[b].sort(function (x, y) { return ORDEN_FIGURAS.indexOf(x.tipo) - ORDEN_FIGURAS.indexOf(y.tipo); });
	});
	return mapa;
}

async function jugarSorteo(result) {

	cancelarSorteo();
	const token = ++tokenSorteo;

	currentDrawData = result;
	const porBola = ganadoresPorBola(result.ganadores);

	const nBolas = (result.bolas || []).length;
	if (nBolas === 0 || nBolas > TOTAL_SLOTS) {
		console.warn('[bingo] el sorteo trae ' + nBolas + ' bolas; deben ser de 1 a ' + TOTAL_SLOTS + ' (hasta el BINGO)');
	}

	prepararSorteo(result);
	startRender();

	gameData.paused = false;
	gameData.drawing = true;

	if (audioOn) {
		playSoundLoop('soundDrum');
		setSoundLoopVolume('soundDrum', .5);
	}
	playSound('soundStart');

	console.log('[bingo] sorteo', result.sorteo, '-', gameData.revealNumbers.length, 'bolas,',
		(result.ganadores || []).length, 'ganadores');

	while (gameData.revealIndex < gameData.revealNumbers.length) {

		const indice = gameData.revealIndex;
		if (!(await revelarBola(indice, token))) return false;

		actualizarSeguimiento();

		const ganadores = porBola[indice + 1];
		if (ganadores) {
			if (!(await mostrarGanadores(indice, ganadores, token))) return false;
		}

		if (!(await espera(gameSettings.revealSpeed, token))) return false;
	}

	// Fin de las bolas
	playSound('soundEnd');
	stopSoundLoop('soundDrum');
	drawDrumBallContainer.removeAllChildren();

	gameData.drawing = false;
	gameData.paused = true;

	settleBallsAtBottom();
	if (!(await espera(2.2, token))) return false;

	stopRender();
	return true;
}


/* Una bola: gira el bombo, sale la bola grande y cae en su casilla. */
function revelarBola(indice, token) {
	return new Promise(function (resolve) {

		const ballNumber = gameData.revealNumbers[indice];

		TweenMax.to(drawDrumBallsContainer, 3, {
			rotation: randomIntFromInterval(-180, 180),
			ease: Expo.easeOut,
			overwrite: true
		});

		drawDrumBallContainer.removeAllChildren();

		TweenMax.to(itmDrumHole, gameSettings.revealSpeed, {
			delay: gameSettings.revealSpeed, rotation: 360, overwrite: true, ease: Sine.easeOut,
			onStart: function () { playSound('soundHover'); },
			onComplete: function () { itmDrumHole.rotation = 0; }
		});

		TweenMax.delayedCall(gameSettings.revealSpeed * 2, function () {
			if (token !== tokenSorteo) return resolve(false);

			playSound('soundPipe');

			var newBall = createBall('ballBig', ballNumber);
			newBall.scaleX = newBall.scaleY = .2;
			newBall.y = 150;
			newBall.bgBall.x = randomIntFromInterval(gameSettings.bigBallRadius, -gameSettings.bigBallRadius);
			newBall.bgBall.y = randomIntFromInterval(gameSettings.bigBallRadius, -gameSettings.bigBallRadius);
			drawDrumBallContainer.addChild(newBall);

			TweenMax.to(newBall, gameSettings.revealSpeed, {
				bezier: { type: "thru", values: [{ x: 0, y: 150 }, { x: -60, y: 70 }, { x: 0, y: 0 }], curviness: 2, autoRotate: false },
				y: 0, scaleX: 1, scaleY: 1, rotation: 0, overwrite: true
			});
			TweenMax.to(newBall.bgBall, gameSettings.revealSpeed, { x: 0, y: 0, overwrite: true });

			var newRevealBall = createBall('ballReveal', ballNumber);
			newRevealBall.rotation = randomIntFromInterval(-45, 45);
			newRevealBall.y = -100;
			$.draw['drop' + indice].addChild(newRevealBall);

			gameData.revealIndex = indice + 1;
			if (timeValueTxt) timeValueTxt.text = gameData.revealIndex < 10 ? '0' + gameData.revealIndex : String(gameData.revealIndex);

			TweenMax.delayedCall(gameSettings.delaySpeed / 4, function () {
				playSound('soundReveal');
				playSound('soundDrop');
			});

			TweenMax.to(newRevealBall, gameSettings.revealSpeed, {
				delay: gameSettings.delaySpeed, y: 0, rotation: 0, ease: Bounce.easeOut,
				onComplete: function () { resolve(token === tokenSorteo); }
			});
		});
	});
}


/* Premios que se completan en esta bola: marca, suspenso y carton ganador. */
async function mostrarGanadores(indice, ganadores, token) {

	gameData.paused = true;
	stopSoundLoop('soundDrum');

	// Marca de la casilla: la primera figura de la bola (BINGO gana sobre JACKPOT)
	const marca = ARTE_FIGURA[ganadores[0].tipo];
	const slot = $.draw['bonus' + indice];
	if (slot) {
		slot.removeAllChildren();
		var bonusImg = new createjs.Bitmap(loader.getResult(marca.assetId));
		centerReg(bonusImg);
		bonusImg.scaleX = bonusImg.scaleY = 1.7;
		bonusImg.alpha = 0;
		slot.addChild(bonusImg);
		slot.visible = true;
		TweenMax.to(bonusImg, 1.5, { alpha: 1, ease: Back.easeOut.config(1.2) });
	}

	let tipoAnterior = null;

	for (const g of ganadores) {
		const arte = ARTE_FIGURA[g.tipo];

		if (g.tipo === 'CUATRO') cuatroInfoTxt.color = arte.color;
		if (g.tipo === 'LINEA') lineaInfoTxt.color = arte.color;
		if (g.tipo === 'DOBLE_LINEA') dobleInfoTxt.color = arte.color;
		if (g.tipo === 'BINGO') bingoInfoTxt.color = arte.color;
		if (g.tipo === 'JACKPOT') jkActualTxt.color = arte.color;

		if (g.tipo === 'JACKPOT') {
			exitBonus(arte.popUp, g);
			if (!(await espera(JACKPOT_POPUP_SECONDS, token))) return false;
		} else {
			// Suspenso solo la primera vez que aparece la figura (empates seguidos)
			if (tipoAnterior !== g.tipo) {
				showDrumGlassBonus(arte.drumGlassId);
				if (!(await espera(BONUS_SUSPENSE_SECONDS, token))) return false;
			}
			exitBonus(arte.popUp, g);
			if (!(await espera(BONUS_POPUP_SECONDS, token))) return false;
		}

		hidePopupCarton();
		if (!(await espera(HIDE_POPUP_SECONDS, token))) return false;

		tipoAnterior = g.tipo;
	}

	resetDrumGlassBonus();

	if (audioOn) {
		playSoundLoop('soundDrum');
		setSoundLoopVolume('soundDrum', .5);
	}
	gameData.paused = false;
	return true;
}


//////////////////////// BOLAS ////////////////////////

function createBall(size, number) {
	var colorIndex = -1;
	for (var n = 0; n < gameData.colors.length; n++) {
		if (gameData.colors[n].indexOf(number) != -1) colorIndex = n;
	}
	if (colorIndex < 0) colorIndex = 0;

	var newBall = new createjs.Container();
	newBall.colorIndex = colorIndex;
	var newBg = new createjs.Bitmap(loader.getResult(size + colorIndex));
	centerReg(newBg);

	if (size == 'ballReveal') {
		var newNumber = new createjs.Text();
		newNumber.font = "80px bebasregular";
		newNumber.color = '#000';
		newNumber.textAlign = "center";
		newNumber.textBaseline = 'alphabetic';
		newNumber.text = number;
		newNumber.y = 30;

		newBall.addChild(newBg, newNumber);

	} else if (size == 'ballDrum') {
		newBall.tween = {};

		var itemBallH = new createjs.Bitmap(loader.getResult('itemBallH'));
		centerReg(itemBallH);

		var whiteFace = new createjs.Container();

		var bgBall = new createjs.Bitmap(loader.getResult('itemBallWhite'));
		bgBall.regX = gameSettings.drumBallRadius / 2;
		bgBall.regY = gameSettings.drumBallRadius / 2;

		var drumNumber = new createjs.Text();
		drumNumber.font = "10px bebasregular";
		drumNumber.color = "rgba(6, 22, 56, 0.55)";
		drumNumber.textAlign = "center";
		drumNumber.textBaseline = "middle";
		drumNumber.text = number;
		drumNumber.alpha = 0.45;

		whiteFace.addChild(bgBall, drumNumber);

		var ballMask = new createjs.Shape();
		ballMask.graphics.beginFill('red').drawCircle(0, 0, gameSettings.drumBallRadius / 2);
		whiteFace.mask = ballMask;

		newBall.rotation = randomIntFromInterval(-45, 45);
		newBall.bgBall = whiteFace;

		newBall.addChild(newBg, whiteFace, itemBallH);

	} else if (size == 'ballBig') {
		newBall.tween = {};
		var itemBallHB = new createjs.Bitmap(loader.getResult('itemBallH'));
		centerReg(itemBallHB);

		var bigFace = new createjs.Container();
		var bgBallWhite = new createjs.Bitmap(loader.getResult('itemBallWhiteB'));
		bgBallWhite.regX = gameSettings.bigBallRadius / 2;
		bgBallWhite.regY = gameSettings.bigBallRadius / 2;

		var bigMask = new createjs.Shape();
		bigMask.graphics.beginFill('red').drawCircle(0, 0, gameSettings.bigBallRadius / 2);
		bigFace.mask = bigMask;

		var bigNumber = new createjs.Text();
		bigNumber.font = "100px bebasregular";
		bigNumber.color = '#000';
		bigNumber.textAlign = "center";
		bigNumber.textBaseline = 'alphabetic';
		bigNumber.y = 35;
		bigNumber.text = number;

		bigFace.addChild(bgBallWhite, bigNumber);

		newBall.rotation = randomIntFromInterval(-45, 45);
		newBall.bgBall = bigFace;
		newBall.addChild(newBg, bigFace);
	}

	return newBall;
}

function settleBallsAtBottom() {
	TweenMax.killTweensOf(drawDrumBallsContainer);
	drawDrumBallsContainer.rotation = 0;

	var balls = drumBalls.slice();
	if (balls.length === 0) return;

	var centerX = 7, bottomY = 100, ballSize = 30;
	var spacingX = ballSize * 0.82, spacingY = ballSize * 0.60;

	// 36 bolas exactas
	var rows = [
		{ count: 4, yOffset: 0 },
		{ count: 5, yOffset: -spacingY },
		{ count: 8, yOffset: -spacingY * 2 },
		{ count: 9, yOffset: -spacingY * 3 },
		{ count: 7, yOffset: -spacingY * 4 },
		{ count: 4, yOffset: -spacingY * 5 }
	];

	var positions = [];
	rows.forEach(function (row) {
		var startX = centerX - ((row.count - 1) * spacingX) / 2;
		for (var i = 0; i < row.count; i++) positions.push({ x: startX + (i * spacingX), y: bottomY + row.yOffset });
	});
	shuffleArray(positions);

	for (var i = 0; i < balls.length && i < positions.length; i++) {
		var ball = balls[i], pos = positions[i];
		var scale = 1 + (Math.random() * 0.06);

		TweenMax.killTweensOf(ball);
		TweenMax.to(ball, 0.75 + (Math.random() * 0.2), {
			x: pos.x + randomIntFromInterval(-5, 5),
			y: pos.y + randomIntFromInterval(-3, 3),
			scaleX: scale, scaleY: scale,
			rotation: randomIntFromInterval(-20, 20),
			ease: Bounce.easeOut,
			delay: i * 0.012,
			overwrite: true
		});
	}
}


//////////////////////// LAYOUT ////////////////////////

function resizeGameLayout() {
	drawDrumContainer.x = drawDrumBallContainer.x = itemBgDrum.x = canvasW / 2;
	drawDrumContainer.y = drawDrumBallContainer.y = itemBgDrum.y = canvasH / 100 * 22;

	var DRUM_SCALE = 1.3;
	itemBgDrum.scaleX = itemBgDrum.scaleY = DRUM_SCALE;
	drawDrumContainer.scaleX = drawDrumContainer.scaleY = DRUM_SCALE;
	drawDrumBallContainer.scaleX = drawDrumBallContainer.scaleY = DRUM_SCALE;

	itmDrumGlass.scaleX = itmDrumGlass.scaleY = .55;
	itmDrumGlassBonus.scaleX = itmDrumGlassBonus.scaleY = .55;

	// 10 columnas de 6 casillas: 5 a la izquierda y 5 a la derecha del bombo
	var GAP = 110, index = 0;
	[5, 12, 19, 26, 33, 66, 73, 80, 87, 94].forEach(function (pct) {
		index = placeFixedColumn(index, 6, canvasW / 100 * pct, canvasH / 100 * 8, GAP);
	});
}

function positionRevealSlot(n, x, y) {
	if (!$.draw['placed' + n]) return;

	$.draw['placed' + n].x = x;
	$.draw['placed' + n].y = y;

	if ($.draw['bonus' + n]) {
		$.draw['bonus' + n].x = x - 3;
		$.draw['bonus' + n].y = y - 4;
	}

	if ($.draw['drop' + n]) {
		$.draw['drop' + n].x = x;
		$.draw['drop' + n].y = y;
		if ($.draw['drop' + n].ballMask) {
			$.draw['drop' + n].ballMask.x = x;
			$.draw['drop' + n].ballMask.y = y;
		}
	}
}

function placeFixedColumn(startIndex, total, x, startY, gap) {
	for (var i = 0; i < total; i++) positionRevealSlot(startIndex + i, x, startY + (i * gap));
	return startIndex + total;
}


//////////////////////// BOMBO ////////////////////////

function updateGame(deltaMs) {
	if (!gameData.paused) loopDrumBalls(deltaMs);
}

function buildDrumBalls() {
	rotateData.column = 6;
	rotateData.row = 6;
	drumBalls = [];
	drumDepthOrder = [];
	drumDepthFrame = 0;
	$.balls = {};

	var numberIndex = 0;

	for (var r = 0; r < rotateData.row; r++) {
		for (var c = 0; c < rotateData.column; c++) {
			var ball = createBall('ballDrum', gameData.numbers[numberIndex]);
			$.balls[r + '_' + c] = ball;
			numberIndex++;

			ball.angle = ball.oriAngle = (r * ((Math.PI * 2) / rotateData.row));
			ball.offsetX = ball.newOffsetX = randomIntFromInterval(-80, 80);
			ball.offsetY = ball.newOffsetY = randomIntFromInterval(-20, 20);
			ball.rotateSpeedX = randomIntFromInterval(-2, 2);
			ball.rotateSpeedY = randomIntFromInterval(-2, 2);
			ball.timer = randomIntFromInterval(50, 100);
			ball.timerRotate = randomIntFromInterval(30, 50);
			ball.depthEntry = { ball: ball, scale: 0 };
			drumBalls.push(ball);
			drumDepthOrder.push(ball.depthEntry);
			drawDrumBallsContainer.addChild(ball);
		}
	}
}

function loopDrumBalls(deltaMs) {
	var drumSpeed = gameData.drawing == false ? rotateData.normalSpeed : rotateData.revealSpeed;
	var frameFactor = Math.min((deltaMs || 16.67) / 16.67, 2);

	rotateData.speed += (drumSpeed - rotateData.speed) * 0.05 * frameFactor;
	rotateData.angle += rotateData.speed * frameFactor;
	rotateData.angle = rotateData.angle > (Math.PI * 2) ? 0 : rotateData.angle;

	for (var n = 0; n < drumBalls.length; n++) {
		var ball = drumBalls[n];
		var currentAngle = ball.oriAngle + rotateData.angle;
		var cosAngle = Math.cos(currentAngle);
		var posX = cosAngle * rotateData.radiusX;
		var posY = Math.sin(currentAngle) * rotateData.radiusY;
		var scale = ((cosAngle * rotateData.depth) / rotateData.radiusY) + rotateData.scale;

		ball.depthEntry.scale = scale;

		if (ball.timer > 0) {
			ball.timer -= frameFactor;
		} else {
			ball.timer = randomIntFromInterval(50, 100);
			ball.newOffsetX = randomIntFromInterval(-80, 80);
			ball.newOffsetY = randomIntFromInterval(-20, 20);
		}

		ball.offsetX += (ball.newOffsetX - ball.offsetX) * 0.02 * frameFactor;
		ball.offsetY += (ball.newOffsetY - ball.offsetY) * 0.02 * frameFactor;

		if (ball.timerRotate > 0) {
			ball.timerRotate -= frameFactor;
		} else {
			ball.timerRotate = randomIntFromInterval(30, 50);
			ball.rotateSpeedX = randomIntFromInterval(-2, 2);
			ball.rotateSpeedY = randomIntFromInterval(-2, 2);
		}

		ball.bgBall.x += ball.rotateSpeedX * frameFactor;
		ball.bgBall.y += ball.rotateSpeedY * frameFactor;

		ball.bgBall.x = ball.bgBall.x < -gameSettings.drumBallRadius ? 0 : ball.bgBall.x;
		ball.bgBall.x = ball.bgBall.x > 0 ? -gameSettings.drumBallRadius : ball.bgBall.x;
		ball.bgBall.y = ball.bgBall.y < -gameSettings.drumBallRadius ? 0 : ball.bgBall.y;
		ball.bgBall.y = ball.bgBall.y > 0 ? -gameSettings.drumBallRadius : ball.bgBall.y;

		ball.x = posX + ball.offsetX;
		ball.y = posY + ball.offsetY;
		ball.scaleX = ball.scaleY = scale;
		ball.angle = currentAngle;
	}

	if (++drumDepthFrame >= DEPTH_SORT_INTERVAL) {
		drumDepthFrame = 0;
		sortOnObject(drumDepthOrder, 'scale', false);
		for (var i = 0; i < drumDepthOrder.length; i++) {
			drawDrumBallsContainer.setChildIndex(drumDepthOrder[i].ball, i);
		}
	}
}
