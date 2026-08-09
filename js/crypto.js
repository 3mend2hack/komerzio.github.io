// /js/crypto.js
// ============================================================
// Módulo de Criptomonedas - KOMERZIO
// Gestiona recargas con USDT (BEP20) y otras criptomonedas
// ============================================================

import { supabase } from '/js/supabase-client.js';
import { auth } from '/js/auth.js';

console.log('🔐 Crypto.js - Inicializando...');

// ============================================================
// VERIFICAR DEPENDENCIAS
// ============================================================
if (!auth) {
    console.error('❌ Auth no disponible. Asegúrate de que auth.js está cargado antes que crypto.js');
}

// ============================================================
// ESTILOS CSS PARA MODALES
// ============================================================
const styles = `
    .crypto-modal-content { text-align: center; }
    .crypto-wallet-box {
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        padding: 16px;
        border-radius: 16px;
        word-break: break-all;
        font-family: 'Courier New', monospace;
        font-size: 13px;
        margin: 16px 0;
        color: #fbbf24;
        border: 1px solid #f97316;
        text-align: center;
        user-select: all;
    }
    .crypto-tasa-box {
        background: #f8fafc;
        padding: 12px;
        border-radius: 12px;
        margin: 10px 0;
        text-align: center;
        border: 1px solid #e2e8f0;
    }
    .crypto-tasa-box i { color: #f97316; margin-right: 6px; }
    .crypto-btn-copy {
        background: linear-gradient(135deg, #f97316, #ea580c);
        color: white;
        border: none;
        padding: 10px 24px;
        border-radius: 40px;
        cursor: pointer;
        font-weight: 600;
        margin-top: 10px;
        transition: all 0.3s;
        font-size: 14px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }
    .crypto-btn-copy:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(249,115,22,0.4);
    }
    .crypto-btn-copy:active {
        transform: scale(0.95);
    }
    .crypto-info-text {
        font-size: 12px;
        color: #64748b;
        margin-top: 12px;
    }
    .crypto-info-text i { margin-right: 4px; }
    .crypto-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 20px;
        color: #f97316;
        font-size: 16px;
    }
    .crypto-loading i { font-size: 24px; }
    .crypto-ul {
        margin: 0;
        padding-left: 20px;
        text-align: left;
        font-size: 13px;
        color: #0c4a6e;
        line-height: 1.8;
    }
    .crypto-ul li { margin-bottom: 4px; }
    .crypto-ul li i { color: #f97316; margin-right: 6px; }
`;

// Agregar estilos solo una vez
if (!document.getElementById('crypto-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'crypto-styles';
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
}

// ============================================================
// CONFIGURACIÓN
// ============================================================
const SUPABASE_FUNCTIONS_URL = 'https://ehlebvmalatsdyvopvkn.supabase.co/functions/v1';

// ============================================================
// OBTENER WALLET USDT PARA EL USUARIO
// ============================================================
async function obtenerWalletUsuario() {
    const usuario = auth.getUsuario();
    if (!usuario) throw new Error('Usuario no autenticado');
    
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    
    if (!accessToken) throw new Error('No se pudo obtener el token de autenticación');
    
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/trondealer-create-invoice`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
            usuarioId: usuario.id,
            montoUSDT: 1,
            esPedido: false
        })
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText || 'No se pudo obtener la wallet'}`);
    }
    
    const data = await response.json();
    if (!data.success || !data.wallet_address) {
        throw new Error(data.error || 'No se pudo obtener la wallet');
    }
    
    return data;
}

// ============================================================
// CARGAR SALDO EN HEADER (FUNCIÓN AUXILIAR)
// ============================================================
async function cargarSaldoHeader() {
    const usuario = auth.getUsuario();
    if (!usuario) return;
    
    try {
        const { data, error } = await supabase
            .from('saldo_usuarios')
            .select('saldo_actual')
            .eq('user_id', usuario.id)
            .single();
        
        if (!error && data) {
            const saldoAmount = document.getElementById('saldoHeaderAmount');
            if (saldoAmount) {
                saldoAmount.textContent = `$${data.saldo_actual.toFixed(2)}`;
            }
        }
    } catch (error) {
        console.error('Error cargando saldo:', error);
    }
}

