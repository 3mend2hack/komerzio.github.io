// ============================================
// GOLFINALIVE - STREAM JS (VERSIÓN CORREGIDA - RESPONSIVE)
// ============================================

var SUPABASE_URL = 'https://qddfdisbnwnnlvkrnckd.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkZGZkaXNibndubmx2a3JuY2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NDQwMzcsImV4cCI6MjEwMjQyMDAzN30.9Jsgl0qepqjJ8oiiewyPZK3vOsqm49EnLCEtOar5MiQ';
var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// CONFIGURACIÓN
// ============================================
var CONFIG = {
    campoAncho: 600,
    campoAlto: 400,
    campoColor: '#1a6b3a',
    playerImageSize: 80,
    playerShape: 'rectangular',
    goalSize: 1.0,
    neonRojo: '#ff1744',
    neonAzul: '#2979ff',
    neonDorado: '#ffd700',
    neonIntensity: 60,
    mostrarLineas: true,
    ballSpeed: 0.5,
    precisionGol: 0.3,
    margenCampo: 0.045
};

var goalState = {
    ronaldoReducida: false,
    messiReducida: false
};

// ============================================
// ESTADO DE LAS BOLAS
// ============================================
var ballState = {
    ronaldo: { x: 0, y: 0, vx: 0, vy: 0 },
    messi: { x: 0, y: 0, vx: 0, vy: 0 }
};

// ============================================
// VARIABLES GLOBALES
// ============================================
var currentMatchId = null;
var poderesInterval = null;
var audios = {};
var audioEstadio = null;
var audioFondoActivo = false;

var gameState = {
    scoreRonaldo: 0,
    scoreMessi: 0,
    powerActive: null,
    powerTimer: null,
    chaosActive: false,
    matchTime: 0,
    timerInterval: null,
    partidaActiva: false,
    metaGoles: 50,
    ballInterval: null,
    autoGuardadoInterval: null,
    _lastScoreRonaldo: 0,
    _lastScoreMessi: 0,
    animFrameId: null
};

var recordatorioInterval = null;
var recordatorioElement = document.getElementById('recordatorio-timer');
var recordatorioSegundos = document.getElementById('recordatorio-segundos');

// ============================================
// FUNCIONES AUXILIARES
// ============================================
function getLimitesCampo() {
    var canvas = document.getElementById('campo-canvas');
    if (!canvas) {
        return { minX: 20, maxX: 120, minY: 20, maxY: 80, w: 140, h: 100, radio: 12, ballSize: 24 };
    }
    var w = canvas.width || CONFIG.campoAncho || 600;
    var h = canvas.height || CONFIG.campoAlto || 400;
    var ballSize = Math.min(w, h) * 0.045;
    ballSize = Math.max(14, Math.min(32, ballSize));
    var radio = ballSize / 2;
    var margen = Math.max(18, w * CONFIG.margenCampo);
    return {
        minX: margen + radio,
        maxX: w - margen - radio,
        minY: margen + radio,
        maxY: h - margen - radio,
        w: w,
        h: h,
        radio: radio,
        ballSize: ballSize
    };
}

function generarDireccionAleatoria() {
    var angulo = Math.random() * 2 * Math.PI;
    var velocidad = 0.5 + Math.random() * 0.3;
    return { vx: Math.cos(angulo) * velocidad, vy: Math.sin(angulo) * velocidad };
}

// ============================================
// CONFIGURACIÓN - CORREGIDA PARA RESPONSIVE
// ============================================
function cargarConfiguracion() {
    var saved = localStorage.getItem('golfinalive_config');
    if (saved) {
        try {
            var parsed = JSON.parse(saved);
            CONFIG = { ...CONFIG, ...parsed };
        } catch(e) { console.warn('Error cargando configuración:', e); }
    }
    // Aplicar configuración después de cargar
    setTimeout(aplicarConfiguracion, 100);
}

function guardarConfiguracion() {
    localStorage.setItem('golfinalive_config', JSON.stringify(CONFIG));
    var status = document.getElementById('config-status');
    if (status) {
        status.textContent = '✅ Configuración guardada!';
        status.className = 'config-status';
        setTimeout(function() { status.textContent = ''; }, 3000);
    }
}

// ============================================
// APLICAR CONFIGURACIÓN - CORREGIDO
// ============================================
function aplicarConfiguracion() {
    var canvas = document.getElementById('campo-canvas');
    var wrapper = document.getElementById('campo-wrapper');
    if (!canvas || !wrapper) return;
    
    // Obtener tamaño REAL del wrapper
    var w = wrapper.clientWidth;
    var h = wrapper.clientHeight;
    
    // Asegurar tamaño mínimo
    if (w < 100) w = 600;
    if (h < 100) h = 400;
    
    // Guardar en CONFIG
    CONFIG.campoAncho = w;
    CONFIG.campoAlto = h;
    
    // Aplicar al canvas - USAR 100% EN VEZ DE PX FIJOS
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    
    // Redibujar campo
    dibujarCampo();
    
    // Actualizar UI de configuración
    var anchoLabel = document.getElementById('campo-ancho-label');
    if (anchoLabel) anchoLabel.textContent = w + 'px';
    var altoLabel = document.getElementById('campo-alto-label');
    if (altoLabel) altoLabel.textContent = h + 'px';
    
    var anchoSlider = document.getElementById('campo-ancho-slider');
    if (anchoSlider) anchoSlider.value = w;
    var altoSlider = document.getElementById('campo-alto-slider');
    if (altoSlider) altoSlider.value = h;
    
    // Tamaño de imágenes de jugadores
    var imagenes = document.querySelectorAll('.player-img');
    imagenes.forEach(function(img) {
        img.style.width = CONFIG.playerImageSize + 'px';
        img.style.height = (CONFIG.playerImageSize * 1.3) + 'px';
    });
    
    // Aplicar neones
    aplicarNeones();
    
    // Actualizar controles de configuración
    var speedSlider = document.getElementById('ball-speed-slider');
    if (speedSlider) speedSlider.value = CONFIG.ballSpeed;
    var speedLabel = document.getElementById('ball-speed-label');
    if (speedLabel) speedLabel.textContent = CONFIG.ballSpeed.toFixed(2);
    
    var playerSlider = document.getElementById('player-size-slider');
    if (playerSlider) playerSlider.value = CONFIG.playerImageSize;
    var playerLabel = document.getElementById('player-size-label');
    if (playerLabel) playerLabel.textContent = CONFIG.playerImageSize + 'px';
    
    var goalSlider = document.getElementById('goal-size-slider');
    if (goalSlider) {
        goalSlider.value = CONFIG.goalSize;
        var goalLabel = document.getElementById('goal-size-label');
        if (goalLabel) goalLabel.textContent = CONFIG.goalSize.toFixed(1);
    }
    
    var precisionSlider = document.getElementById('precision-gol-slider');
    if (precisionSlider) {
        precisionSlider.value = CONFIG.precisionGol;
        var precisionLabel = document.getElementById('precision-gol-label');
        if (precisionLabel) precisionLabel.textContent = CONFIG.precisionGol.toFixed(2);
    }
    
    var margenSlider = document.getElementById('margen-campo-slider');
    if (margenSlider) {
        margenSlider.value = CONFIG.margenCampo;
        var margenLabel = document.getElementById('margen-campo-label');
        if (margenLabel) margenLabel.textContent = CONFIG.margenCampo.toFixed(3);
    }
    
    var neonRojoPicker = document.getElementById('neon-rojo-picker');
    if (neonRojoPicker) neonRojoPicker.value = CONFIG.neonRojo;
    var neonAzulPicker = document.getElementById('neon-azul-picker');
    if (neonAzulPicker) neonAzulPicker.value = CONFIG.neonAzul;
    var neonDoradoPicker = document.getElementById('neon-dorado-picker');
    if (neonDoradoPicker) neonDoradoPicker.value = CONFIG.neonDorado;
    
    var neonIntensitySlider = document.getElementById('neon-intensity-slider');
    if (neonIntensitySlider) neonIntensitySlider.value = CONFIG.neonIntensity;
    var neonIntensityLabel = document.getElementById('neon-intensity-label');
    if (neonIntensityLabel) neonIntensityLabel.textContent = CONFIG.neonIntensity + '%';
    
    var colorPicker = document.getElementById('campo-color-picker');
    if (colorPicker) colorPicker.value = CONFIG.campoColor;
    
    // Iniciar bolas si no hay partida activa
    if (!gameState.partidaActiva) {
        iniciarBolas();
    }
}

