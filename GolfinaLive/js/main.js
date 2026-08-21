import { Ball } from './physics.js';
import { Stadium } from './stadium.js';
import { AudioManager } from './audio.js';
import { UIManager } from './ui.js';
import { initSupabase } from './supabase.js';

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
  extra1: 'assets/audio/extra1.mp3',
  extra2: 'assets/audio/extra2.mp3'
};

const stadium = new Stadium(canvas);
const audioManager = new AudioManager(audioFiles);

const BALL_RADIUS = 12;
const ballRed = new Ball(field.width, field.height, BALL_RADIUS, '#ff0000', 200, 'right');
const ballBlue = new Ball(field.width, field.height, BALL_RADIUS, '#0000ff', 200, 'left');

let isRunning = false;
let lastTime = 0;
let scores = { red: 0, blue: 0 };
let goalTarget = 5;
let goalPause = false;
let goalTimeout = null;

// Variables para efectos temporales de poderes
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

const uiManager = new UIManager({
  field,
  canvasWidth: CANVAS_WIDTH,
  canvasHeight: CANVAS_HEIGHT,
  onFieldChange: () => {
    // Si el usuario cambia el tamaño manualmente, actualizamos originales
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
  onControlAction: (action) => {
    handleControlAction(action);
  },
  onAudioAction: (key) => {
    audioManager.play(key);
  },
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

function handleControlAction(action) {
  switch (action) {
    case 'start':
      if (!isRunning && !goalPause) {
        isRunning = true;
        lastTime = performance.now();
        requestAnimationFrame(loop);
      }
      break;
    case 'pause':
      isRunning = false;
      break;
    case 'resume':
      if (!isRunning && !goalPause) {
        isRunning = true;
        lastTime = performance.now();
        requestAnimationFrame(loop);
      }
      break;
    case 'reset':
      if (goalTimeout) clearTimeout(goalTimeout);
      if (fieldResizeTimeout) clearTimeout(fieldResizeTimeout);
      if (invertTimeout) clearTimeout(invertTimeout);
      goalPause = false;
      isRunning = false;
      scores.red = 0;
      scores.blue = 0;
      doublePoints.red = false;
      doublePoints.blue = false;
      field.width = originalFieldWidth;
      field.height = originalFieldHeight;
      field.goalMouthRatio = 0.4; // Valor por defecto
      updateScoreboard();
      ballRed.reset(field.width, field.height);
      ballBlue.reset(field.width, field.height);
      hideMessage();
      drawFrame();
      break;
  }
}

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
      // Aquí se podría llamar a saveMatchResult
    } else {
      hideMessage();
      goalPause = false;
      isRunning = true;
      lastTime = performance.now();
      requestAnimationFrame(loop);
    }
    return;
  }

  showMessage(seconds.toString());
  setTimeout(() => startCountdown(seconds - 1), 1000);
}

