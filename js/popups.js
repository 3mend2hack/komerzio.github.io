// ============================================================
// popups.js - Sistema de Popups Promocionales (MEJORADO)
// Lógica: Aceptar = nunca más, Cancelar = 24h, 3min entre popups
// ============================================================

import { supabase } from './supabase-client.js';
import { auth } from './auth.js';

console.log('🔔 Popups Manager - Inicializando...');

// ============================================================
// CLASE POPUPS MANAGER
// ============================================================
class PopupsManager {
    constructor() {
        this.popupActual = null;
        this.modalVisible = false;
        this.procesando = false;
        this.timerInterval = null;
        this.verificacionesPendientes = 0;
    }

    /**
     * Verifica si hay un popup disponible y lo muestra si es necesario
     */
    async verificarYMostrarPopup() {
        // Prevenir múltiples verificaciones simultáneas
        if (this.procesando || this.modalVisible) {
            console.log('⏳ Popups: ya hay una verificación en curso');
            return;
        }

        const usuario = auth.getUsuario();
        if (!usuario) {
            console.log('🔔 Popups: usuario no autenticado');
            return;
        }

        this.procesando = true;
        this.verificacionesPendientes++;

        try {
            console.log(`🔔 Popups: verificando para usuario ${usuario.id} (intento ${this.verificacionesPendientes})`);

            // Llamar a la función RPC que aplica toda la lógica
            const { data, error } = await supabase
                .rpc('obtener_proximo_popup', {
                    p_usuario_id: usuario.id
                });

            if (error) {
                console.error('❌ Error obteniendo popup:', error);
                this.procesando = false;
                return;
            }

            if (data.no_popups) {
                console.log('📢 No hay popups pendientes para este usuario');
                this.procesando = false;
                // Programar verificación después de 5 minutos
                this.programarSiguienteVerificacion(300000); // 5 minutos
                return;
            }

            if (data.esperar) {
                const segundos = Math.ceil(data.segundos_restantes);
                console.log(`⏳ Esperando ${segundos} segundos para el próximo popup`);

                // Programar verificación después del tiempo de espera
                setTimeout(() => {
                    this.procesando = false;
                    this.verificarYMostrarPopup();
                }, (segundos + 1) * 1000);

                return;
            }

            // Tenemos un popup para mostrar
            this.popupActual = data;
            this.procesando = false;
            this.mostrarPopup(data);

        } catch (err) {
            console.error('❌ Error en verificarYMostrarPopup:', err);
            this.procesando = false;
        }
    }

    /**
     * Muestra el popup en un modal de SweetAlert2
     */
    mostrarPopup(popup) {
        if (this.modalVisible) return;
        this.modalVisible = true;

        const tieneImagen = popup.imagen_url ?
            `<img src="${popup.imagen_url}" style="max-width: 100%; max-height: 200px; border-radius: 20px; margin-bottom: 20px; object-fit: contain;" onerror="this.style.display='none'">` :
            '';

        const esRegalo = popup.accion === 'regalar_saldo';
        const icono = esRegalo ? 'success' : 'info';
        const botonTexto = popup.boton_texto || (esRegalo ? '🎁 Reclamar' : '¡Aceptar!');
        const titulo = popup.titulo || (esRegalo ? '🎁 ¡Tienes un regalo!' : '📢 Aviso importante');

        // Construir HTML del modal
        let html = `
            <div style="text-align: center;">
                ${tieneImagen}
                <p style="font-size: 16px; margin: 20px 0; color: #333; line-height: 1.6;">${popup.mensaje}</p>
        `;

        if (esRegalo) {
            const monto = popup.accion_data?.monto || 0;
            const limite = popup.accion_data?.limite_usuarios || 0;
            html += `
                <div style="background: #dcfce7; padding: 15px; border-radius: 12px; margin: 10px 0;">
                    <p style="font-size: 18px; color: #16a34a; font-weight: 700; margin: 0;">
                        💰 Recibirás: <span style="font-size: 24px;">$${monto.toFixed(2)} USD</span>
                    </p>
                    ${limite > 0 ? `<p style="font-size: 12px; color: #64748b; margin: 5px 0 0 0;">Límite: ${limite} usuarios</p>` : ''}
                </div>
            `;
        }

        html += '</div>';

        Swal.fire({
            title: titulo,
            html: html,
            icon: icono,
            confirmButtonText: botonTexto,
            confirmButtonColor: esRegalo ? '#22c55e' : '#f97316',
            showCancelButton: true,
            cancelButtonText: 'Cerrar',
            cancelButtonColor: '#64748b',
            allowOutsideClick: false,
            allowEscapeKey: true,
            backdrop: true,
            width: '480px',
            padding: '25px'
        }).then(async (result) => {
            this.modalVisible = false;

            if (result.isConfirmed) {
                // USUARIO ACEPTÓ -> Procesar acción y NUNCA MÁS mostrar
                await this.procesarAceptacion(popup);
            } else {
                // USUARIO CANCELÓ -> Registrar cierre (reaparecerá en 24h)
                await this.registrarCancelacion(popup.id);
            }

            // Programar verificación del siguiente popup (después de 3 minutos)
            this.programarSiguienteVerificacion(180000); // 3 minutos
        });
    }

