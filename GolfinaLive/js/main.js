import { Ball } from './physics.js';
import { Stadium } from './stadium.js';
import { AudioManager } from './audio.js';
import { UIManager } from './ui.js';
import { signIn, signOut, getSession, initSupabase, savePartida, loadPartidaActiva, finalizarPartida } from './supabase.js';

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
  goalMouthRatio: 0.4
};

const audioFiles = {
  bienvenida: 'assets/audio/bienvenida.mp3',
  gol_rojo: 'assets/audio/gol_rojo.mp3',
  gol_azul: 'assets/audio/gol_azul.mp3',
  suscribete: 'assets/audio/suscribete.mp3',
  apoya_estrella: 'assets/audio/apoya_estrella.mp3',
  poder: 'assets/audio/poder.mp3',
  tulike: 'assets/audio/tulike.mp3',
  estadio_completo: 'assets/audio/estadio_completo.mp3'
};

const stadium = new Stadium(canvas);
const audioManager = new AudioManager(audioFiles);

const BALL_RADIUS = 16;
const ballRed = new Ball(field.width, field.height, BALL_RADIUS, '#ff0000', 200, 'right');
const ballBlue = new Ball(field.width, field.height, BALL_RADIUS, '#0000ff', 200, 'left');

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
let fieldResizeTimeout = null;
let invertTimeout = null;

const scoreRedEl = document.getElementById('score-red');
const scoreBlueEl = document.getElementById('score-blue');
const goalTargetEl = document.getElementById('goal-target');
const messageOverlay = document.getElementById('message-overlay');
const messageText = document.getElementById('message-text');
const loginOverlay = document.getElementById('login-overlay');
const passwordInput = document.getElementById('password-input');
const btnLogin = document.getElementById('btn-login');
const loginError = document.getElementById('login-error');

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
    await initGame();
  } catch (error) {
    loginError.textContent = 'Contraseña incorrecta';
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
      field.goalMouthRatio = ratio;
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
        isRunning = true;
        audioManager.playLoop('estadio_completo');
        lastTime = performance.now();
        requestAnimationFrame(loop);
        saveCurrentPartida();
      }
      break;
    case 'reset':
      if (goalTimeout) clearTimeout(goalTimeout);
      if (fieldResizeTimeout) clearTimeout(fieldResizeTimeout);
      if (invertTimeout) clearTimeout(invertTimeout);
      goalPause = false;
      isRunning = false;
      audioManager.stopLoop();
      scores.red = 0;
      scores.blue = 0;
      doublePoints.red = false;
      doublePoints.blue = false;
      field.width = originalFieldWidth;
      field.height = originalFieldHeight;
      field.goalMouthRatio = 0.4;
      updateScoreboard();
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

  const resultRed = ballRed.update(deltaTime, field);
  if (resultRed === 'goal') {
    handleGoal('red');
    return;
  }
  const resultBlue = ballBlue.update(deltaTime, field);
  if (resultBlue === 'goal') {
    handleGoal('blue');
    return;
  }

  ballRed.collide(ballBlue);

  drawFrame();
  requestAnimationFrame(loop);
}

function drawFrame() {
  stadium.draw(field);
  drawBall(ballRed);
  drawBall(ballBlue);
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
  ctx.fillStyle = ball.color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ball.x - ball.radius * 0.3, ball.y - ball.radius * 0.3, ball.radius * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fill();
  ctx.restore();
}

