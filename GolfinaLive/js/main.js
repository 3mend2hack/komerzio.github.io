import { Ball } from './physics.js';
import { Stadium } from './stadium.js';
import { AudioManager } from './audio.js';
import { UIManager } from './ui.js';
import { signIn, signOut, getSession, initSupabase, savePartida, loadPartidaActiva, finalizarPartida } from './supabase.js';
import { supabase } from './supabase.js';

// ===================== CONFIGURACIÓN INICIAL =====================
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

canvas.width = 1200;
canvas.height = 700;
const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

const field = {
  width: 700,
  height: 400,
  offsetX: (CANVAS_WIDTH - 700) / 2,
  offsetY: (CANVAS_HEIGHT - 400) / 2,
  goalMouthRatioLeft: 0.4,
  goalMouthRatioRight: 0.4,
};

const audioFiles = {
  bienvenida: 'assets/audio/bienvenida.mp3',
  gol_rojo: 'assets/audio/gol_rojo.mp3',
  gol_azul: 'assets/audio/gol_azul.mp3',
  audioronaldo: 'assets/audio/audioronaldo.mp3',
  audiomessi: 'assets/audio/audiomessi.mp3',
  suscribete: 'assets/audio/suscribete.mp3',
  apoya_estrella: 'assets/audio/apoya_estrella.mp3',
  poder: 'assets/audio/poder.mp3',
  tulike: 'assets/audio/tulike.mp3',
  estadio_completo: 'assets/audio/estadio_completo.mp3'
};

const stadium = new Stadium(canvas);
const audioManager = new AudioManager(audioFiles);

const BALL_RADIUS = 16;

const ballRed = new Ball(field.width, field.height, BALL_RADIUS, '#ff0000', 200, 'right', 'red');
const ballBlue = new Ball(field.width, field.height, BALL_RADIUS, '#0000ff', 200, 'left', 'blue');

let balls = [ballRed, ballBlue];

let isRunning = false;
let lastTime = 0;
let scores = { red: 0, blue: 0 };
let goalTarget = 5;
let goalPause = false;
let goalTimeout = null;
let partidaId = null;

let doublePoints = { red: false, blue: false };
let originalFieldWidth = field.width;
let originalFieldHeight = field.height;
let originalGoalMouthRatioLeft = field.goalMouthRatioLeft;
let originalGoalMouthRatioRight = field.goalMouthRatioRight;
let fieldResizeTimeout = null;
let invertTimeout = null;
let giantBallTimeout = null;
let cloneTimeouts = [];

let goalkeeper = {
  active: false,
  team: null,
  x: 0,
  y: 0,
  radius: 20,
  speed: 150
};

let neonMode = false;

const scoreRedEl = document.getElementById('score-red');
const scoreBlueEl = document.getElementById('score-blue');
const goalTargetEl = document.getElementById('goal-target');
const messageOverlay = document.getElementById('message-overlay');
const messageText = document.getElementById('message-text');
const loginOverlay = document.getElementById('login-overlay');
const passwordInput = document.getElementById('password-input');
const btnLogin = document.getElementById('btn-login');
const loginError = document.getElementById('login-error');
const btnLogout = document.getElementById('btn-logout');

// ===================== FUNCIÓN PARA DESBLOQUEAR AUDIO =====================
function unlockAudio() {
  const audio = new Audio();
  audio.volume = 0;
  audio.play().then(() => {
    audio.pause();
  }).catch(() => {});
}

// ===================== AUTENTICACIÓN =====================
async function checkSession() {
  try {
    const session = await getSession();
    if (session) {
      loginOverlay.classList.remove('open');
      await initGame();
    } else {
      loginOverlay.classList.add('open');
    }
  } catch (error) {
    console.error('Error al verificar sesión:', error);
    loginOverlay.classList.add('open');
  }
}

btnLogin.addEventListener('click', async () => {
  const password = passwordInput.value;
  if (!password) {
    loginError.textContent = 'Ingresa tu contraseña';
    return;
  }
  try {
    await signIn(password);
    loginOverlay.classList.remove('open');
    passwordInput.value = '';
    loginError.textContent = '';
    unlockAudio(); // Desbloquear audio tras login
    await initGame();
  } catch (error) {
    loginError.textContent = 'Contraseña incorrecta';
  }
});

