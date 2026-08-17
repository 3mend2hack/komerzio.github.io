// ============================================
// CONFIGURACIÓN Y ESTADO
// ============================================
let partidaActual = null;
let usuarioLogueado = false;
let suscripcionPartida = null;
let suscripcionEventos = null;
let usuarioVoto = null;
let metaGoles = 5;
let golesRojo = 0;
let golesAzul = 0;
let partidaFinalizada = false;

// Tamaños de portería
let tamanoPorteriaRojo = 'grande';
let tamanoPorteriaAzul = 'grande';

// Movimiento de porterías
let moverPorteriaRojo = false;
let moverPorteriaAzul = false;
let velocidadPorteriaRojo = 1;
let velocidadPorteriaAzul = 1;
let offsetPorteriaRojo = 0;
let offsetPorteriaAzul = 0;
let direccionPorteriaRojo = 1;
let direccionPorteriaAzul = 1;
let animacionMovimientoId = null;

// Poderes
let poderesActivos = {};
let intervaloCuentas = null;

// ============================================
// REFERENCIAS DOM
// ============================================
const DOM = {
    login: document.getElementById('pantalla-login'),
    principal: document.getElementById('pantalla-principal'),
    puntosRojo: document.getElementById('puntos-rojo'),
    puntosAzul: document.getElementById('puntos-azul'),
    barraRojo: document.getElementById('barra-rojo'),
    barraAzul: document.getElementById('barra-azul'),
    mensajeGanador: document.getElementById('mensaje-ganador'),
    mensajeBando: document.getElementById('mensaje-bando'),
    contadorVotos: document.getElementById('contador-votos'),
    btnRojo: document.getElementById('btn-rojo'),
    btnAzul: document.getElementById('btn-azul'),
    estadoPartida: document.getElementById('estado-partida'),
    modoActual: document.getElementById('modo-actual'),
    nombreRojo: document.getElementById('nombre-rojo'),
    nombreAzul: document.getElementById('nombre-azul'),
    avatarRojo: document.getElementById('avatar-rojo'),
    avatarAzul: document.getElementById('avatar-azul'),
    ultimoEvento: document.getElementById('ultimo-evento'),
    resultadoAccion: document.getElementById('resultado-accion'),
    emailLogin: document.getElementById('email-login'),
    passwordLogin: document.getElementById('password-login'),
    mensajeLogin: document.getElementById('mensaje-login'),
    inputMeta: document.getElementById('input-meta'),
    contadorGoles: document.getElementById('contador-goles'),
    mensajeGol: document.getElementById('mensaje-gol'),
    tamanoRojo: document.getElementById('tamano-porteria-rojo'),
    tamanoAzul: document.getElementById('tamano-porteria-azul'),
    moverRojo: document.getElementById('mover-porteria-rojo'),
    moverAzul: document.getElementById('mover-porteria-azul'),
    velRojo: document.getElementById('velocidad-porteria-rojo'),
    velAzul: document.getElementById('velocidad-porteria-azul'),
    listaPoderes: document.getElementById('lista-poderes-activos'),
    contadorPoderes: document.getElementById('contador-poderes')
};

// ============================================
// AUTENTICACIÓN
// ============================================
async function iniciarSesion() {
    const email = DOM.emailLogin.value.trim();
    const password = DOM.passwordLogin.value.trim();
    
    DOM.mensajeLogin.textContent = '⏳ Iniciando sesión...';
    DOM.mensajeLogin.style.color = '#ffd700';
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            DOM.mensajeLogin.textContent = '❌ ' + error.message;
            DOM.mensajeLogin.style.color = '#ff1744';
            return;
        }
        
        usuarioLogueado = true;
        DOM.login.style.display = 'none';
        DOM.principal.style.display = 'block';
        
        cargarJugadores();
        cargarUltimaPartida();
        
        agregarEventoUI('✅ Sesión iniciada como: ' + email);
        
        // Iniciar mensajes automáticos
        iniciarMensajesAutomaticos();
        
    } catch (error) {
        DOM.mensajeLogin.textContent = '❌ Error: ' + error.message;
        DOM.mensajeLogin.style.color = '#ff1744';
    }
}

function cerrarSesion() {
    supabaseClient.auth.signOut();
    usuarioLogueado = false;
    DOM.login.style.display = 'flex';
    DOM.principal.style.display = 'none';
    if (suscripcionPartida) suscripcionPartida.unsubscribe();
    if (suscripcionEventos) suscripcionEventos.unsubscribe();
    if (animacionMovimientoId) {
        cancelAnimationFrame(animacionMovimientoId);
        animacionMovimientoId = null;
    }
    if (intervaloCuentas) {
        clearInterval(intervaloCuentas);
        intervaloCuentas = null;
    }
    detenerMensajesAutomaticos();
    detenerAudioCache();
}

// ============================================
// CARGAR JUGADORES
// ============================================
async function cargarJugadores() {
    const { data, error } = await supabaseClient
        .from('jugadores')
        .select('*');

    if (error) {
        console.error('Error al cargar jugadores:', error);
        return;
    }

    data.forEach(jugador => {
        if (jugador.color === 'rojo') {
            DOM.nombreRojo.textContent = jugador.nombre;
            if (jugador.imagen_url) {
                const img = document.getElementById('img-rojo');
                if (img) {
                    img.src = jugador.imagen_url;
                    img.style.display = 'block';
                }
            }
        } else if (jugador.color === 'azul') {
            DOM.nombreAzul.textContent = jugador.nombre;
            if (jugador.imagen_url) {
                const img = document.getElementById('img-azul');
                if (img) {
                    img.src = jugador.imagen_url;
                    img.style.display = 'block';
                }
            }
        }
    });
}

// ============================================
// FUNCIÓN PARA ACTUALIZAR MOVIMIENTO DE PORTERÍAS
// ============================================
function actualizarMovimientoPorterias() {
    moverPorteriaRojo = DOM.moverRojo.checked;
    moverPorteriaAzul = DOM.moverAzul.checked;
    velocidadPorteriaRojo = parseFloat(DOM.velRojo.value) || 1;
    velocidadPorteriaAzul = parseFloat(DOM.velAzul.value) || 1;
    
    if (velocidadPorteriaRojo < 0.1) velocidadPorteriaRojo = 0.1;
    if (velocidadPorteriaAzul < 0.1) velocidadPorteriaAzul = 0.1;
    
    if (!moverPorteriaRojo) {
        const dimsRojo = getDimensionesPorteria(tamanoPorteriaRojo);
        offsetPorteriaRojo = canvasHeight/2 - dimsRojo.alto/2 - 5;
        direccionPorteriaRojo = 1;
    }
    if (!moverPorteriaAzul) {
        const dimsAzul = getDimensionesPorteria(tamanoPorteriaAzul);
        offsetPorteriaAzul = canvasHeight/2 - dimsAzul.alto/2 - 5;
        direccionPorteriaAzul = 1;
    }
    
    if (!moverPorteriaRojo && !moverPorteriaAzul) {
        if (animacionMovimientoId) {
            cancelAnimationFrame(animacionMovimientoId);
            animacionMovimientoId = null;
        }
        if (ctx) {
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            dibujarCampo();
        }
        return;
    }
    
    if (!animacionMovimientoId) {
        animarPorterias();
    }
    
    agregarEventoUI('🔄 Movimiento de porterías actualizado');
}

