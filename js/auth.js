// auth.js - VERSIÓN COMPLETA CORREGIDA CON VERIFICACIÓN DE BANEO
// ============================================
import { supabase } from './supabase-client.js'

// ========== ESTADO GLOBAL ==========
let usuarioActual = null
let listeners = []

// ========== CLASE DE AUTENTICACIÓN ==========
export class AuthManager {
    constructor() {
        this.init()
    }

    async init() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            
            if (session?.user) {
                // ✅ VERIFICAR BANEO ANTES DE CARGAR EL USUARIO
                const baneado = await this.verificarBaneo(session.user.id)
                if (baneado) {
                    console.log('⚠️ Sesión de usuario baneado detectada, cerrando...')
                    await supabase.auth.signOut()
                    localStorage.removeItem('komerzio_user')
                    usuarioActual = null
                    this.notificarCambio()
                    return
                }
                await this.cargarUsuario(session.user.id)
            } else {
                const localUser = localStorage.getItem('komerzio_user')
                if (localUser) {
                    try {
                        usuarioActual = JSON.parse(localUser)
                        // ✅ VERIFICAR BANEO DEL USUARIO EN LOCALSTORAGE
                        const baneado = await this.verificarBaneo(usuarioActual.id)
                        if (baneado) {
                            console.log('⚠️ Usuario en localStorage está baneado, limpiando...')
                            localStorage.removeItem('komerzio_user')
                            usuarioActual = null
                            this.notificarCambio()
                            return
                        }
                        this.notificarCambio()
                    } catch (e) {
                        localStorage.removeItem('komerzio_user')
                    }
                }
            }
            console.log('✅ Auth inicializado correctamente')
        } catch (error) {
            console.error('❌ Error en init:', error)
        }
    }

    async verificarBaneo(userId) {
        try {
            const { data, error } = await supabase
                .from('perfiles')
                .select('estado, motivo_baneo')
                .eq('id', userId)
                .maybeSingle()
            
            if (error) {
                console.error('Error verificando baneo:', error)
                return false
            }
            
            return data?.estado === 'baneado'
        } catch (error) {
            console.error('Error en verificarBaneo:', error)
            return false
        }
    }

    async cargarUsuario(userId) {
        try {
            console.log('👤 Cargando usuario:', userId)
            
            // Verificar si está baneado
            const baneado = await this.verificarBaneo(userId)
            if (baneado) {
                console.log('⚠️ Usuario baneado')
                await this.cerrarSesion()
                return null
            }
            
            // Obtener datos del perfil
            const { data, error } = await supabase
                .from('perfiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle()
            
            if (error) {
                console.error('❌ Error cargando perfil:', error)
            }
            
            if (data) {
                usuarioActual = { 
                    id: userId, 
                    ...data,
                    nombre: data.nombre || data.email?.split('@')[0] || 'Usuario',
                    email: data.email || ''
                }
                console.log('✅ Usuario cargado desde perfiles:', usuarioActual.email)
            } else {
                console.log('⚠️ Perfil no encontrado, creando uno básico')
                const { data: userData } = await supabase.auth.getUser()
                if (userData?.user) {
                    const nuevoPerfil = {
                        id: userId,
                        email: userData.user.email,
                        nombre: userData.user.user_metadata?.nombre || userData.user.email?.split('@')[0] || 'Usuario',
                        telefono: userData.user.user_metadata?.telefono || '',
                        provincia: userData.user.user_metadata?.provincia || '',
                        estado: 'activo',
                        created_at: new Date().toISOString()
                    }
                    
                    const { error: insertError } = await supabase
                        .from('perfiles')
                        .insert([nuevoPerfil])
                    
                    if (!insertError) {
                        usuarioActual = nuevoPerfil
                    } else {
                        console.error('❌ Error creando perfil básico:', insertError)
                        usuarioActual = {
                            id: userId,
                            email: userData.user.email,
                            nombre: userData.user.user_metadata?.nombre || userData.user.email?.split('@')[0] || 'Usuario',
                            telefono: userData.user.user_metadata?.telefono || '',
                            provincia: userData.user.user_metadata?.provincia || '',
                            estado: 'activo'
                        }
                    }
                }
            }
            
            localStorage.setItem('komerzio_user', JSON.stringify(usuarioActual))
            this.notificarCambio()
            return usuarioActual
            
        } catch (error) {
            console.error('❌ Error cargando usuario:', error)
            return null
        }
    }

    // ============================================
    // LOGIN - CORREGIDO CON VERIFICACIÓN DE BANEO
    // ============================================
    async login(email, password) {
        try {
            if (!email || !password) {
                return { success: false, error: '❌ Email y contraseña son requeridos' }
            }
            
            const { data, error } = await supabase.auth.signInWithPassword({ 
                email: email.trim(), 
                password: password 
            })
            
            if (error) {
                console.error('❌ Error de login:', error)
                
                if (error.message?.includes('Invalid login credentials')) {
                    return { success: false, error: '❌ Email o contraseña incorrectos' }
                }
                if (error.message?.includes('Email not confirmed')) {
                    return { success: false, error: '📧 Debes confirmar tu email antes de iniciar sesión. Revisa tu bandeja de entrada y SPAM.' }
                }
                return { success: false, error: `❌ ${error.message}` }
            }
            
            // ✅ VERIFICAR BANEO INMEDIATAMENTE DESPUÉS DEL LOGIN
            const baneado = await this.verificarBaneo(data.user.id)
            if (baneado) {
                console.log('⚠️ Usuario baneado, cerrando sesión')
                await supabase.auth.signOut()
                return { success: false, error: '🚫 Tu cuenta ha sido suspendida' }
            }
            
            await this.cargarUsuario(data.user.id)
            return { 
                success: true, 
                user: data.user, 
                session: data.session,
                message: '✅ Inicio de sesión exitoso'
            }
            
        } catch (error) {
            console.error('❌ Error en login:', error)
            return { success: false, error: `❌ ${error.message}` }
        }
    }

    // ============================================
    // LOGIN CON GOOGLE
    // ============================================
    async loginGoogle() {
        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/mi-cuenta.html`
                }
            })
            
            if (error) {
                console.error('❌ Error en login con Google:', error)
                return { success: false, error: `❌ ${error.message}` }
            }
            
            return { 
                success: true, 
                url: data.url,
                message: '✅ Redirigiendo a Google...'
            }
            
        } catch (error) {
            console.error('❌ Error en login con Google:', error)
            return { success: false, error: `❌ ${error.message}` }
        }
    }

    // ============================================
    // REGISTRAR
    // ============================================
    async registrar(email, password, datos) {
        try {
            console.log('📝 Registrando usuario:', { email, datos });
            
            if (!email || !email.includes('@')) {
                return { success: false, error: '❌ Ingresa un email válido' }
            }
            if (!password || password.length < 6) {
                return { success: false, error: '❌ La contraseña debe tener al menos 6 caracteres' }
            }
            
            const { data: existeEmail, error: checkError } = await supabase
                .from('perfiles')
                .select('id, email')
                .eq('email', email)
                .maybeSingle();
            
            if (checkError) {
                console.error('❌ Error verificando email:', checkError);
                return { success: false, error: 'Error al verificar el email' }
            }
            
            if (existeEmail) {
                return { success: false, error: '⚠️ Este email ya está registrado' }
            }
            
            if (datos.telefono) {
                const { data: existeTelefono, error: checkTelError } = await supabase
                    .from('perfiles')
                    .select('id, telefono')
                    .eq('telefono', datos.telefono)
                    .maybeSingle();
                
                if (checkTelError) {
                    console.error('❌ Error verificando teléfono:', checkTelError);
                    return { success: false, error: 'Error al verificar el teléfono' }
                }
                
                if (existeTelefono) {
                    return { success: false, error: '⚠️ Este número de teléfono ya está registrado' }
                }
            }
            
            const { data, error } = await supabase.auth.signUp({
                email: email.trim(),
                password: password,
                options: {
                    emailRedirectTo: `${window.location.origin}/login.html`,
                    data: {
                        nombre: datos.nombre || '',
                        telefono: datos.telefono || '',
                        provincia: datos.provincia || '',
                        codigo_referido: datos.codigo_referido || null
                    }
                }
            });
            
            console.log('📥 Respuesta signUp:', data);
            
            if (error) {
                console.error('❌ Error en signUp:', error);
                return { success: false, error: `❌ ${error.message}` }
            }
            
            if (!data.user) {
                return { success: false, error: '❌ No se pudo crear el usuario' }
            }
            
            console.log('✅ Usuario creado - Email de confirmación enviado a:', email);
            
            const perfilData = {
                id: data.user.id,
                email: email.trim(),
                nombre: datos.nombre || '',
                telefono: datos.telefono || '',
                provincia: datos.provincia || '',
                estado: 'activo',
                created_at: new Date().toISOString()
            };
            
            if (datos.codigo_referido) {
                perfilData.codigo_referido = datos.codigo_referido;
            }
            if (datos.referido_por) {
                perfilData.referido_por = datos.referido_por;
            }
            
            const { error: perfilError } = await supabase
                .from('perfiles')
                .insert([perfilData]);
            
            if (perfilError) {
                console.error('❌ Error creando perfil:', perfilError);
                return { 
                    success: true, 
                    user: data.user,
                    warning: 'Usuario creado pero hubo un error al crear el perfil. Contacta a soporte.',
                    message: '✅ Cuenta creada. Revisa tu email para confirmar.'
                }
            }
            
            if (datos.codigo_referido && datos.referido_por) {
                try {
                    await supabase
                        .from('historial_referidos')
                        .insert([{
                            usuario_id: datos.referido_por,
                            referido_id: data.user.id,
                            codigo_utilizado: datos.codigo_referido,
                            estado: 'pendiente',
                            created_at: new Date().toISOString()
                        }]);
                    
                    console.log('✅ Referido registrado correctamente');
                } catch (refError) {
                    console.error('⚠️ Error registrando referido:', refError);
                }
            }
            
            try {
                await supabase
                    .from('saldo_usuarios')
                    .insert([{
                        user_id: data.user.id,
                        saldo_actual: 0,
                        created_at: new Date().toISOString()
                    }]);
                console.log('✅ Saldo inicial creado');
            } catch (saldoError) {
                console.error('⚠️ Error creando saldo:', saldoError);
            }
            
            await this.cargarUsuario(data.user.id);
            
            return { 
                success: true, 
                user: data.user,
                codigo_referido: datos.codigo_referido || null,
                message: '✅ Cuenta creada correctamente. Revisa tu correo para confirmar tu cuenta.'
            }
            
        } catch (error) {
            console.error('❌ Error en registrar:', error);
            return { success: false, error: `❌ ${error.message}` }
        }
    }

    async obtenerPedidos() {
        if (!usuarioActual) return []
        try {
            const { data, error } = await supabase
                .from('pedidos')
                .select('*')
                .eq('user_id', usuarioActual.id)
                .order('created_at', { ascending: false })
            
            if (error) throw error
            return data || []
        } catch (error) {
            console.error('Error obteniendo pedidos:', error)
            return []
        }
    }

    async actualizarPerfil(datos) {
        if (!usuarioActual) {
            return { success: false, error: 'No hay usuario autenticado' }
        }
        
        const baneado = await this.verificarBaneo(usuarioActual.id)
        if (baneado) {
            await this.cerrarSesion()
            return { success: false, error: 'Cuenta suspendida' }
        }
        
        try {
            const updateData = {
                updated_at: new Date().toISOString()
            }
            
            const fieldMap = {
                nombre: 'nombre',
                nombre_completo: 'nombre',
                telefono: 'telefono',
                carnet: 'carnet',
                direccion: 'direccion',
                localidad: 'localidad',
                referencia: 'referencia',
                provincia: 'provincia',
                municipio: 'municipio'
            }
            
            for (const [key, dbField] of Object.entries(fieldMap)) {
                if (datos[key] !== undefined) {
                    updateData[dbField] = datos[key]
                }
            }
            
            const { error } = await supabase
                .from('perfiles')
                .update(updateData)
                .eq('id', usuarioActual.id)
            
            if (error) throw error
            
            usuarioActual = { ...usuarioActual, ...datos }
            localStorage.setItem('komerzio_user', JSON.stringify(usuarioActual))
            this.notificarCambio()
            
            return { 
                success: true, 
                message: '✅ Perfil actualizado correctamente' 
            }
            
        } catch (error) {
            console.error('Error actualizando perfil:', error)
            return { success: false, error: `❌ ${error.message}` }
        }
    }

    async cambiarPassword(passwordActual, passwordNuevo) {
        if (!usuarioActual) {
            return { success: false, error: 'No hay usuario autenticado' }
        }
        
        try {
            const { error: signError } = await supabase.auth.signInWithPassword({
                email: usuarioActual.email,
                password: passwordActual
            })
            
            if (signError) {
                return { success: false, error: '❌ Contraseña actual incorrecta' }
            }
            
            const { error } = await supabase.auth.updateUser({
                password: passwordNuevo
            })
            
            if (error) throw error
            
            return { 
                success: true, 
                message: '✅ Contraseña actualizada correctamente' 
            }
            
        } catch (error) {
            console.error('Error cambiando password:', error)
            return { success: false, error: `❌ ${error.message}` }
        }
    }

    async cerrarSesion() {
        try {
            await supabase.auth.signOut()
        } catch (error) {
            console.error('Error cerrando sesión:', error)
        } finally {
            usuarioActual = null
            localStorage.removeItem('komerzio_user')
            this.notificarCambio()
        }
    }

    getUsuario() {
        return usuarioActual
    }
    
    isAuthenticated() {
        return usuarioActual !== null
    }

    onCambio(callback) {
        listeners.push(callback)
        return () => {
            listeners = listeners.filter(l => l !== callback)
        }
    }

    notificarCambio() {
        listeners.forEach(cb => {
            try {
                cb(usuarioActual)
            } catch (error) {
                console.error('Error en listener:', error)
            }
        })
        
        window.dispatchEvent(new CustomEvent('auth-change', {
            detail: { user: usuarioActual }
        }))
    }
}

// ========== EXPORTAR INSTANCIA ==========
export const auth = new AuthManager()
window.auth = auth

console.log('✅ Auth Manager cargado correctamente')