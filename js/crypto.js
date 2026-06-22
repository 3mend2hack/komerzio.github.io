// /js/crypto.js
import { supabase } from '/js/supabase-client.js'
import { auth } from '/js/auth.js'

if (!auth) {
    console.error('❌ Auth no disponible. Asegúrate de que auth.js está cargado antes que crypto.js')
}

const styles = `
    .crypto-modal-content { text-align: center; }
    .crypto-wallet-box { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 16px; border-radius: 16px; word-break: break-all; font-family: monospace; font-size: 13px; margin: 16px 0; color: #fbbf24; border: 1px solid #f97316; text-align: center; }
    .crypto-tasa-box { background: #f8fafc; padding: 12px; border-radius: 12px; margin: 10px 0; text-align: center; }
    .crypto-btn-copy { background: linear-gradient(135deg, #f97316, #ea580c); color: white; border: none; padding: 10px 20px; border-radius: 40px; cursor: pointer; font-weight: 600; margin-top: 10px; transition: all 0.2s; }
    .crypto-btn-copy:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(249,115,22,0.4); }
    .crypto-info-text { font-size: 12px; color: #64748b; margin-top: 10px; }
    .crypto-loading { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 20px; color: #f97316; }
`;

if (!document.getElementById('crypto-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'crypto-styles';
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
}

const SUPABASE_FUNCTIONS_URL = 'https://houfrgnlctliwkzzelmi.supabase.co/functions/v1';

async function obtenerWalletUsuario() {
    const usuario = auth.getUsuario();
    if (!usuario) throw new Error('Usuario no autenticado');
    
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    
    if (!accessToken) throw new Error('No se pudo obtener el token de autenticación');
    
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/trondealer-create-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ usuarioId: usuario.id, montoUSDT: 1, esPedido: false })
    });
    
    if (!response.ok) throw new Error(`Error ${response.status}: No se pudo obtener la wallet`);
    
    const data = await response.json();
    if (!data.success || !data.wallet_address) throw new Error(data.error || 'No se pudo obtener la wallet');
    
    return data;
}

export const cryptoManager = {
    async mostrarModalRecarga() {
        const usuario = auth.getUsuario();
        if (!usuario) {
            Swal.fire({
                icon: 'info', title: '🔐 Inicia sesión', text: 'Debes iniciar sesión para recargar saldo',
                showCancelButton: true, confirmButtonText: 'Iniciar sesión', cancelButtonText: 'Cancelar',
                confirmButtonColor: '#f97316'
            }).then(result => { if (result.isConfirmed) window.location.href = '/login.html'; });
            return;
        }
        
        Swal.fire({
            title: '🔄 Obteniendo tu wallet...',
            html: '<div class="crypto-loading"><i class="fa fa-spinner fa-pulse"></i> Por favor espera</div>',
            allowOutsideClick: false, showConfirmButton: false
        });
        
        try {
            const walletData = await obtenerWalletUsuario();
            Swal.close();
            
            Swal.fire({
                title: '💰 Recarga con USDT',
                html: `
                    <div class="crypto-modal-content">
                        <div class="crypto-tasa-box">
                            <i class="fa fa-info-circle" style="color: #f97316;"></i>
                            <strong>1 USDT = 1 USD</strong> — Recibes la misma cantidad
                        </div>
                        
                        <p style="margin: 10px 0 5px 0; text-align: left; font-size: 13px;">
                            <i class="fa fa-qrcode"></i> <strong>Tu wallet personal:</strong>
                        </p>
                        <div class="crypto-wallet-box">${walletData.wallet_address}</div>
                        
                        <button id="copiarWalletBtn" class="crypto-btn-copy"><i class="fa fa-copy"></i> Copiar dirección</button>
                        
                        <div style="margin-top: 20px; padding: 12px; background: #f0f9ff; border-radius: 12px;">
                            <p style="margin: 0 0 8px 0; font-weight: 600; color: #0369a1;"><i class="fa fa-lightbulb-o"></i> ¿Cómo funciona?</p>
                            <ul style="margin: 0; padding-left: 20px; text-align: left; font-size: 13px; color: #0c4a6e;">
                                <li>Envía <strong>CUALQUIER cantidad</strong> de USDT (mínimo 1)</li>
                                <li>Usa la red <strong>BEP20 (BSC)</strong></li>
                                <li>Recibirás <strong>la misma cantidad en USD</strong> en tu saldo</li>
                                <li>La recarga es <strong>automática</strong> al confirmarse</li>
                            </ul>
                        </div>
                        
                        <div class="crypto-info-text"><i class="fa fa-clock-o"></i> La confirmación tarda ~3-5 minutos.</div>
                    </div>
                `,
                icon: 'success', confirmButtonText: 'Entendido', confirmButtonColor: '#f97316',
                didOpen: () => {
                    document.getElementById('copiarWalletBtn')?.addEventListener('click', () => {
                        navigator.clipboard.writeText(walletData.wallet_address);
                        Swal.fire({ icon: 'success', title: '¡Copiado!', text: 'Dirección copiada', timer: 1500, showConfirmButton: false });
                    });
                }
            });
            
        } catch (error) {
            console.error('Error en recarga:', error);
            Swal.fire({ icon: 'error', title: '❌ Error', text: error.message || 'Ocurrió un error', confirmButtonColor: '#f97316' });
        }
    }
};

async function cargarSaldoHeader() {
    const usuario = auth.getUsuario();
    if (!usuario) return;
    try {
        const { data, error } = await supabase.from('saldo_usuarios').select('saldo_actual').eq('user_id', usuario.id).single();
        if (!error && data) {
            const saldoAmount = document.getElementById('saldoHeaderAmount');
            if (saldoAmount) saldoAmount.textContent = `$${data.saldo_actual.toFixed(2)}`;
        }
    } catch (error) { console.error('Error cargando saldo:', error); }
}

window.cargarSaldoHeader = cargarSaldoHeader;
console.log('✅ CryptoManager cargado - KOMERZIO');