// ============================================
// ANIMACIÓN DE MOVIMIENTO DE PORTERÍAS
// ============================================
function animarPorterias() {
    const dimsRojo = getDimensionesPorteria(tamanoPorteriaRojo);
    const dimsAzul = getDimensionesPorteria(tamanoPorteriaAzul);
    
    const altoRojo = dimsRojo.alto;
    const altoAzul = dimsAzul.alto;
    
    const margen = 20;
    const limiteSuperior = margen + 10;
    const limiteInferiorRojo = canvasHeight - margen - altoRojo - 10;
    const limiteInferiorAzul = canvasHeight - margen - altoAzul - 10;
    
    if (moverPorteriaRojo) {
        offsetPorteriaRojo += velocidadPorteriaRojo * 0.6 * direccionPorteriaRojo;
        
        if (offsetPorteriaRojo > limiteInferiorRojo) {
            offsetPorteriaRojo = limiteInferiorRojo;
            direccionPorteriaRojo = -1;
        } else if (offsetPorteriaRojo < limiteSuperior) {
            offsetPorteriaRojo = limiteSuperior;
            direccionPorteriaRojo = 1;
        }
    }
    
    if (moverPorteriaAzul) {
        offsetPorteriaAzul += velocidadPorteriaAzul * 0.6 * direccionPorteriaAzul;
        
        if (offsetPorteriaAzul > limiteInferiorAzul) {
            offsetPorteriaAzul = limiteInferiorAzul;
            direccionPorteriaAzul = -1;
        } else if (offsetPorteriaAzul < limiteSuperior) {
            offsetPorteriaAzul = limiteSuperior;
            direccionPorteriaAzul = 1;
        }
    }
    
    if (ctx) {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        dibujarCampo();
    }
    
    if (moverPorteriaRojo || moverPorteriaAzul) {
        animacionMovimientoId = requestAnimationFrame(animarPorterias);
    } else {
        animacionMovimientoId = null;
    }
}

// ============================================
// CREAR PARTIDA
// ============================================
async function crearPartida() {
    if (!usuarioLogueado) {
        alert('Debes iniciar sesión primero');
        return;
    }
    
    metaGoles = parseInt(DOM.inputMeta.value) || 5;
    if (metaGoles < 1) metaGoles = 1;
    golesRojo = 0;
    golesAzul = 0;
    partidaFinalizada = false;

    tamanoPorteriaRojo = DOM.tamanoRojo.value;
    tamanoPorteriaAzul = DOM.tamanoAzul.value;
    
    const dimsRojoIni = getDimensionesPorteria(tamanoPorteriaRojo);
    const dimsAzulIni = getDimensionesPorteria(tamanoPorteriaAzul);
    const centroY = canvasHeight / 2;
    
    offsetPorteriaRojo = centroY - dimsRojoIni.alto/2 - 5;
    offsetPorteriaAzul = centroY - dimsAzulIni.alto/2 - 5;
    direccionPorteriaRojo = 1;
    direccionPorteriaAzul = 1;

    try {
        const { data, error } = await supabaseClient
            .from('partidas')
            .insert({
                estado: 'activa',
                modo: 'futbol',
                puntaje_rojo: 0,
                puntaje_azul: 0
            })
            .select()
            .single();

        if (error) throw error;

        partidaActual = data;
        actualizarUI();
        agregarEventoUI('✅ Partida creada! Meta: ' + metaGoles + ' goles');
        mostrarResultado('✅ Partida creada! Meta: ' + metaGoles + ' goles');
        actualizarContadorGoles();
        
        actualizarTamanosPorterias();
        suscribirseCambios();

    } catch (error) {
        console.error('Error:', error);
        mostrarResultado('❌ Error: ' + error.message);
    }
}

// ============================================
// FUNCIÓN PARA ACTUALIZAR TAMAÑOS DE PORTERÍA
// ============================================
function actualizarTamanosPorterias() {
    tamanoPorteriaRojo = DOM.tamanoRojo.value;
    tamanoPorteriaAzul = DOM.tamanoAzul.value;
    
    const dimsRojo = getDimensionesPorteria(tamanoPorteriaRojo);
    const dimsAzul = getDimensionesPorteria(tamanoPorteriaAzul);
    const centroY = canvasHeight / 2;
    offsetPorteriaRojo = centroY - dimsRojo.alto/2 - 5;
    offsetPorteriaAzul = centroY - dimsAzul.alto/2 - 5;
    
    if (ctx) {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        dibujarCampo();
    }
    
    agregarEventoUI('🔄 Tamaños de portería actualizados');
}

// ============================================
// OBTENER DIMENSIONES DE PORTERÍA
// ============================================
function getDimensionesPorteria(tamano) {
    const dimensiones = {
        'muy-grande': { ancho: 30, alto: 130 },
        'grande': { ancho: 22, alto: 100 },
        'mediana': { ancho: 16, alto: 75 },
        'pequena': { ancho: 12, alto: 55 },
        'muy-pequena': { ancho: 8, alto: 40 }
    };
    return dimensiones[tamano] || dimensiones['grande'];
}

// ============================================
// SUSCRIPCIONES EN TIEMPO REAL
// ============================================
function suscribirseCambios() {
    if (!partidaActual) return;

    if (suscripcionPartida) suscripcionPartida.unsubscribe();
    if (suscripcionEventos) suscripcionEventos.unsubscribe();

    suscripcionPartida = supabaseClient
        .channel('partida-' + partidaActual.id)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'partidas',
            filter: `id=eq.${partidaActual.id}`
        }, (payload) => {
            partidaActual = payload.new;
            actualizarUI();
            if (partidaActual.estado === 'finalizada') {
                mostrarGanador();
            }
        })
        .subscribe();

    suscripcionEventos = supabaseClient
        .channel('eventos-' + partidaActual.id)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'eventos',
            filter: `partida_id=eq.${partidaActual.id}`
        }, (payload) => {
            const evento = payload.new;
            const emoji = evento.bando === 'rojo' ? '🔴' : '🔵';
            DOM.ultimoEvento.textContent = `⚡ ${emoji} ${evento.bando.toUpperCase()} +${evento.puntos} ${evento.detalle || ''}`;
            cargarVotos();
        })
        .subscribe();
}

// ============================================
// ACTUALIZAR UI
// ============================================
function actualizarUI() {
    if (!partidaActual) return;

    DOM.puntosRojo.textContent = partidaActual.puntaje_rojo;
    DOM.puntosAzul.textContent = partidaActual.puntaje_azul;

    const meta = 9999;
    DOM.barraRojo.style.width = Math.min((partidaActual.puntaje_rojo / meta) * 100, 100) + '%';
    DOM.barraAzul.style.width = Math.min((partidaActual.puntaje_azul / meta) * 100, 100) + '%';

    DOM.modoActual.textContent = 'Modo: ⚽ Fútbol';

    if (partidaActual.estado === 'finalizada') {
        DOM.estadoPartida.textContent = '🏁 FINALIZADO';
        DOM.estadoPartida.style.background = '#ffd700';
        DOM.estadoPartida.style.color = '#000';
        mostrarGanador();
    } else {
        DOM.estadoPartida.textContent = '🔴 EN VIVO';
        DOM.estadoPartida.style.background = '#ff1744';
        DOM.estadoPartida.style.color = '#fff';
    }
}