function aplicarNeones() {
    var intensity = CONFIG.neonIntensity / 100;
    var rojo = CONFIG.neonRojo;
    var azul = CONFIG.neonAzul;
    var dorado = CONFIG.neonDorado;
    
    document.querySelectorAll('.neon-rojo').forEach(function(el) {
        el.style.color = rojo;
        el.style.textShadow = '0 0 ' + (10 * intensity) + 'px ' + rojo + ', 0 0 ' + (20 * intensity) + 'px ' + rojo + ', 0 0 ' + (40 * intensity) + 'px ' + rojo;
    });
    
    document.querySelectorAll('.neon-azul').forEach(function(el) {
        el.style.color = azul;
        el.style.textShadow = '0 0 ' + (10 * intensity) + 'px ' + azul + ', 0 0 ' + (20 * intensity) + 'px ' + azul + ', 0 0 ' + (40 * intensity) + 'px ' + azul;
    });
    
    document.querySelectorAll('.neon-dorado').forEach(function(el) {
        el.style.color = dorado;
        el.style.textShadow = '0 0 ' + (10 * intensity) + 'px ' + dorado + ', 0 0 ' + (20 * intensity) + 'px ' + dorado + ', 0 0 ' + (40 * intensity) + 'px ' + dorado;
    });
    
    var ronaldoImg = document.getElementById('ronaldo-img');
    if (ronaldoImg) {
        ronaldoImg.style.borderColor = rojo;
        ronaldoImg.style.boxShadow = '0 0 ' + (30 * intensity) + 'px ' + rojo;
    }
    
    var messiImg = document.getElementById('messi-img');
    if (messiImg) {
        messiImg.style.borderColor = azul;
        messiImg.style.boxShadow = '0 0 ' + (30 * intensity) + 'px ' + azul;
    }
}

// ============================================
// FUNCIÓN PARA REDIMENSIONAR EL CANVAS
// ============================================
function resizeCanvas() {
    var wrapper = document.getElementById('campo-wrapper');
    if (!wrapper) return;
    aplicarConfiguracion();
    if (!gameState.partidaActiva) {
        iniciarBolas();
    }
}

// ============================================
// DIBUJAR CAMPO - COMPLETO Y CORREGIDO
// ============================================
function dibujarCampo() {
    var canvas = document.getElementById('campo-canvas');
    if (!canvas) return;
    
    var w = CONFIG.campoAncho || 600;
    var h = CONFIG.campoAlto || 400;
    
    // Asegurar que el canvas tenga el tamaño correcto
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
    }
    
    var ctx = canvas.getContext('2d');
    
    // FONDO DEL CAMPO
    var grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, '#66bb6a');
    grad.addColorStop(0.25, '#4caf50');
    grad.addColorStop(0.5, '#388e3c');
    grad.addColorStop(0.75, '#2e7d32');
    grad.addColorStop(1, '#1b5e20');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    
    // Efecto de pasto
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (var y = 0; y < h; y += 6) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }
    
    if (CONFIG.mostrarLineas === false) {
        dibujarBolasEnCanvas(ctx);
        return;
    }
    
    var color = 'rgba(255,255,255,0.15)';
    var colorFuerte = 'rgba(255,255,255,0.08)';
    
    // Línea central
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Círculo central
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.12, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Áreas de penalti
    var areaAncho = w * 0.18;
    var areaAlto = h * 0.55;
    var areaX = w * 0.03;
    var areaY = (h - areaAlto) / 2;
    
    ctx.strokeStyle = 'rgba(255,23,68,0.12)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(areaX, areaY, areaAncho, areaAlto);
    
    ctx.strokeStyle = 'rgba(41,121,255,0.12)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(w - areaX - areaAncho, areaY, areaAncho, areaAlto);
    
    // PORTERÍAS
    var goalSize = CONFIG.goalSize || 1.0;
    var goalAncho = Math.max(w * 0.08 * goalSize, 35);
    var goalProfundidad = Math.max(w * 0.035 * goalSize, 18);
    
    var goalAnchoR = goalState.ronaldoReducida ? goalAncho * 0.5 : goalAncho;
    var goalProfR = goalState.ronaldoReducida ? goalProfundidad * 0.5 : goalProfundidad;
    var goalAnchoM = goalState.messiReducida ? goalAncho * 0.5 : goalAncho;
    var goalProfM = goalState.messiReducida ? goalProfundidad * 0.5 : goalProfundidad;
    
    // PORTERÍA RONALDO (IZQUIERDA)
    var gX_R = w * 0.01;
    var gY_R = (h - goalAnchoR) / 2;
    
    ctx.fillStyle = 'rgba(255,23,68,0.08)';
    ctx.fillRect(gX_R, gY_R, goalProfR, goalAnchoR);
    
    ctx.shadowColor = CONFIG.neonRojo || '#ff1744';
    ctx.shadowBlur = 20;
    
    ctx.strokeStyle = 'rgba(255,23,68,0.9)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(gX_R + goalProfR, gY_R);
    ctx.lineTo(gX_R + goalProfR, gY_R + goalAnchoR);
    ctx.stroke();
    
    ctx.strokeStyle = 'rgba(255,23,68,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gX_R, gY_R);
    ctx.lineTo(gX_R, gY_R + goalAnchoR);
    ctx.stroke();
    
    ctx.strokeStyle = 'rgba(255,23,68,0.9)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(gX_R, gY_R);
    ctx.lineTo(gX_R + goalProfR, gY_R);
    ctx.stroke();
    
    ctx.shadowBlur = 0;
    
    // Malla
    ctx.strokeStyle = 'rgba(255,23,68,0.1)';
    ctx.lineWidth = 0.8;
    var rows = 8;
    var cellH = goalAnchoR / rows;
    for (var j = 1; j < rows; j++) {
        var yPos = gY_R + j * cellH;
        var alpha = 0.05 + 0.1 * (1 - j / rows);
        ctx.strokeStyle = 'rgba(255,23,68,' + alpha + ')';
        ctx.beginPath();
        ctx.moveTo(gX_R, yPos);
        ctx.lineTo(gX_R + goalProfR, yPos);
        ctx.stroke();
    }
    
    // PORTERÍA MESSI (DERECHA)
    var gX_M = w - w * 0.01 - goalProfM;
    var gY_M = (h - goalAnchoM) / 2;
    
    ctx.fillStyle = 'rgba(41,121,255,0.08)';
    ctx.fillRect(gX_M, gY_M, goalProfM, goalAnchoM);
    
    ctx.shadowColor = CONFIG.neonAzul || '#2979ff';
    ctx.shadowBlur = 20;
    
    ctx.strokeStyle = 'rgba(41,121,255,0.9)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(gX_M, gY_M);
    ctx.lineTo(gX_M, gY_M + goalAnchoM);
    ctx.stroke();
    
    ctx.strokeStyle = 'rgba(41,121,255,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gX_M + goalProfM, gY_M);
    ctx.lineTo(gX_M + goalProfM, gY_M + goalAnchoM);
    ctx.stroke();
    
    ctx.strokeStyle = 'rgba(41,121,255,0.9)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(gX_M, gY_M);
    ctx.lineTo(gX_M + goalProfM, gY_M);
    ctx.stroke();
    
    ctx.shadowBlur = 0;
    
    // Malla
    ctx.strokeStyle = 'rgba(41,121,255,0.1)';
    ctx.lineWidth = 0.8;
    for (var jM = 1; jM < rows; jM++) {
        var yPosM = gY_M + jM * cellH;
        var alphaM = 0.05 + 0.1 * (1 - jM / rows);
        ctx.strokeStyle = 'rgba(41,121,255,' + alphaM + ')';
        ctx.beginPath();
        ctx.moveTo(gX_M, yPosM);
        ctx.lineTo(gX_M + goalProfM, yPosM);
        ctx.stroke();
    }
    
    // DIBUJAR BOLAS EN EL CANVAS
    dibujarBolasEnCanvas(ctx);
}