    /**
     * Procesa la aceptación del usuario
     */
    async procesarAceptacion(popup) {
        const usuario = auth.getUsuario();
        if (!usuario) {
            console.error('❌ Usuario no autenticado al procesar aceptación');
            return;
        }

        if (popup.accion === 'regalar_saldo') {
            const monto = popup.accion_data?.monto || 0;
            const limite = popup.accion_data?.limite_usuarios || 0;

            // Verificar límite de usuarios
            if (limite > 0) {
                const { count, error: countError } = await supabase
                    .from('popups_vistos')
                    .select('*', { count: 'exact', head: true })
                    .eq('popup_id', popup.id)
                    .eq('accion_tomada', 'reclamado');

                if (countError) {
                    console.error('Error verificando límite:', countError);
                }

                if (count >= limite) {
                    Swal.fire({
                        icon: 'info',
                        title: 'Promoción agotada',
                        text: 'Lo sentimos, el límite de regalos ya fue alcanzado.',
                        confirmButtonColor: '#f97316'
                    });
                    await this.registrarCancelacion(popup.id);
                    return;
                }
            }

            // Mostrar loading
            Swal.fire({
                title: 'Procesando...',
                text: 'Estamos acreditando tu saldo',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            // Llamar a la función RPC para reclamar saldo
            try {
                const { data, error } = await supabase
                    .rpc('reclamar_saldo_popup', {
                        p_usuario_id: usuario.id,
                        p_popup_id: popup.id,
                        p_monto: monto
                    });

                if (error) {
                    console.error('❌ Error reclamando saldo:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'No se pudo procesar el regalo. Intenta de nuevo.',
                        confirmButtonColor: '#f97316'
                    });
                    return;
                }

                if (data && data.success) {
                    Swal.fire({
                        icon: 'success',
                        title: '🎉 ¡Felicidades!',
                        text: data.message || `Has recibido $${monto.toFixed(2)} USD en tu saldo`,
                        confirmButtonColor: '#22c55e',
                        footer: `Tu nuevo saldo: $${(data.nuevo_saldo || 0).toFixed(2)} USD`
                    });

                    // Actualizar saldo en header
                    if (typeof window.cargarSaldoHeader === 'function') {
                        window.cargarSaldoHeader();
                    }
                } else {
                    Swal.fire({
                        icon: 'info',
                        title: 'Aviso',
                        text: data?.message || 'No se pudo procesar el regalo',
                        confirmButtonColor: '#f97316'
                    });
                    // Registrar como cancelado para no insistir
                    await this.registrarCancelacion(popup.id);
                }

            } catch (err) {
                console.error('❌ Error en reclamar_saldo_popup:', err);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Ocurrió un error inesperado',
                    confirmButtonColor: '#f97316'
                });
            }

        } else if (popup.accion === 'redirigir') {
            // Marcar como reclamado para no mostrar más
            await this.registrarReclamado(popup.id);
            const url = popup.accion_data?.url || '/';
            window.location.href = url;

        } else {
            // Solo informativo - marcar como reclamado para no mostrar más
            await this.registrarReclamado(popup.id);
        }
    }

    /**
     * Registra que el usuario reclamó el popup (nunca más se muestra)
     */
    async registrarReclamado(popupId) {
        const usuario = auth.getUsuario();
        if (!usuario) return;

        await supabase
            .from('popups_vistos')
            .upsert({
                popup_id: popupId,
                usuario_id: usuario.id,
                accion_tomada: 'reclamado',
                visto_en: new Date().toISOString()
            }, {
                onConflict: 'popup_id,usuario_id'
            });

        console.log(`✅ Popup ${popupId} marcado como reclamado`);
    }

    /**
     * Registra que el usuario canceló el popup (reaparece en 24h)
     */
    async registrarCancelacion(popupId) {
        const usuario = auth.getUsuario();
        if (!usuario) return;

        await supabase
            .from('popups_vistos')
            .upsert({
                popup_id: popupId,
                usuario_id: usuario.id,
                accion_tomada: 'cerrado',
                visto_en: new Date().toISOString()
            }, {
                onConflict: 'popup_id,usuario_id'
            });

        console.log(`📅 Popup ${popupId} cancelado - Reaparecerá en 24 horas`);
    }

    /**
     * Programa la siguiente verificación después de un tiempo
     */
    programarSiguienteVerificacion(ms) {
        // Limpiar timer anterior
        if (this.timerInterval) {
            clearTimeout(this.timerInterval);
            this.timerInterval = null;
        }

        // Programar verificación
        this.timerInterval = setTimeout(() => {
            console.log(`⏰ ${ms/1000} segundos transcurridos - Verificando siguiente popup`);
            this.procesando = false;
            this.verificarYMostrarPopup();
        }, ms);
    }

    /**
     * Detiene el manager
     */
    detener() {
        if (this.timerInterval) {
            clearTimeout(this.timerInterval);
            this.timerInterval = null;
        }
        this.procesando = false;
        this.modalVisible = false;
        this.verificacionesPendientes = 0;
        console.log('🛑 Popups Manager detenido');
    }
}