btnLogout.addEventListener('click', async () => {
  try {
    await signOut();
    loginOverlay.classList.add('open');
    passwordInput.value = '';
    loginError.textContent = '';
    isRunning = false;
    goalPause = false;
    audioManager.stopAll();
    hideMessage();
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }
});

// ===================== INICIALIZACIÓN DEL JUEGO =====================
let uiManager;

async function initGame() {
  try {
    const partida = await loadPartidaActiva();
    if (partida) {
      partidaId = partida.id;
      scores.red = partida.puntaje_rojo || 0;
      scores.blue = partida.puntaje_azul || 0;
      goalTarget = partida.goles_para_ganar || 5;
      document.getElementById('goal-target-input').value = goalTarget;
      goalTargetEl.textContent = goalTarget;
    }
  } catch (error) {
    console.warn('No se pudo cargar partida:', error);
  }

  uiManager = new UIManager({
    field,
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
    onFieldChange: () => {
      originalFieldWidth = field.width;
      originalFieldHeight = field.height;
      ballRed.reset(field.width, field.height);
      ballBlue.reset(field.width, field.height);
      drawFrame();
    },
    onOffsetChange: () => {
      drawFrame();
    },
    onImageSizeChange: (size) => {},
    onControlAction: (action) => handleControlAction(action),
    onAudioAction: (key) => audioManager.play(key),
    onBallSpeedChange: (speed) => {
      ballRed.setSpeed(speed);
      ballBlue.setSpeed(speed);
    },
    onGoalSizeChange: (ratio) => {
      field.goalMouthRatioLeft = ratio;
      field.goalMouthRatioRight = ratio;
      originalGoalMouthRatioLeft = ratio;
      originalGoalMouthRatioRight = ratio;
      drawFrame();
    },
    onGoalTargetChange: (target) => {
      goalTarget = target;
      goalTargetEl.textContent = target;
    }
  });

  try {
    initSupabase({
      onPoderRecibido: (nombrePoder, canal, usuario) => {
        console.log(`Poder recibido: ${nombrePoder} (canal: ${canal}) activado por: ${usuario || 'desconocido'}`);
        aplicarPoder(nombrePoder, canal, usuario);
      },
      onPartidaFinalizada: (ganador) => {
        showMessage(`¡Fin del partido! Ganador: ${ganador}`);
        audioManager.stopLoop();
      }
    });
  } catch (error) {
    console.warn('No se pudo conectar con Supabase:', error);
  }

  drawFrame();
  updateScoreboard();
}

// ===================== MANEJO DE CONTROLES =====================
function handleControlAction(action) {
  switch (action) {
    case 'start':
      if (!isRunning && !goalPause) {
        unlockAudio(); // Desbloquear audio al iniciar partido
        isRunning = true;
        audioManager.playLoop('estadio_completo');
        lastTime = performance.now();
        requestAnimationFrame(loop);
        saveCurrentPartida();
      }
      break;
    case 'pause':
      isRunning = false;
      audioManager.stopLoop();
      saveCurrentPartida();
      break;
    case 'resume':
      if (!isRunning && !goalPause) {
        unlockAudio(); // También al reanudar
        loadAndRestorePartida().then(() => {
          isRunning = true;
          audioManager.playLoop('estadio_completo');
          lastTime = performance.now();
          requestAnimationFrame(loop);
          saveCurrentPartida();
        });
      }
      break;
    case 'reset':
      if (goalTimeout) clearTimeout(goalTimeout);
      if (fieldResizeTimeout) clearTimeout(fieldResizeTimeout);
      if (invertTimeout) clearTimeout(invertTimeout);
      if (giantBallTimeout) clearTimeout(giantBallTimeout);
      cloneTimeouts.forEach(t => clearTimeout(t));
      cloneTimeouts = [];
      goalPause = false;
      isRunning = false;
      audioManager.stopLoop();
      scores.red = 0;
      scores.blue = 0;
      doublePoints.red = false;
      doublePoints.blue = false;
      field.width = originalFieldWidth;
      field.height = originalFieldHeight;
      field.goalMouthRatioLeft = originalGoalMouthRatioLeft;
      field.goalMouthRatioRight = originalGoalMouthRatioRight;
      goalkeeper.active = false;
      neonMode = false;
      updateScoreboard();
      balls = [ballRed, ballBlue];
      ballRed.reset(field.width, field.height);
      ballBlue.reset(field.width, field.height);
      hideMessage();
      drawFrame();
      saveCurrentPartida();
      break;
    case 'continue':
      loadAndRestorePartida();
      break;
  }
}