// ============================================
// MOSTRAR GANADOR
// ============================================
function mostrarGanador() {
    if (!partidaActual || partidaActual.estado !== 'finalizada') return;

    const ganador = partidaActual.ganador;
    if (ganador) {
        const nombre = ganador === 'rojo' ? DOM.nombreRojo.textContent : DOM.nombreAzul.textContent;
        DOM.mensajeGanador.textContent = `🏆 ¡${nombre} GANA con ${ganador === 'rojo' ? golesRojo : golesAzul} goles! 🏆`;
        DOM.mensajeGanador.classList.remove('oculto');
        DOM.btnRojo.disabled = true;
        DOM.btnAzul.disabled = true;
        DOM.mensajeBando.textContent = '⛔ Partida finalizada';
    }
}

// ============================================
// VOTOS
// ============================================
async function votar(bando) {
    if (!partidaActual || partidaActual.estado !== 'activa') {
        DOM.mensajeBando.textContent = '⛔ No hay partida activa';
        return;
    }

    if (usuarioVoto) {
        DOM.mensajeBando.textContent = `⚠️ Ya votaste por ${usuarioVoto === 'rojo' ? 'ROJO' : 'AZUL'}`;
        return;
    }

    const usuarioId = getUsuarioId();

    const { error } = await supabaseClient
        .from('votos_usuarios')
        .insert({
            partida_id: partidaActual.id,
            usuario_id: usuarioId,
            bando: bando
        });

    if (error) {
        if (error.code === '23505') {
            DOM.mensajeBando.textContent = '⚠️ Ya votaste en esta partida';
            usuarioVoto = bando;
            return;
        }
        console.error('Error al votar:', error);
        DOM.mensajeBando.textContent = '❌ Error al votar';
        return;
    }

    usuarioVoto = bando;
    DOM.btnRojo.disabled = true;
    DOM.btnAzul.disabled = true;
    DOM.mensajeBando.textContent = `✅ ¡Votaste por ${bando === 'rojo' ? 'ROJO' : 'AZUL'}!`;
    cargarVotos();
}

async function cargarVotos() {
    if (!partidaActual) return;

    const { data, error } = await supabaseClient
        .from('votos_usuarios')
        .select('bando')
        .eq('partida_id', partidaActual.id);

    if (error) {
        console.error('Error al cargar votos:', error);
        return;
    }

    const rojo = data.filter(v => v.bando === 'rojo').length;
    const azul = data.filter(v => v.bando === 'azul').length;
    DOM.contadorVotos.textContent = `Votos: 🔴 ${rojo} | 🔵 ${azul}`;
}

// ============================================
// CARGAR ÚLTIMA PARTIDA
// ============================================
async function cargarUltimaPartida() {
    try {
        const { data, error } = await supabaseClient
            .from('partidas')
            .select('*')
            .eq('estado', 'activa')
            .order('creada_en', { ascending: false })
            .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
            partidaActual = data[0];
            actualizarUI();
            cargarVotos();
            suscribirseCambios();
            agregarEventoUI('🔄 Partida cargada');
            actualizarTamanosPorterias();
        } else {
            agregarEventoUI('ℹ️ Sin partida activa. Crea una nueva.');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function agregarEventoUI(mensaje) {
    DOM.ultimoEvento.textContent = mensaje;
}

function mostrarResultado(mensaje) {
    DOM.resultadoAccion.textContent = mensaje;
}

function actualizarContadorGoles() {
    if (DOM.contadorGoles) {
        DOM.contadorGoles.textContent = `⚽ ${golesRojo}-${golesAzul}`;
    }
}

// ============================================
// FUNCIONES DE CONTROL
// ============================================
async function añadirPunto(bando, puntos) {
    if (!partidaActual || partidaActual.estado !== 'activa') return;

    const campo = bando === 'rojo' ? 'puntaje_rojo' : 'puntaje_azul';
    const nuevoValor = partidaActual[campo] + puntos;

    const { error } = await supabaseClient
        .from('partidas')
        .update({ [campo]: nuevoValor })
        .eq('id', partidaActual.id);

    if (error) {
        console.error('Error al añadir punto:', error);
        return;
    }

    await supabaseClient
        .from('eventos')
        .insert({
            partida_id: partidaActual.id,
            bando: bando,
            puntos: puntos,
            detalle: 'Gol ⚽'
        });

    partidaActual[campo] = nuevoValor;
    actualizarUI();
}

async function reiniciarPartida() {
    if (!usuarioLogueado) { mostrarResultado('⚠️ Solo el administrador'); return; }
    if (!partidaActual) { mostrarResultado('⚠️ No hay partida'); return; }
    
    golesRojo = 0;
    golesAzul = 0;
    partidaFinalizada = false;
    actualizarContadorGoles();
    
    if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = null;
    }
    animacionEnCurso = false;
    reiniciando = false;
    bolas = [];
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    dibujarCampo();
    
    await supabaseClient
        .from('partidas')
        .update({
            puntaje_rojo: 0,
            puntaje_azul: 0,
            ganador: null,
            estado: 'activa'
        })
        .eq('id', partidaActual.id);

    partidaActual.puntaje_rojo = 0;
    partidaActual.puntaje_azul = 0;
    partidaActual.estado = 'activa';
    partidaActual.ganador = null;
    actualizarUI();
    DOM.mensajeGanador.classList.add('oculto');
    DOM.btnRojo.disabled = false;
    DOM.btnAzul.disabled = false;
    DOM.mensajeBando.textContent = '👆 Toca un botón para elegir';
    mostrarResultado('🔄 Partida reiniciada');
    DOM.ultimoEvento.textContent = '🔄 Partida reiniciada';
    if (DOM.mensajeGol) DOM.mensajeGol.style.opacity = '0';
}

async function finalizarPartida() {
    if (!usuarioLogueado) { mostrarResultado('⚠️ Solo el administrador'); return; }
    if (!partidaActual || partidaActual.estado !== 'activa') { mostrarResultado('⚠️ No hay partida activa'); return; }
    
    if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = null;
    }
    animacionEnCurso = false;
    reiniciando = false;
    bolas = [];
    
    const ganador = partidaActual.puntaje_rojo > partidaActual.puntaje_azul ? 'rojo' :
                    partidaActual.puntaje_azul > partidaActual.puntaje_rojo ? 'azul' : null;

    await supabaseClient
        .from('partidas')
        .update({
            estado: 'finalizada',
            ganador: ganador,
            finalizada_en: new Date().toISOString()
        })
        .eq('id', partidaActual.id);

    partidaActual.estado = 'finalizada';
    partidaActual.ganador = ganador;
    actualizarUI();
    mostrarResultado(`🏆 ¡Finalizada! Ganador: ${ganador ? ganador.toUpperCase() : 'EMPATE'}`);
    DOM.ultimoEvento.textContent = `🏆 Ganador: ${ganador ? ganador.toUpperCase() : 'EMPATE'}`;
}

// ============================================
// SISTEMA DE FÍSICA PARA EL CAMPO DE FÚTBOL
// ============================================