// ============================================================
// EXPORTAR INSTANCIA ÚNICA
// ============================================================
export const popupsManager = new PopupsManager();

// ============================================================
// INICIALIZACIÓN
// ============================================================

// Cuando el usuario cambia (login/logout)
auth.onCambio(async (usuario) => {
    if (usuario) {
        console.log('👤 Usuario autenticado - Iniciando popups');
        // Esperar 2 segundos para no interferir con otras cargas
        setTimeout(() => popupsManager.verificarYMostrarPopup(), 2000);
    } else {
        console.log('👤 Usuario desconectado - Deteniendo popups');
        popupsManager.detener();
    }
});

// Verificar si ya está autenticado al cargar
if (auth.isAuthenticated()) {
    console.log('👤 Usuario ya autenticado - Verificando popups');
    setTimeout(() => popupsManager.verificarYMostrarPopup(), 2000);
}

// ============================================================
// EXPONER FUNCIONES GLOBALES PARA DEPURACIÓN
// ============================================================
window.popupsManager = popupsManager;

// Función para forzar verificación manual (para pruebas)
window.forzarVerificacionPopups = function() {
    console.log('🔍 Forzando verificación de popups');
    popupsManager.procesando = false;
    popupsManager.verificarYMostrarPopup();
};

// Función para resetear estado (para pruebas)
window.resetearPopups = function() {
    console.log('🔄 Resetear estado de popups');
    popupsManager.detener();
    popupsManager.procesando = false;
    popupsManager.modalVisible = false;
};

console.log('✅ Popups Manager MEJORADO cargado - KOMERZIO');
console.log('📢 Funciones disponibles: window.forzarVerificacionPopups(), window.resetearPopups()');