// ============================================================
// js/main.js - Sistema de autenticación y carrito global
// KOMERZIO - Versión Corregida
// ============================================================

import { auth } from '/js/auth.js';
import { initCarrito } from '/js/cart.js';

console.log('✅ main.js - Inicializado con autenticación y carrito');

// ============================================================
// VARIABLES GLOBALES
// ============================================================
let carritoInstance = null;
let usuarioActual = null;

// ============================================================
// INICIALIZAR CARRITO
// ============================================================
function initCarritoGlobal() {
    if (!carritoInstance) {
        carritoInstance = initCarrito();
        window.carrito = carritoInstance;
        window.cart = carritoInstance;
        carritoInstance.cargarDeLocalStorage();
        carritoInstance.actualizarInterfaz();
    }
    return carritoInstance;
}

// ============================================================
// VERIFICAR AUTENTICACIÓN
// ============================================================
function checkAuthStatus() {
    const userSection = document.getElementById('user-section');
    if (!userSection) return;
    
    const usuario = auth.getUsuario();
    
    if (usuario && usuario.id) {
        usuarioActual = usuario;
        renderUserMenu(usuario);
        updateLoginLinks();
        cargarSaldoHeader();
    } else {
        usuarioActual = null;
        renderGuestMenu();
    }
}

// ============================================================
// RENDERIZAR MENÚ DE USUARIO
// ============================================================
function renderUserMenu(usuario) {
    const userSection = document.getElementById('user-section');
    if (!userSection) return;
    
    const nombre = usuario.nombre || usuario.nombre_completo || usuario.email?.split('@')[0] || 'Mi cuenta';
    const inicial = nombre.charAt(0).toUpperCase();
    
    userSection.innerHTML = `
        <div class="user-dropdown">
            <button class="user-btn" onclick="window.toggleUserMenu()">
                <span class="user-avatar">${inicial}</span>
                <span class="user-name">${nombre}</span>
                <i class="fas fa-chevron-down"></i>
            </button>
            <div class="dropdown-menu" id="userDropdownMenu">
                <a href="/mi-cuenta.html"><i class="fas fa-user"></i> Mi perfil</a>
                <a href="/pedidos.html"><i class="fas fa-box"></i> Mis pedidos</a>
                <a href="/lista-deseos.html"><i class="fas fa-heart"></i> Lista de deseos</a>
                <a href="/notificaciones.html"><i class="fas fa-bell"></i> Notificaciones</a>
                <a href="/recarga.html"><i class="fas fa-bolt"></i> Recargar saldo</a>
                <a href="/transferir.html"><i class="fas fa-exchange"></i> Transferir</a>
                <div class="dropdown-divider"></div>
                <a href="#" onclick="window.cerrarSesionGlobal(); return false;">
                    <i class="fas fa-sign-out-alt"></i> Cerrar sesión
                </a>
            </div>
        </div>
    `;
    
    // Agregar estilos para el menú desplegable si no existen
    injectDropdownStyles();
}

// ============================================================
// RENDERIZAR MENÚ DE INVITADO
// ============================================================
function renderGuestMenu() {
    const userSection = document.getElementById('user-section');
    if (!userSection) return;
    
    userSection.innerHTML = `
        <div class="auth-buttons">
            <a href="/login.html" class="btn-login"><i class="fas fa-sign-in-alt"></i> Iniciar sesión</a>
            <a href="/registro.html" class="btn-register"><i class="fas fa-user-plus"></i> Registrarse</a>
        </div>
    `;
}

