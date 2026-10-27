////////////////////////////////////////////////////////////
// CANVAS LOADER - CLEAN VIEWER VERSION  buildGameButton
////////////////////////////////////////////////////////////

// buttonSoundOn
// buttonSoundOff
// buttonMusicOn
// buttonMusicOff
// buttonSettings
// soundButton
// soundStart
// soundHover

// Rutas relativas a screens/show-bingo/index.html (assets propios de esta pantalla)
const ASSET_PATH = '';

/*!
 * 
 * START CANVAS PRELOADER
 * 
 */
function initPreload(){
	toggleLoader(true);

	resizeGameFunc();
	
	loader = new createjs.LoadQueue(false);

	manifest = [
		// Background
		{src: ASSET_PATH + 'assets/CS/background.png', id:'background'},

		//popup
		{src: ASSET_PATH + 'assets/CS/win_cuatro.png', id:'itemPopup_cuatro'},
		{src: ASSET_PATH + 'assets/CS/win_line.png', id:'itemPopup_line'},
		{src: ASSET_PATH + 'assets/CS/win_double_line.png', id:'itemPopup_lineD'},
		{src: ASSET_PATH + 'assets/CS/win_bingo.png', id:'itemPopup_bingo'},
		
		{src: ASSET_PATH + 'assets/CS/win_jackpot.png', id:'itemPopup_jackpot'},
		

		// premios
		{src: ASSET_PATH + 'assets/itemSelectCuatro.png', id:'itemSelectBonus1'},
		{src: ASSET_PATH + 'assets/itemSelectLinea.png', id:'itemSelectBonus2'},
		{src: ASSET_PATH + 'assets/itemSelectLineaD.png', id:'itemSelectBonus3'},
		{src: ASSET_PATH + 'assets/itemSelectBingo.png', id:'itemSelectBonus4'},

		// Bola grande central
		{src: ASSET_PATH + 'assets/itmDrumGlassCuatro.png', id:'itmDrumGlassBonus1'},
		{src: ASSET_PATH + 'assets/itmDrumGlassLinea.png', id:'itmDrumGlassBonus2'},
		{src: ASSET_PATH + 'assets/itmDrumGlassLineaD.png', id:'itmDrumGlassBonus3'},
		{src: ASSET_PATH + 'assets/itmDrumGlassBingo.png', id:'itmDrumGlassBonus4'},

		// Baners para informaciones
		
		{src: ASSET_PATH + 'assets/CS/itemCount.png', id:'itemTime'},
		{src: ASSET_PATH + 'assets/CS/itemJkActual.png', id:'itemJackpotInfo'},
		{src: ASSET_PATH + 'assets/CS/itemJkInfo.png', id:'itemJackpotResult'},
		{src: ASSET_PATH + 'assets/CS/itemCarton.png', id:'itemCardboard'},
		{src: ASSET_PATH + 'assets/CS/itemTable.png', id:'itemTable'},
		

		// Drum
		{src: ASSET_PATH + 'assets/CS/item_drum_glass.png', id:'itmDrumGlass'},
		{src: ASSET_PATH + 'assets/CS/item_drum_hole.png', id:'itmDrumHole'},
		{src: ASSET_PATH + 'assets/item_bg_drum.png', id:'itemBgDrum'},

		// Reveal slotsa
		{src: ASSET_PATH + 'assets/CS/item_place.png', id:'itemPlace'},
		{src: ASSET_PATH + 'assets/item_place_gradient.png', id:'itemPlaceGradient'}, 

		// Ball masks/highlights
		{src: ASSET_PATH + 'assets/item_ball_white.png', id:'itemBallWhite'},
		{src: ASSET_PATH + 'assets/item_ball_h.png', id:'itemBallH'},
		{src: ASSET_PATH + 'assets/item_ball_white_b.png', id:'itemBallWhiteB'},


		
		{ src: ASSET_PATH + 'assets/DEMP/logo.png', id:'logo'},
		{ src: ASSET_PATH + 'assets/DEMP/count_time.png', id: 'countTime' },
		{ src: ASSET_PATH + 'assets/DEMP/time.png', id: 'TimeR' },
		{ src: ASSET_PATH + 'assets/DEMP/item_jk.png', id: 'itemJk' },
		{ src: ASSET_PATH + 'assets/DEMP/previous_draws2.png', id: 'previousDraw' },
		{ src: ASSET_PATH + 'assets/DEMP/next_draws2.png', id: 'nextDraw' },
		
		{ src: ASSET_PATH + 'assets/DEMP/special_draws.png', id: 'specialDraw' },
		{ src: ASSET_PATH + 'assets/DEMP/item_draw_special6.png', id: 'itemDrawSpecial' }, 
		{ src: ASSET_PATH + 'assets/DEMP/notDrawSpecial.png', id: 'notDrawSpecial' }, 

		{ src: ASSET_PATH + 'assets/DEMP/itemJkInfo_result.png', id: 'itemJkInfoResult' }

	];

	for(var n=0; n<ballAssets.length; n++){
		manifest.push({src: ASSET_PATH + ballAssets[n].drum, id:'ballDrum'+n});
		manifest.push({src: ASSET_PATH + ballAssets[n].reveal, id:'ballReveal'+n});
		manifest.push({src: ASSET_PATH + ballAssets[n].big, id:'ballBig'+n});
	}

	audioOn = true;

	if(audioOn){
		
		manifest.push({src: ASSET_PATH + 'assets/sounds/sound_start.ogg', id:'soundStart'});
		manifest.push({src: ASSET_PATH + 'assets/sounds/sound_end.ogg', id:'soundEnd'});
		manifest.push({src: ASSET_PATH + 'assets/sounds/sound_drop.ogg', id:'soundDrop'});
		manifest.push({src: ASSET_PATH + 'assets/sounds/sound_pipe.ogg', id:'soundPipe'});
		manifest.push({src: ASSET_PATH + 'assets/sounds/sound_drum.ogg', id:'soundDrum'});
		manifest.push({src: ASSET_PATH + 'assets/sounds/sound_hover.ogg', id:'soundHover'});
		manifest.push({src: ASSET_PATH + 'assets/sounds/sound_reveal.ogg', id:'soundReveal'});

		createjs.Sound.alternateExtensions = ["mp3"];
		loader.installPlugin(createjs.Sound);
	}
	
	loader.addEventListener("complete", handleComplete);
	loader.addEventListener("fileload", fileComplete);
	loader.addEventListener("error", handleFileError);
	loader.on("progress", handleProgress, this);
	loader.loadManifest(manifest);
}

function fileComplete(evt) {
	var item = evt.item;
}

function handleFileError(evt) {
	console.error("[bingo] no se pudo cargar", evt && evt.data && evt.data.src);
}

function handleProgress() {
	$('#mainLoader span').html(Math.round(loader.progress/1*100)+' %');
}

function handleComplete() {
	toggleLoader(false);
	initMain();
}

function toggleLoader(con){
	if(con){
		$('#mainLoader').show();
	}else{
		$('#mainLoader').hide();
	}
}
 