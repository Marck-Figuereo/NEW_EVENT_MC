(() => {
  "use strict";

  /* =========================================================
     ROULETTE MULTIPLIERS
     Canvas 2560x1440 + GSAP @ 60 FPS
     SIN VIDEO DE FONDO
     ========================================================= */

  const W = 2560;
  const H = 1440;
  
  const INTRO_DURATION = 10;

  const RED_NUMBERS = new Set([
    1, 3, 5, 7, 9, 12, 14, 16, 18,
    19, 21, 23, 25, 27, 30, 32, 34, 36
  ]);

  const ASSET_PATHS = {
    title: "assets/title.png",

    balls: {
      red: "assets/ball_red.png",
      black: "assets/ball_black.png",
      green: "assets/ball_green.png"
    },

    multipliers: {
      50: "assets/x50.png",
      100: "assets/x100.png",
      150: "assets/x150.png",
      200: "assets/x200.png",
      300: "assets/x300.png",
      500: "assets/x500.png"
    }
  };

  const DEMO = [
    { number: 17, multiplier: 100 },
    { number: 32, multiplier: 50 },
    { number: 8,  multiplier: 200 },
    { number: 23, multiplier: 300 }
  ];

  const canvas = document.getElementById("fxCanvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  const backgroundVideo = document.getElementById("backgroundVideo");

  const repeatButton = document.getElementById("repeatButton");
  const debugMode = new URLSearchParams(location.search).get("debug") === "1";

  if (debugMode) {
    document.body.classList.add("debug-preview");
  }

  /* PRUEBA DE RENDIMIENTO — RESOLUCIÓN REAL DE TRABAJO 1920x1080

     W y H siguen siendo el ESPACIO DE DISEÑO (2560x1440), así que ninguna
     coordenada, tamaño, posición ni animación de este archivo cambia.
     Lo único que cambia es el framebuffer: el canvas mide físicamente
     1920x1080 y todo se dibuja con un factor base de 0.75.

         2560 * 0.75 = 1920
         1440 * 0.75 = 1080

     No hay un canvas de 2560x1440 detrás reducido por CSS. */
  const RENDER_SCALE = 1920 / W;      // 0.75

  canvas.width  = Math.round(W * RENDER_SCALE);    // 1920
  canvas.height = Math.round(H * RENDER_SCALE);    // 1080

  const images = {};
  let masterTimeline = null;
  let idleTweens = [];
  let currentData = [];

  const scene = {
    flash: 0,
    title: {
      alpha: 0,
      scale: 0.62,
      y: 42,
      glow: 0,
      pulse: 0
    },
    items: []
  };

  let particles = [];
  let bolts = [];
  let lastTick = performance.now();

  /* ---------------------------------------------------------
     Asset loading
     --------------------------------------------------------- */

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`No se pudo cargar: ${src}`));

      img.src = src;
    });
  }

  async function preloadAssets() {
    images.title = await loadImage(ASSET_PATHS.title);

    images.balls = {
      red: await loadImage(ASSET_PATHS.balls.red),
      black: await loadImage(ASSET_PATHS.balls.black),
      green: await loadImage(ASSET_PATHS.balls.green)
    };

    images.multipliers = {};

    for (const [value, src] of Object.entries(ASSET_PATHS.multipliers)) {
      images.multipliers[value] = await loadImage(src);
    }
  }

  /* ---------------------------------------------------------
     Roulette helpers
     --------------------------------------------------------- */

  function rouletteColor(number) {
    const n = Number(number);

    if (n === 0) return "green";
    return RED_NUMBERS.has(n) ? "red" : "black";
  }

  function normalizeData(data) {
    return (Array.isArray(data) ? data : [])
      .slice(0, 5)
      .map(item => ({
        number: Number(item.number),
        multiplier: Number(item.multiplier)
      }))
      .filter(item =>
        Number.isInteger(item.number) &&
        item.number >= 0 &&
        item.number <= 36 &&
        Boolean(images.multipliers[item.multiplier])
      );
  }

  /* ---------------------------------------------------------
     Layout 1-5 items
     --------------------------------------------------------- */

  function xPositions(count) {
    const maps = {
      1: [1280],
      2: [860, 1700],
      3: [610, 1280, 1950],
      4: [470, 1010, 1550, 2090],
      5: [320, 800, 1280, 1760, 2240]
    };

    return maps[count] || maps[5];
  }

  function metricsForCount(count) {
    if (count === 5) {
      return {
        ballSize: 245,
        multiplierWidth: 285,
        ballY: 835,
        multiplierY: 1082
      };
    }

    if (count === 4) {
      return {
        ballSize: 278,
        multiplierWidth: 330,
        ballY: 825,
        multiplierY: 1100
      };
    }

    return {
      ballSize: 310,
      multiplierWidth: 365,
      ballY: 820,
      multiplierY: 1114
    };
  }

  function buildSceneItems(data) {
    const count = data.length;
    const positions = xPositions(count);
    const metrics = metricsForCount(count);

    scene.items = data.map((item, index) => ({
      number: item.number,
      multiplier: item.multiplier,
      color: rouletteColor(item.number),

      x: positions[index],

      ballSize: metrics.ballSize,
      multiplierWidth: metrics.multiplierWidth,

      ballY: metrics.ballY + 105,
      ballTargetY: metrics.ballY,

      multiplierY: metrics.multiplierY + 90,
      multiplierTargetY: metrics.multiplierY,

      alpha: 0,
      ballScale: 0.30,
      multiplierScale: 0.45,
      rotation: index % 2 ? 0.09 : -0.09,

      glow: 0,
      ringAlpha: 0,
      ringScale: 0.20,
      floatY: 0,
      multiplierFloatY: 0
    }));
  }

  /* ---------------------------------------------------------
     Drawing helpers
     --------------------------------------------------------- */

  function drawImageCentered(img, x, y, width, alpha = 1, scale = 1, rotation = 0) {
    if (!img || alpha <= 0 || scale <= 0) return;

    const aspect = img.height / img.width;
    const height = width * aspect;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);

    ctx.drawImage(
      img,
      -width / 2,
      -height / 2,
      width,
      height
    );

    ctx.restore();
  }

  function drawTitle() {
    const s = scene.title;

    if (s.alpha <= 0) return;

    const img = images.title;
    const width = 1540;
    const height = width * (img.height / img.width);
    const x = W / 2;
    const y = 315 + s.y;

    ctx.save();
    ctx.globalAlpha = s.alpha;

    if (s.glow > 0) {
      ctx.shadowColor = `rgba(65, 168, 255, ${0.45 * s.glow})`;
      ctx.shadowBlur = 50 * s.glow;
    }

    ctx.translate(x, y);
    ctx.scale(s.scale, s.scale);

    ctx.drawImage(
      img,
      -width / 2,
      -height / 2,
      width,
      height
    );

    ctx.restore();
  }

  function drawBall(item) {
    const ball = images.balls[item.color];
    const y = item.ballY + item.floatY;

    ctx.save();

    // Live glow behind ball
    if (item.glow > 0) {
      const radius = item.ballSize * (0.60 + item.glow * 0.12);
      const g = ctx.createRadialGradient(
        item.x, y,
        0,
        item.x, y,
        radius
      );

      g.addColorStop(0, `rgba(195, 239, 255, ${0.25 * item.glow})`);
      g.addColorStop(0.35, `rgba(50, 154, 255, ${0.17 * item.glow})`);
      g.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(item.x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    drawImageCentered(
      ball,
      item.x,
      y,
      item.ballSize,
      item.alpha,
      item.ballScale,
      item.rotation
    );

    // Dynamic number on top of the ball
    if (item.alpha > 0.01) {
      const fontSize = Math.round(item.ballSize * 0.37);

      ctx.save();
      ctx.globalAlpha = item.alpha;
      ctx.translate(item.x, y);
      ctx.scale(item.ballScale, item.ballScale);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `900 ${fontSize}px Impact, "Arial Black", Arial, sans-serif`;

      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(7, fontSize * 0.075);
      ctx.strokeStyle = "rgba(0,0,0,.92)";
      ctx.strokeText(String(item.number), 0, 4);

      ctx.fillStyle = "#ffffff";
      ctx.fillText(String(item.number), 0, 4);

      ctx.restore();
    }

    // Impact ring
    if (item.ringAlpha > 0.001) {
      ctx.save();
      ctx.globalAlpha = item.ringAlpha;
      ctx.strokeStyle = "#e9fbff";
      ctx.lineWidth = 4;
      ctx.shadowColor = "#4bb8ff";
      ctx.shadowBlur = 30;

      ctx.beginPath();
      ctx.arc(
        item.x,
        y,
        item.ballSize * 0.48 * item.ringScale,
        0,
        Math.PI * 2
      );
      ctx.stroke();

      ctx.restore();
    }
  }

  function drawMultiplier(item) {
    const img = images.multipliers[item.multiplier];

    drawImageCentered(
      img,
      item.x,
      item.multiplierY + item.multiplierFloatY,
      item.multiplierWidth,
      item.alpha,
      item.multiplierScale,
      0
    );

    // Energy base: dynamic canvas effect
    if (item.alpha > 0.01 && item.glow > 0.01) {
      const x = item.x;
      const y = item.multiplierY + item.multiplierFloatY + 88;

      ctx.save();
      ctx.globalAlpha = item.alpha * (0.38 + item.glow * 0.24);

      const g = ctx.createRadialGradient(x, y, 0, x, y, item.multiplierWidth * 0.52);
      g.addColorStop(0, "rgba(230,250,255,.86)");
      g.addColorStop(.18, "rgba(69,178,255,.45)");
      g.addColorStop(.55, "rgba(31,92,225,.12)");
      g.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = g;

      ctx.beginPath();
      ctx.ellipse(
        x,
        y,
        item.multiplierWidth * 0.47,
        30 + item.glow * 6,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      ctx.restore();
    }
  }

  /* ---------------------------------------------------------
     Lightning
     --------------------------------------------------------- */

  function generateBolt(targetX, targetY) {
    const points = [];

    let x = targetX + (Math.random() - 0.5) * 180;
    let y = -40;

    points.push({ x, y });

    const segments = 13;

    for (let i = 1; i < segments; i++) {
      const t = i / segments;

      x +=
        (targetX - x) * 0.18 +
        (Math.random() - 0.5) * 92;

      y = -40 + (targetY + 40) * t;

      points.push({ x, y });
    }

    points.push({ x: targetX, y: targetY });

    return {
      points,
      alpha: 1,
      life: 0.34,
      maxLife: 0.34
    };
  }

  function spawnBolt(x, y) {
    bolts.push(generateBolt(x, y));
  }

  function updateBolts(dt) {
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];

      b.life -= dt;

      if (b.life <= 0) {
        bolts.splice(i, 1);
        continue;
      }

      b.alpha = Math.min(1, b.life / b.maxLife);
    }
  }

  function drawBolts() {
    for (const b of bolts) {
      if (b.points.length < 2) continue;

      ctx.save();
      ctx.globalAlpha = b.alpha;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Outer blue glow
      ctx.beginPath();
      ctx.moveTo(b.points[0].x, b.points[0].y);

      for (let i = 1; i < b.points.length; i++) {
        ctx.lineTo(b.points[i].x, b.points[i].y);
      }

      ctx.strokeStyle = "rgba(64,164,255,.65)";
      ctx.lineWidth = 13;
      ctx.shadowColor = "#169cff";
      ctx.shadowBlur = 30;
      ctx.stroke();

      // Bright core
      ctx.shadowBlur = 15;
      ctx.strokeStyle = "rgba(245,253,255,.98)";
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.restore();
    }
  }

  /* ---------------------------------------------------------
     Particles
     --------------------------------------------------------- */

  function spawnParticles(x, y, count = 50) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 300;
      const life = 0.42 + Math.random() * 0.65;

      particles.push({
        x: x + (Math.random() - 0.5) * 50,
        y: y + (Math.random() - 0.5) * 42,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 55,
        size: 1 + Math.random() * 4,
        life,
        maxLife: life
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      p.life -= dt;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      p.vx *= Math.pow(0.985, dt * 60);
      p.vy += 40 * dt;
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.maxLife);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#dff8ff";
      ctx.shadowColor = "#39b5ff";
      ctx.shadowBlur = 15;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  /* ---------------------------------------------------------
     Screen flash
     --------------------------------------------------------- */

  function drawFlash() {
    if (scene.flash <= 0.001) return;

    ctx.save();
    ctx.globalAlpha = scene.flash;

    const g = ctx.createRadialGradient(
      W / 2, H * 0.66,
      0,
      W / 2, H * 0.66,
      W * 0.58
    );

    g.addColorStop(0, "rgba(235,252,255,.85)");
    g.addColorStop(.20, "rgba(68,176,255,.38)");
    g.addColorStop(.55, "rgba(35,91,220,.10)");
    g.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.restore();
  }

  /* ---------------------------------------------------------
     Master renderer
     --------------------------------------------------------- */

  function render() {
    /* Transformación base de la prueba de rendimiento. Todo el dibujo de
       abajo sigue usando las coordenadas originales de 2560x1440; el canvas
       físico es 1920x1080. Todos los draw* usan save/restore balanceado,
       así que basta con fijarla una vez por frame. */
    ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);

    ctx.clearRect(0, 0, W, H);

    drawTitle();

    for (const item of scene.items) {
      drawBall(item);
      drawMultiplier(item);
    }

    drawBolts();
    drawParticles();
    drawFlash();
  }

  /* ---------------------------------------------------------
     GSAP animation
     --------------------------------------------------------- */

  function killCurrentAnimation() {
    if (masterTimeline) {
      masterTimeline.kill();
      masterTimeline = null;
    }

    for (const tween of idleTweens) {
      tween.kill();
    }

    idleTweens = [];

    gsap.killTweensOf(scene.title);
    gsap.killTweensOf(scene);

    for (const item of scene.items) {
      gsap.killTweensOf(item);
    }

    particles = [];
    bolts = [];
  }

  function impact(item) {
    item.ringAlpha = 1;
    item.ringScale = 0.18;

    spawnBolt(item.x, item.ballTargetY - item.ballSize * 0.15);
    spawnParticles(item.x, item.ballTargetY, 58);

    gsap.fromTo(
      scene,
      { flash: 0.24 },
      {
        flash: 0,
        duration: 0.30,
        ease: "power2.out",
        overwrite: true
      }
    );

    gsap.to(item, {
      ringAlpha: 0,
      ringScale: 1.82,
      duration: 0.52,
      ease: "power2.out"
    });
  }

  function addIdleMotion(item, index) {
    idleTweens.push(
      gsap.to(item, {
        floatY: index % 2 ? 7 : -7,
        duration: 1.7 + index * 0.08,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut"
      })
    );

    idleTweens.push(
      gsap.to(item, {
        multiplierFloatY: index % 2 ? -4 : 4,
        duration: 1.45 + index * 0.07,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut"
      })
    );

    idleTweens.push(
      gsap.to(item, {
        glow: 1,
        duration: 1.15 + index * 0.06,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut"
      })
    );
  }

  function play(data = DEMO) {
    if (!window.gsap) {
      console.error("GSAP no está disponible.");
      return;
    }

    restartBackgroundVideo();
    killCurrentAnimation();

    currentData = normalizeData(data);
    buildSceneItems(currentData);

    scene.title.alpha = 0;
    scene.title.scale = 0.62;
    scene.title.y = 50;
    scene.title.glow = 0;

    scene.flash = 0;

    masterTimeline = gsap.timeline();

    masterTimeline
      .to(scene.title, {
        alpha: 1,
        scale: 1.08,
        y: -8,
        glow: 1,
        duration: 0.72,
        ease: "back.out(1.8)"
      }, 0)

      .to(scene.title, {
        scale: 1,
        y: 0,
        glow: 0.36,
        duration: 0.42,
        ease: "power2.out"
      }, 0.60);

    scene.items.forEach((item, index) => {
      const at = 1.20 + index * 1.35;

      masterTimeline
        .to(item, {
          alpha: 1,
          ballY: item.ballTargetY,
          ballScale: 1.08,
          rotation: 0,
          duration: 0.60,
          ease: "back.out(1.7)",
          onStart: () => impact(item)
        }, at)

        .to(item, {
          ballScale: 1,
          duration: 0.22,
          ease: "power2.out"
        }, at + 0.50)

        .to(item, {
          multiplierY: item.multiplierTargetY,
          multiplierScale: 1.08,
          duration: 0.55,
          ease: "back.out(1.8)"
        }, at + 0.10)

        .to(item, {
          multiplierScale: 1,
          duration: 0.22,
          ease: "power2.out",
          onComplete: () => addIdleMotion(item, index)
        }, at + 0.57);
    });

    const finalPulseStart = INTRO_DURATION - 1.30;

    masterTimeline.to(scene.title, {
      glow: 0.70,
      duration: 0.65,
      yoyo: true,
      repeat: 1,
      ease: "sine.inOut"
    }, finalPulseStart);

    return masterTimeline;

  }

  function hide() {
    if (!window.gsap) return;

    const tl = gsap.timeline({
      onComplete: () => {
        scene.title.alpha = 0;

        scene.items.forEach(item => {
          item.alpha = 0;
        });
      }
    });

    tl.to(scene.title, {
      alpha: 0,
      scale: 1.03,
      duration: 0.30,
      ease: "power2.in"
    }, 0);

    scene.items.forEach((item, index) => {
      tl.to(item, {
        alpha: 0,
        ballY: item.ballY - 40,
        multiplierY: item.multiplierY + 28,
        duration: 0.30,
        ease: "power2.in"
      }, index * 0.025);
    });

    return tl;
  }

  function setMultipliers(data) {
    killCurrentAnimation();

    currentData = normalizeData(data);
    buildSceneItems(currentData);

    scene.title.alpha = 1;
    scene.title.scale = 1;
    scene.title.y = 0;
    scene.title.glow = 0.35;

    for (const [index, item] of scene.items.entries()) {
      item.alpha = 1;
      item.ballY = item.ballTargetY;
      item.ballScale = 1;
      item.multiplierY = item.multiplierTargetY;
      item.multiplierScale = 1;
      item.rotation = 0;
      item.glow = 0.55;

      addIdleMotion(item, index);
    }
  }

  function handleRouletteMessage(message) {
    if (!message || message.type !== "roulette.intro") return;

    play(message.multipliers || []);
  }

  /* ---------------------------------------------------------
     60 FPS ticker
     --------------------------------------------------------- */

  function tick() {
    HOST.frames++;

    const now = performance.now();
    const dt = Math.min(0.034, (now - lastTick) / 1000);

    lastTick = now;

    updateParticles(dt);
    updateBolts(dt);
    render();
  }

  /* ---------------------------------------------------------
     Background video
     --------------------------------------------------------- */

  /* ---------------------------------------------------------
     HOST — suspensión de la view cuando no está activa

     deactivate()  gsap.ticker.sleep()  -> se para el rAF, y con él tick():
                   no hay render, ni partículas, ni rayos, ni flashes, ni
                   avance de las tweens de entrada o de idle.
                   El video de fondo se pausa.

     activate()    gsap.ticker.wake()   -> se reanuda el MISMO tick ya
                   registrado. No se registra nada nuevo, así que entrar y
                   salir mil veces no acumula tickers ni tweens.
     --------------------------------------------------------- */

  const HOST = { active: true, ready: false, frames: 0 };

  function applyHost() {
    if (!HOST.ready) return;

    if (HOST.active) {
      window.gsap.ticker.wake();
      playBackgroundVideo();
    } else {
      window.gsap.ticker.sleep();
      if (backgroundVideo) backgroundVideo.pause();
    }
  }

  function setHostActive(on) {
    HOST.active = !!on;
    applyHost();
  }

  function restartBackgroundVideo() {
    if (!backgroundVideo) return;

    try {
      backgroundVideo.currentTime = 0;
    } catch (_) {}

    if (!HOST.active) {          // la view está suspendida
      backgroundVideo.pause();
      return;
    }

    backgroundVideo.play().catch(() => {});
  }

  function playBackgroundVideo() {
    if (!backgroundVideo) return;
    if (!HOST.active) return;    // la view está suspendida
    backgroundVideo.play().catch(() => {});
  }

  function pauseBackgroundVideo() {
    if (!backgroundVideo) return;
    backgroundVideo.pause();
  }

  /* ---------------------------------------------------------
     Public API
     --------------------------------------------------------- */

  window.RouletteMultipliers = {
    play,
    hide,
    setMultipliers,
    handleRouletteMessage,

    restartVideo: restartBackgroundVideo,
    playVideo: playBackgroundVideo,
    pauseVideo: pauseBackgroundVideo,

    /* --- control de suspensión desde el visor integrado --- */
    setHostActive,
    get hostActive()  { return HOST.active; },
    get frames()      { return HOST.frames; },
    get videoPaused() { return backgroundVideo ? backgroundVideo.paused : null; },

    demo: () => play(DEMO)
  };

  /* Backwards-compatible alias with the previous package. */
  window.RouletteThunder = window.RouletteMultipliers;

  /* ---------------------------------------------------------
     Init
     --------------------------------------------------------- */

  preloadAssets()
    .then(() => {
      /* 30 FPS: el intro sigue siendo la secuencia animada aprobada, solo que
         a la mitad de frames. Sus animaciones no se tocan. */
      gsap.ticker.fps(30);
      gsap.ticker.lagSmoothing(500, 33);
      gsap.ticker.add(tick);

      play(DEMO);

      /* gsap.ticker.add() despierta el ticker por su cuenta, así que el
         estado del host se re-aplica DESPUÉS de registrarlo. Si el visor ya
         pidió suspender esta pantalla mientras cargaban los assets, se queda
         suspendida sin haber llegado a renderizar. */
      HOST.ready = true;
      applyHost();
    })
    .catch(error => {
      console.error(error);
    });

  repeatButton.addEventListener("click", () => {
    play(DEMO);
  });

  addEventListener("keydown", event => {
    if (event.code === "Space") {
      event.preventDefault();
      play(DEMO);
    }
  });
})();