// ============================================================
// INYECTAR ESTILOS DEL MENÚ
// ============================================================
function injectDropdownStyles() {
    if (document.getElementById('dropdown-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'dropdown-styles';
    styles.textContent = `
        .user-dropdown { position: relative; display: inline-block; }
        .user-btn {
            display: flex; align-items: center; gap: 8px;
            background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);
            color: white; padding: 6px 14px; border-radius: 30px;
            cursor: pointer; font-family: 'Inter', sans-serif;
            font-size: 14px; font-weight: 500; transition: all 0.3s;
        }
        .user-btn:hover { background: rgba(249,115,22,0.3); border-color: #f97316; }
        .user-avatar {
            width: 28px; height: 28px; background: #f97316; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-weight: 700; font-size: 14px; color: white;
            flex-shrink: 0;
        }
        .user-name { max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dropdown-menu {
            display: none; position: absolute; right: 0; top: 48px;
            background: #0f172a; border: 1px solid #1e293b;
            border-radius: 12px; min-width: 220px; padding: 8px 0;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3); z-index: 1000;
        }
        .dropdown-menu.show { display: block; animation: dropdownFade 0.2s ease; }
        @keyframes dropdownFade {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .dropdown-menu a {
            display: flex; align-items: center; gap: 10px;
            padding: 10px 18px; color: #e2e8f0; text-decoration: none;
            font-size: 14px; transition: background 0.2s;
        }
        .dropdown-menu a:hover { background: #1e293b; }
        .dropdown-menu a i { width: 18px; color: #94a3b8; }
        .dropdown-divider {
            height: 1px; background: #1e293b; margin: 6px 12px;
        }
        .auth-buttons { display: flex; gap: 10px; align-items: center; }
        .btn-login, .btn-register {
            padding: 8px 16px; border-radius: 30px; font-size: 14px;
            font-weight: 500; text-decoration: none; transition: all 0.3s;
            display: inline-flex; align-items: center; gap: 6px;
        }
        .btn-login {
            background: rgba(255,255,255,0.08); color: white;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .btn-login:hover { background: rgba(249,115,22,0.3); border-color: #f97316; }
        .btn-register {
            background: #f97316; color: white; border: 1px solid #f97316;
        }
        .btn-register:hover { background: #ea580c; border-color: #ea580c; transform: translateY(-2px); }
        .cart-icon { position: relative; cursor: pointer; }
        .cart-badge {
            position: absolute; top: -8px; right: -8px;
            background: #dc2626; color: white; font-size: 10px; font-weight: 700;
            min-width: 18px; height: 18px; border-radius: 9px;
            display: flex; align-items: center; justify-content: center;
            padding: 0 5px; box-shadow: 0 2px 8px rgba(220,38,38,0.3);
        }
        @media (max-width: 768px) {
            .user-name { display: none; }
            .btn-register span { display: none; }
            .btn-login span { display: none; }
            .btn-login, .btn-register { padding: 8px 10px; border-radius: 50%; }
            .dropdown-menu { right: -20px; min-width: 200px; }
        }
    `;
    document.head.appendChild(styles);
}

// ============================================================
// TOGGLE MENÚ DE USUARIO
// ============================================================
window.toggleUserMenu = function() {
    const menu = document.getElementById('userDropdownMenu');
    if (menu) {
        menu.classList.toggle('show');
    }
};

// ============================================================
// CERRAR MENÚ AL HACER CLIC FUERA
// ============================================================
document.addEventListener('click', function(e) {
    const dropdown = document.querySelector('.user-dropdown');
    if (dropdown && !dropdown.contains(e.target)) {
        const menu = document.getElementById('userDropdownMenu');
        if (menu) menu.classList.remove('show');
    }
});

// ============================================================
// CARGAR SALDO EN HEADER
// ============================================================
async function cargarSaldoHeader() {
    try {
        const usuario = auth.getUsuario();
        if (!usuario) return;
        
        const { supabase } = await import('/js/supabase-client.js');
        const { data, error } = await supabase
            .from('saldo_usuarios')
            .select('saldo_actual')
            .eq('user_id', usuario.id)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        
        const saldo = data?.saldo_actual || 0;
        const saldoElement = document.getElementById('saldoHeaderAmount');
        if (saldoElement) {
            saldoElement.textContent = `$${saldo.toFixed(2)}`;
        }
        const saldoCard = document.getElementById('saldoHeaderCard');
        if (saldoCard) {
            saldoCard.style.display = 'flex';
        }
    } catch (error) {
        console.error('Error cargando saldo:', error);
    }
}

// ============================================================
// CERRAR SESIÓN GLOBAL
// ============================================================
window.cerrarSesionGlobal = async function() {
    const result = await Swal.fire({
        title: '¿Cerrar sesión?',
        text: '¿Estás seguro que deseas cerrar tu sesión?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, cerrar sesión',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc2626'
    });
    
    if (result.isConfirmed) {
        await auth.cerrarSesion();
        window.location.href = '/';
    }
};

// ============================================================
// ACTUALIZAR ENLACES DE LOGIN
// ============================================================
function updateLoginLinks() {
    document.querySelectorAll('a[href="/login.html"]').forEach(link => {
        link.addEventListener('click', function(e) {
            if (auth.isAuthenticated()) {
                e.preventDefault();
                window.location.href = '/mi-cuenta.html';
            }
        });
    });
}

// ============================================================
// ACTUALIZAR CONTADOR DEL CARRITO
// ============================================================
function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('komerzio_cart') || '[]');
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
        const totalItems = cart.reduce((sum, item) => sum + (item.cantidad || 1), 0);
        cartCount.textContent = totalItems;
        cartCount.style.display = totalItems > 0 ? 'flex' : 'none';
    }
}

// ============================================================
// CONFIGURAR PREVIEW DEL CARRITO
// ============================================================
function setupCartPreview() {
    const cartIcon = document.querySelector('.cart-icon');
    const cartPreview = document.getElementById('cart-preview');
    
    if (cartIcon && cartPreview) {
        cartIcon.addEventListener('mouseenter', function() {
            showCartPreview();
        });
        
        cartIcon.addEventListener('mouseleave', function() {
            setTimeout(() => {
                if (!cartPreview.matches(':hover')) {
                    cartPreview.classList.remove('show');
                }
            }, 200);
        });
        
        cartPreview.addEventListener('mouseleave', function() {
            cartPreview.classList.remove('show');
        });
    }
}

