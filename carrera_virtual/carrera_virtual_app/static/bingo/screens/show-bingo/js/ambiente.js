////////////////////////////////////////////////////////////
// AMBIENTE - la luz del arte
//
// El arte dorado traia los destellos pintados (congelados) y por eso parecia falso. Los
// destellos se borraron de los PNG y aqui se hace la luz como en una pieza de metal real:
//
//   1. UNA SOLA FUENTE DE LUZ. Cada pocos segundos una franja de luz cruza toda la pantalla
//      de izquierda a derecha, inclinada. Solo se refleja en lo que es metal (dorado del arte:
//      marcos, filetes, titulos, medallas): se calcula una mascara del dorado de cada pieza y
//      la luz se pinta solo ahi. Lo azul oscuro y los datos no brillan.
//   2. DESTELLOS DE LENTE en los puntos donde el arte los tenia: nucleo blanco, halo azul y
//      raya horizontal que se estira. Respiran con ruido (no con un seno parejo) y cuando la
//      franja de luz pasa por encima se encienden: todo responde a la misma luz.
//   3. En el sorteo: destello en la casilla donde cae cada bola; en los popups de ganador la
//      luz cruza el marco y el titulo al abrir y, en el JACKPOT, cae confeti dorado.
//
// Todo se suma como luz ('lighter') por debajo de los datos. Con "reducir movimiento" del
// sistema no se monta nada.
////////////////////////////////////////////////////////////