// ============================================
// DIBUJAR SOLO LAS BOLAS (PARA OPTIMIZACIÓN)
// ============================================
function dibujarSoloBolas() {
    var canvas = document.getElementById('campo-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    // Limpiar solo el área de las bolas (usar un rectángulo pequeño)
    // O mejor, limpiar todo y redibujar solo las bolas
    dibujarBolasEnCanvas(ctx);
}

// ============================================
// DIBUJAR BOLAS EN CANVAS
// ============================================
function dibujarBolasEnCanvas(ctx) {
    var limites = getLimitesCampo();
    var radio = limites.radio || 12;
    
    // Bola Ronaldo
    var gradR = ctx.createRadialGradient(
        ballState.ronaldo.x - 4, ballState.ronaldo.y - 4, 2,
        ballState.ronaldo.x, ballState.ronaldo.y, radio
    );
    gradR.addColorStop(0, '#ff6666');
    gradR.addColorStop(0.7, '#ff1744');
    gradR.addColorStop(1, '#cc0000');
    
    ctx.shadowColor = 'rgba(255,23,68,0.4)';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(ballState.ronaldo.x, ballState.ronaldo.y, radio, 0, Math.PI * 2);
    ctx.fillStyle = gradR;
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Brillo de la bola Ronaldo
    ctx.beginPath();
    ctx.arc(ballState.ronaldo.x - 4, ballState.ronaldo.y - 4, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();
    
    // Bola Messi
    var gradM = ctx.createRadialGradient(
        ballState.messi.x - 4, ballState.messi.y - 4, 2,
        ballState.messi.x, ballState.messi.y, radio
    );
    gradM.addColorStop(0, '#6666ff');
    gradM.addColorStop(0.7, '#2979ff');
    gradM.addColorStop(1, '#0d47a1');
    
    ctx.shadowColor = 'rgba(41,121,255,0.4)';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(ballState.messi.x, ballState.messi.y, radio, 0, Math.PI * 2);
    ctx.fillStyle = gradM;
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Brillo de la bola Messi
    ctx.beginPath();
    ctx.arc(ballState.messi.x - 4, ballState.messi.y - 4, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();
}

// ============================================
// INICIALIZAR BOLAS
// ============================================
function iniciarBolas() {
    var limites = getLimitesCampo();
    var w = limites.w;
    var h = limites.h;
    var margen = 30;
    var velocidadBase = 1.2;
    var anguloR = Math.random() * 2 * Math.PI;
    var anguloM = Math.random() * 2 * Math.PI;
    ballState.ronaldo.x = margen + Math.random() * (w * 0.3);
    ballState.ronaldo.y = margen + Math.random() * (h - margen * 2);
    ballState.ronaldo.vx = Math.cos(anguloR) * velocidadBase;
    ballState.ronaldo.vy = Math.sin(anguloR) * velocidadBase;
    ballState.messi.x = w - margen - Math.random() * (w * 0.3);
    ballState.messi.y = margen + Math.random() * (h - margen * 2);
    ballState.messi.vx = Math.cos(anguloM) * velocidadBase;
    ballState.messi.vy = Math.sin(anguloM) * velocidadBase;
}

// ============================================
// MOVIMIENTO DE BOLAS
// ============================================
function moverBolas() {
    var limites = getLimitesCampo();
    var minX = limites.minX;
    var maxX = limites.maxX;
    var minY = limites.minY;
    var maxY = limites.maxY;
    var speed = gameState.chaosActive ? CONFIG.ballSpeed * 2.5 : CONFIG.ballSpeed;
    var radio = limites.radio;
    
    var bR = ballState.ronaldo;
    bR.x += bR.vx * speed;
    bR.y += bR.vy * speed;
    
    var bM = ballState.messi;
    bM.x += bM.vx * speed;
    bM.y += bM.vy * speed;
    
    // Colisiones entre bolas
    var dx = bM.x - bR.x;
    var dy = bM.y - bR.y;
    var distancia = Math.sqrt(dx * dx + dy * dy);
    var distanciaMinima = radio * 2;
    
    if (distancia < distanciaMinima && distancia > 0) {
        var nx = dx / distancia;
        var ny = dy / distancia;
        var overlap = (distanciaMinima - distancia) / 2;
        bR.x -= nx * overlap;
        bR.y -= ny * overlap;
        bM.x += nx * overlap;
        bM.y += ny * overlap;
        
        var dvx = bR.vx - bM.vx;
        var dvy = bR.vy - bM.vy;
        var dvn = dvx * nx + dvy * ny;
        if (dvn > 0) {
            bR.vx -= dvn * nx;
            bR.vy -= dvn * ny;
            bM.vx += dvn * nx;
            bM.vy += dvn * ny;
        }
        
        var rapidezR = Math.sqrt(bR.vx * bR.vx + bR.vy * bR.vy);
        var rapidezM = Math.sqrt(bM.vx * bM.vx + bM.vy * bM.vy);
        var rapidezPromedio = (rapidezR + rapidezM) / 2;
        if (rapidezR > 0) {
            bR.vx = (bR.vx / rapidezR) * rapidezPromedio;
            bR.vy = (bR.vy / rapidezR) * rapidezPromedio;
        }
        if (rapidezM > 0) {
            bM.vx = (bM.vx / rapidezM) * rapidezPromedio;
            bM.vy = (bM.vy / rapidezM) * rapidezPromedio;
        }
    }
    
    // Rebotes en bordes
    if (bR.x < minX) { bR.x = minX; bR.vx *= -1; }
    if (bR.x > maxX) { bR.x = maxX; bR.vx *= -1; }
    if (bR.y < minY) { bR.y = minY; bR.vy *= -1; }
    if (bR.y > maxY) { bR.y = maxY; bR.vy *= -1; }
    if (bM.x < minX) { bM.x = minX; bM.vx *= -1; }
    if (bM.x > maxX) { bM.x = maxX; bM.vx *= -1; }
    if (bM.y < minY) { bM.y = minY; bM.vy *= -1; }
    if (bM.y > maxY) { bM.y = maxY; bM.vy *= -1; }
}

// ============================================
// BUCLE DEL JUEGO CON REQUESTANIMATIONFRAME
// ============================================
function gameLoop() {
    if (!gameState.partidaActiva) {
        gameState.animFrameId = requestAnimationFrame(gameLoop);
        return;
    }
    
    moverBolas();
    detectarGoles();
    
    // Redibujar solo las bolas (más eficiente)
    dibujarSoloBolas();
    
    gameState.animFrameId = requestAnimationFrame(gameLoop);
}

// ============================================
// DETECCIÓN DE GOLES
// ============================================
function detectarGoles() {
    var canvas = document.getElementById('campo-canvas');
    if (!canvas) return;
    var w = canvas.width || CONFIG.campoAncho || 600;
    var h = canvas.height || CONFIG.campoAlto || 400;
    var bR = ballState.ronaldo;
    var bM = ballState.messi;
    var radio = getLimitesCampo().radio;
    
    var goalAncho = Math.max(w * 0.08 * CONFIG.goalSize, 35);
    var goalProfundidad = Math.max(w * 0.035 * CONFIG.goalSize, 18);
    
    var goalAnchoR = goalState.ronaldoReducida ? goalAncho * 0.5 : goalAncho;
    var goalProfR = goalState.ronaldoReducida ? goalProfundidad * 0.5 : goalProfundidad;
    var goalAnchoM = goalState.messiReducida ? goalAncho * 0.5 : goalAncho;
    var goalProfM = goalState.messiReducida ? goalProfundidad * 0.5 : goalProfundidad;
    
    var margenGol = radio * CONFIG.precisionGol;
    
    var gX_R = w * 0.01;
    var gY_R = (h - goalAnchoR) / 2;
    var gX_R_End = gX_R + goalProfR;
    var gY_R_End = gY_R + goalAnchoR;
    
    var gX_M = w - w * 0.01 - goalProfM;
    var gY_M = (h - goalAnchoM) / 2;
    var gX_M_End = gX_M + goalProfM;
    var gY_M_End = gY_M + goalAnchoM;
    
    // Gol de Ronaldo (bola de Messi entra en portería de Ronaldo)
    var bM_centroX = bM.x;
    var bM_centroY = bM.y;
    
    if (bM_centroX + margenGol > gX_R && bM_centroX - margenGol < gX_R_End &&
        bM_centroY + margenGol > gY_R && bM_centroY - margenGol < gY_R_End) {
        if (bM_centroX > gX_R + radio && bM_centroX < gX_R_End - radio &&
            bM_centroY > gY_R + radio && bM_centroY < gY_R_End - radio) {
            gameState.scoreRonaldo++;
            actualizarMarcador();
            showGoalNotification('⚽ GOL DE RONALDO!');
            reproducirSonido('ronaldo');
            bM.x = w * 0.7 + Math.random() * w * 0.2;
            bM.y = Math.random() * (h - 40) + 20;
            var dirM = generarDireccionAleatoria();
            bM.vx = dirM.vx * 1.5;
            bM.vy = dirM.vy * 1.5;
            if (verificarGanador()) return;
            guardarEstadoCompleto();
            return;
        }
    }
    
    // Gol de Messi (bola de Ronaldo entra en portería de Messi)
    var bR_centroX = bR.x;
    var bR_centroY = bR.y;
    
    if (bR_centroX + margenGol > gX_M && bR_centroX - margenGol < gX_M_End &&
        bR_centroY + margenGol > gY_M && bR_centroY - margenGol < gY_M_End) {
        if (bR_centroX > gX_M + radio && bR_centroX < gX_M_End - radio &&
            bR_centroY > gY_M + radio && bR_centroY < gY_M_End - radio) {
            gameState.scoreMessi++;
            actualizarMarcador();
            showGoalNotification('⚽ GOL DE MESSI!');
            reproducirSonido('messi');
            bR.x = w * 0.1 + Math.random() * w * 0.2;
            bR.y = Math.random() * (h - 40) + 20;
            var dirR = generarDireccionAleatoria();
            bR.vx = dirR.vx * 1.5;
            bR.vy = dirR.vy * 1.5;
            if (verificarGanador()) return;
            guardarEstadoCompleto();
            return;
        }
    }
}

// ============================================
// SONIDOS
// ============================================
function cargarAudioEstadio() {
    var basePath = 'audios/';
    audioEstadio = new Audio(basePath + 'estadio_completo.mp3');
    audioEstadio.preload = 'auto';
    audioEstadio.volume = 0.3;
    audioEstadio.loop = true;
}

function iniciarAudioEstadio() {
    if (audioFondoActivo) return;
    if (!audioEstadio) return;
    audioFondoActivo = true;
    audioEstadio.currentTime = 0;
    var playPromise = audioEstadio.play();
    if (playPromise !== undefined) {
        playPromise.then(function() {
            var btn = document.querySelector('.btn-ambiente');
            if (btn) {
                btn.classList.add('activo');
                btn.textContent = '🎧 ON';
            }
        }).catch(function(e) {
            document.addEventListener('click', function iniciarFondo() {
                if (audioFondoActivo && audioEstadio) {
                    audioEstadio.play().catch(function() {});
                }
                document.removeEventListener('click', iniciarFondo);
            }, { once: true });
        });
    }
}

function detenerAudioEstadio() {
    audioFondoActivo = false;
    if (audioEstadio) {
        audioEstadio.pause();
        audioEstadio.currentTime = 0;
    }
    var btn = document.querySelector('.btn-ambiente');
    if (btn) {
        btn.classList.remove('activo');
        btn.textContent = '🎧 OFF';
    }
}

function toggleAudioEstadio() {
    if (audioFondoActivo) {
        detenerAudioEstadio();
    } else {
        if (!gameState.partidaActiva) return;
        iniciarAudioEstadio();
    }
}

function cargarAudios() {
    var listaAudios = ['ronaldo', 'messi', 'bienvenida', 'suscribete', 'elige', 'ayuda', 'mejor', 'poder'];
    var basePath = 'audios/';
    listaAudios.forEach(function(nombre) {
        var audio = new Audio(basePath + nombre + '.mp3');
        audio.preload = 'auto';
        audio.volume = 1.0;
        audios[nombre] = audio;
    });
    cargarAudioEstadio();
}

function reproducirSonido(nombre) {
    if (audios[nombre]) {
        audios[nombre].pause();
        audios[nombre].currentTime = 0;
        audios[nombre].play().catch(function(e) {});
    }
}

// ============================================
// MARCADOR
// ============================================
function actualizarMarcador() {
    var scoreRonaldo = document.getElementById('score-ronaldo');
    var scoreMessi = document.getElementById('score-messi');
    if (scoreRonaldo) {
        scoreRonaldo.textContent = gameState.scoreRonaldo;
        scoreRonaldo.classList.remove('gol-effect');
        scoreRonaldo.offsetHeight;
        scoreRonaldo.classList.add('gol-effect');
    }
    if (scoreMessi) {
        scoreMessi.textContent = gameState.scoreMessi;
        scoreMessi.classList.remove('gol-effect');
        scoreMessi.offsetHeight;
        scoreMessi.classList.add('gol-effect');
    }
}

function actualizarMetaEnStream(meta) {
    var metaElement = document.getElementById('meta-goles-show');
    if (metaElement) metaElement.textContent = meta || 5;
}

function verificarGanador() {
    var meta = gameState.metaGoles;
    if (gameState.scoreRonaldo >= meta) {
        showGoalNotification('🏆 ¡RONALDO GANA EL PARTIDO!');
        detenerPartida();
        reproducirSonido('mejor');
        detenerAudioEstadio();
        return true;
    } else if (gameState.scoreMessi >= meta) {
        showGoalNotification('🏆 ¡MESSI GANA EL PARTIDO!');
        detenerPartida();
        reproducirSonido('mejor');
        detenerAudioEstadio();
        return true;
    }
    return false;
}

// ============================================
// PODERES
// ============================================
function cargarPoderesActivosStream() {
    supabaseClient
        .from('poderes')
        .select('*')
        .eq('activo', true)
        .order('creado_en', { ascending: false })
        .then(function(result) {
            var data = result.data;
            var error = result.error;
            if (error) { console.error('Error cargando poderes activos:', error); return; }
            var container = document.getElementById('lista-poderes-activos');
            var contador = document.getElementById('contador-poderes');
            if (!data || data.length === 0) {
                if (container) container.innerHTML = '<div class="sin-poderes">🔍 No hay poderes activos</div>';
                if (contador) contador.textContent = '0';
                return;
            }
            if (contador) contador.textContent = data.length;
            var ahora = new Date();
            var html = '';
            data.forEach(function(poder) {
                var expira = new Date(poder.expira_en);
                var tiempoRestante = Math.max(0, Math.floor((expira - ahora) / 1000));
                var clase = 'neutral';
                var nombreLower = poder.nombre.toLowerCase();
                if (nombreLower.includes('ronaldo')) clase = 'ronaldo';
                else if (nombreLower.includes('messi')) clase = 'messi';
                else if (nombreLower.includes('caos')) clase = 'caos';
                else if (nombreLower.includes('lento')) clase = 'lento';
                var minutos = Math.floor(tiempoRestante / 60);
                var segundos = tiempoRestante % 60;
                var tiempoStr = minutos > 0 ? minutos + 'm ' + segundos + 's' : segundos + 's';
                html += '<div class="poder-item ' + clase + '"><span><span class="poder-nombre">⚡ ' + poder.nombre + '</span><span class="poder-usuario"> por ' + (poder.usuario || 'Admin') + '</span></span><span class="poder-tiempo">' + tiempoStr + '</span></div>';
            });
            if (container) container.innerHTML = html;
        })
        .catch(function(error) { console.error('Error:', error); });
}

function iniciarActualizacionPoderes() {
    cargarPoderesActivosStream();
    if (poderesInterval) clearInterval(poderesInterval);
    poderesInterval = setInterval(cargarPoderesActivosStream, 1000);
}

function activatePower(power) {
    if (gameState.powerActive) deactivatePower(gameState.powerActive);
    gameState.powerActive = power.nombre;
    reproducirSonido('poder');
    var banner = document.getElementById('power-banner');
    var powerName = document.getElementById('power-name');
    var powerUser = document.getElementById('power-user');
    createPortalEffect();
    if (banner) {
        banner.classList.remove('entrando', 'saliendo');
        banner.offsetHeight;
        banner.classList.add('entrando');
        setTimeout(function() {
            banner.classList.remove('entrando');
            banner.classList.add('active');
        }, 800);
    }
    if (powerName) powerName.textContent = power.nombre.toUpperCase();
    if (powerUser) powerUser.textContent = power.usuario || 'Anónimo';
    var timer = document.getElementById('power-timer');
    var timeLeft = document.getElementById('power-time-left');
    if (power.expira_en) {
        var expireDate = new Date(power.expira_en);
        var now = new Date();
        var seconds = Math.max(0, Math.floor((expireDate - now) / 1000));
        if (timeLeft) timeLeft.textContent = seconds;
        if (timer) timer.classList.add('active');
        if (gameState.powerTimer) clearInterval(gameState.powerTimer);
        gameState.powerTimer = setInterval(function() {
            var currentTime = parseInt(timeLeft.textContent);
            if (currentTime <= 0) {
                clearInterval(gameState.powerTimer);
                deactivatePower(power.nombre);
            } else {
                timeLeft.textContent = currentTime - 1;
            }
        }, 1000);
    }
    applyPowerEffect(power.nombre, true);
    mostrarRecordatorio(30);
}

function deactivatePower(powerName) {
    gameState.powerActive = null;
    var banner = document.getElementById('power-banner');
    var timer = document.getElementById('power-timer');
    if (banner) {
        banner.classList.remove('entrando', 'active');
        banner.offsetHeight;
        banner.classList.add('saliendo');
        setTimeout(function() { banner.classList.remove('saliendo'); }, 600);
    }
    if (timer) timer.classList.remove('active');
    if (gameState.powerTimer) {
        clearInterval(gameState.powerTimer);
        gameState.powerTimer = null;
    }
    applyPowerEffect(powerName, false);
}

function applyPowerEffect(powerName, active) {
    var p = powerName.toLowerCase();
    if (p.includes('caos')) {
        gameState.chaosActive = active;
        var chaosOverlay = document.getElementById('chaos-overlay');
        var canvas = document.getElementById('campo-canvas');
        if (chaosOverlay) {
            if (active) chaosOverlay.classList.add('active');
            else chaosOverlay.classList.remove('active');
        }
        if (canvas) {
            if (active) canvas.classList.add('chaos-effect');
            else canvas.classList.remove('chaos-effect');
        }
    }
    if (p.includes('escudoronaldo')) {
        if (active) {
            goalState.ronaldoReducida = true;
            dibujarCampo();
            setTimeout(function() { goalState.ronaldoReducida = false; dibujarCampo(); }, 60000);
        }
    }
    if (p.includes('escudomessi')) {
        if (active) {
            goalState.messiReducida = true;
            dibujarCampo();
            setTimeout(function() { goalState.messiReducida = false; dibujarCampo(); }, 60000);
        }
    }
}

// ============================================
// EFECTOS VISUALES
// ============================================
function createShockwave(x, y) {
    var el = document.createElement('div');
    el.className = 'shockwave';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    var wrapper = document.getElementById('campo-wrapper');
    if (wrapper) {
        wrapper.appendChild(el);
        setTimeout(function() { el.remove(); }, 1200);
    }
}

function createFireworks(x, y) {
    var colors = ['#ffd700', '#ff6b35', '#ff1744', '#2979ff', '#00e676', '#b026ff', '#00f0ff', '#ff2d95'];
    var container = document.getElementById('game-container');
    if (!container) return;
    for (var i = 0; i < 60; i++) {
        var particle = document.createElement('div');
        particle.className = 'firework-particle';
        var angle = Math.random() * Math.PI * 2;
        var distance = 100 + Math.random() * 250;
        var color = colors[Math.floor(Math.random() * colors.length)];
        var size = 4 + Math.random() * 8;
        particle.style.cssText = 'left: ' + (x + (Math.random() - 0.5) * 20) + 'px; top: ' + (y + (Math.random() - 0.5) * 20) + 'px; background: ' + color + '; --tx: ' + (Math.cos(angle) * distance) + 'px; --ty: ' + (Math.sin(angle) * distance - 250) + 'px; box-shadow: 0 0 15px ' + color + '; width: ' + size + 'px; height: ' + size + 'px; animation-duration: ' + (1.2 + Math.random() * 0.6) + 's; border-radius: ' + (Math.random() > 0.5 ? '50%' : '2px') + ';';
        container.appendChild(particle);
        setTimeout(function() { particle.remove(); }, 1800);
    }
}

function createConfetti(count) {
    count = count || 50;
    var container = document.getElementById('game-container');
    if (!container) return;
    var colors = ['#ff1744', '#2979ff', '#ffd700', '#00e676', '#b026ff', '#ff6b35', '#00f0ff', '#ff2d95'];
    for (var i = 0; i < count; i++) {
        var el = document.createElement('div');
        el.className = 'confetti';
        var color = colors[Math.floor(Math.random() * colors.length)];
        var sizeW = 6 + Math.random() * 10;
        var sizeH = 10 + Math.random() * 18;
        el.style.cssText = 'left: ' + (Math.random() * 100) + 'vw; top: -20px; background: ' + color + '; width: ' + sizeW + 'px; height: ' + sizeH + 'px; animation-duration: ' + (2 + Math.random() * 3) + 's; animation-delay: ' + (Math.random() * 2) + 's; transform: rotate(' + (Math.random() * 360) + 'deg); border-radius: ' + (Math.random() > 0.5 ? '50%' : '2px') + '; box-shadow: 0 0 5px ' + color + ';';
        container.appendChild(el);
        setTimeout(function() { el.remove(); }, 5000);
    }
}

function createPortalEffect() {
    var el = document.createElement('div');
    el.className = 'portal-effect';
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 1000);
}

function showGoalNotification(scorer) {
    var notification = document.getElementById('goal-notification');
    if (!notification) return;
    notification.textContent = scorer;
    notification.classList.add('active');
    var canvas = document.getElementById('campo-canvas');
    var rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    if (scorer.includes('GOL')) {
        createShockwave(rect.left + rect.width / 2, rect.top + rect.height / 2);
        createConfetti(40);
    }
    if (scorer.includes('GANA')) {
        createFireworks(cx, cy);
        createConfetti(100);
        for (var i = 0; i < 5; i++) {
            setTimeout(function() {
                createFireworks(
                    rect.left + rect.width * (0.1 + Math.random() * 0.8),
                    rect.top + rect.height * (0.1 + Math.random() * 0.8)
                );
            }, i * 300);
        }
    }
    setTimeout(function() { notification.classList.remove('active'); }, 2000);
}

// ============================================
// FUNCIONES DE CONFIGURACIÓN
// ============================================
function setCampoAncho(ancho) {
    CONFIG.campoAncho = parseInt(ancho);
    var label = document.getElementById('campo-ancho-label');
    var slider = document.getElementById('campo-ancho-slider');
    var canvas = document.getElementById('campo-canvas');
    
    if (label) label.textContent = ancho + 'px';
    if (slider) slider.value = ancho;
    
    if (canvas) {
        canvas.width = ancho;
        canvas.style.width = ancho + 'px';
    }
    
    dibujarCampo();
    if (!gameState.partidaActiva) {
        iniciarBolas();
    }
}

function setCampoAlto(alto) {
    CONFIG.campoAlto = parseInt(alto);
    var label = document.getElementById('campo-alto-label');
    var slider = document.getElementById('campo-alto-slider');
    var canvas = document.getElementById('campo-canvas');
    
    if (label) label.textContent = alto + 'px';
    if (slider) slider.value = alto;
    
    if (canvas) {
        canvas.height = alto;
        canvas.style.height = alto + 'px';
    }
    
    dibujarCampo();
    if (!gameState.partidaActiva) {
        iniciarBolas();
    }
}

function setCampoColor(color) {
    CONFIG.campoColor = color;
    var picker = document.getElementById('campo-color-picker');
    if (picker) picker.value = color;
    dibujarCampo();
}

function setPlayerImageSize(size) {
    CONFIG.playerImageSize = parseInt(size);
    
    var label = document.getElementById('player-size-label');
    var slider = document.getElementById('player-size-slider');
    if (label) label.textContent = size + 'px';
    if (slider) slider.value = size;
    
    var imagenes = document.querySelectorAll('.player-img');
    imagenes.forEach(function(img) {
        img.style.width = size + 'px';
        img.style.height = (size * 1.3) + 'px';
    });
    
    guardarConfiguracion();
}

function setGoalSize(size) {
    CONFIG.goalSize = parseFloat(size);
    var label = document.getElementById('goal-size-label');
    var slider = document.getElementById('goal-size-slider');
    if (label) label.textContent = parseFloat(size).toFixed(1);
    if (slider) slider.value = size;
    dibujarCampo();
}

function setCampoLineas(mostrar) {
    CONFIG.mostrarLineas = mostrar;
    dibujarCampo();
}

function setBallSpeed(speed) {
    CONFIG.ballSpeed = parseFloat(speed);
    var label = document.getElementById('ball-speed-label');
    var slider = document.getElementById('ball-speed-slider');
    if (label) label.textContent = speed.toFixed(2);
    if (slider) slider.value = speed;
}

function setNeonRojo(color) { CONFIG.neonRojo = color; aplicarNeones(); }
function setNeonAzul(color) { CONFIG.neonAzul = color; aplicarNeones(); }
function setNeonDorado(color) { CONFIG.neonDorado = color; aplicarNeones(); }

function setNeonIntensity(value) {
    CONFIG.neonIntensity = parseInt(value);
    var label = document.getElementById('neon-intensity-label');
    var slider = document.getElementById('neon-intensity-slider');
    if (label) label.textContent = value + '%';
    if (slider) slider.value = value;
    aplicarNeones();
}

function setPrecisionGol(valor) {
    CONFIG.precisionGol = parseFloat(valor);
    var label = document.getElementById('precision-gol-label');
    var slider = document.getElementById('precision-gol-slider');
    if (label) label.textContent = parseFloat(valor).toFixed(2);
    if (slider) slider.value = valor;
}

function setMargenCampo(valor) {
    CONFIG.margenCampo = parseFloat(valor);
    var label = document.getElementById('margen-campo-label');
    var slider = document.getElementById('margen-campo-slider');
    if (label) label.textContent = parseFloat(valor).toFixed(3);
    if (slider) slider.value = valor;
    iniciarBolas();
}

function restaurarConfiguracion() {
    CONFIG = {
        campoAncho: 600,
        campoAlto: 400,
        campoColor: '#1a6b3a',
        playerImageSize: 80,
        playerShape: 'rectangular',
        goalSize: 1.0,
        neonRojo: '#ff1744',
        neonAzul: '#2979ff',
        neonDorado: '#ffd700',
        neonIntensity: 60,
        mostrarLineas: true,
        ballSpeed: 0.5,
        precisionGol: 0.3,
        margenCampo: 0.04
    };
    guardarConfiguracion();
    aplicarConfiguracion();
    var status = document.getElementById('config-status');
    if (status) {
        status.textContent = '↩️ Configuración restaurada!';
        status.className = 'config-status';
        setTimeout(function() { status.textContent = ''; }, 3000);
    }
}

// ============================================
// TOGGLES
// ============================================
function toggleAudios() {
    var panel = document.getElementById('panel-audios');
    var btn = document.getElementById('btn-toggle-audios');
    if (panel) {
        if (panel.style.display === 'none' || panel.style.display === '') {
            panel.style.display = 'block';
            panel.classList.add('visible');
            if (btn) btn.textContent = '🔽 Audios';
        } else {
            panel.style.display = 'none';
            panel.classList.remove('visible');
            if (btn) btn.textContent = '🔊 Audios';
        }
    }
}

function toggleConfiguracion() {
    var panel = document.getElementById('panel-configuracion');
    var btn = document.getElementById('btn-toggle-config');
    if (panel) {
        if (panel.style.display === 'none' || panel.style.display === '') {
            panel.style.display = 'flex';
            if (btn) btn.textContent = '⚙️ Cerrar';
        } else {
            panel.style.display = 'none';
            if (btn) btn.textContent = '⚙️ Config';
        }
    }
}

function mostrarRecordatorio(segundos) {
    if (recordatorioInterval) {
        clearInterval(recordatorioInterval);
        recordatorioInterval = null;
    }
    if (!recordatorioElement) return;
    var tiempoRestante = segundos || 30;
    recordatorioSegundos.textContent = tiempoRestante;
    recordatorioElement.classList.add('active');
    recordatorioInterval = setInterval(function() {
        tiempoRestante--;
        if (tiempoRestante <= 0) {
            clearInterval(recordatorioInterval);
            recordatorioInterval = null;
            recordatorioElement.classList.remove('active');
        } else {
            recordatorioSegundos.textContent = tiempoRestante;
        }
    }, 1000);
}

// ============================================
// CONTROL DE POSICIÓN DE PANELES - DESACTIVADO
// ============================================
function moverPanel(panelId, direccion) {
    console.log('Los paneles son estáticos, no se pueden mover');
}

function guardarPosicionesPaneles() {
    return;
}

function cargarPosicionesPaneles() {
    return;
}

function actualizarVelocidadFlechas(valor) {
    return;
}

// ============================================
// GUARDAR ESTADO
// ============================================
function guardarEstadoLocal() {
    if (!gameState.partidaActiva) return;
    try {
        var estado = {
            scoreRonaldo: gameState.scoreRonaldo,
            scoreMessi: gameState.scoreMessi,
            partidaActiva: gameState.partidaActiva,
            metaGoles: gameState.metaGoles,
            ballRonaldo: { x: ballState.ronaldo.x, y: ballState.ronaldo.y, vx: ballState.ronaldo.vx, vy: ballState.ronaldo.vy },
            ballMessi: { x: ballState.messi.x, y: ballState.messi.y, vx: ballState.messi.vx, vy: ballState.messi.vy },
            goalState: { ronaldoReducida: goalState.ronaldoReducida, messiReducida: goalState.messiReducida },
            timestamp: Date.now()
        };
        localStorage.setItem('golfinalive_partida', JSON.stringify(estado));
    } catch(e) { console.warn('Error guardando estado:', e); }
}

function guardarMarcadorEnSupabase() {
    if (!currentMatchId) { crearPartidaEnSupabase(); return; }
    supabaseClient
        .from('partidas')
        .update({ puntaje_rojo: gameState.scoreRonaldo, puntaje_azul: gameState.scoreMessi, estado: gameState.partidaActiva ? 'activa' : 'finalizada' })
        .eq('id', currentMatchId)
        .then(function(result) { if (result.error) console.warn('Error guardando marcador:', result.error); });
}

function crearPartidaEnSupabase() {
    var goalsToWin = parseInt(document.getElementById('meta-goles').value) || 50;
    gameState.metaGoles = goalsToWin;
    actualizarMetaEnStream(goalsToWin);
    supabaseClient
        .from('partidas')
        .insert({ estado: 'activa', puntaje_rojo: gameState.scoreRonaldo || 0, puntaje_azul: gameState.scoreMessi || 0, goles_para_ganar: goalsToWin, creada_en: new Date().toISOString() })
        .select()
        .single()
        .then(function(result) { if (result.data) currentMatchId = result.data.id; });
}

function guardarEstadoCompleto() {
    guardarEstadoLocal();
    guardarMarcadorEnSupabase();
}

function iniciarAutoGuardado() {
    if (gameState.autoGuardadoInterval) clearInterval(gameState.autoGuardadoInterval);
    gameState.autoGuardadoInterval = setInterval(function() { if (gameState.partidaActiva) guardarEstadoCompleto(); }, 5000);
}

// ============================================
// CONTROL DE PARTIDA
// ============================================
function iniciarPartida() {
    if (gameState.partidaActiva) return;
    gameState.partidaActiva = true;
    gameState.scoreRonaldo = 0;
    gameState.scoreMessi = 0;
    var metaInput = document.getElementById('meta-goles');
    if (metaInput) gameState.metaGoles = parseInt(metaInput.value) || 50;
    actualizarMetaEnStream(gameState.metaGoles);
    actualizarMarcador();
    iniciarBolas();
    var btnIniciar = document.getElementById('btn-iniciar');
    var btnDetener = document.getElementById('btn-detener');
    var estadoPartida = document.getElementById('estado-partida');
    var gameContainer = document.getElementById('game-container');
    if (btnIniciar) btnIniciar.style.display = 'none';
    if (btnDetener) btnDetener.style.display = 'inline-block';
    if (estadoPartida) {
        estadoPartida.textContent = '🟢 EN VIVO';
        estadoPartida.style.color = '#00e676';
        estadoPartida.className = 'estado-vivo';
    }
    if (gameContainer) {
        gameContainer.classList.remove('iniciando');
        gameContainer.offsetHeight;
        gameContainer.classList.add('iniciando');
        setTimeout(function() { gameContainer.classList.remove('iniciando'); }, 1500);
    }
    
    // Usar requestAnimationFrame en lugar de setInterval
    if (gameState.ballInterval) {
        clearInterval(gameState.ballInterval);
        gameState.ballInterval = null;
    }
    if (gameState.animFrameId) {
        cancelAnimationFrame(gameState.animFrameId);
    }
    gameLoop();
    
    crearPartidaEnSupabase();
    iniciarAutoGuardado();
    guardarEstadoCompleto();
    iniciarAudioEstadio();
    iniciarActualizacionPoderes();
    reproducirSonido('bienvenida');
}

function detenerPartida() {
    gameState.partidaActiva = false;
    if (gameState.ballInterval) { clearInterval(gameState.ballInterval); gameState.ballInterval = null; }
    if (gameState.animFrameId) { cancelAnimationFrame(gameState.animFrameId); gameState.animFrameId = null; }
    if (gameState.autoGuardadoInterval) { clearInterval(gameState.autoGuardadoInterval); gameState.autoGuardadoInterval = null; }
    if (poderesInterval) { clearInterval(poderesInterval); poderesInterval = null; }
    var btnIniciar = document.getElementById('btn-iniciar');
    var btnDetener = document.getElementById('btn-detener');
    var estadoPartida = document.getElementById('estado-partida');
    var gameContainer = document.getElementById('game-container');
    if (btnIniciar) btnIniciar.style.display = 'inline-block';
    if (btnDetener) btnDetener.style.display = 'none';
    if (estadoPartida) {
        estadoPartida.textContent = '⏹️ DETENIDO';
        estadoPartida.style.color = '#ff1744';
        estadoPartida.className = 'estado-detenido';
    }
    if (gameContainer) {
        gameContainer.classList.remove('deteniendo');
        gameContainer.offsetHeight;
        gameContainer.classList.add('deteniendo');
        setTimeout(function() { gameContainer.classList.remove('deteniendo'); }, 1000);
    }
    guardarEstadoCompleto();
    detenerAudioEstadio();
    var container = document.getElementById('lista-poderes-activos');
    if (container) container.innerHTML = '<div class="sin-poderes">🔍 No hay poderes activos</div>';
    var contador = document.getElementById('contador-poderes');
    if (contador) contador.textContent = '0';
}

function reiniciarPartida() {
    detenerPartida();
    gameState.scoreRonaldo = 0;
    gameState.scoreMessi = 0;
    actualizarMarcador();
    actualizarMetaEnStream(gameState.metaGoles);
    iniciarBolas();
    goalState.ronaldoReducida = false;
    goalState.messiReducida = false;
    dibujarCampo();
    localStorage.removeItem('golfinalive_partida');
    var btnIniciar = document.getElementById('btn-iniciar');
    var btnDetener = document.getElementById('btn-detener');
    var estadoPartida = document.getElementById('estado-partida');
    if (btnIniciar) btnIniciar.style.display = 'inline-block';
    if (btnDetener) btnDetener.style.display = 'none';
    if (estadoPartida) {
        estadoPartida.textContent = '⏹️ DETENIDO';
        estadoPartida.style.color = '#ff1744';
        estadoPartida.className = 'estado-detenido';
    }
}

// ============================================
// TIMER
// ============================================
function startMatchTimer() {
    var timerElement = document.getElementById('match-timer');
    if (!timerElement) return;
    var seconds = 0;
    gameState.timerInterval = setInterval(function() {
        seconds++;
        var mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        var secs = String(seconds % 60).padStart(2, '0');
        timerElement.textContent = mins + ':' + secs;
    }, 1000);
}

// ============================================
// REAL TIME
// ============================================
function setupRealtime() {
    supabaseClient
        .channel('poderes-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'poderes' }, function(payload) {
            if (payload.eventType === 'INSERT' && payload.new.activo) {
                activatePower(payload.new);
                mostrarRecordatorio(30);
            } else if (payload.eventType === 'UPDATE' && !payload.new.activo) {
                deactivatePower(payload.new.nombre);
            }
        })
        .subscribe();
    supabaseClient
        .channel('partidas-changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'partidas' }, function(payload) {
            var p = payload.new;
            if (p.puntaje_rojo !== undefined && p.puntaje_azul !== undefined) {
                gameState.scoreRonaldo = p.puntaje_rojo;
                gameState.scoreMessi = p.puntaje_azul;
                actualizarMarcador();
            }
            if (p.goles_para_ganar !== undefined) {
                gameState.metaGoles = p.goles_para_ganar;
                actualizarMetaEnStream(p.goles_para_ganar);
            }
        })
        .subscribe();
    getActiveMatch();
}