// ============================================================
// MOSTRAR PREVIEW DEL CARRITO
// ============================================================
function showCartPreview() {
    const cart = JSON.parse(localStorage.getItem('komerzio_cart') || '[]');
    const cartPreview = document.getElementById('cart-preview');
    
    if (!cartPreview) return;
    
    if (cart.length === 0) {
        cartPreview.innerHTML = `
            <div class="cart-empty">
                <i class="fas fa-shopping-cart" style="font-size: 32px; color: #94a3b8;"></i>
                <p style="color: #94a3b8; margin-top: 8px;">Tu carrito está vacío</p>
            </div>
        `;
    } else {
        let html = '<div class="cart-items">';
        let total = 0;
        
        cart.slice(0, 3).forEach(item => {
            const subtotal = (item.precio || 0) * (item.cantidad || 1);
            total += subtotal;
            html += `
                <div class="cart-preview-item">
                    <img src="${item.imagen_url || '/assets/images/no-image.jpg'}" alt="${item.nombre}">
                    <div class="item-info">
                        <h4>${item.nombre}</h4>
                        <p>${item.cantidad || 1} x $${(item.precio || 0).toFixed(2)}</p>
                    </div>
                </div>
            `;
        });
        
        if (cart.length > 3) {
            html += `<p class="cart-more">Y ${cart.length - 3} productos más...</p>`;
        }
        
        html += `</div>
                <div class="cart-total">Total: $${total.toFixed(2)}</div>
                <a href="/p/cart.html" class="btn-view-cart">Ver carrito completo</a>`;
        
        cartPreview.innerHTML = html;
    }
    
    cartPreview.classList.add('show');
}

// ============================================================
// AÑADIR AL CARRITO (FUNCIÓN GLOBAL)
// ============================================================
window.addToCart = function(producto) {
    const cart = JSON.parse(localStorage.getItem('komerzio_cart') || '[]');
    
    const existingItem = cart.find(item => item.id === producto.id);
    
    if (existingItem) {
        existingItem.cantidad = (existingItem.cantidad || 1) + 1;
    } else {
        cart.push({
            ...producto,
            cantidad: 1
        });
    }
    
    localStorage.setItem('komerzio_cart', JSON.stringify(cart));
    updateCartCount();
    showNotification('Producto añadido al carrito', 'success');
};

// ============================================================
// SISTEMA DE NOTIFICACIONES
// ============================================================
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 
                 type === 'error' ? 'fa-exclamation-circle' : 
                 'fa-info-circle';
    
    notification.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    
    // Estilos para notificaciones
    if (!document.getElementById('notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed; bottom: 24px; right: 24px;
                padding: 14px 24px; border-radius: 12px;
                display: flex; align-items: center; gap: 12px;
                font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                z-index: 9999; transform: translateY(100px);
                opacity: 0; transition: all 0.3s ease;
                max-width: 400px; cursor: default;
                border: 1px solid rgba(255,255,255,0.1);
            }
            .notification.show {
                transform: translateY(0); opacity: 1;
            }
            .notification-success {
                background: #0f172a; color: #22c55e;
                border-left: 4px solid #22c55e;
            }
            .notification-error {
                background: #0f172a; color: #ef4444;
                border-left: 4px solid #ef4444;
            }
            .notification-info {
                background: #0f172a; color: #3b82f6;
                border-left: 4px solid #3b82f6;
            }
            .notification i { font-size: 20px; }
            @media (max-width: 480px) {
                .notification { left: 16px; right: 16px; max-width: none; bottom: 16px; }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================================
// ACTUALIZAR CARRITO AL CARGAR (EVENTO DE STORAGE)
// ============================================================
window.addEventListener('storage', function(e) {
    if (e.key === 'komerzio_cart') {
        updateCartCount();
        // También actualizar cart.js si está disponible
        if (window.carrito && typeof window.carrito.actualizarInterfaz === 'function') {
            window.carrito.actualizarInterfaz();
        }
    }
});

// ============================================================
// INICIALIZAR AL CARGAR LA PÁGINA
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar carrito
    initCarritoGlobal();
    
    // Verificar autenticación
    checkAuthStatus();
    
    // Actualizar contador del carrito
    updateCartCount();
    
    // Configurar preview del carrito
    setupCartPreview();
    
    // Escuchar cambios de autenticación
    if (auth && typeof auth.onCambio === 'function') {
        auth.onCambio(function(usuario) {
            checkAuthStatus();
            if (usuario) {
                cargarSaldoHeader();
            }
        });
    }
    
    console.log('✅ main.js - Inicialización completa');
});

// ============================================================
// EXPONER FUNCIONES GLOBALES
// ============================================================
window.checkAuthStatus = checkAuthStatus;
window.updateCartCount = updateCartCount;
window.showNotification = showNotification;
window.cargarSaldoHeader = cargarSaldoHeader;
window.initCarritoGlobal = initCarritoGlobal;

// ============================================================
// NOTIFICACIÓN GLOBAL DE CAMBIO DE USUARIO
// ============================================================
document.addEventListener('auth-change', function(e) {
    checkAuthStatus();
    if (e.detail?.user) {
        cargarSaldoHeader();
    }
});

console.log('✅ main.js - Todas las funciones cargadas correctamente');