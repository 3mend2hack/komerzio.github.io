// ============================================
// GOLFINALIVE - DEPURADOR VISUAL
// ============================================

(function() {
    console.log('🔍 ===== INICIANDO DEPURADOR =====');
    
    // ============================================
    // 1. MOSTRAR INFORMACIÓN DEL CONTENEDOR
    // ============================================
    function mostrarInfoContenedor() {
        var container = document.getElementById('game-container');
        var field = document.getElementById('field');
        var wrapper = document.getElementById('campo-wrapper');
        var canvas = document.getElementById('campo-canvas');
        
        console.log('📐 ===== TAMAÑOS =====');
        
        if (container) {
            var rect = container.getBoundingClientRect();
            console.log('📦 game-container:', {
                width: rect.width + 'px',
                height: rect.height + 'px',
                top: rect.top + 'px',
                left: rect.left + 'px',
                aspectRatio: (rect.width / rect.height).toFixed(3)
            });
        }
        
        if (field) {
            var rect = field.getBoundingClientRect();
            console.log('🏟️ field:', {
                width: rect.width + 'px',
                height: rect.height + 'px',
                top: rect.top + 'px',
                left: rect.left + 'px',
                padding: window.getComputedStyle(field).padding
            });
        }
        
        if (wrapper) {
            var rect = wrapper.getBoundingClientRect();
            console.log('🟩 campo-wrapper:', {
                width: rect.width + 'px',
                height: rect.height + 'px',
                top: rect.top + 'px',
                left: rect.left + 'px'
            });
        }
        
        if (canvas) {
            var rect = canvas.getBoundingClientRect();
            console.log('🖼️ campo-canvas:', {
                width: rect.width + 'px',
                height: rect.height + 'px',
                top: rect.top + 'px',
                left: rect.left + 'px',
                canvasWidth: canvas.width + 'px (atributo)',
                canvasHeight: canvas.height + 'px (atributo)',
                styleWidth: canvas.style.width,
                styleHeight: canvas.style.height
            });
        }
        
        // Mostrar todos los paneles
        var paneles = document.querySelectorAll('.panel-flotante, #panel-configuracion');
        console.log('📋 ===== PANELES =====');
        paneles.forEach(function(panel) {
            var rect = panel.getBoundingClientRect();
            var id = panel.id || 'sin-id';
            var display = window.getComputedStyle(panel).display;
            console.log('📋 ' + id + ':', {
                width: rect.width + 'px',
                height: rect.height + 'px',
                top: rect.top + 'px',
                left: rect.left + 'px',
                display: display,
                visible: display !== 'none'
            });
        });
    }
    
    // ============================================
    // 2. DIBUJAR MARCADORES VISUALES EN LA PANTALLA
    // ============================================
    function dibujarMarcadores() {
        var container = document.getElementById('game-container');
        if (!container) return;
        
        // Limpiar marcadores anteriores
        var viejos = container.querySelectorAll('.debug-marker');
        viejos.forEach(function(el) { el.remove(); });
        
        // 1. Marcar el contenedor principal
        var marker1 = document.createElement('div');
        marker1.className = 'debug-marker';
        marker1.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border: 4px solid #ff0000;
            pointer-events: none;
            z-index: 9999;
            box-sizing: border-box;
        `;
        container.appendChild(marker1);
        
        // 2. Marcar el campo
        var field = document.getElementById('field');
        if (field) {
            var rect = field.getBoundingClientRect();
            var containerRect = container.getBoundingClientRect();
            var marker2 = document.createElement('div');
            marker2.className = 'debug-marker';
            marker2.style.cssText = `
                position: absolute;
                top: ${rect.top - containerRect.top}px;
                left: ${rect.left - containerRect.left}px;
                width: ${rect.width}px;
                height: ${rect.height}px;
                border: 3px dashed #00aa00;
                pointer-events: none;
                z-index: 9999;
                box-sizing: border-box;
                background: rgba(0, 170, 0, 0.05);
            `;
            container.appendChild(marker2);
            
            // Etiqueta del campo
            var label2 = document.createElement('div');
            label2.className = 'debug-marker';
            label2.textContent = 'FIELD';
            label2.style.cssText = `
                position: absolute;
                top: ${rect.top - containerRect.top + 2}px;
                left: ${rect.left - containerRect.left + 4}px;
                color: #00aa00;
                font-size: 10px;
                font-weight: bold;
                font-family: Arial, sans-serif;
                pointer-events: none;
                z-index: 9999;
                background: rgba(0,0,0,0.7);
                padding: 2px 6px;
                border-radius: 3px;
            `;
            container.appendChild(label2);
        }
        
        // 3. Marcar el canvas
        var canvas = document.getElementById('campo-canvas');
        if (canvas) {
            var rect = canvas.getBoundingClientRect();
            var containerRect = container.getBoundingClientRect();
            var marker3 = document.createElement('div');
            marker3.className = 'debug-marker';
            marker3.style.cssText = `
                position: absolute;
                top: ${rect.top - containerRect.top}px;
                left: ${rect.left - containerRect.left}px;
                width: ${rect.width}px;
                height: ${rect.height}px;
                border: 3px solid #ff8800;
                pointer-events: none;
                z-index: 9999;
                box-sizing: border-box;
                background: rgba(255, 136, 0, 0.05);
            `;
            container.appendChild(marker3);
            
            // Etiqueta del canvas
            var label3 = document.createElement('div');
            label3.className = 'debug-marker';
            label3.textContent = 'CANVAS (' + canvas.width + 'x' + canvas.height + ')';
            label3.style.cssText = `
                position: absolute;
                top: ${rect.top - containerRect.top + 2}px;
                right: ${containerRect.right - rect.right + 4}px;
                color: #ff8800;
                font-size: 10px;
                font-weight: bold;
                font-family: Arial, sans-serif;
                pointer-events: none;
                z-index: 9999;
                background: rgba(0,0,0,0.7);
                padding: 2px 6px;
                border-radius: 3px;
            `;
            container.appendChild(label3);
        }
        
        // 4. Marcar los paneles
        var paneles = document.querySelectorAll('.panel-flotante, #panel-configuracion');
        var colores = ['#3366ff', '#ff8800', '#cc44cc', '#22aa44', '#ff0000'];
        var idx = 0;
        paneles.forEach(function(panel) {
            if (panel.id === 'panel-marcador' || panel.id === 'panel-poderes' || 
                panel.id === 'panel-controles' || panel.id === 'panel-audios' ||
                panel.id === 'panel-configuracion') {
                var rect = panel.getBoundingClientRect();
                var containerRect = container.getBoundingClientRect();
                var color = colores[idx % colores.length];
                var marker = document.createElement('div');
                marker.className = 'debug-marker';
                marker.style.cssText = `
                    position: absolute;
                    top: ${rect.top - containerRect.top}px;
                    left: ${rect.left - containerRect.left}px;
                    width: ${rect.width}px;
                    height: ${rect.height}px;
                    border: 2px solid ${color};
                    pointer-events: none;
                    z-index: 9999;
                    box-sizing: border-box;
                    background: rgba(0, 0, 0, 0.03);
                `;
                container.appendChild(marker);
                
                var label = document.createElement('div');
                label.className = 'debug-marker';
                label.textContent = panel.id.toUpperCase();
                label.style.cssText = `
                    position: absolute;
                    top: ${rect.top - containerRect.top + 2}px;
                    left: ${rect.left - containerRect.left + 4}px;
                    color: ${color};
                    font-size: 9px;
                    font-weight: bold;
                    font-family: Arial, sans-serif;
                    pointer-events: none;
                    z-index: 9999;
                    background: rgba(0,0,0,0.7);
                    padding: 1px 4px;
                    border-radius: 2px;
                `;
                container.appendChild(label);
                idx++;
            }
        });
        
        // 5. Mostrar porcentaje de espacio usado
        var fieldRect = field ? field.getBoundingClientRect() : null;
        var containerRect = container.getBoundingClientRect();
        if (fieldRect) {
            var porcentajeAlto = ((fieldRect.height / containerRect.height) * 100).toFixed(1);
            var porcentajeAncho = ((fieldRect.width / containerRect.width) * 100).toFixed(1);
            var info = document.createElement('div');
            info.className = 'debug-marker';
            info.textContent = '📊 Campo: ' + porcentajeAncho + '% x ' + porcentajeAlto + '%';
            info.style.cssText = `
                position: absolute;
                bottom: 10px;
                right: 10px;
                color: #ffffff;
                font-size: 12px;
                font-weight: bold;
                font-family: Arial, sans-serif;
                pointer-events: none;
                z-index: 10000;
                background: rgba(0,0,0,0.8);
                padding: 4px 10px;
                border-radius: 4px;
                border: 1px solid #ffd700;
            `;
            container.appendChild(info);
        }
    }
    
    // ============================================
    // 3. MOSTRAR ERRORES EN CONSOLA
    // ============================================
    function mostrarErrores() {
        console.log('🔍 ===== VERIFICANDO ERRORES COMUNES =====');
        
        // Verificar si el canvas existe
        var canvas = document.getElementById('campo-canvas');
        if (!canvas) {
            console.error('❌ ERROR: No se encontró el canvas');
        } else {
            console.log('✅ Canvas encontrado');
            if (canvas.width === 0 || canvas.height === 0) {
                console.warn('⚠️ El canvas tiene tamaño 0x0');
            }
        }
        
        // Verificar si los paneles tienen posición
        var paneles = document.querySelectorAll('.panel-flotante, #panel-configuracion');
        paneles.forEach(function(panel) {
            var style = window.getComputedStyle(panel);
            if (style.position === 'static') {
                console.warn('⚠️ El panel ' + (panel.id || 'sin-id') + ' tiene position:static (debería ser absolute)');
            }
            if (style.display === 'none') {
                console.log('ℹ️ El panel ' + (panel.id || 'sin-id') + ' está oculto (display:none)');
            }
        });
        
        // Verificar si la zona de controles existe
        var zona = document.getElementById('zona-controles');
        if (!zona) {
            console.warn('⚠️ No existe #zona-controles en el HTML');
        } else {
            console.log('✅ #zona-controles encontrada');
        }
    }
    
    // ============================================
    // 4. EJECUTAR DEPURACIÓN
    // ============================================
    function depurar() {
        console.log('🔍 ===== EJECUTANDO DEPURACIÓN =====');
        mostrarErrores();
        setTimeout(mostrarInfoContenedor, 100);
        setTimeout(dibujarMarcadores, 200);
        
        // Repetir cada 2 segundos para ver cambios
        var interval = setInterval(function() {
            dibujarMarcadores();
        }, 2000);
        
        // Detener después de 30 segundos
        setTimeout(function() {
            clearInterval(interval);
            console.log('🔍 ===== DEPURACIÓN FINALIZADA =====');
        }, 30000);
    }
    
    // ============================================
    // 5. INICIAR DEPURACIÓN AL CARGAR
    // ============================================
    // Ejecutar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', depurar);
    } else {
        depurar();
    }
    
    // También ejecutar después de que cargue todo
    window.addEventListener('load', function() {
        setTimeout(depurar, 500);
    });
    
    // Función global para ejecutar depuración manualmente
    window.ejecutarDepuracion = function() {
        console.log('🔍 ===== DEPURACIÓN MANUAL =====');
        mostrarErrores();
        mostrarInfoContenedor();
        dibujarMarcadores();
    };
    
    console.log('🔍 ===== DEPURADOR CARGADO =====');
    console.log('💡 Escribe "ejecutarDepuracion()" en la consola para ejecutar la depuración manualmente');
    
})();