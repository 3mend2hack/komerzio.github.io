// ============================================
// SISTEMA DE LOGS EN TIEMPO REAL
// ============================================
let contadorLogs = 0;

function agregarLog(mensaje, tipo = 'info') {
    contadorLogs++;
    const contenedor = document.getElementById('log-contenedor');
    if (!contenedor) return;
    
    const entrada = document.createElement('div');
    const timestamp = new Date().toLocaleTimeString();
    
    const iconos = {
        'info': '🟢',
        'exito': '✅',
        'error': '❌',
        'advertencia': '⚠️',
        'debug': '🔍'
    };
    
    const colores = {
        'info': '#0f0',
        'exito': '#4caf50',
        'error': '#ff1744',
        'advertencia': '#ffd700',
        'debug': '#2979ff'
    };
    
    entrada.style.color = colores[tipo] || '#fff';
    entrada.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
    entrada.style.padding = '3px 0';
    entrada.style.fontSize = '0.8rem';
    entrada.style.fontFamily = 'monospace';
    entrada.innerHTML = `<span style="color:#666;">[${timestamp}]</span> ${iconos[tipo] || ''} ${mensaje}`;
    
    contenedor.appendChild(entrada);
    contenedor.scrollTop = contenedor.scrollHeight;
    
    const contador = document.getElementById('log-contador');
    if (contador) contador.textContent = `Registros: ${contadorLogs}`;
    
    console.log(`[${timestamp}] ${mensaje}`);
}

function limpiarLogs() {
    const contenedor = document.getElementById('log-contenedor');
    if (contenedor) contenedor.innerHTML = '';
    contadorLogs = 0;
    agregarLog('🧹 Logs limpiados', 'info');
}

function exportarLogs() {
    const contenedor = document.getElementById('log-contenedor');
    if (!contenedor) return;
    const logs = contenedor.innerText;
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_golfina_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    agregarLog('📥 Logs exportados', 'exito');
}