function getActiveMatch() {
    supabaseClient
        .from('partidas')
        .select('*')
        .eq('estado', 'activa')
        .order('creada_en', { ascending: false })
        .limit(1)
        .then(function(result) {
            var data = result.data;
            if (data && data.length > 0) {
                var match = data[0];
                currentMatchId = match.id;
                gameState.metaGoles = match.goles_para_ganar || 5;
                actualizarMetaEnStream(gameState.metaGoles);
                gameState.scoreRonaldo = match.puntaje_rojo || 0;
                gameState.scoreMessi = match.puntaje_azul || 0;
                actualizarMarcador();
                iniciarActualizacionPoderes();
            }
        });
}

// ============================================
// CARGAR IMÁGENES
// ============================================
function cargarImagenesJugadores() {
    supabaseClient
        .from('jugadores')
        .select('nombre, imagen_url')
        .in('nombre', ['RONALDO', 'MESSI'])
        .then(function(result) {
            var data = result.data;
            var error = result.error;
            if (error) return;
            data.forEach(function(jugador) {
                if (jugador.imagen_url && jugador.imagen_url.startsWith('data:')) {
                    var imgId = jugador.nombre === 'RONALDO' ? 'ronaldo-img' : 'messi-img';
                    var imgElement = document.getElementById(imgId);
                    if (imgElement) {
                        var img = new Image();
                        img.onload = function() {
                            imgElement.style.backgroundImage = 'url("' + jugador.imagen_url + '")';
                            imgElement.style.backgroundSize = 'cover';
                            imgElement.style.backgroundPosition = 'center';
                        };
                        img.onerror = function() {
                            imgElement.style.backgroundColor = jugador.nombre === 'RONALDO' ? '#cc0000' : '#0000cc';
                        };
                        img.src = jugador.imagen_url;
                    }
                }
            });
        });
}