const canvas = document.getElementById('canvas-campo');
const ctx = canvas.getContext('2d');

let canvasWidth = canvas.width;
let canvasHeight = canvas.height;

function resizeCanvas() {
    const container = document.getElementById('campo-container');
    if (container) {
        const rect = container.getBoundingClientRect();
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
    }
}
window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas, 100);

// ============================================
// CLASE BOLA CON FÍSICA PERFECTA Y DETECCIÓN DE GOL
// ============================================
class Bola {
    constructor(x, y, radio, color) {
        this.x = x;
        this.y = y;
        this.radio = radio;
        this.color = color;
        const angulo = (Math.random() - 0.5) * Math.PI * 0.7;
        const velocidadBase = 2 + Math.random() * 1.2;
        this.vx = Math.cos(angulo) * velocidadBase * (color === 'rojo' ? 1 : -1);
        this.vy = Math.sin(angulo) * velocidadBase;
        this.gravedad = 0;
        this.friccion = 1.0;
        this.rebote = 1.0;
        this.activa = true;
        this.entradaGol = false;
        this.trayectoria = [];
        this.maxTrayectoria = 10;
        this.numero = Math.floor(Math.random() * 100);
        
        const dimsRojo = getDimensionesPorteria(tamanoPorteriaRojo);
        const dimsAzul = getDimensionesPorteria(tamanoPorteriaAzul);
        
        this.porteriaRoja = { 
            x: 0, 
            y: offsetPorteriaRojo,
            ancho: dimsRojo.ancho + 15,
            alto: dimsRojo.alto + 10
        };
        this.porteriaAzul = { 
            x: canvasWidth - dimsAzul.ancho - 15,
            y: offsetPorteriaAzul,
            ancho: dimsAzul.ancho + 15,
            alto: dimsAzul.alto + 10
        };
    }

    actualizar(bolas) {
        if (!this.activa) return;

        this.porteriaRoja.y = offsetPorteriaRojo;
        this.porteriaAzul.y = offsetPorteriaAzul;

        this.trayectoria.push({ x: this.x, y: this.y });
        if (this.trayectoria.length > this.maxTrayectoria) {
            this.trayectoria.shift();
        }

        this.x += this.vx;
        this.y += this.vy;

        const margen = 22;
        
        if (this.x - this.radio < margen) {
            this.x = margen + this.radio;
            this.vx = -this.vx;
            this.vy += (Math.random() - 0.5) * 0.08;
        }
        if (this.x + this.radio > canvasWidth - margen) {
            this.x = canvasWidth - margen - this.radio;
            this.vx = -this.vx;
            this.vy += (Math.random() - 0.5) * 0.08;
        }
        if (this.y - this.radio < margen) {
            this.y = margen + this.radio;
            this.vy = -this.vy;
            this.vx += (Math.random() - 0.5) * 0.08;
        }
        if (this.y + this.radio > canvasHeight - margen) {
            this.y = canvasHeight - margen - this.radio;
            this.vy = -this.vy;
            this.vx += (Math.random() - 0.5) * 0.08;
        }

        const velocidadActual = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
        const velocidadObjetivo = 2.5 + Math.random() * 0.3;
        if (velocidadActual > 0.1) {
            this.vx = (this.vx / velocidadActual) * velocidadObjetivo;
            this.vy = (this.vy / velocidadActual) * velocidadObjetivo;
        }

        // DETECCIÓN DE GOL CORRECTA
        if (this.color === 'rojo') {
            const px = this.porteriaAzul.x;
            const py = this.porteriaAzul.y;
            const pw = this.porteriaAzul.ancho;
            const ph = this.porteriaAzul.alto;
            
            if (this.x + this.radio > px && 
                this.x - this.radio < px + pw &&
                this.y + this.radio > py && 
                this.y - this.radio < py + ph) {
                this.entradaGol = true;
                this.activa = false;
                return { gol: 'rojo' };
            }
        }
        
        if (this.color === 'azul') {
            const px = this.porteriaRoja.x;
            const py = this.porteriaRoja.y;
            const pw = this.porteriaRoja.ancho;
            const ph = this.porteriaRoja.alto;
            
            if (this.x + this.radio > px && 
                this.x - this.radio < px + pw &&
                this.y + this.radio > py && 
                this.y - this.radio < py + ph) {
                this.entradaGol = true;
                this.activa = false;
                return { gol: 'azul' };
            }
        }

        // Colisiones entre bolas
        for (const otra of bolas) {
            if (otra === this || !otra.activa) continue;
            
            const dx = this.x - otra.x;
            const dy = this.y - otra.y;
            const distancia = Math.sqrt(dx*dx + dy*dy);
            const distanciaMinima = this.radio + otra.radio;
            
            if (distancia < distanciaMinima && distancia > 0.01) {
                const nx = dx / distancia;
                const ny = dy / distancia;
                
                const overlap = (distanciaMinima - distancia) / 2;
                this.x += nx * overlap;
                this.y += ny * overlap;
                otra.x -= nx * overlap;
                otra.y -= ny * overlap;
                
                const dvx = this.vx - otra.vx;
                const dvy = this.vy - otra.vy;
                const dvn = dvx * nx + dvy * ny;
                
                if (dvn < 0) {
                    this.vx -= dvn * nx;
                    this.vy -= dvn * ny;
                    otra.vx += dvn * nx;
                    otra.vy += dvn * ny;
                }
            }
        }

        return null;
    }

    dibujar(ctx) {
        if (!this.activa && !this.entradaGol) return;

        if (this.trayectoria.length > 1) {
            for (let i = 0; i < this.trayectoria.length - 1; i++) {
                const alpha = (i / this.trayectoria.length) * 0.2;
                const radioEstela = this.radio * (0.2 + 0.8 * (i / this.trayectoria.length));
                ctx.beginPath();
                ctx.arc(this.trayectoria[i].x, this.trayectoria[i].y, radioEstela, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${this.color === 'rojo' ? '255,23,68' : '41,121,255'}, ${alpha})`;
                ctx.fill();
            }
        }

        ctx.beginPath();
        ctx.arc(this.x + 2, this.y + 3, this.radio * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fill();

        const gradiente = ctx.createRadialGradient(
            this.x - this.radio * 0.3, 
            this.y - this.radio * 0.3, 
            this.radio * 0.1,
            this.x, 
            this.y, 
            this.radio
        );
        
        if (this.color === 'rojo') {
            gradiente.addColorStop(0, '#ff6b6b');
            gradiente.addColorStop(0.7, '#ff1744');
            gradiente.addColorStop(1, '#b71c1c');
        } else {
            gradiente.addColorStop(0, '#6bb5ff');
            gradiente.addColorStop(0.7, '#2979ff');
            gradiente.addColorStop(1, '#0d47a1');
        }
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radio, 0, Math.PI * 2);
        ctx.fillStyle = gradiente;
        ctx.fill();
        ctx.strokeStyle = this.color === 'rojo' ? '#ff9100' : '#00e5ff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(this.x - this.radio * 0.25, this.y - this.radio * 0.25, this.radio * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x - this.radio * 0.15, this.y - this.radio * 0.35, this.radio * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = `${this.radio * 0.6}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.numero, this.x, this.y + 1);
    }
}

// ============================================
// DIBUJAR CAMPO DE FÚTBOL
// ============================================
function dibujarCampo() {
    const gradiente = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
    gradiente.addColorStop(0, '#1a6e1a');
    gradiente.addColorStop(0.5, '#2d8a2d');
    gradiente.addColorStop(1, '#1a6e1a');
    ctx.fillStyle = gradiente;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;

    const margen = 20;
    const anchoCampo = canvasWidth - margen * 2;
    const altoCampo = canvasHeight - margen * 2;
    const centroX = canvasWidth / 2;
    const centroY = canvasHeight / 2;

    ctx.strokeRect(margen, margen, anchoCampo, altoCampo);

    ctx.beginPath();
    ctx.moveTo(centroX, margen);
    ctx.lineTo(centroX, canvasHeight - margen);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centroX, centroY, 40, 0, Math.PI * 2);
    ctx.stroke();