// ===================== FUNCIÓN PARA APLICAR PODERES =====================
function aplicarPoder(nombrePoder) {
  console.log('Aplicando poder:', nombrePoder);
  const comando = nombrePoder.toLowerCase();

  // Poderes de Ronaldo (equipo rojo)
  if (comando === 'velocidadronaldo') {
    ballRed.setSpeed(ballRed.speed * 1.5);
    showMessage('¡Velocidad aumentada para Ronaldo!');
    setTimeout(() => {
      ballRed.setSpeed(ballRed.speed / 1.5);
    }, 60000);
  }
  else if (comando === 'lentoronaldo') {
    ballBlue.setSpeed(ballBlue.speed * 0.5);
    showMessage('¡Messi ralentizado!');
    setTimeout(() => {
      ballBlue.setSpeed(ballBlue.speed * 2); // restaurar velocidad original
    }, 30000);
  }
  else if (comando === 'golronaldo') {
    handleGoal('red');
  }
  else if (comando === 'caosronaldo') {
    // Caos: invertir dirección de la pelota de Messi
    ballBlue.vx = -ballBlue.vx;
    ballBlue.vy = -ballBlue.vy;
    showMessage('¡Caos para Messi!');
  }
  else if (comando === 'escudoronaldo') {
    // Reducir la portería de Messi (lado izquierdo)
    field.goalMouthRatio = field.goalMouthRatio * 0.7;
    showMessage('¡Escudo para Ronaldo!');
    setTimeout(() => {
      field.goalMouthRatio = field.goalMouthRatio / 0.7;
      drawFrame();
    }, 60000);
    drawFrame();
  }
  else if (comando === 'lluviaronaldo') {
    // Añadir 3 goles automáticos para Ronaldo
    for (let i = 0; i < 3; i++) {
      scores.red += 1;
      if (doublePoints.red) scores.red += 1; // Si doble puntos activo, cada gol vale 2
    }
    updateScoreboard();
    showMessage('¡Lluvia de goles para Ronaldo!');
    checkWinnerAfterAutoGoal();
  }
  else if (comando === 'congelarronaldo') {
    ballBlue.setSpeed(0);
    showMessage('¡Messi congelado!');
    setTimeout(() => {
      ballBlue.setSpeed(ballRed.speed); // restaurar velocidad original (ambas deberían ser iguales)
    }, 10000);
  }
  else if (comando === 'doblepuntosronaldo') {
    doublePoints.red = true;
    showMessage('¡Goles de Ronaldo valen doble!');
    setTimeout(() => {
      doublePoints.red = false;
    }, 60000);
  }
  // Poderes de Messi (equipo azul)
  else if (comando === 'velocidadmessi') {
    ballBlue.setSpeed(ballBlue.speed * 1.5);
    showMessage('¡Velocidad aumentada para Messi!');
    setTimeout(() => {
      ballBlue.setSpeed(ballBlue.speed / 1.5);
    }, 60000);
  }
  else if (comando === 'lentomessi') {
    ballRed.setSpeed(ballRed.speed * 0.5);
    showMessage('¡Ronaldo ralentizado!');
    setTimeout(() => {
      ballRed.setSpeed(ballRed.speed * 2);
    }, 30000);
  }
  else if (comando === 'golmessi') {
    handleGoal('blue');
  }
  else if (comando === 'caosmessi') {
    ballRed.vx = -ballRed.vx;
    ballRed.vy = -ballRed.vy;
    showMessage('¡Caos para Ronaldo!');
  }
  else if (comando === 'escudomessi') {
    field.goalMouthRatio = field.goalMouthRatio * 0.7;
    showMessage('¡Escudo para Messi!');
    setTimeout(() => {
      field.goalMouthRatio = field.goalMouthRatio / 0.7;
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
    showMessage('¡Lluvia de goles para Messi!');
    checkWinnerAfterAutoGoal();
  }
  else if (comando === 'congelarmessi') {
    ballRed.setSpeed(0);
    showMessage('¡Ronaldo congelado!');
    setTimeout(() => {
      ballRed.setSpeed(ballBlue.speed);
    }, 10000);
  }
  else if (comando === 'doblepuntosmessi') {
    doublePoints.blue = true;
    showMessage('¡Goles de Messi valen doble!');
    setTimeout(() => {
      doublePoints.blue = false;
    }, 60000);
  }
  // Poderes neutrales
  else if (comando === 'super') {
    ballRed.setSpeed(ballRed.speed * 2);
    ballBlue.setSpeed(ballBlue.speed * 2);
    showMessage('¡Súper velocidad para ambos!');
    setTimeout(() => {
      ballRed.setSpeed(ballRed.speed / 2);
      ballBlue.setSpeed(ballBlue.speed / 2);
    }, 30000);
  }
  else if (comando === 'campopequeno') {
    // Reducir tamaño del campo temporalmente
    originalFieldWidth = field.width;
    originalFieldHeight = field.height;
    field.width = field.width * 0.7;
    field.height = field.height * 0.7;
    field.offsetX = (CANVAS_WIDTH - field.width) / 2;
    field.offsetY = (CANVAS_HEIGHT - field.height) / 2;
    ballRed.reset(field.width, field.height);
    ballBlue.reset(field.width, field.height);
    drawFrame();
    showMessage('¡Campo reducido!');
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
    // Invertir direcciones de ambas pelotas
    ballRed.vx = -ballRed.vx;
    ballRed.vy = -ballRed.vy;
    ballBlue.vx = -ballBlue.vx;
    ballBlue.vy = -ballBlue.vy;
    showMessage('¡Direcciones invertidas!');
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
  }
}

// ===================== INICIALIZAR SUPABASE =====================
initSupabase({
  onPoderRecibido: (nombrePoder, canal) => {
    console.log(`Poder recibido: ${nombrePoder} (canal: ${canal})`);
    aplicarPoder(nombrePoder);
  },
  onPartidaFinalizada: (ganador) => {
    showMessage(`¡Fin del partido! Ganador: ${ganador}`);
  }
});

// ===================== DIBUJO INICIAL =====================
drawFrame();

// ===================== INTEGRACIÓN FUTURA CON SUPABASE (guardado de partidas) =====================
async function saveMatchResult(winner, goalsRed, goalsBlue, duration) {
  console.log('Guardar partido:', { winner, goalsRed, goalsBlue, duration });
}

async function saveUserStats(userId, points, favoriteTeam) {
  console.log('Guardar usuario:', { userId, points, favoriteTeam });
}