// ============================================================
// EXPORTAR CRYPTO MANAGER
// ============================================================
export const cryptoManager = {
    /**
     * Muestra el modal de recarga con USDT
     * Genera una wallet personal para el usuario
     */
    async mostrarModalRecarga() {
        const usuario = auth.getUsuario();
        if (!usuario) {
            Swal.fire({
                icon: 'info',
                title: '🔐 Inicia sesión',
                text: 'Debes iniciar sesión para recargar saldo',
                showCancelButton: true,
                confirmButtonText: 'Iniciar sesión',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#f97316'
            }).then(result => {
                if (result.isConfirmed) {
                    window.location.href = '/login.html?redirect=/recarga.html';
                }
            });
            return;
        }
        
        // Mostrar loading
        Swal.fire({
            title: '🔄 Obteniendo tu wallet...',
            html: `
                <div class="crypto-loading">
                    <i class="fa fa-spinner fa-pulse"></i>
                    <span>Por favor espera</span>
                </div>
            `,
            allowOutsideClick: false,
            showConfirmButton: false
        });
        
        try {
            const walletData = await obtenerWalletUsuario();
            Swal.close();
            
            // Mostrar modal con la wallet
            Swal.fire({
                title: '💰 Recarga con USDT',
                html: `
                    <div class="crypto-modal-content">
                        <div class="crypto-tasa-box">
                            <i class="fa fa-info-circle"></i>
                            <strong>1 USDT = 1 USD</strong> — Recibes la misma cantidad en tu saldo
                        </div>
                        
                        <p style="margin: 12px 0 6px 0; text-align: left; font-size: 13px; font-weight: 600; color: #0f172a;">
                            <i class="fa fa-qrcode" style="color: #f97316;"></i> Tu wallet personal:
                        </p>
                        <div class="crypto-wallet-box" id="walletAddressDisplay">
                            ${walletData.wallet_address}
                        </div>
                        
                        <button id="copiarWalletBtn" class="crypto-btn-copy">
                            <i class="fa fa-copy"></i> Copiar dirección
                        </button>
                        
                        <div style="margin-top: 20px; padding: 14px; background: #f0f9ff; border-radius: 12px; border: 1px solid #7dd3fc;">
                            <p style="margin: 0 0 10px 0; font-weight: 700; color: #0369a1; font-size: 14px;">
                                <i class="fa fa-lightbulb-o"></i> ¿Cómo funciona?
                            </p>
                            <ul class="crypto-ul">
                                <li><i class="fa fa-check-circle"></i> Envía <strong>CUALQUIER cantidad</strong> de USDT (mínimo 1)</li>
                                <li><i class="fa fa-check-circle"></i> Usa la red <strong>BEP20 (Binance Smart Chain)</strong></li>
                                <li><i class="fa fa-check-circle"></i> Recibirás <strong>la misma cantidad en USD</strong> en tu saldo</li>
                                <li><i class="fa fa-check-circle"></i> La recarga es <strong>automática</strong> al confirmarse</li>
                            </ul>
                        </div>
                        
                        <div class="crypto-info-text">
                            <i class="fa fa-clock-o"></i> La confirmación tarda ~3-5 minutos en la blockchain.
                        </div>
                    </div>
                `,
                icon: 'success',
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#f97316',
                width: '480px',
                didOpen: () => {
                    // Evento para copiar dirección
                    document.getElementById('copiarWalletBtn')?.addEventListener('click', () => {
                        const address = walletData.wallet_address;
                        navigator.clipboard.writeText(address).then(() => {
                            Swal.fire({
                                icon: 'success',
                                title: '¡Copiado!',
                                text: 'Dirección copiada al portapapeles',
                                timer: 1500,
                                showConfirmButton: false
                            });
                        }).catch(() => {
                            // Fallback: seleccionar texto
                            const display = document.getElementById('walletAddressDisplay');
                            const range = document.createRange();
                            range.selectNode(display);
                            window.getSelection().removeAllRanges();
                            window.getSelection().addRange(range);
                            
                            Swal.fire({
                                icon: 'info',
                                title: 'Selecciona el texto',
                                text: 'Selecciona la dirección manualmente y copia (Ctrl+C)',
                                confirmButtonText: 'Entendido',
                                confirmButtonColor: '#f97316'
                            });
                        });
                    });
                }
            });
            
        } catch (error) {
            console.error('Error en recarga:', error);
            Swal.fire({
                icon: 'error',
                title: '❌ Error',
                text: error.message || 'Ocurrió un error al obtener la wallet',
                confirmButtonColor: '#f97316'
            });
        }
    },
    
    /**
     * Redirige a la página de recarga completa
     */
    irARecarga() {
        window.location.href = '/recarga.html';
    }
};

// ============================================================
// EXPONER FUNCIONES GLOBALES
// ============================================================
window.cryptoManager = cryptoManager;
window.cargarSaldoHeader = cargarSaldoHeader;

// ============================================================
// INICIALIZAR EN EL HEADER (SI ESTÁ DISPONIBLE)
// ============================================================
// Esperar a que el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        cargarSaldoHeader();
    });
} else {
    cargarSaldoHeader();
}

console.log('✅ CryptoManager cargado - KOMERZIO');

// ============================================================
// EVENTO PARA ACTUALIZAR SALDO CUANDO CAMBIA EL USUARIO
// ============================================================
if (typeof auth !== 'undefined' && auth.onCambio) {
    auth.onCambio(() => {
        cargarSaldoHeader();
    });
}