// ============================================
// INICIO
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    cargarAudios();
    cargarConfiguracion();
    cargarPosicionEstadio();
    var panelConfig = document.getElementById('panel-configuracion');
    if (panelConfig) panelConfig.style.display = 'none';
    setupRealtime();
    startMatchTimer();
    cargarImagenesJugadores();
    iniciarBolas();
    var btnIniciar = document.getElementById('btn-iniciar');
    if (btnIniciar) btnIniciar.style.display = 'inline-block';
    var btnDetener = document.getElementById('btn-detener');
    if (btnDetener) btnDetener.style.display = 'none';
    
    // Aplicar configuración después de cargar
    setTimeout(aplicarConfiguracion, 300);
});

window.addEventListener('load', function() {
    setTimeout(function() { 
        cargarImagenesJugadores(); 
        aplicarConfiguracion();
    }, 500);
});

// Redimensionar el canvas cuando cambia el tamaño de la pantalla
window.addEventListener('resize', function() {
    clearTimeout(window._resizeTimer);
    window._resizeTimer = setTimeout(resizeCanvas, 300);
});

window.addEventListener('beforeunload', function() {
    if (gameState.partidaActiva) guardarEstadoCompleto();
    if (gameState.timerInterval) clearInterval(gameState.timerInterval);
    if (gameState.powerTimer) clearInterval(gameState.powerTimer);
    if (recordatorioInterval) clearInterval(recordatorioInterval);
    if (gameState.ballInterval) clearInterval(gameState.ballInterval);
    if (gameState.autoGuardadoInterval) clearInterval(gameState.autoGuardadoInterval);
    if (poderesInterval) clearInterval(poderesInterval);
    if (gameState.animFrameId) cancelAnimationFrame(gameState.animFrameId);
    detenerAudioEstadio();
});

