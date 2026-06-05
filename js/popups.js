// ============================================
// popups.js - Sistema de Popups Promocionales (MEJORADO)
// Lógica: Aceptar = nunca más, Cancelar = 24h, 3min entre popups
// ============================================

import { supabase } from './supabase-client.js';
import { auth } from './auth.js';

class PopupsManager {
  constructor() {
    this.popupActual = null;
    this.modalVisible = false;
    this.procesando = false;
    this.timerInterval = null;
  }
  
  async verificarYMostrarPopup() {
    if (this.procesando || this.modalVisible) return;
    
    const usuario = auth.getUsuario();
    if (!usuario) return;
    
    this.procesando = true;
    
    try {
      // Llamar a la función RPC que aplica toda la lógica
      const { data, error } = await supabase
        .rpc('obtener_proximo_popup', {
          p_usuario_id: usuario.id
        });
      
      if (error) {
        console.error('Error obteniendo popup:', error);
        this.procesando = false;
        return;
      }
      
      if (data.no_popups) {
        console.log('📢 No hay popups pendientes para este usuario');
        this.procesando = false;
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
      console.error('Error en verificarYMostrarPopup:', err);
      this.procesando = false;
    }
  }
  
  mostrarPopup(popup) {
    if (this.modalVisible) return;
    this.modalVisible = true;
    
    const tieneImagen = popup.imagen_url ?
      `<img src="${popup.imagen_url}" style="max-width: 100%; max-height: 200px; border-radius: 20px; margin-bottom: 20px;" onerror="this.style.display='none'">` :
      '';
    
    const esRegalo = popup.accion === 'regalar_saldo';
    const icono = esRegalo ? 'success' : 'info';
    const botonTexto = popup.boton_texto || (esRegalo ? '🎁 Reclamar' : '¡Aceptar!');
    
    Swal.fire({
      title: popup.titulo,
      html: `
                ${tieneImagen}
                <p style="font-size: 16px; margin: 20px 0; color: #333;">${popup.mensaje}</p>
                ${esRegalo ? `<p style="font-size: 14px; color: #28a745; font-weight: 600;">💰 Recibirás: $${popup.accion_data?.monto || 0} CUP</p>` : ''}
            `,
      icon: icono,
      confirmButtonText: botonTexto,
      confirmButtonColor: esRegalo ? '#28a745' : '#f97316',
      showCancelButton: true,
      cancelButtonText: 'Cerrar',
      cancelButtonColor: '#6c757d',
      allowOutsideClick: false,
      allowEscapeKey: true,
      backdrop: true
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
      this.programarSiguienteVerificacion();
    });
  }
  
  async procesarAceptacion(popup) {
    const usuario = auth.getUsuario();
    
    if (popup.accion === 'regalar_saldo') {
      const monto = popup.accion_data?.monto || 0;
      const limite = popup.accion_data?.limite_usuarios || 0;
      
      // Verificar límite
      const { count } = await supabase
        .from('popups_vistos')
        .select('*', { count: 'exact', head: true })
        .eq('popup_id', popup.id)
        .eq('accion_tomada', 'reclamado');
      
      if (count >= limite) {
        Swal.fire({
          icon: 'info',
          title: 'Promoción agotada',
          text: 'Lo sentimos, el límite de regalos ya fue alcanzado',
          confirmButtonColor: '#f97316'
        });
        await this.registrarCancelacion(popup.id);
        return;
      }
      
      // Mostrar loading
      Swal.fire({
        title: 'Procesando...',
        text: 'Estamos acreditando tu saldo',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });
      
      // Llamar a la función RPC para reclamar saldo
      const { data, error } = await supabase
        .rpc('reclamar_saldo_popup', {
          p_usuario_id: usuario.id,
          p_popup_id: popup.id,
          p_monto: monto
        });
      
      if (error) {
        console.error('Error reclamando saldo:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo procesar el regalo. Intenta de nuevo.',
          confirmButtonColor: '#f97316'
        });
        return;
      }
      
      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: '¡Felicidades! 🎉',
          text: data.message,
          confirmButtonColor: '#28a745',
          footer: `Tu nuevo saldo: $${data.nuevo_saldo.toFixed(2)} CUP`
        });
        
        // Actualizar saldo en header
        if (typeof window.cargarSaldoHeader === 'function') {
          window.cargarSaldoHeader();
        }
      } else {
        Swal.fire({
          icon: 'info',
          title: 'Aviso',
          text: data.message,
          confirmButtonColor: '#f97316'
        });
        // Si ya reclamó o hubo error, registrar como cancelado para que no insista
        await this.registrarCancelacion(popup.id);
      }
      
    } else if (popup.accion === 'redirigir') {
      // Marcar como reclamado para no mostrar más
      await this.registrarReclamado(popup.id);
      const url = popup.accion_data?.url;
      if (url) window.location.href = url;
      
    } else {
      // Solo informativo - marcar como reclamado para no mostrar más
      await this.registrarReclamado(popup.id);
    }
  }
  
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
  }
  
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
    
    console.log('📅 Popup cancelado - Reaparecerá en 24 horas');
  }
  
  programarSiguienteVerificacion() {
    // Limpiar timer anterior
    if (this.timerInterval) {
      clearTimeout(this.timerInterval);
    }
    
    // Programar verificación para dentro de 3 minutos (180 segundos)
    this.timerInterval = setTimeout(() => {
      console.log('⏰ 3 minutos transcurridos - Verificando siguiente popup');
      this.procesando = false;
      this.verificarYMostrarPopup();
    }, 180000); // 3 minutos = 180,000 ms
  }
  
  detener() {
    if (this.timerInterval) {
      clearTimeout(this.timerInterval);
      this.timerInterval = null;
    }
    this.procesando = false;
    this.modalVisible = false;
  }
}

export const popupsManager = new PopupsManager();

// Inicializar cuando auth esté listo
auth.onCambio(async (usuario) => {
  if (usuario) {
    // Esperar 1.5 segundos para no interferir con otras cargas
    setTimeout(() => popupsManager.verificarYMostrarPopup(), 1500);
  } else {
    popupsManager.detener();
  }
});

// Verificar si ya está autenticado al cargar
if (auth.isAuthenticated()) {
  setTimeout(() => popupsManager.verificarYMostrarPopup(), 1500);
}

console.log('✅ Popups Manager MEJORADO cargado');