// ============================================
// COMPRESOR DE IMÁGENES
// ============================================
async function comprimirImagen(file, calidad = 0.7) {
    agregarLog(`📸 Comprimiendo imagen: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'debug');
    
    try {
        const options = {
            maxSizeMB: 0.5,
            maxWidthOrHeight: 800,
            useWebWorker: true,
            fileType: 'image/jpeg',
            initialQuality: calidad
        };
        
        const compressedFile = await imageCompression(file, options);
        agregarLog(`✅ Imagen comprimida: ${(compressedFile.size / 1024).toFixed(1)} KB (${Math.round((compressedFile.size / file.size) * 100)}% del original)`, 'exito');
        
        return compressedFile;
    } catch (error) {
        agregarLog(`❌ Error al comprimir: ${error.message}`, 'error');
        return file;
    }
}

// ============================================
// ESTADO ADMIN
// ============================================
let partidaActual = null;
let suscripcionPartida = null;
let suscripcionEventos = null;

// ============================================
// INICIALIZAR BASE DE DATOS
// ============================================
async function inicializarBaseDatos() {
    const btn = document.getElementById('btn-inicializar');
    const estado = document.getElementById('estado-bd');
    
    agregarLog('🚀 Iniciando inicialización de base de datos...', 'info');
    btn.disabled = true;
    btn.textContent = '⏳ Creando...';
    estado.textContent = '⏳ Verificando...';
    estado.style.background = '#ff6d00';

    try {
        // Verificar si la tabla partidas existe
        const { data: testData, error: testError } = await supabaseClient
            .from('partidas')
            .select('count')
            .limit(1);
        
        if (testError && testError.code === 'PGRST205') {
            agregarLog('⚠️ Tablas no existen. Debes crearlas manualmente en SQL Editor.', 'advertencia');
            mostrarResultado('⚠️ Crea las tablas manualmente en Supabase SQL Editor');
            btn.disabled = false;
            btn.textContent = '🚀 Reintentar';
            estado.textContent = '⚠️ Crear tablas manualmente';
            estado.style.background = '#ff6d00';
            return;
        }
        
        agregarLog('✅ Base de datos lista', 'exito');
        estado.textContent = '✅ Tablas listas';
        estado.style.background = '#4caf50';
        btn.textContent = '✅ Listo';
        btn.disabled = true;
        document.getElementById('mensaje-inicial').style.display = 'none';
        mostrarResultado('✅ ¡Base de datos inicializada correctamente!');
        
        cargarUltimaPartida();

    } catch (error) {
        agregarLog(`❌ ERROR: ${error.message}`, 'error');
        estado.textContent = '❌ Error';
        estado.style.background = '#ff1744';
        btn.disabled = false;
        btn.textContent = '🚀 Reintentar';
        mostrarResultado('❌ Error: ' + error.message);
    }
}

// ============================================
// GUARDAR JUGADOR (CON UPSERT CORREGIDO)
// ============================================
async function guardarJugador(bando) {
    agregarLog(`📝 Iniciando guardado de jugador: ${bando.toUpperCase()}`, 'info');
    
    const nombreInput = document.getElementById(`nombre-${bando}-input`);
    const imagenInput = document.getElementById(`imagen-${bando}-input`);
    const preview = document.getElementById(`preview-${bando}`);
    const calidadSelect = document.getElementById(`calidad-${bando}`);
    const tamanoSpan = document.getElementById(`tamano-${bando}`);
    
    const nombre = nombreInput.value.trim();
    if (!nombre) {
        agregarLog('⚠️ Nombre vacío', 'advertencia');
        mostrarResultado('⚠️ Ingresa un nombre');
        return;
    }
    
    let imagenUrl = null;
    
    // Subir imagen si existe
    if (imagenInput.files && imagenInput.files[0]) {
        const file = imagenInput.files[0];
        const calidad = parseFloat(calidadSelect.value);
        
        agregarLog(`📸 Archivo: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'debug');
        
        const compressedFile = await comprimirImagen(file, calidad);
        
        if (tamanoSpan) {
            tamanoSpan.textContent = `${(compressedFile.size / 1024).toFixed(1)} KB`;
        }
        
        const fileExt = 'jpg';
        const fileName = `${bando}_${Date.now()}.${fileExt}`;
        
        try {
            const { data, error } = await supabaseClient.storage
                .from('futbolistas')
                .upload(fileName, compressedFile, {
                    contentType: 'image/jpeg',
                    cacheControl: '3600'
                });
            
            if (error) {
                agregarLog(`❌ Error Storage: ${error.message}`, 'error');
                if (error.message.includes('bucket')) {
                    mostrarResultado('⚠️ Crea el bucket "futbolistas" en Supabase Storage');
                    return;
                }
                throw error;
            }
            
            agregarLog('✅ Imagen subida a Storage', 'exito');
            
            const { data: urlData } = supabaseClient.storage
                .from('futbolistas')
                .getPublicUrl(fileName);
            
            imagenUrl = urlData.publicUrl;
            if (preview) preview.src = imagenUrl;
            
        } catch (error) {
            agregarLog(`❌ Error al subir imagen: ${error.message}`, 'error');
            mostrarResultado('❌ Error al subir imagen: ' + error.message);
            return;
        }
    } else {
        agregarLog('ℹ️ Sin imagen seleccionada', 'info');
    }
    
    // ============================================
    // UPSERT CORREGIDO - Sin onConflict
    // ============================================
    try {
        // Primero, verificar si ya existe un jugador con ese color
        const { data: existente, error: findError } = await supabaseClient
            .from('jugadores')
            .select('id')
            .eq('color', bando)
            .maybeSingle();
        
        if (findError && findError.code !== 'PGRST116') {
            agregarLog(`❌ Error al buscar jugador: ${findError.message}`, 'error');
            throw findError;
        }
        
        let error;
        if (existente) {
            // Actualizar existente
            agregarLog(`🔄 Actualizando jugador existente (ID: ${existente.id})`, 'debug');
            const { error: updateError } = await supabaseClient
                .from('jugadores')
                .update({
                    nombre: nombre,
                    imagen_url: imagenUrl
                })
                .eq('color', bando);
            error = updateError;
        } else {
            // Insertar nuevo
            agregarLog('➕ Insertando nuevo jugador', 'debug');
            const { error: insertError } = await supabaseClient
                .from('jugadores')
                .insert({
                    nombre: nombre,
                    imagen_url: imagenUrl,
                    color: bando
                });
            error = insertError;
        }
        
        if (error) {
            agregarLog(`❌ Error en base de datos: ${error.message} (Código: ${error.code})`, 'error');
            throw error;
        }
        
        agregarLog(`✅ Jugador ${bando.toUpperCase()} guardado: ${nombre}`, 'exito');
        mostrarResultado(`✅ Jugador ${bando.toUpperCase()} guardado: ${nombre}`);
        
    } catch (error) {
        agregarLog(`❌ ERROR FINAL: ${error.message}`, 'error');
        mostrarResultado('❌ Error al guardar: ' + error.message);
    }
}