// ============================================
// CONTROL DE MOVIMIENTO DEL ESTADIO - DESACTIVADO PARA PRUEBAS
// ============================================
var velocidadEstadio = 5;

function moverEstadio(direccion) {
    // DESACTIVADO - El estadio ya no se mueve para evitar problemas de posicionamiento
    console.log('Movimiento del estadio desactivado para pruebas');
    return;
    
    /* CÓDIGO ORIGINAL COMENTADO
    var wrapper = document.getElementById('campo-wrapper');
    if (!wrapper) return;
    
    var paso = velocidadEstadio;
    var currentLeft = parseInt(wrapper.style.left) || 0;
    var currentTop = parseInt(wrapper.style.top) || 0;
    
    switch (direccion) {
        case 'arriba': currentTop -= paso; break;
        case 'abajo': currentTop += paso; break;
        case 'izquierda': currentLeft -= paso; break;
        case 'derecha': currentLeft += paso; break;
        case 'centro':
            currentLeft = 0;
            currentTop = 0;
            break;
    }
    
    wrapper.style.position = 'relative';
    wrapper.style.left = currentLeft + 'px';
    wrapper.style.top = currentTop + 'px';
    
    guardarPosicionEstadio(currentLeft, currentTop);
    */
}

function guardarPosicionEstadio(left, top) {
    try {
        var posicion = { left: left, top: top };
        localStorage.setItem('golfinalive_estadio_pos', JSON.stringify(posicion));
    } catch(e) {
        console.warn('Error guardando posición del estadio:', e);
    }
}