async function loadAndRestorePartida() {
  try {
    const partida = await loadPartidaActiva();
    if (partida) {
      partidaId = partida.id;
      scores.red = partida.puntaje_rojo || 0;
      scores.blue = partida.puntaje_azul || 0;
      goalTarget = partida.goles_para_ganar || 5;
      document.getElementById('goal-target-input').value = goalTarget;
      goalTargetEl.textContent = goalTarget;
      updateScoreboard();
      drawFrame();
      showMessage('Partida restaurada');
    } else {
      showMessage('No hay partida guardada');
    }
  } catch (error) {
    console.error('Error al continuar partida:', error);
    showMessage('Error al cargar la partida');
  }
}

async function saveCurrentPartida() {
  try {
    await savePartida({
      puntaje_rojo: scores.red,
      puntaje_azul: scores.blue,
      goles_para_ganar: goalTarget,
      velocidad_bolas: ballRed.speed
    });
  } catch (error) {
    console.warn('No se pudo guardar la partida:', error);
  }
}

// ===================== LÓGICA DEL JUEGO =====================
function updateScoreboard() {
  scoreRedEl.textContent = scores.red;
  scoreBlueEl.textContent = scores.blue;
}

function showMessage(text) {
  messageText.textContent = text;
  messageOverlay.classList.add('active');
}

function hideMessage() {
  messageOverlay.classList.remove('active');
}

function loop(timestamp) {
  if (!isRunning || goalPause) return;

  let deltaTime = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  if (deltaTime > 0.1) deltaTime = 0.1;

  for (let i = 0; i < balls.length; i++) {
    const ball = balls[i];
    const result = ball.update(deltaTime, field);
    if (result === 'goal') {
      handleGoal(ball.team);
      return;
    }
  }

  if (goalkeeper.active) {
    updateGoalkeeper(deltaTime);
  }

  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      balls[i].collide(balls[j]);
    }
  }

  const now = performance.now();
  balls = balls.filter(ball => {
    if (ball.isClone && ball.expireTime && now > ball.expireTime) {
      return false;
    }
    return true;
  });

  drawFrame();
  requestAnimationFrame(loop);
}

function drawFrame() {
  stadium.draw(field, neonMode);

  if (neonMode) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  if (neonMode) {
    ctx.save();
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ffffff';
  }

  balls.forEach(ball => drawBall(ball));

  if (goalkeeper.active) {
    drawGoalkeeper();
  }

  if (neonMode) {
    ctx.restore();
  }
}

