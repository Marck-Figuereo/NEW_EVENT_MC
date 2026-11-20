////////////////////////////////////////////////////////////
// VIDA - movimiento del sorteo
//
//   - La bola que sale del bombo VUELA hasta su casilla (arco, giro y llegada con rebote) en
//     lugar de aparecer cayendo dentro de la casilla. La bola grande anterior vuelve al bombo.
//   - Al llegar, una ONDA de luz recorre las bolas que ya estan en el tablero, desde la nueva
//     hacia afuera, y las bolas del tablero tienen reflejos sueltos mientras se espera.
//   - Cuando sale un premio, las bolas del tablero que forman la figura del ganador laten.
//   - MEJORES CARTONES: cada carton es una fila con vida propia. Cuando cambia el orden las
//     filas se deslizan a su nuevo puesto; cuando le baja lo que falta, la cifra destella; las
//     que entran o salen del top 12 aparecen o se desvanecen.
//   - Popup de ganador: entra con escala y se asienta; las casillas ganadoras se encienden
//     una por una; el premio aparece con un golpe de luz; al salir se encoge y se apaga.
//
// Nada de esto toca datos: solo mueve lo que ya llego de la API. Con "reducir movimiento" se
// usan fundidos sin desplazamientos.
////////////////////////////////////////////////////////////

