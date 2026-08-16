// ============================================
// ESTADO PÚBLICO
// ============================================
let partidaActual = null;
let usuarioVoto = null; // 'rojo' o 'azul'
let suscripcionPartida = null;
let suscripcionEventos = null;

// ============================================
// REFERENCIAS DOM
// ============================================
const DOM = {
    puntosRojo: document.getElementById('puntos-rojo'),
    puntosAzul: document.getElementById('puntos-azul'),
    barraRojo: document.getElementById('barra-rojo'),
    barraAzul: document.getElementById('barra-azul'),
    zonaBolas: document.getElementById('zona-bolas'),
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
    ultimoEvento: document.getElementById('ultimo-evento')
};

// ============================================
// CARGAR PARTIDA ACTIVA
// ============================================
async function cargarPartidaActiva() {
    const { data, error } = await supabaseClient
        .from('partidas')
        .select('*')
        .eq('estado', 'activa')
        .order('creada_en', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Error al cargar partida:', error);
        DOM.estadoPartida.textContent = '❌ Error';
        return;
    }

    if (data && data.length > 0) {
        partidaActual = data[0];
        actualizarUI();
        suscribirseCambios();
        cargarEventos();
        cargarJugadores();
        cargarVotos();
        DOM.estadoPartida.textContent = '🔴 EN VIVO';
    } else {
        DOM.estadoPartida.textContent = '⏳ Sin partida activa';
        DOM.modoActual.textContent = 'Esperando nueva partida...';
    }
}

// ============================================
// ACTUALIZAR UI
// ============================================
function actualizarUI() {
    if (!partidaActual) return;

    // Puntajes
    DOM.puntosRojo.textContent = partidaActual.puntaje_rojo;
    DOM.puntosAzul.textContent = partidaActual.puntaje_azul;

    // Barras de progreso (hacia meta 9999)
    const meta = 9999;
    const pRojo = Math.min((partidaActual.puntaje_rojo / meta) * 100, 100);
    const pAzul = Math.min((partidaActual.puntaje_azul / meta) * 100, 100);
    DOM.barraRojo.style.width = pRojo + '%';
    DOM.barraAzul.style.width = pAzul + '%';

    // Modo
    const nombresModo = {
        'bolas': '🎱 Bolas',
        'dados': '🎲 Dados',
        'ruleta': '🎡 Ruleta'
    };
    DOM.modoActual.textContent = 'Modo: ' + (nombresModo[partidaActual.modo] || partidaActual.modo);

    // Estado
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
        const nombre = ganador === 'rojo' ? 
            (DOM.nombreRojo.textContent || 'RONALDO') : 
            (DOM.nombreAzul.textContent || 'MESSI');
        DOM.mensajeGanador.textContent = `🏆 ¡${nombre} GANA! 🏆`;
        DOM.mensajeGanador.classList.remove('oculto');
        
        // Desactivar botones de voto
        DOM.btnRojo.disabled = true;
        DOM.btnAzul.disabled = true;
        DOM.mensajeBando.textContent = '⛔ Partida finalizada';

        // Efecto de confeti
        for (let i = 0; i < 30; i++) {
            setTimeout(() => {
                const bando = Math.random() < 0.5 ? 'rojo' : 'azul';
                crearAnimacionBola(bando, 1);
            }, i * 80);
        }
    } else {
        DOM.mensajeGanador.textContent = '🤝 ¡EMPATE!';
        DOM.mensajeGanador.classList.remove('oculto');
    }
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
                DOM.avatarRojo.innerHTML = `<img src="${jugador.imagen_url}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;">`;
            }
        } else if (jugador.color === 'azul') {
            DOM.nombreAzul.textContent = jugador.nombre;
            if (jugador.imagen_url) {
                DOM.avatarAzul.innerHTML = `<img src="${jugador.imagen_url}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;">`;
            }
        }
    });
}

// ============================================
// SISTEMA DE VOTOS
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

    // Guardar voto en Supabase
    const { error } = await supabaseClient
        .from('votos_usuarios')
        .insert({
            partida_id: partidaActual.id,
            usuario_id: usuarioId,
            bando: bando
        });

    if (error) {
        if (error.code === '23505') { // Unique violation
            DOM.mensajeBando.textContent = '⚠️ Ya votaste en esta partida';
            usuarioVoto = bando; // Asumir que votó
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
    
    // Actualizar contador
    cargarVotos();
}

// Cargar votos
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
// EVENTOS EN TIEMPO REAL
// ============================================
async function cargarEventos() {
    if (!partidaActual) return;

    const { data, error } = await supabaseClient
        .from('eventos')
        .select('*')
        .eq('partida_id', partidaActual.id)
        .order('creado_en', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error al cargar eventos:', error);
        return;
    }

    if (data && data.length > 0) {
        const ultimo = data[0];
        const emoji = ultimo.bando === 'rojo' ? '🔴' : '🔵';
        DOM.ultimoEvento.textContent = `⚡ ${emoji} ${ultimo.bando.toUpperCase()} +${ultimo.puntos} ${ultimo.detalle || ''}`;
    }
}

// ============================================
// SUSCRIPCIONES EN TIEMPO REAL
// ============================================
function suscribirseCambios() {
    if (!partidaActual) return;

    // Suscribirse a cambios en la partida
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

    // Suscribirse a nuevos eventos
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
            
            // Efecto visual de bola
            crearAnimacionBola(evento.bando, evento.puntos);
            
            // Actualizar votos (pueden cambiar)
            cargarVotos();
        })
        .subscribe();
}

// ============================================
// ANIMACIÓN DE BOLA
// ============================================
function crearAnimacionBola(bando, puntos) {
    const bola = document.createElement('div');
    bola.className = `bola ${bando}`;
    bola.style.left = `${Math.random() * 90 + 5}%`;
    
    if (puntos > 1) {
        bola.style.width = '45px';
        bola.style.height = '45px';
        bola.textContent = '⭐';
        bola.style.display = 'flex';
        bola.style.alignItems = 'center';
        bola.style.justifyContent = 'center';
        bola.style.fontSize = '20px';
        bola.style.background = 'radial-gradient(circle at 30% 30%, #ffd700, #ff6d00)';
        bola.style.border = '2px solid #ffd700';
    }
    
    DOM.zonaBolas.appendChild(bola);
    
    setTimeout(() => {
        if (bola.parentNode) bola.remove();
    }, 1200);
}

// ============================================
// INICIALIZACIÓN
// ============================================
cargarPartidaActiva();

// Recargar votos cada 10 segundos (por si hay cambios)
setInterval(() => {
    if (partidaActual && partidaActual.estado === 'activa') {
        cargarVotos();
    }
}, 10000);

// Exponer función global
window.votar = votar;