function drawBall(ball) {
  ctx.save();
  ctx.translate(field.offsetX, field.offsetY);
  ctx.beginPath();
  ctx.arc(ball.x, ball.y + 2, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  if (neonMode) {
    ctx.fillStyle = ball.color === '#ff0000' ? '#ff00ff' : '#00ffff';
    ctx.shadowBlur = 20;
    ctx.shadowColor = ball.color === '#ff0000' ? '#ff0000' : '#0000ff';
  } else {
    ctx.fillStyle = ball.color;
  }
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ball.x - ball.radius * 0.3, ball.y - ball.radius * 0.3, ball.radius * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fill();
  ctx.restore();
}

function drawGoalkeeper() {
  ctx.save();
  ctx.translate(field.offsetX, field.offsetY);
  ctx.beginPath();
  ctx.arc(goalkeeper.x, goalkeeper.y, goalkeeper.radius, 0, Math.PI * 2);
  ctx.fillStyle = goalkeeper.team === 'red' ? '#ff4444' : '#4444ff';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(goalkeeper.x - 8, goalkeeper.y - 8, 6, 0, Math.PI * 2);
  ctx.arc(goalkeeper.x + 8, goalkeeper.y - 8, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
}

function updateGoalkeeper(deltaTime) {
  const targetBall = goalkeeper.team === 'red' ? ballBlue : ballRed;
  if (!targetBall) return;

  const targetGoalX = goalkeeper.team === 'red' ? 20 : field.width - 20;
  const targetGoalY = field.height / 2;

  const rangeX = 60;
  const rangeY = 80;

  const ballDistToGoal = Math.hypot(targetBall.x - targetGoalX, targetBall.y - targetGoalY);

  if (ballDistToGoal < 150) {
    const dx = targetBall.x - goalkeeper.x;
    const dy = targetBall.y - goalkeeper.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 5) {
      const moveX = (dx / dist) * goalkeeper.speed * deltaTime;
      const moveY = (dy / dist) * goalkeeper.speed * deltaTime;
      goalkeeper.x += moveX;
      goalkeeper.y += moveY;
    }
  } else {
    const dx = targetGoalX - goalkeeper.x;
    const dy = targetGoalY - goalkeeper.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 5) {
      const moveX = (dx / dist) * goalkeeper.speed * deltaTime;
      const moveY = (dy / dist) * goalkeeper.speed * deltaTime;
      goalkeeper.x += moveX;
      goalkeeper.y += moveY;
    }
  }

  goalkeeper.x = Math.max(targetGoalX - rangeX, Math.min(targetGoalX + rangeX, goalkeeper.x));
  goalkeeper.y = Math.max(targetGoalY - rangeY, Math.min(targetGoalY + rangeY, goalkeeper.y));

  if (Math.hypot(targetBall.x - goalkeeper.x, targetBall.y - goalkeeper.y) < goalkeeper.radius + targetBall.radius) {
    const angle = Math.atan2(targetBall.y - goalkeeper.y, targetBall.x - goalkeeper.x);
    targetBall.vx = Math.cos(angle) * targetBall.speed;
    targetBall.vy = Math.sin(angle) * targetBall.speed;
    targetBall.x += Math.cos(angle) * (goalkeeper.radius + targetBall.radius);
    targetBall.y += Math.sin(angle) * (goalkeeper.radius + targetBall.radius);
  }
}

function handleGoal(team) {
  if (goalPause) return;
  goalPause = true;
  isRunning = false;

  const indexClone = balls.findIndex(ball => ball.isClone && ball.team === team);
  if (indexClone !== -1) {
    balls.splice(indexClone, 1);
  }

  let points = 1;
  if (doublePoints[team]) points = 2;

  if (team === 'red') {
    scores.red += points;
    const audioRed = Math.random() < 0.5 ? 'gol_rojo' : 'audioronaldo';
    audioManager.play(audioRed);
  } else {
    scores.blue += points;
    const audioBlue = Math.random() < 0.5 ? 'gol_azul' : 'audiomessi';
    audioManager.play(audioBlue);
  }
  updateScoreboard();
  saveCurrentPartida();

  const scorer = team === 'red' ? uiManager.playerNames.red : uiManager.playerNames.blue;
  showMessage(`¡Gol de ${scorer}! (${points} punto${points !== 1 ? 's' : ''})`);

  setTimeout(() => {
    startCountdown(3);
  }, 2000);
}

function startCountdown(seconds) {
  if (seconds <= 0) {
    balls.forEach(ball => ball.reset(field.width, field.height));
    drawFrame();

    if (scores.red >= goalTarget || scores.blue >= goalTarget) {
      const winner = scores.red >= goalTarget ? uiManager.playerNames.red : uiManager.playerNames.blue;
      showMessage(`¡${winner} gana el partido!`);
      goalPause = false;
      isRunning = false;
      audioManager.stopLoop();
      finalizarPartida(winner);
    } else {
      hideMessage();
      goalPause = false;
      isRunning = true;
      lastTime = performance.now();
      audioManager.playLoop('estadio_completo');
      requestAnimationFrame(loop);
    }
    return;
  }

  showMessage(seconds.toString());
  setTimeout(() => startCountdown(seconds - 1), 1000);
}