// ============================================
// CREAR PARTIDA
// ============================================
async function crearPartida() {
    const modo = document.getElementById('select-modo').value;
    const estado = document.getElementById('estado-bd');

    agregarLog(`📝 Creando nueva partida en modo: ${modo}`, 'info');

    try {
        const { data, error } = await supabaseClient
            .from('partidas')
            .insert({
                estado: 'activa',
                modo: modo,
                puntaje_rojo: 0,
                puntaje_azul: 0
            })
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST205') {
                estado.textContent = '⚠️ Tablas no existen';
                estado.style.background = '#ff6d00';
                mostrarResultado('⚠️ Primero toca "Inicializar BD" o crea las tablas manualmente');
                document.getElementById('mensaje-inicial').style.display = 'block';
                agregarLog('⚠️ Tablas no existen', 'advertencia');
                return;
            }
            throw error;
        }

        partidaActual = data;
        actualizarUIAdmin();
        agregarLog(`✅ Partida creada: ${data.id.substring(0,8)}`, 'exito');
        mostrarResultado('✅ ¡Partida creada! Modo: ' + modo);
        
        if (suscripcionPartida) suscripcionPartida.unsubscribe();
        if (suscripcionEventos) suscripcionEventos.unsubscribe();
        
        suscribirsePartida(data.id, (nuevosDatos) => {
            partidaActual = nuevosDatos;
            actualizarUIAdmin();
            if (partidaActual.estado === 'finalizada') {
                mostrarResultado(`🏆 ¡Finalizada! Ganador: ${partidaActual.ganador ? partidaActual.ganador.toUpperCase() : 'EMPATE'}`);
            }
        });
        
        suscribirseEventos(data.id, (nuevoEvento) => {
            agregarEventoUI(nuevoEvento);
        });

    } catch (error) {
        agregarLog(`❌ Error al crear partida: ${error.message}`, 'error');
        mostrarResultado('❌ Error: ' + error.message);
    }
}

// ============================================
// ACTUALIZAR UI ADMIN
// ============================================
function actualizarUIAdmin() {
    if (!partidaActual) return;
    document.getElementById('partida-id').textContent = partidaActual.id.substring(0, 8) + '...';
    document.getElementById('estado-partida-admin').textContent = 
        partidaActual.estado === 'activa' ? '🟢 Activa' : '🔴 Finalizada';
    document.getElementById('estado-partida-admin').style.color = 
        partidaActual.estado === 'activa' ? '#4caf50' : '#ff1744';
    document.getElementById('puntos-rojo-admin').textContent = partidaActual.puntaje_rojo;
    document.getElementById('puntos-azul-admin').textContent = partidaActual.puntaje_azul;
}

function agregarEventoUI(evento) {
    const lista = document.getElementById('lista-eventos');
    if (!lista) return;
    const li = document.createElement('li');
    const emoji = evento.bando === 'rojo' ? '🔴' : '🔵';
    li.innerHTML = `
        <span>${emoji} ${evento.bando.toUpperCase()}</span>
        <span>+${evento.puntos} pts</span>
        <span style="font-size:0.8rem;color:#666;">${evento.detalle || ''}</span>
    `;
    lista.prepend(li);
}