    const dimsRojo = getDimensionesPorteria(tamanoPorteriaRojo);
    const dimsAzul = getDimensionesPorteria(tamanoPorteriaAzul);
    
    const altoRojo = dimsRojo.alto;
    const anchoRojo = dimsRojo.ancho;
    const altoAzul = dimsAzul.alto;
    const anchoAzul = dimsAzul.ancho;

    const porteriaRojaX = 0;
    const porteriaRojaY = offsetPorteriaRojo;
    const porteriaRojaAncho = anchoRojo + 15;
    const porteriaRojaAlto = altoRojo + 10;
    
    ctx.strokeStyle = 'rgba(255,23,68,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(margen, porteriaRojaY - 10, 35, porteriaRojaAlto + 20);
    
    ctx.strokeStyle = '#ff1744';
    ctx.lineWidth = 4;
    ctx.strokeRect(porteriaRojaX, porteriaRojaY, porteriaRojaAncho, porteriaRojaAlto);
    ctx.fillStyle = 'rgba(255,23,68,0.15)';
    ctx.fillRect(porteriaRojaX, porteriaRojaY, porteriaRojaAncho, porteriaRojaAlto);
    ctx.fillStyle = '#ff1744';
    ctx.fillRect(porteriaRojaX - 1, porteriaRojaY - 2, porteriaRojaAncho + 2, 4);
    ctx.fillRect(porteriaRojaX - 1, porteriaRojaY + porteriaRojaAlto - 2, porteriaRojaAncho + 2, 4);
    
    ctx.strokeStyle = 'rgba(255,23,68,0.15)';
    ctx.lineWidth = 0.5;
    const celdasRojo = Math.floor(porteriaRojaAlto / 15);
    for (let i = 0; i < celdasRojo; i++) {
        const yPos = porteriaRojaY + i * 15;
        ctx.beginPath();
        ctx.moveTo(porteriaRojaX, yPos);
        ctx.lineTo(porteriaRojaX + porteriaRojaAncho, yPos + 15);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(porteriaRojaX + porteriaRojaAncho, yPos);
        ctx.lineTo(porteriaRojaX, yPos + 15);
        ctx.stroke();
    }

    const porteriaAzulX = canvasWidth - anchoAzul - 15;
    const porteriaAzulY = offsetPorteriaAzul;
    const porteriaAzulAncho = anchoAzul + 15;
    const porteriaAzulAlto = altoAzul + 10;
    
    ctx.strokeStyle = 'rgba(41,121,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(canvasWidth - margen - 35, porteriaAzulY - 10, 35, porteriaAzulAlto + 20);
    
    ctx.strokeStyle = '#2979ff';
    ctx.lineWidth = 4;
    ctx.strokeRect(porteriaAzulX, porteriaAzulY, porteriaAzulAncho, porteriaAzulAlto);
    ctx.fillStyle = 'rgba(41,121,255,0.15)';
    ctx.fillRect(porteriaAzulX, porteriaAzulY, porteriaAzulAncho, porteriaAzulAlto);
    ctx.fillStyle = '#2979ff';
    ctx.fillRect(porteriaAzulX - 1, porteriaAzulY - 2, porteriaAzulAncho + 2, 4);
    ctx.fillRect(porteriaAzulX - 1, porteriaAzulY + porteriaAzulAlto - 2, porteriaAzulAncho + 2, 4);
    