// ===================== FUNCIÓN PARA APLICAR PODERES =====================
function aplicarPoder(nombrePoder, canal, usuario) {
  console.log('Aplicando poder:', nombrePoder);
  const comando = nombrePoder.toLowerCase();
  const quien = usuario ? `@${usuario}` : 'alguien';

  if (comando === 'velocidadronaldo') {
    ballRed.setSpeed(ballRed.speed * 1.5);
    showMessage(`¡Velocidad aumentada para Ronaldo! (por ${quien})`);
    setTimeout(() => { ballRed.setSpeed(ballRed.speed / 1.5); }, 60000);
  }
  else if (comando === 'lentoronaldo') {
    ballRed.setSpeed(ballRed.speed * 0.3);
    showMessage(`¡Ronaldo ralentizado! (por ${quien})`);
    setTimeout(() => { ballRed.setSpeed(ballRed.speed / 0.3); }, 30000);
  }
  else if (comando === 'golronaldo') {
    handleGoal('red');
  }
  else if (comando === 'caosronaldo') {
    const interval = setInterval(() => {
      ballBlue.vx = -ballBlue.vx;
      ballBlue.vy = (Math.random() > 0.5 ? 1 : -1) * ballBlue.vy;
    }, 2000);
    showMessage(`¡Caos para Messi! (por ${quien})`);
    setTimeout(() => clearInterval(interval), 20000);
  }
  else if (comando === 'escudoronaldo') {
    field.goalMouthRatioLeft = field.goalMouthRatioLeft * 0.5;
    showMessage(`¡Escudo para Ronaldo! (por ${quien})`);
    setTimeout(() => {
      field.goalMouthRatioLeft = originalGoalMouthRatioLeft;
      drawFrame();
    }, 60000);
    drawFrame();
  }
  else if (comando === 'lluviaronaldo') {
    for (let i = 0; i < 3; i++) {
      scores.red += 1;
      if (doublePoints.red) scores.red += 1;
    }
    updateScoreboard();
    showMessage(`¡Lluvia de goles para Ronaldo! (por ${quien})`);
    checkWinnerAfterAutoGoal();
  }
  else if (comando === 'congelarronaldo') {
    ballBlue.setSpeed(0);
    showMessage(`¡Messi congelado! (por ${quien})`);
    setTimeout(() => { ballBlue.setSpeed(ballRed.speed); }, 10000);
  }
  else if (comando === 'doblepuntosronaldo') {
    doublePoints.red = true;
    showMessage(`¡Goles de Ronaldo valen doble! (por ${quien})`);
    setTimeout(() => { doublePoints.red = false; }, 60000);
  }
  else if (comando === 'velocidadmessi') {
    ballBlue.setSpeed(ballBlue.speed * 1.5);
    showMessage(`¡Velocidad aumentada para Messi! (por ${quien})`);
    setTimeout(() => { ballBlue.setSpeed(ballBlue.speed / 1.5); }, 60000);
  }
  else if (comando === 'lentomessi') {
    ballBlue.setSpeed(ballBlue.speed * 0.3);
    showMessage(`¡Messi ralentizado! (por ${quien})`);
    setTimeout(() => { ballBlue.setSpeed(ballBlue.speed / 0.3); }, 30000);
  }
  else if (comando === 'golmessi') {
    handleGoal('blue');
  }
  else if (comando === 'caosmessi') {
    const interval = setInterval(() => {
      ballRed.vx = -ballRed.vx;
      ballRed.vy = (Math.random() > 0.5 ? 1 : -1) * ballRed.vy;
    }, 2000);
    showMessage(`¡Caos para Ronaldo! (por ${quien})`);
    setTimeout(() => clearInterval(interval), 20000);
  }
  else if (comando === 'escudomessi') {
    field.goalMouthRatioRight = field.goalMouthRatioRight * 0.5;
    showMessage(`¡Escudo para Messi! (por ${quien})`);
    setTimeout(() => {
      field.goalMouthRatioRight = originalGoalMouthRatioRight;
      drawFrame();
    }, 60000);
    drawFrame();
  }
  else if (comando === 'lluviamessi') {
    for (let i = 0; i < 3; i++) {
      scores.blue += 1;
      if (doublePoints.blue) scores.blue += 1;
    }
    updateScoreboard();
    showMessage(`¡Lluvia de goles para Messi! (por ${quien})`);
    checkWinnerAfterAutoGoal();
  }
  else if (comando === 'congelarmessi') {
    ballRed.setSpeed(0);
    showMessage(`¡Ronaldo congelado! (por ${quien})`);
    setTimeout(() => { ballRed.setSpeed(ballBlue.speed); }, 10000);
  }
  else if (comando === 'doblepuntosmessi') {
    doublePoints.blue = true;
    showMessage(`¡Goles de Messi valen doble! (por ${quien})`);
    setTimeout(() => { doublePoints.blue = false; }, 60000);
  }
  else if (comando === 'super') {
    ballRed.setSpeed(ballRed.speed * 2);
    ballBlue.setSpeed(ballBlue.speed * 2);
    showMessage(`¡Súper velocidad para ambos! (por ${quien})`);
    setTimeout(() => {
      ballRed.setSpeed(ballRed.speed / 2);
      ballBlue.setSpeed(ballBlue.speed / 2);
    }, 30000);
  }
  else if (comando === 'invertir') {
    balls.forEach(ball => {
      ball.vx = -ball.vx;
      ball.vy = -ball.vy;
    });
    showMessage(`¡Direcciones invertidas! (por ${quien})`);
    if (invertTimeout) clearTimeout(invertTimeout);
    invertTimeout = setTimeout(() => {
      balls.forEach(ball => {
        ball.vx = -ball.vx;
        ball.vy = -ball.vy;
      });
    }, 15000);
  }
  else if (comando === 'multiplicarronaldo') {
    addClone('red', 2);
    showMessage(`¡Ronaldo multiplicado! 3 bolas rojas (por ${quien})`);
  }
  else if (comando === 'multiplicarmessi') {
    addClone('blue', 2);
    showMessage(`¡Messi multiplicado! 3 bolas azules (por ${quien})`);
  }
  else if (comando === 'pelotagigante') {
    ballRed.radius = 25;
    ballBlue.radius = 25;
    showMessage(`¡Pelotas gigantes! (por ${quien})`);
    if (giantBallTimeout) clearTimeout(giantBallTimeout);
    giantBallTimeout = setTimeout(() => {
      ballRed.radius = BALL_RADIUS;
      ballBlue.radius = BALL_RADIUS;
      drawFrame();
    }, 30000);
    drawFrame();
  }
  else if (comando === 'teletransportar') {
    ballBlue.reset(field.width, field.height);
    showMessage(`¡Messi teletransportado! (por ${quien})`);
  }
  else if (comando === 'porteroronaldo') {
    activateGoalkeeper('red');
    showMessage(`¡Portero para Ronaldo activado! (por ${quien})`);
    setTimeout(() => {
      goalkeeper.active = false;
      drawFrame();
    }, 15000);
  }
  else if (comando === 'porteromessi') {
    activateGoalkeeper('blue');
    showMessage(`¡Portero para Messi activado! (por ${quien})`);
    setTimeout(() => {
      goalkeeper.active = false;
      drawFrame();
    }, 15000);
  }
  else if (comando === 'camponeon') {
    neonMode = true;
    showMessage(`¡Modo neón activado! (por ${quien})`);
    setTimeout(() => {
      neonMode = false;
      drawFrame();
    }, 10000);
  }
  else {
    console.warn('Poder no implementado:', nombrePoder);
  }
}