function handleGoal(team) {
  if (goalPause) return;
  goalPause = true;
  isRunning = false;

  let points = 1;
  if (doublePoints[team]) points = 2;

  if (team === 'red') {
    scores.red += points;
    audioManager.play('gol_rojo');
  } else {
    scores.blue += points;
    audioManager.play('gol_azul');
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
    ballRed.reset(field.width, field.height);
    ballBlue.reset(field.width, field.height);
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

// ===================== FUNCIÓN PARA APLICAR PODERES (ahora recibe usuario) =====================
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
    ballBlue.setSpeed(ballBlue.speed * 0.5);
    showMessage(`¡Messi ralentizado! (por ${quien})`);
    setTimeout(() => { ballBlue.setSpeed(ballBlue.speed * 2); }, 30000);
  }
  else if (comando === 'golronaldo') {
    handleGoal('red');
    showMessage(`¡Gol automático de Ronaldo! (por ${quien})`);
  }
  else if (comando === 'caosronaldo') {
    ballBlue.vx = -ballBlue.vx;
    ballBlue.vy = -ballBlue.vy;
    showMessage(`¡Caos para Messi! (por ${quien})`);
  }
  else if (comando === 'escudoronaldo') {
    field.goalMouthRatio = field.goalMouthRatio * 0.7;
    showMessage(`¡Escudo para Ronaldo! (por ${quien})`);
    setTimeout(() => { field.goalMouthRatio = field.goalMouthRatio / 0.7; drawFrame(); }, 60000);
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
  // Poderes de Messi
  else if (comando === 'velocidadmessi') {
    ballBlue.setSpeed(ballBlue.speed * 1.5);
    showMessage(`¡Velocidad aumentada para Messi! (por ${quien})`);
    setTimeout(() => { ballBlue.setSpeed(ballBlue.speed / 1.5); }, 60000);
  }
  else if (comando === 'lentomessi') {
    ballRed.setSpeed(ballRed.speed * 0.5);
    showMessage(`¡Ronaldo ralentizado! (por ${quien})`);
    setTimeout(() => { ballRed.setSpeed(ballRed.speed * 2); }, 30000);
  }
  else if (comando === 'golmessi') {
    handleGoal('blue');
    showMessage(`¡Gol automático de Messi! (por ${quien})`);
  }
  else if (comando === 'caosmessi') {
    ballRed.vx = -ballRed.vx;
    ballRed.vy = -ballRed.vy;
    showMessage(`¡Caos para Ronaldo! (por ${quien})`);
  }
  else if (comando === 'escudomessi') {
    field.goalMouthRatio = field.goalMouthRatio * 0.7;
    showMessage(`¡Escudo para Messi! (por ${quien})`);
    setTimeout(() => { field.goalMouthRatio = field.goalMouthRatio / 0.7; drawFrame(); }, 60000);
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
  // Poderes neutrales
  else if (comando === 'super') {
    ballRed.setSpeed(ballRed.speed * 2);
    ballBlue.setSpeed(ballBlue.speed * 2);
    showMessage(`¡Súper velocidad para ambos! (por ${quien})`);
    setTimeout(() => {
      ballRed.setSpeed(ballRed.speed / 2);
      ballBlue.setSpeed(ballBlue.speed / 2);
    }, 30000);
  }
  else if (comando === 'campopequeno') {
    originalFieldWidth = field.width;
    originalFieldHeight = field.height;
    field.width = field.width * 0.7;
    field.height = field.height * 0.7;
    field.offsetX = (CANVAS_WIDTH - field.width) / 2;
    field.offsetY = (CANVAS_HEIGHT - field.height) / 2;
    ballRed.reset(field.width, field.height);
    ballBlue.reset(field.width, field.height);
    drawFrame();
    showMessage(`¡Campo reducido! (por ${quien})`);
    if (fieldResizeTimeout) clearTimeout(fieldResizeTimeout);
    fieldResizeTimeout = setTimeout(() => {
      field.width = originalFieldWidth;
      field.height = originalFieldHeight;
      field.offsetX = (CANVAS_WIDTH - field.width) / 2;
      field.offsetY = (CANVAS_HEIGHT - field.height) / 2;
      ballRed.reset(field.width, field.height);
      ballBlue.reset(field.width, field.height);
      drawFrame();
    }, 60000);
  }
  else if (comando === 'invertir') {
    ballRed.vx = -ballRed.vx;
    ballRed.vy = -ballRed.vy;
    ballBlue.vx = -ballBlue.vx;
    ballBlue.vy = -ballBlue.vy;
    showMessage(`¡Direcciones invertidas! (por ${quien})`);
    if (invertTimeout) clearTimeout(invertTimeout);
    invertTimeout = setTimeout(() => {
      ballRed.vx = -ballRed.vx;
      ballRed.vy = -ballRed.vy;
      ballBlue.vx = -ballBlue.vx;
      ballBlue.vy = -ballBlue.vy;
    }, 15000);
  }
  else {
    console.warn('Poder no implementado:', nombrePoder);
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

// ===================== ARRANQUE =====================
checkSession();