    ctx.strokeStyle = 'rgba(41,121,255,0.15)';
    ctx.lineWidth = 0.5;
    const celdasAzul = Math.floor(porteriaAzulAlto / 15);
    for (let i = 0; i < celdasAzul; i++) {
        const yPos = porteriaAzulY + i * 15;
        ctx.beginPath();
        ctx.moveTo(porteriaAzulX, yPos);
        ctx.lineTo(porteriaAzulX + porteriaAzulAncho, yPos + 15);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(porteriaAzulX + porteriaAzulAncho, yPos);
        ctx.lineTo(porteriaAzulX, yPos + 15);
        ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    let textoRojo = '🔴 RONALDO';
    let textoAzul = '🔵 MESSI';
    if (moverPorteriaRojo) {
        textoRojo += ' 🔄';
        ctx.fillStyle = '#ff1744';
    }
    if (moverPorteriaAzul) {
        textoAzul += ' 🔄';
        ctx.fillStyle = '#2979ff';
    }
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(textoRojo, porteriaRojaX + porteriaRojaAncho/2 + 10, porteriaRojaY + porteriaRojaAlto + 18);
    ctx.fillText(textoAzul, porteriaAzulX + porteriaAzulAncho/2 - 10, porteriaAzulY + porteriaAzulAlto + 18);

    ctx.fillStyle = 'rgba(255,215,0,0.08)';
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚽', centroX, centroY);
    
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${golesRojo} - ${golesAzul}`, centroX, margen + 15);
}

// ============================================
// GESTOR DE BOLAS Y ANIMACIÓN
// ============================================
let bolas = [];
let animacionEnCurso = false;
let frameId = null;
let onGol = null;
let reiniciando = false;

function mostrarCuentaRegresiva(numero, callback) {
    const mensaje = document.getElementById('mensaje-gol');
    if (numero > 0) {
        mensaje.textContent = `⏱️ ${numero}`;
        mensaje.style.color = '#ffd700';
        mensaje.style.opacity = '1';
        mensaje.style.fontSize = '4rem';
        setTimeout(() => {
            mostrarCuentaRegresiva(numero - 1, callback);
        }, 1000);
    } else {
        mensaje.textContent = '⚽ ¡YA!';
        mensaje.style.color = '#4caf50';
        mensaje.style.opacity = '1';
        mensaje.style.fontSize = '3.5rem';
        setTimeout(() => {
            mensaje.style.opacity = '0';
            mensaje.style.fontSize = '3.5rem';
            if (callback) callback();
        }, 500);
    }
}

function iniciarJugada(callback) {
    if (partidaFinalizada || reiniciando) return;
    
    onGol = callback;
    bolas = [];
    animacionEnCurso = true;
    reiniciando = false;
    
    const mensaje = document.getElementById('mensaje-gol');
    mensaje.style.opacity = '0';
    mensaje.textContent = '⚽ ¡GOL!';
    mensaje.style.fontSize = '3.5rem';
    
    const radio = 14;
    const margen = 30;
    const centroY = canvasHeight / 2;
    
    const posXRojo = margen + 70;
    const posXAzul = canvasWidth - margen - 70;
    const posYBase = centroY;
    
    const bolaRoja = new Bola(
        posXRojo + (Math.random() - 0.5) * 15,
        posYBase - 30 + (Math.random() - 0.5) * 60,
        radio,
        'rojo'
    );
    const anguloRojo = (Math.random() - 0.5) * 1.0;
    bolaRoja.vx = Math.cos(anguloRojo) * (2.5 + Math.random() * 1.5);
    bolaRoja.vy = Math.sin(anguloRojo) * (2 + Math.random() * 1.5);
    
    const bolaAzul = new Bola(
        posXAzul + (Math.random() - 0.5) * 15,
        posYBase - 30 + (Math.random() - 0.5) * 60,
        radio,
        'azul'
    );
    const anguloAzul = (Math.random() - 0.5) * 1.0 + Math.PI;
    bolaAzul.vx = Math.cos(anguloAzul) * (2.5 + Math.random() * 1.5);
    bolaAzul.vy = Math.sin(anguloAzul) * (2 + Math.random() * 1.5);
    
    bolas.push(bolaRoja, bolaAzul);
    
    if (frameId) cancelAnimationFrame(frameId);
    animarCampo();
}

function animarCampo() {
    if (!animacionEnCurso && bolas.every(b => !b.activa)) {
        return;
    }
    
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    dibujarCampo();
    
    let golDetectado = false;
    let ganadorGol = null;
    
    for (let i = bolas.length - 1; i >= 0; i--) {
        const bola = bolas[i];
        
        if (bola.activa) {
            const resultado = bola.actualizar(bolas);
            if (resultado && resultado.gol && !golDetectado) {
                golDetectado = true;
                ganadorGol = resultado.gol;
                bola.activa = false;
                bola.entradaGol = true;
                
                // 🎵 REPRODUCIR SONIDO DE GOL
                reproducirSonido('gol');
            }
            bola.dibujar(ctx);
        }
    }
    
    if (golDetectado && ganadorGol && !partidaFinalizada && !reiniciando) {
        reiniciando = true;
        animacionEnCurso = false;
        if (frameId) {
            cancelAnimationFrame(frameId);
            frameId = null;
        }
        
        const mensaje = document.getElementById('mensaje-gol');
        mensaje.textContent = `⚽ ¡${ganadorGol.toUpperCase()} MARCA!`;
        mensaje.style.color = ganadorGol === 'rojo' ? '#ff1744' : '#2979ff';
        mensaje.style.opacity = '1';
        mensaje.style.fontSize = '3.5rem';
        
        if (ganadorGol === 'rojo') {
            golesRojo++;
            DOM.puntosRojo.textContent = golesRojo;
            actualizarContadorGoles();
            añadirPunto('rojo', 1);
        } else {
            golesAzul++;
            DOM.puntosAzul.textContent = golesAzul;
            actualizarContadorGoles();
            añadirPunto('azul', 1);
        }
        
        DOM.ultimoEvento.textContent = `⚽ ${ganadorGol.toUpperCase()} MARCA! (${golesRojo}-${golesAzul})`;
        mostrarResultado(`⚽ ¡${ganadorGol.toUpperCase()} MARCA! ${golesRojo}-${golesAzul}`);
        
        if (onGol) onGol(ganadorGol);
        
        if (golesRojo >= metaGoles || golesAzul >= metaGoles) {
            setTimeout(() => {
                finalizarPartidaPorGoles();
            }, 800);
            return;
        } else {
            setTimeout(() => {
                mensaje.style.opacity = '0';
                setTimeout(() => {
                    if (!partidaFinalizada) {
                        mostrarCuentaRegresiva(3, () => {
                            if (!partidaFinalizada) {
                                reiniciando = false;
                                iniciarJugada(onGol);
                            }
                        });
                    }
                }, 300);
            }, 1000);
        }
        return;
    }
    
    if (!golDetectado && bolas.every(b => !b.activa) && !reiniciando) {
        animacionEnCurso = false;
        setTimeout(() => {
            if (!partidaFinalizada && !reiniciando) {
                iniciarJugada(onGol);
            }
        }, 500);
        return;
    }
    
    if (bolas.some(b => b.activa) && !partidaFinalizada && !reiniciando) {
        frameId = requestAnimationFrame(animarCampo);
    }
}

// ============================================
// FINALIZAR POR GOLES
// ============================================
async function finalizarPartidaPorGoles() {
    if (!partidaActual || partidaFinalizada) return;
    partidaFinalizada = true;
    
    if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = null;
    }
    animacionEnCurso = false;
    reiniciando = false;
    bolas = [];
    
    const ganador = golesRojo >= metaGoles ? 'rojo' : 'azul';
    
    DOM.mensajeGanador.textContent = `🏆 ¡${ganador === 'rojo' ? DOM.nombreRojo.textContent : DOM.nombreAzul.textContent} GANA con ${ganador === 'rojo' ? golesRojo : golesAzul} goles! 🏆`;
    DOM.mensajeGanador.classList.remove('oculto');
    DOM.btnRojo.disabled = true;
    DOM.btnAzul.disabled = true;
    DOM.mensajeBando.textContent = '⛔ Partida finalizada';
    DOM.estadoPartida.textContent = '🏁 FINALIZADO';
    DOM.estadoPartida.style.background = '#ffd700';
    DOM.estadoPartida.style.color = '#000';
    
    await supabaseClient
        .from('partidas')
        .update({
            estado: 'finalizada',
            ganador: ganador,
            finalizada_en: new Date().toISOString()
        })
        .eq('id', partidaActual.id);
    
    partidaActual.estado = 'finalizada';
    partidaActual.ganador = ganador;
    mostrarResultado(`🏆 ¡${ganador.toUpperCase()} GANA con ${ganador === 'rojo' ? golesRojo : golesAzul} goles!`);
    DOM.ultimoEvento.textContent = `🏆 ${ganador.toUpperCase()} GANA con ${ganador === 'rojo' ? golesRojo : golesAzul} goles!`;
    
    const mensaje = document.getElementById('mensaje-gol');
    mensaje.textContent = `🏆 ${ganador === 'rojo' ? 'RONALDO' : 'MESSI'} CAMPEÓN!`;
    mensaje.style.color = ganador === 'rojo' ? '#ff1744' : '#2979ff';
    mensaje.style.opacity = '1';
    mensaje.style.fontSize = '2.5rem';
}

// ============================================
// FUNCIÓN PARA LANZAR BOLAS
// ============================================
async function lanzarBolas() {
    if (!usuarioLogueado) { 
        mostrarResultado('⚠️ Solo el administrador puede hacer esto');
        return;
    }
    if (!partidaActual || partidaActual.estado !== 'activa') {
        mostrarResultado('⚠️ No hay partida activa');
        return;
    }
    if (partidaFinalizada) {
        mostrarResultado('⚠️ La partida ya terminó');
        return;
    }
    if (reiniciando) {
        mostrarResultado('⏳ Espera a que termine la cuenta regresiva');
        return;
    }
    
    metaGoles = parseInt(DOM.inputMeta.value) || 5;
    if (metaGoles < 1) metaGoles = 1;
    mostrarResultado('⚽ Lanzando jugada...');
    
    actualizarTamanosPorterias();
    
    if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = null;
    }
    animacionEnCurso = false;
    bolas = [];
    
    iniciarJugada((ganador) => {});
}

// ============================================
// APLICAR PODERES
// ============================================
function aplicarPoder(nombre) {
    switch (nombre) {
        case 'ronaldo':
            velocidadPorteriaRojo += 1;
            setTimeout(() => { velocidadPorteriaRojo -= 1; }, 60000);
            mostrarResultado('⚡ ¡Poder Ronaldo activado!');
            reproducirSonido('poder');
            break;
            
        case 'messi':
            velocidadPorteriaAzul += 1;
            setTimeout(() => { velocidadPorteriaAzul -= 1; }, 60000);
            mostrarResultado('⚡ ¡Poder Messi activado!');
            reproducirSonido('poder');
            break;
            
        case 'lento':
            mostrarResultado('🐢 ¡Modo Lento activado!');
            reproducirSonido('poder');
            break;
            
        case 'gol':
            mostrarResultado('🎯 ¡Gol Seguro activado!');
            reproducirSonido('poder');
            break;
            
        case 'caos':
            mostrarResultado('🌀 ¡Caos Total activado!');
            reproducirSonido('poder');
            break;
            
        case 'escudo':
            if (golesRojo > golesAzul) {
                tamanoPorteriaAzul = 'muy-pequena';
                actualizarTamanosPorterias();
                mostrarResultado('🛡️ ¡Escudo activado! Portería de Messi reducida');
                setTimeout(() => {
                    tamanoPorteriaAzul = 'grande';
                    actualizarTamanosPorterias();
                    mostrarResultado('🛡️ Escudo desactivado - Portería de Messi restaurada');
                }, 60000);
            } else if (golesAzul > golesRojo) {
                tamanoPorteriaRojo = 'muy-pequena';
                actualizarTamanosPorterias();
                mostrarResultado('🛡️ ¡Escudo activado! Portería de Ronaldo reducida');
                setTimeout(() => {
                    tamanoPorteriaRojo = 'grande';
                    actualizarTamanosPorterias();
                    mostrarResultado('🛡️ Escudo desactivado - Portería de Ronaldo restaurada');
                }, 60000);
            } else {
                tamanoPorteriaAzul = 'muy-pequena';
                actualizarTamanosPorterias();
                mostrarResultado('🛡️ ¡Escudo activado! Portería de Messi reducida');
                setTimeout(() => {
                    tamanoPorteriaAzul = 'grande';
                    actualizarTamanosPorterias();
                    mostrarResultado('🛡️ Escudo desactivado - Portería de Messi restaurada');
                }, 60000);
            }
            reproducirSonido('poder');
            break;
            
        default:
            console.log('⚠️ Poder desconocido:', nombre);
    }
}

// ============================================
// PANEL DE PODERES ACTIVOS
// ============================================

function calcularTiempoRestante(fechaExpiracion) {
    if (!fechaExpiracion) return 'Expirado';
    
    const ahora = Date.now();
    const expira = new Date(fechaExpiracion).getTime();
    const diferencia = expira - ahora;

    if (diferencia <= 0) return '⏳ Expirado';

    const segundos = Math.ceil(diferencia / 1000);
    if (segundos < 60) {
        return `${segundos}s`;
    }
    const minutos = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${minutos}m ${segs}s`;
}

function actualizarPanelPoderes() {
    const contenedor = DOM.listaPoderes;
    const contador = DOM.contadorPoderes;
    
    if (!contenedor) return;
    
    supabaseClient
        .from('poderes')
        .select('*')
        .eq('activo', true)
        .then(({ data, error }) => {
            if (error) {
                console.error('Error al obtener poderes:', error);
                return;
            }
            
            if (!data || data.length === 0) {
                contenedor.innerHTML = `<div style="text-align:center;color:#444;font-size:0.75rem;padding:6px 0;">Ningún poder activo</div>`;
                if (contador) contador.textContent = '0 activos';
                return;
            }
            
            if (contador) contador.textContent = `${data.length} activo${data.length > 1 ? 's' : ''}`;
            
            const nombresPoderes = {
                'ronaldo': '⚡ Poder Ronaldo',
                'messi': '⚡ Poder Messi',
                'lento': '🐢 Modo Lento',
                'gol': '🎯 Gol Seguro',
                'caos': '🌀 Caos Total',
                'escudo': '🛡️ Escudo'
            };
            
            const coloresPoderes = {
                'ronaldo': '#ff1744',
                'messi': '#2979ff',
                'lento': '#ffd700',
                'gol': '#4caf50',
                'caos': '#ff6d00',
                'escudo': '#00bcd4'
            };
            
            let html = '';
            data.forEach(poder => {
                const nombreLegible = nombresPoderes[poder.nombre] || poder.nombre;
                const color = coloresPoderes[poder.nombre] || '#ffd700';
                const tiempoRestante = calcularTiempoRestante(poder.expira_en);
                
                let equipo = '⚪ Neutral';
                if (poder.nombre === 'ronaldo') equipo = '🔴 Ronaldo';
                else if (poder.nombre === 'messi') equipo = '🔵 Messi';
                else if (poder.nombre === 'escudo') equipo = '🛡️ Defensivo';
                
                html += `
                    <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.03);padding:6px 10px;border-radius:8px;border-left:3px solid ${color};">
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            <span style="font-size:0.85rem;">${nombreLegible}</span>
                            <span style="font-size:0.65rem;padding:1px 8px;border-radius:10px;background:rgba(255,255,255,0.05);color:#888;">${equipo}</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span style="font-size:0.65rem;color:#ffd700;" class="countdown" data-expira="${poder.expira_en}">⏱️ ${tiempoRestante}</span>
                            <span style="font-size:0.55rem;color:#555;">👤 ${poder.usuario || 'Anónimo'}</span>
                        </div>
                    </div>
                `;
            });
            
            contenedor.innerHTML = html;
            iniciarCuentasRegresivas();
        });
}

function iniciarCuentasRegresivas() {
    if (intervaloCuentas) {
        clearInterval(intervaloCuentas);
    }
    
    intervaloCuentas = setInterval(() => {
        document.querySelectorAll('.countdown').forEach(el => {
            const expira = el.getAttribute('data-expira');
            if (expira) {
                const tiempo = calcularTiempoRestante(expira);
                el.textContent = `⏱️ ${tiempo}`;
                if (tiempo === '⏳ Expirado' || tiempo === 'Expirado') {
                    el.style.color = '#ff1744';
                }
            }
        });
    }, 1000);
}

function escucharPoderesActivos() {
    supabaseClient
        .channel('poderes-activos-cambios')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'poderes'
        }, () => {
            actualizarPanelPoderes();
        })
        .subscribe();
}