function activateGoalkeeper(team) {
  goalkeeper.active = true;
  goalkeeper.team = team;
  goalkeeper.x = team === 'red' ? 30 : field.width - 30;
  goalkeeper.y = field.height / 2;
}

function addClone(team, count) {
  const baseBall = team === 'red' ? ballRed : ballBlue;
  const color = baseBall.color;
  const targetGoal = baseBall.targetGoal;
  const speed = baseBall.speed;
  for (let i = 0; i < count; i++) {
    const clone = new Ball(field.width, field.height, BALL_RADIUS, color, speed, targetGoal, team);
    clone.isClone = true;
    clone.expireTime = performance.now() + 30000;
    clone.reset(field.width, field.height);
    balls.push(clone);
  }
}

function checkWinnerAfterAutoGoal() {
  if (scores.red >= goalTarget || scores.blue >= goalTarget) {
    isRunning = false;
    const winner = scores.red >= goalTarget ? uiManager.playerNames.red : uiManager.playerNames.blue;
    showMessage(`¡${winner} gana el partido!`);
    goalPause = false;
    audioManager.stopLoop();
    finalizarPartida(winner);
  }
}

// ===================== ADMINISTRACIÓN DE PODERES =====================
document.getElementById('btn-admin').addEventListener('click', openAdminModal);
document.getElementById('btn-close-admin').addEventListener('click', () => {
  document.getElementById('admin-modal').classList.remove('open');
});
document.getElementById('btn-add-poder').addEventListener('click', addOrUpdatePoder);