// ============================================
// AÑADIR PUNTO
// ============================================
async function añadirPunto(bando, puntos) {
    if (!partidaActual || partidaActual.estado !== 'activa') {
        mostrarResultado('⚠️ No hay partida activa');
        return;
    }

    const campo = bando === 'rojo' ? 'puntaje_rojo' : 'puntaje_azul';
    const nuevoValor = partidaActual[campo] + puntos;

    const { error: updateError } = await supabaseClient
        .from('partidas')
        .update({ [campo]: nuevoValor })
        .eq('id', partidaActual.id);

    if (updateError) {
        mostrarResultado('❌ Error al sumar puntos: ' + updateError.message);
        return;
    }

    await supabaseClient
        .from('eventos')
        .insert({
            partida_id: partidaActual.id,
            bando: bando,
            puntos: puntos,
            detalle: 'Manual +' + puntos
        });

    partidaActual[campo] = nuevoValor;
    actualizarUIAdmin();
    mostrarResultado(`🎯 +${puntos} para ${bando.toUpperCase()}`);
    agregarLog(`🎯 +${puntos} puntos para ${bando.toUpperCase()}`, 'exito');
}

// ============================================
// MODOS DE AZAR
// ============================================
async function lanzarBola() {
    if (!partidaActual || partidaActual.estado !== 'activa') {
        mostrarResultado('⚠️ No hay partida activa');
        return;
    }
    if (partidaActual.modo !== 'bolas') {
        mostrarResultado('⚠️ Cambia el modo a "Bolas" primero');
        return;
    }
    const bando = Math.random() < 0.5 ? 'rojo' : 'azul';
    await añadirPunto(bando, 1);
    mostrarResultado(`🎱 ¡Bola ${bando.toUpperCase()}! +1 punto`);
    agregarLog(`🎱 Bola ${bando.toUpperCase()}`, 'info');
}

async function lanzarDados() {
    if (!partidaActual || partidaActual.estado !== 'activa') {
        mostrarResultado('⚠️ No hay partida activa');
        return;
    }
    if (partidaActual.modo !== 'dados') {
        mostrarResultado('⚠️ Cambia el modo a "Dados" primero');
        return;
    }
    const dadoRojo = Math.floor(Math.random() * 6) + 1;
    const dadoAzul = Math.floor(Math.random() * 6) + 1;
    await añadirPunto('rojo', dadoRojo);
    await añadirPunto('azul', dadoAzul);
    mostrarResultado(`🎲 Dados: 🔴 ${dadoRojo} | 🔵 ${dadoAzul}`);
    agregarLog(`🎲 Dados: Rojo=${dadoRojo}, Azul=${dadoAzul}`, 'info');
}

async function lanzarRuleta() {
    if (!partidaActual || partidaActual.estado !== 'activa') {
        mostrarResultado('⚠️ No hay partida activa');
        return;
    }
    if (partidaActual.modo !== 'ruleta') {
        mostrarResultado('⚠️ Cambia el modo a "Ruleta" primero');
        return;
    }
    const aleatorio = Math.random();
    let bando, puntos;
    if (aleatorio < 0.45) {
        bando = 'rojo';
        puntos = Math.floor(Math.random() * 5) + 1;
    } else if (aleatorio < 0.90) {
        bando = 'azul';
        puntos = Math.floor(Math.random() * 5) + 1;
    } else {
        bando = 'ambos';
        puntos = Math.floor(Math.random() * 3) + 3;
    }
    if (bando === 'ambos') {
        await añadirPunto('rojo', puntos);
        await añadirPunto('azul', puntos);
        mostrarResultado(`🎡 ¡PUNTOS EXTRA! Ambos +${puntos}`);
        agregarLog(`🎡 Puntos extra: ambos +${puntos}`, 'info');
    } else {
        await añadirPunto(bando, puntos);
        mostrarResultado(`🎡 Ruleta: ${bando.toUpperCase()} +${puntos}`);
        agregarLog(`🎡 Ruleta: ${bando.toUpperCase()} +${puntos}`, 'info');
    }
}