// ============================================
// SISTEMA DE SONIDOS Y MENSAJES
// ============================================

// Ruta base de los audios
const RUTAS_AUDIOS = {
    gol: 'audios/gol.mp3',
    bienvenida: 'audios/bienvenida.mp3',
    suscribete: 'audios/suscribete.mp3',
    elige: 'audios/elige-favorito.mp3',
    ayuda: 'audios/ayuda-favorito.mp3',
    mejor: 'audios/mejor-mundo.mp3',
    poder: 'audios/poder-activado.mp3'
};

// Cache de audios
const audioCache = {};

function precargarAudios() {
    Object.keys(RUTAS_AUDIOS).forEach(key => {
        const audio = new Audio(RUTAS_AUDIOS[key]);
        audio.preload = 'auto';
        audioCache[key] = audio;
    });
}

function detenerAudioCache() {
    Object.keys(audioCache).forEach(key => {
        audioCache[key].pause();
        audioCache[key].currentTime = 0;
    });
}

function reproducirAudio(tipo) {
    if (audioCache[tipo]) {
        audioCache[tipo].pause();
        audioCache[tipo].currentTime = 0;
        audioCache[tipo].play().catch(error => {
            console.log('Error al reproducir audio:', error);
        });
    } else {
        console.warn('Audio no encontrado:', tipo);
    }
}

