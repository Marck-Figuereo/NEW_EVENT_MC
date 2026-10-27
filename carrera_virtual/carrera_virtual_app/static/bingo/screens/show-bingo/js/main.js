////////////////////////////////////////////////////////////
// MAIN
//
// Esta pantalla ya NO arranca sola ni trae datos propios.
// Al terminar la carga deja lista la API window.BingoScreen y muestra la
// pantalla de SORTEOS (programacion) vacia. A partir de ahi la controla el
// visor (static/bingo/funcionamiento_bingo.js):
//
//   BingoScreen.mostrarProgramacion(datos)   sorteos pasados / proximos / especiales
//   BingoScreen.actualizarReloj({hora, conteo})
//   BingoScreen.actualizarJackpot(monto)
//   BingoScreen.jugarSorteo(sorteo)  -> Promise (se resuelve al terminar las 60 bolas)
//   BingoScreen.setHostActive(bool)  solo una vista del visor trabaja a la vez
////////////////////////////////////////////////////////////
var stageW = 1600;
var stageH = 900;
var contentW = 1600;
var contentH = 900;

const viewport = { isLandscape: true };
const landscapeSize = { w: stageW, h: stageH, cW: contentW, cH: contentH };

var resizeTimer = null;

async function initMain() {

	$('#canvasHolder').show();

	initGameCanvas(stageW, stageH);
	buildGameCanvas();
	buildGameButton();

	changeViewport(true);
	resizeGameFunc();
	resizeCanvas();

	$(window).off('resize.viewer').on('resize.viewer', function () {
		clearTimeout(resizeTimer);

		resizeTimer = setTimeout(function () {
			changeViewport(true);
			resizeGameFunc();
			resizeCanvas();
		}, 200);
	});

	// Pantalla inicial: SORTEOS sin datos hasta que el visor mande la programacion.
	buildResultScreen(null);
	goPage('results');

	BingoScreen.listo = true;
	console.log('[bingo] pantalla lista');
}


var windowW = 0, windowH = 0;
var scalePercent = 0;
const dpr = 1;
const offset = { x: 0, y: 0, left: 0, top: 0 };

/*!
 * GAME RESIZE - escala y centra el canvas de 1600x900 dentro del iframe
 */
function resizeGameFunc() {
	setTimeout(function () {

		windowW = window.innerWidth;
		windowH = window.innerHeight;
		scalePercent = Math.min(windowW / contentW, windowH / contentH);
		scalePercent = scalePercent > 1 ? 1 : scalePercent;

		if (windowW > stageW && windowH > stageH) {
			scalePercent = windowW / stageW;
			if ((stageH * scalePercent) > windowH) scalePercent = windowH / stageH;
		}

		const cssWidth = stageW * scalePercent;
		const cssHeight = stageH * scalePercent;

		offset.left = cssWidth > windowW ? -(cssWidth - windowW) : windowW - cssWidth;
		offset.top = cssHeight > windowH ? -(cssHeight - windowH) : windowH - cssHeight;

		offset.x = offset.left < 0 ? Math.abs((offset.left / scalePercent) / 2) : 0;
		offset.y = offset.top < 0 ? Math.abs((offset.top / scalePercent) / 2) : 0;

		const gameCanvas = document.getElementById("gameCanvas");

		gameCanvas.style.width = cssWidth + "px";
		gameCanvas.style.height = cssHeight + "px";
		gameCanvas.style.left = (offset.left / 2) + "px";
		gameCanvas.style.top = (offset.top / 2) + "px";

		const realWidth = Math.round(stageW * dpr);
		const realHeight = Math.round(stageH * dpr);

		if (gameCanvas.width !== realWidth || gameCanvas.height !== realHeight) {
			gameCanvas.width = realWidth;
			gameCanvas.height = realHeight;
		}

		$(window).scrollTop(0);

		resizeCanvas();
		if (typeof requestRender === 'function') requestRender();

	}, 100);
}


/*!
 * API PUBLICA PARA EL VISOR
 */
window.BingoScreen = {
	listo: false,
	hostActive: true,
	frames: 0,

	setHostActive(activo) {
		this.hostActive = !!activo;
		if (activo) requestRender();
	},

	mostrarProgramacion(datos) {
		cancelarSorteo();
		buildResultScreen(datos);
		goPage('results');
	},

	actualizarReloj(reloj) {
		actualizarRelojProgramacion(reloj || {});
	},

	actualizarJackpot(monto) {
		actualizarJackpotProgramacion(monto);
	},

	jugarSorteo(sorteo) {
		goPage('game');
		return jugarSorteo(sorteo);
	},

	/* Solo pruebas: acelera todas las animaciones (TweenMax). 1 = normal. */
	setVelocidad(factor) {
		TweenMax.globalTimeScale(Math.max(0.1, Number(factor) || 1));
	},

	reanudarAudio() {
		try {
			if (createjs.WebAudioPlugin.context && createjs.WebAudioPlugin.context.state === 'suspended') {
				createjs.WebAudioPlugin.context.resume();
			}
		} catch (e) {}
	},

	get vista() { return curPage; }
};
