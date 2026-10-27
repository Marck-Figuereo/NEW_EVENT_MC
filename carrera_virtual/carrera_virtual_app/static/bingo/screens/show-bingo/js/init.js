////////////////////////////////////////////////////////////
// INIT
////////////////////////////////////////////////////////////
var stageWidth, stageHeight = 0;
var isLoaded = false;

$(function () {
	// Chrome deja el contexto de audio suspendido hasta un clic. En el visor
	// el host tambien llama a BingoScreen.reanudarAudio() desde su boton.
	var resumeAudioContext = function () {
		try {
			if (createjs.WebAudioPlugin.context && createjs.WebAudioPlugin.context.state === "suspended") {
				createjs.WebAudioPlugin.context.resume();
				window.removeEventListener("click", resumeAudioContext);
			}
		} catch (e) {}
	};
	window.addEventListener("click", resumeAudioContext);

	checkBrowser();
});

var browserSupport = false;

function checkBrowser() {
	var canvasEl = document.createElement('canvas');

	if (canvasEl.getContext) browserSupport = true;

	if (browserSupport) {
		if (!isLoaded) {
			isLoaded = true;
			initPreload();
		}
	} else {
		$('#notSupportHolder').show();
	}
}