function mostrarMensajeVoz(mensaje, tipo) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.85);
        color: #ffd700;
        padding: 20px 40px;
        border-radius: 15px;
        font-size: 2rem;
        font-weight: bold;
        text-align: center;
        z-index: 1000;
        border: 2px solid rgba(255,215,0,0.3);
        max-width: 90%;
        box-shadow: 0 0 50px rgba(255,215,0,0.1);
        animation: aparecerMensaje 0.5s ease;
        pointer-events: none;
        text-shadow: 0 0 20px rgba(255,215,0,0.2);
    `;
    
    const emojis = {
        'gol': '⚽',
        'bienvenida': '👋',
        'suscribete': '🔔',
        'elige': '🔥',
        'ayuda': '💪',
        'mejor': '🏆',
        'poder': '⚡'
    };
    
    overlay.innerHTML = `
        <div style="font-size: 4rem;">${emojis[tipo] || '🎯'}</div>
        <div>${mensaje}</div>
        <div style="font-size: 0.8rem; color: #888; margin-top: 10px;">${tipo === 'gol' ? '⚡ ¡INCREÍBLE!' : '💡 ¡ÚNETE A LA ACCIÓN!'}</div>
    `;
    
    document.body.appendChild(overlay);
    
    setTimeout(() => {
        overlay.style.animation = 'desaparecerMensaje 0.5s ease forwards';
        setTimeout(() => {
            overlay.remove();
        }, 500);
    }, 4000);
}

function reproducirSonido(tipo) {
    const mensajes = {
        'gol': '¡GOOOOOOL! ¡GOLAZO! ¡Increíble!',
        'bienvenida': '¡Bienvenidos a Gol Fina Live! El partido más emocionante entre Ronaldo y Messi. ¡Elige a tu favorito y ayúdalo a ganar!',
        'suscribete': '¡Suscríbete al canal y gana puntos extra para ayudar a tu jugador favorito! Cada suscriptor nuevo es un punto más para tu equipo.',
        'elige': '¿Quién es el mejor del mundo? ¿Ronaldo o Messi? ¡Elige a tu favorito y demuéstralo en el chat!',
        'ayuda': '¡Ayuda a tu favorito a ganar! Usa los comandos en el chat para activar poderes especiales. ¡Cada poder cuenta!',
        'mejor': '¿Quién es el mejor del mundo? ¿Ronaldo o Messi? ¡El chat decide! ¡Escribe tu voto ahora!',
        'poder': '¡Poder activado! El juego cambia. ¡Aprovecha la ventaja!'
    };
    
    const mensaje = mensajes[tipo] || '¡Sonido activado!';
    
    // Reproducir audio MP3 si existe
    if (audioCache[tipo]) {
        reproducirAudio(tipo);
    }
    
    // Mostrar mensaje en pantalla
    mostrarMensajeVoz(mensaje, tipo);
}

// ============================================
// MENSAJES AUTOMÁTICOS
// ============================================
let intervaloMensajes = null;
let mensajesAutomaticos = [
    { tipo: 'suscribete', intervalo: 120 },
    { tipo: 'elige', intervalo: 180 },
    { tipo: 'ayuda', intervalo: 240 },
    { tipo: 'mejor', intervalo: 300 }
];

function iniciarMensajesAutomaticos() {
    if (intervaloMensajes) {
        clearInterval(intervaloMensajes);
    }
    
    let contador = 0;
    intervaloMensajes = setInterval(() => {
        const mensaje = mensajesAutomaticos[contador % mensajesAutomaticos.length];
        reproducirSonido(mensaje.tipo);
        contador++;
    }, 60000);
}

function detenerMensajesAutomaticos() {
    if (intervaloMensajes) {
        clearInterval(intervaloMensajes);
        intervaloMensajes = null;
    }
}

// ============================================
// ESTILOS PARA ANIMACIONES
// ============================================
const estiloAnimaciones = document.createElement('style');
estiloAnimaciones.textContent = `
    @keyframes aparecerMensaje {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    @keyframes desaparecerMensaje {
        0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(1.2); }
    }
`;
document.head.appendChild(estiloAnimaciones);

// ============================================
// FUNCIONES PARA MANTENER COMPATIBILIDAD
// ============================================
function lanzarDados() {
    mostrarResultado('⚠️ Modo Fútbol activo. Usa "Lanzar" para jugar.');
}

function lanzarRuleta() {
    mostrarResultado('⚠️ Modo Fútbol activo. Usa "Lanzar" para jugar.');
}

function cambiarModo() {
    mostrarResultado('⚠️ Solo hay modo Fútbol disponible.');
}

// ============================================
// AÑADIR roundRect
// ============================================
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        if (r > w/2) r = w/2;
        if (r > h/2) r = h/2;
        this.moveTo(x + r, y);
        this.lineTo(x + w - r, y);
        this.quadraticCurveTo(x + w, y, x + w, y + r);
        this.lineTo(x + w, y + h - r);
        this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.lineTo(x + r, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r);
        this.lineTo(x, y + r);
        this.quadraticCurveTo(x, y, x + r, y);
        return this;
    };
}

// ============================================
// INICIALIZACIÓN
// ============================================
supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session) {
        usuarioLogueado = true;
        DOM.login.style.display = 'none';
        DOM.principal.style.display = 'block';
        cargarJugadores();
        cargarUltimaPartida();
        agregarEventoUI('✅ Sesión activa');
        dibujarCampo();
        
        // Precargar audios
        precargarAudios();
        
        // Inicializar panel de poderes
        setTimeout(() => {
            actualizarPanelPoderes();
            escucharPoderesActivos();
        }, 1000);
    }
});

// ============================================
// EXPONER FUNCIONES GLOBALES
// ============================================
window.iniciarSesion = iniciarSesion;
window.cerrarSesion = cerrarSesion;
window.crearPartida = crearPartida;
window.lanzarBolas = lanzarBolas;
window.lanzarDados = lanzarDados;
window.lanzarRuleta = lanzarRuleta;
window.cambiarModo = cambiarModo;
window.reiniciarPartida = reiniciarPartida;
window.finalizarPartida = finalizarPartida;
window.votar = votar;
window.actualizarTamanosPorterias = actualizarTamanosPorterias;
window.actualizarMovimientoPorterias = actualizarMovimientoPorterias;
window.actualizarPanelPoderes = actualizarPanelPoderes;
window.reproducirSonido = reproducirSonido;