// ============================================
// CAMBIAR MODO
// ============================================
async function cambiarModo() {
    if (!partidaActual) {
        mostrarResultado('⚠️ Primero crea una partida');
        return;
    }
    const nuevoModo = document.getElementById('select-modo').value;
    const { error } = await supabaseClient
        .from('partidas')
        .update({ modo: nuevoModo })
        .eq('id', partidaActual.id);
    if (error) {
        mostrarResultado('❌ Error al cambiar modo: ' + error.message);
        return;
    }
    partidaActual.modo = nuevoModo;
    mostrarResultado('🔄 Modo cambiado a: ' + nuevoModo);
    agregarLog(`🔄 Modo cambiado a: ${nuevoModo}`, 'info');
}

// ============================================
// REINICIAR Y FINALIZAR
// ============================================
async function reiniciarPartida() {
    if (!partidaActual) {
        mostrarResultado('⚠️ No hay partida');
        return;
    }
    const { error } = await supabaseClient
        .from('partidas')
        .update({
            puntaje_rojo: 0,
            puntaje_azul: 0,
            ganador: null,
            estado: 'activa'
        })
        .eq('id', partidaActual.id);
    if (error) {
        mostrarResultado('❌ Error al reiniciar: ' + error.message);
        return;
    }
    partidaActual.puntaje_rojo = 0;
    partidaActual.puntaje_azul = 0;
    partidaActual.estado = 'activa';
    partidaActual.ganador = null;
    actualizarUIAdmin();
    document.getElementById('lista-eventos').innerHTML = '';
    mostrarResultado('🔄 Partida reiniciada');
    agregarLog('🔄 Partida reiniciada', 'info');
}

async function finalizarPartida() {
    if (!partidaActual || partidaActual.estado !== 'activa') {
        mostrarResultado('⚠️ No hay partida activa');
        return;
    }
    const ganador = partidaActual.puntaje_rojo > partidaActual.puntaje_azul ? 'rojo' :
                    partidaActual.puntaje_azul > partidaActual.puntaje_rojo ? 'azul' : null;
    const { error } = await supabaseClient
        .from('partidas')
        .update({
            estado: 'finalizada',
            ganador: ganador,
            finalizada_en: new Date().toISOString()
        })
        .eq('id', partidaActual.id);
    if (error) {
        mostrarResultado('❌ Error al finalizar: ' + error.message);
        return;
    }
    partidaActual.estado = 'finalizada';
    partidaActual.ganador = ganador;
    actualizarUIAdmin();
    mostrarResultado(`🏆 ¡Finalizada! Ganador: ${ganador ? ganador.toUpperCase() : 'EMPATE'}`);
    agregarLog(`🏆 Partida finalizada. Ganador: ${ganador ? ganador.toUpperCase() : 'EMPATE'}`, 'exito');
}