function cargarPosicionEstadio() {
    try {
        var saved = localStorage.getItem('golfinalive_estadio_pos');
        if (saved) {
            var posicion = JSON.parse(saved);
            var wrapper = document.getElementById('campo-wrapper');
            if (wrapper) {
                wrapper.style.position = 'relative';
                wrapper.style.left = (posicion.left || 0) + 'px';
                wrapper.style.top = (posicion.top || 0) + 'px';
            }
        }
    } catch(e) {
        console.warn('Error cargando posición del estadio:', e);
    }
}

// ============================================
// FUNCIONES GLOBALES
// ============================================
window.iniciarPartida = iniciarPartida;
window.detenerPartida = detenerPartida;
window.reiniciarPartida = reiniciarPartida;
window.reproducirSonido = reproducirSonido;
window.toggleAudioEstadio = toggleAudioEstadio;
window.toggleAudios = toggleAudios;
window.toggleConfiguracion = toggleConfiguracion;
window.setCampoAncho = setCampoAncho;
window.setCampoAlto = setCampoAlto;
window.setCampoColor = setCampoColor;
window.setPlayerImageSize = setPlayerImageSize;
window.setGoalSize = setGoalSize;
window.setCampoLineas = setCampoLineas;
window.setBallSpeed = setBallSpeed;
window.setNeonRojo = setNeonRojo;
window.setNeonAzul = setNeonAzul;
window.setNeonDorado = setNeonDorado;
window.setNeonIntensity = setNeonIntensity;
window.setPrecisionGol = setPrecisionGol;
window.setMargenCampo = setMargenCampo;
window.guardarConfiguracion = guardarConfiguracion;
window.restaurarConfiguracion = restaurarConfiguracion;
window.actualizarVelocidadFlechas = actualizarVelocidadFlechas;
window.moverPanel = moverPanel;
window.moverEstadio = moverEstadio;
window.setPlayerImages = function(ronaldoUrl, messiUrl) {
    if (ronaldoUrl) {
        var img = document.getElementById('ronaldo-img');
        if (img) { img.style.backgroundImage = 'url("' + ronaldoUrl + '")'; img.style.backgroundSize = 'cover'; img.style.backgroundPosition = 'center'; }
    }
    if (messiUrl) {
        var img = document.getElementById('messi-img');
        if (img) { img.style.backgroundImage = 'url("' + messiUrl + '")'; img.style.backgroundSize = 'cover'; img.style.backgroundPosition = 'center'; }
    }
};