const Vida = (function () {

	const QUIETO = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
	const azar = (a, b) => a + Math.random() * (b - a);

	/* Brillo redondo (para la onda y los reflejos de las bolas) */
	const SPR_HALO = (function () {
		const c = document.createElement('canvas'); c.width = c.height = 128;
		const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
		r.addColorStop(0, 'rgba(255,245,215,0.9)'); r.addColorStop(0.35, 'rgba(255,205,110,0.45)'); r.addColorStop(1, 'rgba(255,170,60,0)');
		g.fillStyle = r; g.fillRect(0, 0, 128, 128);
		return c;
	})();
	// Reflejo diagonal pequeño (cruza la bola como luz sobre vidrio)
	const SPR_REFLEJO = (function () {
		const c = document.createElement('canvas'); c.width = 64; c.height = 16;
		const g = c.getContext('2d'), l = g.createLinearGradient(0, 0, 64, 0);
		l.addColorStop(0, 'rgba(255,255,255,0)'); l.addColorStop(0.5, 'rgba(255,255,255,0.75)'); l.addColorStop(1, 'rgba(255,255,255,0)');
		g.fillStyle = l; g.fillRect(0, 0, 64, 16);
		return c;
	})();

	function halo(capa, x, y, radio) {
		const b = new createjs.Bitmap(SPR_HALO);
		b.regX = b.regY = 64; b.x = x; b.y = y;
		b.scaleX = b.scaleY = (radio * 2) / 128;
		b.compositeOperation = 'lighter';
		b.alpha = 0;
		capa.addChild(b);
		return b;
	}

	/* ------------------------------------------------------------ capa sobre el tablero */

	let capaTablero = null;          // encima de las casillas, debajo de los paneles de datos
	let brillosCasilla = [];         // un halo por casilla (para la onda y los latidos)
	let latido = [];                 // tweens de las bolas que laten
	let reflejoTimer = null;

	function preparar() {
		if (capaTablero) return;
		capaTablero = new createjs.Container();
		capaTablero.mouseEnabled = false;
		drawContainer.addChildAt(capaTablero, drawContainer.getChildIndex(infoContainer));
		for (let n = 0; n < TOTAL_SLOTS; n++) {
			const p = $.draw['placed' + n];
			brillosCasilla.push(halo(capaTablero, p.x, p.y, 62));
		}
	}

	function casillaLlena(n) { const d = $.draw['drop' + n]; return d && d.numChildren > 0; }

	/* ------------------------------------------------------------ bola que vuela */

	/* La bola grande anterior vuelve al bombo en lugar de desaparecer de golpe. */
	function retirarBolaGrande() {
		const vieja = drawDrumBallContainer.children.slice();
		vieja.forEach(b => {
			TweenMax.killTweensOf(b);
			TweenMax.to(b, 0.45, { scaleX: 0.25, scaleY: 0.25, y: 140, alpha: 0, rotation: b.rotation + 40, ease: Power2.easeIn,
				onComplete: () => { if (b.parent) b.parent.removeChild(b); } });
		});
	}

	/* Sale la bola grande del bombo con mas cuerpo: sube girando y se asienta con rebote. */
	function salidaBolaGrande(bola) {
		const giro = azar(-70, 70);
		bola.rotation = giro;
		TweenMax.to(bola, 0.95, {
			bezier: { type: 'thru', values: [{ x: 0, y: 150 }, { x: -70, y: 60 }, { x: 0, y: 0 }], curviness: 1.6 },
			ease: Power3.easeOut, overwrite: true
		});
		TweenMax.fromTo(bola, 0.95, { scaleX: 0.2, scaleY: 0.2 }, { scaleX: 1, scaleY: 1, ease: Back.easeOut.config(1.5) });
		TweenMax.to(bola, 1.25, { rotation: 0, ease: Elastic.easeOut.config(1, 0.55) });
		TweenMax.to(bola.bgBall, 1.1, { x: 0, y: 0, ease: Power3.easeOut, overwrite: true });
	}

	/* Copia de la bola que vuela del centro a su casilla. Al llegar llama a alLlegar(). */
	function volarACasilla(numero, indice, alLlegar) {
		preparar();
		const p = $.draw['placed' + indice];
		const viajera = createBall('ballReveal', numero);
		const desdeX = drawDrumBallContainer.x, desdeY = drawDrumBallContainer.y;
		const escalaGrande = (gameSettings.bigBallRadius * drawDrumBallContainer.scaleX) / 150;
		const escalaCasilla = $.draw['drop' + indice].scaleX;
		viajera.x = desdeX; viajera.y = desdeY;
		viajera.scaleX = viajera.scaleY = escalaGrande;
		viajera.alpha = 0;
		capaTablero.addChild(viajera);

		if (QUIETO) {
			TweenMax.to(viajera, 0.3, { alpha: 1, onComplete: () => { capaTablero.removeChild(viajera); alLlegar(); } });
			return;
		}
		// arco: sube un poco hacia el lado de la casilla y baja sobre ella
		const medioX = (desdeX + p.x) / 2, medioY = Math.min(desdeY, p.y) - 70;
		TweenMax.to(viajera, 0.12, { alpha: 1 });
		TweenMax.to(viajera, 0.8, {
			bezier: { type: 'soft', values: [{ x: medioX, y: medioY }, { x: p.x, y: p.y }] },
			scaleX: escalaCasilla, scaleY: escalaCasilla, rotation: (p.x < desdeX ? -1 : 1) * 360,
			ease: Power2.easeInOut,
			onComplete: () => { if (viajera.parent) viajera.parent.removeChild(viajera); alLlegar(); }
		});
	}

	/* La bola ya en su casilla: aplasta y rebota, destello y onda. */
	function aterrizar(indice, bolaCasilla) {
		bolaCasilla.y = 0;
		bolaCasilla.rotation = 0;
		if (!QUIETO) {
			TweenMax.fromTo(bolaCasilla, 0.55, { scaleX: 1.22, scaleY: 0.8 }, { scaleX: 1, scaleY: 1, ease: Elastic.easeOut.config(1.1, 0.4) });
		}
		onda(indice);
	}

	/* Onda de luz que sale de la casilla nueva y pasa por las bolas que ya salieron. */
	function onda(indice) {
		preparar();
		const o = $.draw['placed' + indice];
		for (let n = 0; n < TOTAL_SLOTS; n++) {
			if (!casillaLlena(n)) continue;
			const p = $.draw['placed' + n], h = brillosCasilla[n];
			const d = Math.hypot(p.x - o.x, p.y - o.y);
			const retraso = d / 1500;
			const fuerza = n === indice ? 1 : Math.max(0.22, 0.6 - d / 2600);
			TweenMax.killTweensOf(h);
			TweenMax.fromTo(h, 0.18, { alpha: 0 }, { alpha: fuerza, delay: retraso, ease: Power1.easeOut });
			TweenMax.to(h, 0.7, { alpha: 0, delay: retraso + 0.18, ease: Power2.easeOut });
			if (!QUIETO && n !== indice) {
				const bola = $.draw['drop' + n].children[0];
				if (bola) TweenMax.fromTo(bola, 0.5, { scaleX: 1.08, scaleY: 1.08 }, { scaleX: 1, scaleY: 1, delay: retraso, ease: Power2.easeOut });
			}
		}
	}

	/* Mientras el sorteo corre: un reflejo cruza de vez en cuando una bola del tablero. */
	function reflejosSueltos(activo) {
		clearTimeout(reflejoTimer);
		if (!activo || QUIETO) return;
		const uno = () => {
			const llenas = [];
			for (let n = 0; n < TOTAL_SLOTS; n++) if (casillaLlena(n)) llenas.push(n);
			if (llenas.length && capaTablero) {
				const n = llenas[Math.floor(Math.random() * llenas.length)], p = $.draw['placed' + n];
				const r = new createjs.Bitmap(SPR_REFLEJO);
				r.regX = 32; r.regY = 8; r.rotation = -35; r.compositeOperation = 'lighter';
				r.x = p.x - 34; r.y = p.y - 26; r.alpha = 0;
				const m = new createjs.Shape(); m.graphics.beginFill('#000').drawCircle(p.x, p.y, 40); r.mask = m;
				capaTablero.addChild(r);
				TweenMax.to(r, 0.2, { alpha: 0.8 });
				TweenMax.to(r, 0.75, { x: p.x + 34, y: p.y + 26, ease: Sine.easeInOut, onComplete: () => { if (r.parent) r.parent.removeChild(r); } });
				TweenMax.to(r, 0.25, { alpha: 0, delay: 0.5 });
			}
			reflejoTimer = setTimeout(uno, azar(450, 1100));
		};
		reflejoTimer = setTimeout(uno, 800);
	}

	/* Bolas del tablero que forman la figura ganadora: laten hasta que se llame a calmar(). */
	function resaltar(numeros, color) {
		preparar();
		calmar();
		const set = new Set(numeros);
		for (let n = 0; n < gameData.revealIndex; n++) {
			if (!set.has(gameData.revealNumbers[n])) continue;
			const h = brillosCasilla[n], bola = $.draw['drop' + n].children[0];
			TweenMax.killTweensOf(h);
			h.alpha = 0.25;
			latido.push(TweenMax.to(h, 0.55, { alpha: 0.85, yoyo: true, repeat: -1, ease: Sine.easeInOut, delay: (n % 5) * 0.06 }));
			if (bola && !QUIETO) latido.push(TweenMax.to(bola, 0.55, { scaleX: 1.07, scaleY: 1.07, yoyo: true, repeat: -1, ease: Sine.easeInOut, delay: (n % 5) * 0.06 }));
		}
	}

	function calmar() {
		latido.forEach(t => t.kill());
		latido = [];
		brillosCasilla.forEach(h => { TweenMax.to(h, 0.4, { alpha: 0 }); });
		for (let n = 0; n < TOTAL_SLOTS; n++) {
			const b = $.draw['drop' + n] && $.draw['drop' + n].children[0];
			if (b) TweenMax.to(b, 0.3, { scaleX: 1, scaleY: 1 });
		}
	}

	function reiniciar() {
		calmar();
		reflejosSueltos(false);
		if (capaTablero) capaTablero.children.slice().forEach(c => { if (brillosCasilla.indexOf(c) < 0) capaTablero.removeChild(c); });
		brillosCasilla.forEach(h => { TweenMax.killTweensOf(h); h.alpha = 0; });
	}

	/* ------------------------------------------------------------ MEJORES CARTONES */

	/* Lista animada. geo = { x, y, paso, ancho, cols: {lugar, ticket, faltan}, anchos: {...} }. */
	function ListaCartones(contenedor, geo) {
		const capa = new createjs.Container();
		contenedor.addChild(capa);
		const filas = new Map();        // clave -> { c, lugar, ticket, faltan, n, puesto }
		const ORO = '#fcc65b';

		function crearFila(c) {
			const cont = new createjs.Container();
			const t = (col, w) => Object.assign(nuevoTexto("20px bebasregular", "#fff", "left", "top", ''), { x: geo.x + geo.cols[col], maxWidth: w });
			const f = { c: cont, lugar: t('lugar', geo.anchos.lugar), ticket: t('ticket', geo.anchos.ticket), faltan: t('faltan', geo.anchos.faltan), n: null, puesto: -1 };
			const fondo = new createjs.Shape();
			fondo.graphics.beginFill('rgba(252,198,91,0.16)').drawRoundRect(geo.x + geo.cols.lugar - 8, -3, geo.ancho, geo.paso - 2, 5);
			fondo.alpha = 0;
			f.fondo = fondo;
			cont.addChild(fondo, f.lugar, f.ticket, f.faltan);
			f.lugar.text = sinAcentos(c.lugar);
			f.ticket.text = c.ticket;
			capa.addChild(cont);
			return f;
		}

		return {
			actualizar(lista) {
				const vivas = new Set();
				lista.slice(0, 12).forEach((c, puesto) => {
					const clave = c.lugar + '|' + c.ticket;
					vivas.add(clave);
					let f = filas.get(clave), nueva = false;
					if (!f) { f = crearFila(c); filas.set(clave, f); nueva = true; }
					const y = geo.y + puesto * geo.paso;
					const n = c.faltan.length;
					const color = n <= 1 ? ORO : '#fff';
					f.lugar.color = f.ticket.color = f.faltan.color = color;
					const texto = n === 0 ? 'BINGO' : n <= 4 ? c.faltan.join('  ') : String(n);
					const bajo = f.n != null && n < f.n;
					f.faltan.text = texto;
					f.n = n;

					TweenMax.killTweensOf(f.c);
					if (nueva) {
						f.c.y = y; f.c.alpha = 0; f.c.x = QUIETO ? 0 : 14;
						TweenMax.to(f.c, 0.45, { alpha: 1, x: 0, ease: Power3.easeOut, delay: puesto * 0.015 });
					} else {
						f.c.alpha = 1; f.c.x = 0;
						if (f.puesto !== puesto) {
							if (QUIETO) f.c.y = y;
							else TweenMax.to(f.c, 0.55, { y: y, ease: Power3.easeInOut });
							// sube en el ranking: se marca un instante
							if (puesto < f.puesto) { TweenMax.killTweensOf(f.fondo); TweenMax.fromTo(f.fondo, 0.15, { alpha: 0 }, { alpha: 1, onComplete: () => TweenMax.to(f.fondo, 0.9, { alpha: 0, delay: 0.2 }) }); }
						}
					}
					if (bajo && !QUIETO) {
						// la cifra de lo que falta destella y da un pequeño salto
						TweenMax.killTweensOf(f.faltan);
						f.faltan.scaleX = f.faltan.scaleY = 1;
						TweenMax.fromTo(f.faltan, 0.4, { scaleX: 1.25, scaleY: 1.25, alpha: 0.4 }, { scaleX: 1, scaleY: 1, alpha: 1, ease: Back.easeOut.config(2) });
					}
					f.puesto = puesto;
				});
				// las que salen del top 12 se desvanecen
				filas.forEach((f, clave) => {
					if (vivas.has(clave)) return;
					filas.delete(clave);
					TweenMax.killTweensOf(f.c);
					TweenMax.to(f.c, 0.35, { alpha: 0, x: QUIETO ? 0 : -14, ease: Power2.easeIn, onComplete: () => { if (f.c.parent) f.c.parent.removeChild(f.c); } });
				});
			},
			limpiar() {
				filas.forEach(f => { TweenMax.killTweensOf(f.c); if (f.c.parent) f.c.parent.removeChild(f.c); });
				filas.clear();
			}
		};
	}

	/* ------------------------------------------------------------ popup de ganador */

	/* Entrada: el marco crece y se asienta; las casillas ganadoras se encienden en orden. */
	function entradaPopup(marco, overlay, encendidos, premio) {
		TweenMax.killTweensOf(marco);
		TweenMax.fromTo(overlay, 0.45, { alpha: 0 }, { alpha: 1, ease: Power2.easeOut });
		if (QUIETO) { TweenMax.fromTo(marco, 0.4, { alpha: 0 }, { alpha: 1 }); return; }
		TweenMax.fromTo(marco, 0.6, { alpha: 0, scaleX: 0.86, scaleY: 0.86 }, { alpha: 1, scaleX: 1, scaleY: 1, ease: Back.easeOut.config(1.3) });
		encendidos.forEach((e, i) => {
			const d = 0.45 + i * 0.11;
			if (e.aro) TweenMax.fromTo(e.aro, 0.35, { alpha: 0 }, { alpha: 1, delay: d, ease: Power2.easeOut });
			TweenMax.fromTo(e.num, 0.45, { scaleX: 1.5, scaleY: 1.5, alpha: 0.2 }, { scaleX: 1, scaleY: 1, alpha: 1, delay: d, ease: Back.easeOut.config(2.2) });
		});
		if (premio) {
			const d = 0.5 + encendidos.length * 0.11;
			TweenMax.fromTo(premio, 0.55, { scaleX: 0.6, scaleY: 0.6, alpha: 0 }, { scaleX: 1, scaleY: 1, alpha: 1, delay: d, ease: Back.easeOut.config(2) });
		}
	}

	function salidaPopup(marco, overlay, duracion) {
		if (!QUIETO) TweenMax.to(marco, duracion, { scaleX: 0.92, scaleY: 0.92, ease: Power2.easeIn });
	}

	return {
		retirarBolaGrande, salidaBolaGrande, volarACasilla, aterrizar, onda,
		reflejosSueltos, resaltar, calmar, reiniciar,
		ListaCartones, entradaPopup, salidaPopup
	};
})();

window.Vida = Vida;