const Ambiente = (function () {

	const APAGADO = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
	const ANGULO = 22 * Math.PI / 180;           // inclinacion de la franja de luz
	const ANCHO_LUZ = 230;                        // ancho de la franja (unidades del canvas)
	const CRUCE = 2.6;                            // segundos que tarda en cruzar la pantalla

	const paginas = { results: null, game: null, fondo: null, popup: null };

	const resolucion = () => Math.max(1, Math.min(2, typeof dpr !== 'undefined' ? dpr : 1));
	const azar = (a, b) => a + Math.random() * (b - a);
	const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

	/* Ruido suave 1D (para que el titileo no sea un seno parejo) */
	function ruido(semilla) {
		const f = [azar(0.21, 0.37), azar(0.53, 0.81), azar(1.1, 1.7)], fase = f.map(() => Math.random() * 6.28);
		return t => (Math.sin(t * f[0] * 6.28 + fase[0]) * 0.5 + Math.sin(t * f[1] * 6.28 + fase[1]) * 0.3 + Math.sin(t * f[2] * 6.28 + fase[2]) * 0.2 + 1) / 2;
	}

	function lienzo(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

	/* ------------------------------------------------------------ destello de lente */

	const SPR = (function () {
		const w = 520, h = 140, c = lienzo(w, h), g = c.getContext('2d'), cx = w / 2, cy = h / 2;
		// raya horizontal: gradiente radial aplastado (se afina hacia las puntas, sin cortes)
		g.save(); g.translate(cx, cy); g.scale(1, 0.035);
		let r = g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
		r.addColorStop(0, 'rgba(225,242,255,0.95)'); r.addColorStop(0.18, 'rgba(140,200,255,0.55)');
		r.addColorStop(0.5, 'rgba(60,140,255,0.16)'); r.addColorStop(1, 'rgba(40,110,255,0)');
		g.fillStyle = r; g.fillRect(-w / 2, -h / 0.035, w, h * 2 / 0.035); g.restore();
		// halo
		r = g.createRadialGradient(cx, cy, 0, cx, cy, 58);
		r.addColorStop(0, 'rgba(120,190,255,0.55)'); r.addColorStop(0.35, 'rgba(70,140,255,0.2)'); r.addColorStop(1, 'rgba(40,100,255,0)');
		g.fillStyle = r; g.fillRect(0, 0, w, h);
		// nucleo
		r = g.createRadialGradient(cx, cy, 0, cx, cy, 13);
		r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.45, 'rgba(225,240,255,0.8)'); r.addColorStop(1, 'rgba(160,210,255,0)');
		g.fillStyle = r; g.fillRect(0, 0, w, h);
		return c;
	})();

	// Destello dorado (para la casilla donde cae una bola)
	const SPR_ORO = (function () {
		const w = 300, h = 120, c = lienzo(w, h), g = c.getContext('2d'), cx = w / 2, cy = h / 2;
		g.save(); g.translate(cx, cy); g.scale(1, 0.04);
		let r = g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
		r.addColorStop(0, 'rgba(255,248,225,0.95)'); r.addColorStop(0.25, 'rgba(255,205,110,0.45)'); r.addColorStop(1, 'rgba(255,170,60,0)');
		g.fillStyle = r; g.fillRect(-w / 2, -h / 0.04, w, h * 2 / 0.04); g.restore();
		r = g.createRadialGradient(cx, cy, 0, cx, cy, 50);
		r.addColorStop(0, 'rgba(255,250,230,0.9)'); r.addColorStop(0.3, 'rgba(255,200,100,0.35)'); r.addColorStop(1, 'rgba(255,170,60,0)');
		g.fillStyle = r; g.fillRect(0, 0, w, h);
		return c;
	})();

	function destello(capa, x, y, opc) {
		opc = opc || {};
		const b = new createjs.Bitmap(SPR);
		b.regX = SPR.width / 2; b.regY = SPR.height / 2;
		b.x = x; b.y = y;
		b.compositeOperation = 'lighter';
		capa.addChild(b);
		const esc = (opc.escala || 1) * 0.55, base = opc.base != null ? opc.base : 0.22, n = ruido();
		let chispa = 0, proxima = performance.now() + azar(3000, 12000);
		return {
			x: x, y: y,
			paso(ahora, luz) {
				const t = ahora / 1000;
				// de vez en cuando se enciende solo, como un reflejo que cambia de angulo
				if (ahora > proxima) { chispa = 1; proxima = ahora + azar(6000, 16000); }
				chispa = Math.max(0, chispa - 0.012);
				const respiro = base * (0.55 + 0.9 * n(t));
				const i = Math.min(1.2, respiro + luz * 1.1 + Math.pow(chispa, 2) * 0.8);
				b.alpha = Math.min(1, 0.15 + i * 0.85);
				b.scaleX = esc * (0.45 + 1.15 * i);           // la raya se estira con la intensidad
				b.scaleY = esc * (0.75 + 0.35 * i);
			}
		};
	}

	/* ------------------------------------------------------------ brillo sobre el metal */

	/* Copia de la pieza donde solo queda lo que es metal (dorado y brillante), aclarado.
	   Se calcula una vez por pieza, al tamaño en que se ve. */
	function mascaraMetal(img, w, h, modo) {
		const c = lienzo(w, h), g = c.getContext('2d');
		g.drawImage(img, 0, 0, c.width, c.height);
		let d;
		try { d = g.getImageData(0, 0, c.width, c.height); } catch (e) { return null; }
		const p = d.data;
		for (let i = 0; i < p.length; i += 4) {
			const r = p[i], gg = p[i + 1], b = p[i + 2], a = p[i + 3];
			let m;
			if (modo === 'color') {
				// popups: marcos y titulos de color (verde, azul, rojo, dorado) brillantes
				const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
				m = suave(110, 230, mx) * suave(0.25, 0.6, mx ? (mx - mn) / mx : 0) + suave(200, 250, mn) * 0.6;
			} else {
				// dorado: rojo alto, azul bajo; tambien los reflejos casi blancos del oro
				m = suave(30, 110, r - b) * suave(110, 210, r) + suave(215, 250, Math.min(r, gg)) * suave(10, 60, r - b) * 0.6;
			}
			m *= a / 255;
			p[i] = Math.min(255, (r + 255 * 1.4) / 2.4);
			p[i + 1] = Math.min(255, (gg + 245 * 1.4) / 2.4);
			p[i + 2] = Math.min(255, (b + 215 * 1.4) / 2.4);
			p[i + 3] = Math.round(255 * Math.min(1, m));
		}
		g.putImageData(d, 0, 0);
		return c;
	}

	/* Pieza de arte que refleja la luz. bmp: Bitmap del arte (centrado con regX/regY). */
	function metal(capa, bmp, opc) {
		opc = opc || {};
		if (!bmp || !bmp.image) return null;
		const img = bmp.image, nw = img.naturalWidth || img.width, nh = img.naturalHeight || img.height;
		const res = resolucion();
		const dw = nw * Math.abs(bmp.scaleX) * res, dh = nh * Math.abs(bmp.scaleY) * res;
		const mascara = mascaraMetal(img, dw, dh, opc.modo);
		if (!mascara) return null;
		const lienzoLuz = lienzo(mascara.width, mascara.height), g = lienzoLuz.getContext('2d');
		const vista = new createjs.Bitmap(lienzoLuz);
		vista.regX = bmp.regX * mascara.width / nw; vista.regY = bmp.regY * mascara.height / nh;
		vista.scaleX = bmp.scaleX * nw / mascara.width; vista.scaleY = bmp.scaleY * nh / mascara.height;
		vista.x = bmp.x; vista.y = bmp.y;
		vista.compositeOperation = 'lighter';
		vista.alpha = opc.intensidad || 0.75;
		capa.addChild(vista);

		// borde izquierdo de la pieza en el canvas y su escala (canvas -> pixeles del lienzo)
		const izq = bmp.x - bmp.regX * bmp.scaleX, arriba = bmp.y - bmp.regY * bmp.scaleY;
		const k = mascara.width / (nw * bmp.scaleX);
		let pintado = false;

		return {
			izq: izq, der: izq + nw * bmp.scaleX,
			/* xLuz: posicion de la franja (en el canvas) a la altura del centro de la pieza */
			paso(xLuz) {
				const cx = (xLuz - izq) * k, cy = mascara.height / 2;
				const media = ANCHO_LUZ * k;
				if (cx < -media * 2 || cx > mascara.width + media * 2) {
					if (pintado) { g.clearRect(0, 0, lienzoLuz.width, lienzoLuz.height); pintado = false; vista.visible = false; }
					return;
				}
				vista.visible = true; pintado = true;
				const dx = Math.cos(ANGULO), dy = Math.sin(ANGULO);
				const gr = g.createLinearGradient(cx - dx * media, cy - dy * media, cx + dx * media, cy + dy * media);
				gr.addColorStop(0, 'rgba(0,0,0,0)');
				gr.addColorStop(0.32, 'rgba(0,0,0,0.25)');
				gr.addColorStop(0.47, 'rgba(0,0,0,0.95)');
				gr.addColorStop(0.5, 'rgba(0,0,0,1)');
				gr.addColorStop(0.53, 'rgba(0,0,0,0.95)');
				gr.addColorStop(0.68, 'rgba(0,0,0,0.25)');
				gr.addColorStop(1, 'rgba(0,0,0,0)');
				g.globalCompositeOperation = 'copy';
				g.drawImage(mascara, 0, 0);
				g.globalCompositeOperation = 'destination-in';
				g.fillStyle = gr;
				g.fillRect(0, 0, lienzoLuz.width, lienzoLuz.height);
				g.globalCompositeOperation = 'source-over';
			}
		};
	}

	/* ------------------------------------------------------------ la luz que cruza */

	/* Posicion de la franja en el canvas para la altura y, o null si no esta cruzando. */
	function Luz(ancho, primera) {
		let inicio = performance.now() + primera * 1000;
		return {
			x(ahora, y, alto) {
				const t = (ahora - inicio) / 1000;
				if (t > CRUCE) { inicio = ahora + azar(5.5, 8.5) * 1000; return null; }
				if (t < 0) return null;
				const p = t / CRUCE, e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
				const x0 = -ANCHO_LUZ * 2 + e * (ancho + ANCHO_LUZ * 4);
				return x0 + (y - alto / 2) * Math.tan(ANGULO);          // franja inclinada
			}
		};
	}

	/* ------------------------------------------------------------ pagina */

	function Pagina(contenedor, indice) {
		const capa = new createjs.Container();
		capa.mouseEnabled = false;
		if (indice != null) contenedor.addChildAt(capa, Math.min(indice, contenedor.numChildren));
		else contenedor.addChild(capa);
		const piezas = [], destellos = [], extras = [];
		const luz = Luz(typeof canvasW !== 'undefined' ? canvasW : 1600, azar(1.2, 2.2));
		return {
			capa: capa,
			metal(bmp, opc) { const m = metal(capa, bmp, opc); if (m) { m.y = bmp.y; piezas.push(m); } },
			destello(x, y, opc) { destellos.push(destello(capa, x, y, opc)); },
			extra(fn) { extras.push(fn); },
			paso(ahora) {
				const alto = typeof canvasH !== 'undefined' ? canvasH : 900;
				for (const p of piezas) { const x = luz.x(ahora, p.y, alto); p.paso(x == null ? -1e6 : x); }
				for (const d of destellos) {
					const x = luz.x(ahora, d.y, alto);
					const cerca = x == null ? 0 : Math.max(0, 1 - Math.abs(x - d.x) / (ANCHO_LUZ * 0.9));
					d.paso(ahora, cerca * cerca);
				}
				for (const f of extras) f(ahora);
			},
			quitar() { if (capa.parent) capa.parent.removeChild(capa); }
		};
	}

	function montar(nombre, contenedor, indice) {
		if (paginas[nombre]) paginas[nombre].quitar();
		paginas[nombre] = Pagina(contenedor, indice);
		return paginas[nombre];
	}

	/* Punto del arte (fraccion 0..1 del PNG) en el canvas. */
	function punto(bmp, fx, fy) {
		const w = bmp.image.naturalWidth || bmp.image.width, h = bmp.image.naturalHeight || bmp.image.height;
		return { x: bmp.x + (fx * w - bmp.regX) * bmp.scaleX, y: bmp.y + (fy * h - bmp.regY) * bmp.scaleY };
	}

	/* Destellos: donde estaban pintados en el arte original (fracciones medidas sobre el PNG) */
	const DESTELLOS = {
		previous_draws2: [[0.488, 0.012, 1.1, 0.3], [0.464, 0.987, 1, 0.3], [0.47, 0.101, 0.6, 0.12], [0.469, 0.281, 0.6, 0.12], [0.469, 0.459, 0.6, 0.12], [0.469, 0.636, 0.6, 0.12], [0.471, 0.811, 0.6, 0.12]],
		next_draws2: [[0.48, 0.011, 1.1, 0.3], [0.477, 0.982, 1, 0.3], [0.523, 0.281, 0.6, 0.12], [0.536, 0.452, 0.6, 0.12], [0.519, 0.622, 0.6, 0.12], [0.513, 0.793, 0.6, 0.12]],
		special_draws: [[0.483, 0.004, 1.1, 0.3]],
		background: [[0.5, 0.024, 1.3, 0.25], [0.498, 0.967, 1.3, 0.25], [0.011, 0.455, 0.9, 0.2], [0.989, 0.455, 0.9, 0.2]],
		itemJkActual: [[0.362, 0.03, 1, 0.3], [0.736, 0.989, 0.9, 0.25]],
		itemJkInfo: [[0.32, 0.06, 0.9, 0.25]],
		itemCarton: [[0.502, 0.125, 0.8, 0.3]],
		itemTable: [[0.568, 0.024, 1, 0.3]]
	};
	function destellosDe(pag, bmp, clave) {
		(DESTELLOS[clave] || []).forEach(d => { const p = punto(bmp, d[0], d[1]); pag.destello(p.x, p.y, { escala: d[2], base: d[3] }); });
	}

	/* Confeti dorado que cae dentro de un rectangulo (popup del JACKPOT). */
	function confeti(capa, r, cantidad) {
		const piezas = [], colores = ['#ffe7a3', '#f2c356', '#d9a441', '#fff4d6'];
		for (let i = 0; i < cantidad; i++) {
			const s = new createjs.Shape(), w = azar(3, 7), h = azar(6, 12);
			s.graphics.beginFill(colores[i % colores.length]).drawRect(-w / 2, -h / 2, w, h);
			s.compositeOperation = 'lighter';
			piezas.push({ s: s, x: azar(r.x, r.x + r.w), y: azar(r.y - r.h, r.y), v: azar(40, 95), giro: azar(-240, 240), vaiven: azar(0.8, 2.2), fase: Math.random() * 6, alfa: azar(0.45, 0.95) });
			capa.addChild(s);
		}
		let antes = performance.now();
		return function (ahora) {
			const dt = Math.min(0.05, (ahora - antes) / 1000); antes = ahora;
			piezas.forEach(p => {
				p.y += p.v * dt;
				if (p.y > r.y + r.h) { p.y = r.y - 10; p.x = azar(r.x, r.x + r.w); }
				p.s.x = p.x + Math.sin(ahora / 1000 * p.vaiven + p.fase) * 10;
				p.s.y = p.y;
				p.s.rotation += p.giro * dt;
				p.s.scaleY = Math.abs(Math.cos(ahora / 1000 * p.vaiven * 2 + p.fase)) * 0.8 + 0.2;
				p.s.alpha = Math.max(0, Math.min(1, (p.y - r.y) / 40, (r.y + r.h - p.y) / 40)) * p.alfa;
			});
		};
	}

	/* ------------------------------------------------------------ API */

	return {
		get apagado() { return APAGADO; },

		montarFondo(contenedor, indice, bg) {
			if (APAGADO || !bg || !bg.image) return;
			const pag = montar('fondo', contenedor, indice);
			destellosDe(pag, bg, 'background');
		},

		/* SORTEOS. arte = { anteriores, proximos, especiales, ultimo, jackpot, hora, conteo, logo, tarjetas[] } */
		montarSorteos(contenedor, indice, arte) {
			if (APAGADO) return;
			const pag = montar('results', contenedor, indice);
			[arte.anteriores, arte.proximos, arte.especiales, arte.ultimo, arte.jackpot, arte.hora, arte.conteo, arte.logo]
				.concat(arte.tarjetas || []).forEach(b => pag.metal(b));
			destellosDe(pag, arte.anteriores, 'previous_draws2');
			destellosDe(pag, arte.proximos, 'next_draws2');
			destellosDe(pag, arte.especiales, 'special_draws');
		},

		/* Pantalla del sorteo. arte = { jackpot, ultimo, cartones, premios, bola } */
		montarSorteo(contenedor, indice, arte) {
			if (APAGADO) return;
			const pag = montar('game', contenedor, indice);
			[arte.jackpot, arte.ultimo, arte.cartones, arte.premios, arte.bola].forEach(b => pag.metal(b));
			destellosDe(pag, arte.jackpot, 'itemJkActual');
			destellosDe(pag, arte.ultimo, 'itemJkInfo');
			destellosDe(pag, arte.cartones, 'itemCarton');
			destellosDe(pag, arte.premios, 'itemTable');
		},

		/* Destello dorado en la casilla donde cae una bola. */
		casilla(contenedor, x, y) {
			if (APAGADO) return;
			const b = new createjs.Bitmap(SPR_ORO);
			b.regX = SPR_ORO.width / 2; b.regY = SPR_ORO.height / 2;
			b.x = x; b.y = y + 28;                      // en el borde de abajo de la casilla
			b.compositeOperation = 'lighter';
			contenedor.addChild(b);
			TweenMax.fromTo(b, 0.9, { alpha: 1, scaleX: 0.3, scaleY: 0.6 }, { alpha: 0, scaleX: 0.9, scaleY: 0.9, ease: Power2.easeOut,
				onComplete: () => { if (b.parent) b.parent.removeChild(b); } });
		},

		/* Popup de ganador: la luz cruza su marco y titulo enseguida; JACKPOT con confeti. */
		popup(contenedor, bmp, rect, jackpot) {
			if (APAGADO) return;
			const pag = montar('popup', contenedor);
			// La luz del popup va por su cuenta: cruza apenas abre y luego cada pocos segundos
			const m = metal(pag.capa, bmp, { modo: 'color', intensidad: 0.85 });
			let inicio = performance.now() + 350;
			if (m) pag.extra(ahora => {
				const t = (ahora - inicio) / 1000, dur = 1.5;
				if (t > dur) { inicio = ahora + 2600; m.paso(-1e6); return; }
				if (t < 0) { m.paso(-1e6); return; }
				const p = t / dur, e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
				m.paso(m.izq - ANCHO_LUZ * 2 + e * (m.der - m.izq + ANCHO_LUZ * 4));
			});
			if (jackpot) pag.extra(confeti(pag.capa, { x: rect.x + rect.w * 0.04, y: rect.y + rect.h * 0.05, w: rect.w * 0.92, h: rect.h * 0.9 }, 70));
		},

		cerrarPopup() { if (paginas.popup) { paginas.popup.quitar(); paginas.popup = null; } },

		/* Avanza la luz de una pagina. Devuelve true si hay algo vivo que pintar. */
		paso(pagina, ahora) {
			if (APAGADO) return false;
			const lista = [paginas[pagina], paginas.fondo];
			if (pagina === 'game') lista.push(paginas.popup);
			let vivo = false;
			for (const p of lista) if (p) { p.paso(ahora); vivo = true; }
			return vivo;
		}
	};
})();

// Las demas piezas lo buscan como window.Ambiente (una const de nivel superior no queda en window)
window.Ambiente = Ambiente;