async function openAdminModal() {
  const { data, error } = await supabase
    .from('poderes_personalizados')
    .select('*')
    .order('bando', { ascending: true });

  if (error) {
    console.error('Error cargando poderes:', error);
    return;
  }

  const container = document.getElementById('admin-poderes-list');
  container.innerHTML = '';

  const grupos = { rojo: [], azul: [], neutral: [] };
  data.forEach(poder => {
    if (grupos[poder.bando]) {
      grupos[poder.bando].push(poder);
    }
  });

  for (const bando in grupos) {
    const titulo = document.createElement('h4');
    titulo.textContent = bando.toUpperCase();
    titulo.style.color = bando === 'rojo' ? '#ff4444' : bando === 'azul' ? '#4444ff' : '#cccccc';
    container.appendChild(titulo);

    grupos[bando].forEach(poder => {
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.justifyContent = 'space-between';
      div.style.alignItems = 'center';
      div.style.marginBottom = '5px';
      div.innerHTML = `
        <span>${poder.nombre} (${poder.comando}) - ${poder.costo} pts</span>
        <span>
          <button onclick="editPoder('${poder.id}', '${poder.nombre}', '${poder.comando}', ${poder.costo}, ${poder.duracion}, '${poder.bando}')" style="background:#3498db; margin-right:5px;">Editar</button>
          <button onclick="deletePoder('${poder.id}')" style="background:#e74c3c;">Eliminar</button>
        </span>
      `;
      container.appendChild(div);
    });
  }

  document.getElementById('admin-modal').classList.add('open');
}

window.editPoder = function(id, nombre, comando, costo, duracion, bando) {
  document.getElementById('admin-id').value = id;
  document.getElementById('admin-nombre').value = nombre;
  document.getElementById('admin-comando').value = comando;
  document.getElementById('admin-costo').value = costo;
  document.getElementById('admin-duracion').value = duracion;
  document.getElementById('admin-bando').value = bando;
};

window.deletePoder = async function(id) {
  if (!confirm('¿Seguro que deseas eliminar este poder?')) return;

  const { error } = await supabase
    .from('poderes_personalizados')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error eliminando poder:', error);
    alert('Error al eliminar');
    return;
  }

  openAdminModal();
};

async function addOrUpdatePoder() {
  const id = document.getElementById('admin-id').value;
  const nombre = document.getElementById('admin-nombre').value.trim();
  const comando = document.getElementById('admin-comando').value.trim();
  const costo = Number(document.getElementById('admin-costo').value);
  const duracion = Number(document.getElementById('admin-duracion').value);
  const bando = document.getElementById('admin-bando').value;

  if (!nombre || !comando || !costo || !duracion) {
    alert('Completa todos los campos');
    return;
  }

  let error;
  if (id) {
    ({ error } = await supabase
      .from('poderes_personalizados')
      .update({ nombre, comando, costo, duracion, bando })
      .eq('id', id));
  } else {
    ({ error } = await supabase
      .from('poderes_personalizados')
      .insert({ nombre, comando, costo, duracion, bando, activo: true }));
  }

  if (error) {
    console.error('Error guardando poder:', error);
    alert('Error al guardar');
    return;
  }

  document.getElementById('admin-id').value = '';
  document.getElementById('admin-nombre').value = '';
  document.getElementById('admin-comando').value = '';
  document.getElementById('admin-costo').value = '';
  document.getElementById('admin-duracion').value = '';
  openAdminModal();
}

// ===================== ARRANQUE =====================
checkSession();