// ============================================
// CARGAR ÚLTIMA PARTIDA
// ============================================
async function cargarUltimaPartida() {
    const estado = document.getElementById('estado-bd');
    agregarLog('🔍 Buscando última partida activa...', 'debug');
    
    try {
        const { data, error } = await supabaseClient
            .from('partidas')
            .select('*')
            .eq('estado', 'activa')
            .order('creada_en', { ascending: false })
            .limit(1);

        if (error) {
            if (error.code === 'PGRST205') {
                estado.textContent = '⚠️ Inicializar BD';
                estado.style.background = '#ff6d00';
                document.getElementById('mensaje-inicial').style.display = 'block';
                agregarLog('⚠️ Tablas no existen. Inicializa la BD.', 'advertencia');
                return;
            }
            throw error;
        }

        if (data && data.length > 0) {
            partidaActual = data[0];
            actualizarUIAdmin();
            estado.textContent = '✅ Conectado';
            estado.style.background = '#4caf50';
            document.getElementById('mensaje-inicial').style.display = 'none';
            agregarLog(`✅ Partida cargada: ${partidaActual.id.substring(0,8)} (${partidaActual.modo})`, 'exito');
            
            cargarEventosAdmin();
            
            suscribirsePartida(partidaActual.id, (nuevosDatos) => {
                partidaActual = nuevosDatos;
                actualizarUIAdmin();
                if (partidaActual.estado === 'finalizada') {
                    mostrarResultado(`🏆 ¡Finalizada! Ganador: ${partidaActual.ganador ? partidaActual.ganador.toUpperCase() : 'EMPATE'}`);
                }
            });
            
            suscribirseEventos(partidaActual.id, (nuevoEvento) => {
                agregarEventoUI(nuevoEvento);
            });
        } else {
            estado.textContent = '✅ Conectado (sin partida)';
            estado.style.background = '#4caf50';
            agregarLog('ℹ️ Sin partida activa. Crea una nueva.', 'info');
        }
    } catch (error) {
        agregarLog(`❌ Error al cargar partida: ${error.message}`, 'error');
        estado.textContent = '❌ Error';
        estado.style.background = '#ff1744';
    }
}

// ============================================
// CARGAR EVENTOS
// ============================================
async function cargarEventosAdmin() {
    if (!partidaActual) return;
    const { data, error } = await supabaseClient
        .from('eventos')
        .select('*')
        .eq('partida_id', partidaActual.id)
        .order('creado_en', { ascending: false })
        .limit(50);
    if (error) {
        console.error('Error al cargar eventos:', error);
        return;
    }
    const lista = document.getElementById('lista-eventos');
    if (!lista) return;
    lista.innerHTML = '';
    data.forEach(e => {
        const li = document.createElement('li');
        const emoji = e.bando === 'rojo' ? '🔴' : '🔵';
        li.innerHTML = `
            <span>${emoji} ${e.bando.toUpperCase()}</span>
            <span>+${e.puntos} pts</span>
            <span style="font-size:0.8rem;color:#666;">${e.detalle || ''}</span>
        `;
        lista.appendChild(li);
    });
}

// ============================================
// MOSTRAR RESULTADO
// ============================================
function mostrarResultado(mensaje) {
    const elemento = document.getElementById('resultado-accion');
    if (elemento) elemento.innerHTML = mensaje;
}

// ============================================
// VISTA PREVIA DE IMÁGENES
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    const rojoInput = document.getElementById('imagen-rojo-input');
    const azulInput = document.getElementById('imagen-azul-input');
    
    if (rojoInput) {
        rojoInput.addEventListener('change', function(e) {
            const reader = new FileReader();
            reader.onload = function() {
                const preview = document.getElementById('preview-rojo');
                if (preview) preview.src = reader.result;
            };
            if (e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
        });
    }
    
    if (azulInput) {
        azulInput.addEventListener('change', function(e) {
            const reader = new FileReader();
            reader.onload = function() {
                const preview = document.getElementById('preview-azul');
                if (preview) preview.src = reader.result;
            };
            if (e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
        });
    }
});

// ============================================
// INICIALIZACIÓN
// ============================================
agregarLog('🟢 Sistema de administración iniciado', 'info');
agregarLog(`🔌 Conectando a Supabase: ${SUPABASE_URL}`, 'debug');
cargarUltimaPartida();

// Exponer funciones globalmente
window.inicializarBaseDatos = inicializarBaseDatos;
window.crearPartida = crearPartida;
window.cambiarModo = cambiarModo;
window.añadirPunto = añadirPunto;
window.lanzarBola = lanzarBola;
window.lanzarDados = lanzarDados;
window.lanzarRuleta = lanzarRuleta;
window.guardarJugador = guardarJugador;
window.reiniciarPartida = reiniciarPartida;
window.finalizarPartida = finalizarPartida;
window.limpiarLogs = limpiarLogs;
window.exportarLogs = exportarLogs;