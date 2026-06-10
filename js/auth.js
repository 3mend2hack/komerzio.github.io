// auth.js - CORREGIDO PARA ESPERAR A SUPABASE
// ============================================

// Esperar a que Supabase esté disponible
let supabase = null;

function esperarSupabase() {
    return new Promise((resolve) => {
        if (window.supabase) {
            supabase = window.supabase.createClient(
                'https://houfrgnlctliwkzzelmi.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvdWZyZ25sY3RsaXdrenplbG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MTQ2OTMsImV4cCI6MjA5NjE5MDY5M30.zUfcA755LEjBbn-N05LrmwFqsOFITRP4qLzxjgPIy54'
            );
            resolve(supabase);
        } else {
            const checkInterval = setInterval(() => {
                if (window.supabase) {
                    clearInterval(checkInterval);
                    supabase = window.supabase.createClient(
                        'https://houfrgnlctliwkzzelmi.supabase.co',
                        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvdWZyZ25sY3RsaXdrenplbG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MTQ2OTMsImV4cCI6MjA5NjE5MDY5M30.zUfcA755LEjBbn-N05LrmwFqsOFITRP4qLzxjgPIy54'
                    );
                    resolve(supabase);
                }
            }, 50);
        }
    });
}

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
            await esperarSupabase();
            const { data: { session } } = await supabase.auth.getSession()
            
            if (session?.user) {
                await this.cargarUsuario(session.user.id)
            } else {
                const localUser = localStorage.getItem('komerzio_user')
                if (localUser) {
                    usuarioActual = JSON.parse(localUser)
                    this.notificarCambio()
                }
            }
            console.log('✅ Auth inicializado correctamente');
        } catch (error) {
            console.error('Error en init:', error)
        }
    }

    // ========== VERIFICAR SI EL USUARIO ESTÁ BANEADO ==========
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

    // ========== CARGAR USUARIO ==========
    async cargarUsuario(userId) {
        try {
            console.log('👤 Cargando usuario:', userId)
            
            const baneado = await this.verificarBaneo(userId)
            if (baneado) {
                console.log('🚫 Usuario baneado, cerrando sesión')
                await this.cerrarSesion()
                return null
            }
            
            const { data, error } = await supabase
                .from('perfiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle()
            
            if (error) {
                console.error('Error cargando perfil:', error)
            }
            
            if (data) {
                usuarioActual = {
                    id: userId,
                    ...data
                }
                console.log('✅ Usuario cargado desde perfiles:', usuarioActual.email)
            } else {
                const { data: userData } = await supabase.auth.getUser()
                
                if (userData?.user) {
                    usuarioActual = {
                        id: userId,
                        email: userData.user.email,
                        nombre: userData.user.user_metadata?.nombre || userData.user.email?.split('@')[0] || 'Usuario',
                        telefono: userData.user.user_metadata?.telefono || '',
                        estado: 'activo'
                    }
                }
            }
            
            localStorage.setItem('komerzio_user', JSON.stringify(usuarioActual))
            this.notificarCambio()
            return usuarioActual
            
        } catch (error) {
            console.error('Error cargando usuario:', error)
            return null
        }
    }

    // ========== LOGIN ==========
    async login(email, password) {
        try {
            console.log('🔑 Iniciando sesión:', email)
            
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            })
            
            if (error) {
                console.error('❌ Error de login:', error)
                
                if (error.message?.includes('Invalid login credentials')) {
                    return {
                        success: false,
                        error: '❌ Email o contraseña incorrectos'
                    }
                }
                if (error.message?.includes('Email not confirmed')) {
                    return {
                        success: false,
                        error: '📧 Debes confirmar tu email antes de iniciar sesión. Revisa tu bandeja de entrada y SPAM.'
                    }
                }
                
                return {
                    success: false,
                    error: error.message || 'Email o contraseña incorrectos'
                }
            }
            
            console.log('✅ Login exitoso en Supabase:', data.user.id)
            
            const baneado = await this.verificarBaneo(data.user.id)
            if (baneado) {
                console.log('🚫 Usuario baneado, cerrando sesión')
                await supabase.auth.signOut()
                return {
                    success: false,
                    error: '🚫 Tu cuenta ha sido suspendida. Contacta al administrador.'
                }
            }
            
            await this.cargarUsuario(data.user.id)
            
            return {
                success: true,
                user: data.user,
                session: data.session
            }
            
        } catch (error) {
            console.error('❌ Error en login:', error)
            return {
                success: false,
                error: error.message || 'Error al iniciar sesión'
            }
        }
    }

    // ========== REGISTRO ==========
    async registrar(email, password, datos) {
        try {
            console.log('📝 Registrando usuario:', email)
            
            if (!email || !email.includes('@')) {
                return {
                    success: false,
                    error: '❌ Ingresa un email válido'
                }
            }
            
            if (!password || password.length < 6) {
                return {
                    success: false,
                    error: '❌ La contraseña debe tener al menos 6 caracteres'
                }
            }
            
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        nombre: datos.nombre || '',
                        telefono: datos.telefono || '',
                        carnet: datos.carnet || '',
                        provincia: datos.provincia || '',
                        municipio: datos.municipio || ''
                    }
                }
            })
            
            if (authError) {
                console.error('❌ Error de auth:', authError.message)
                
                if (authError.message?.includes('already registered') || 
                    authError.message?.includes('already exists')) {
                    return {
                        success: false,
                        error: '⚠️ Este email ya está registrado'
                    }
                }
                
                return {
                    success: false,
                    error: `❌ Error: ${authError.message}`
                }
            }
            
            if (authData?.user) {
                console.log('✅ Usuario creado en Auth:', authData.user.id)
                
                const { error: perfilError } = await supabase
                    .from('perfiles')
                    .insert([{
                        id: authData.user.id,
                        email: email,
                        nombre: datos.nombre || '',
                        telefono: datos.telefono || '',
                        estado: 'activo'
                    }])
                
                if (perfilError) {
                    console.error('❌ Error guardando perfil:', perfilError)
                }
                
                return {
                    success: true,
                    user: authData.user,
                    message: '✅ ¡Registro exitoso! Ya puedes iniciar sesión.'
                }
            }
            
            if (!authError) {
                return {
                    success: true,
                    message: '📧 Te hemos enviado un email de confirmación.'
                }
            }
            
            return {
                success: false,
                error: '❌ No se pudo completar el registro.'
            }
            
        } catch (error) {
            console.error('❌ Error inesperado en registro:', error)
            return {
                success: false,
                error: '❌ Error inesperado. Por favor, intenta de nuevo.'
            }
        }
    }

    // ========== OBTENER PEDIDOS ==========
    async obtenerPedidos() {
        if (!usuarioActual) return [];
        try {
            const { data, error } = await supabase
                .from('pedidos')
                .select('*')
                .eq('user_id', usuarioActual.id)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error obteniendo pedidos:', error);
            return [];
        }
    }

    // ========== OBTENER DIRECCIONES ==========
    async obtenerDirecciones() {
        if (!usuarioActual) return [];
        try {
            const { data, error } = await supabase
                .from('direcciones')
                .select('*')
                .eq('usuario_id', usuarioActual.id);
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error obteniendo direcciones:', error);
            return [];
        }
    }

    // ========== ELIMINAR DIRECCIÓN ==========
    async eliminarDireccion(id) {
        if (!usuarioActual) return { success: false, error: 'No autenticado' };
        try {
            const { error } = await supabase
                .from('direcciones')
                .delete()
                .eq('id', id)
                .eq('usuario_id', usuarioActual.id);
            
            if (error) throw error;
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ========== ACTUALIZAR PERFIL (CORREGIDO CON TODOS LOS CAMPOS) ==========
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
            console.log('📝 Actualizando perfil:', usuarioActual.id)
            console.log('📦 Datos recibidos:', datos)
            
            // Construir objeto con los campos que existen en la tabla perfiles
            const updateData = {};
            
            if (datos.nombre !== undefined) updateData.nombre = datos.nombre;
            if (datos.nombre_completo !== undefined) updateData.nombre = datos.nombre_completo;
            if (datos.telefono !== undefined) updateData.telefono = datos.telefono;
            if (datos.carnet !== undefined) updateData.carnet = datos.carnet;
            if (datos.direccion !== undefined) updateData.direccion = datos.direccion;
            if (datos.localidad !== undefined) updateData.localidad = datos.localidad;
            if (datos.referencia !== undefined) updateData.referencia = datos.referencia;
            if (datos.provincia !== undefined) updateData.provincia = datos.provincia;
            if (datos.municipio !== undefined) updateData.municipio = datos.municipio;
            
            updateData.updated_at = new Date().toISOString();
            
            console.log('📦 Datos a actualizar en Supabase:', updateData);
            
            const { error } = await supabase
                .from('perfiles')
                .update(updateData)
                .eq('id', usuarioActual.id)
            
            if (error) throw error
            
            // Actualizar objeto local
            usuarioActual = { ...usuarioActual, ...datos }
            localStorage.setItem('komerzio_user', JSON.stringify(usuarioActual))
            this.notificarCambio()
            
            return { success: true, message: '✅ Perfil actualizado' }
            
        } catch (error) {
            console.error('❌ Error actualizando perfil:', error)
            return { success: false, error: error.message }
        }
    }

    // ========== CAMBIAR CONTRASEÑA ==========
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
                return { success: false, error: 'Contraseña actual incorrecta' }
            }
            
            const { error } = await supabase.auth.updateUser({
                password: passwordNuevo
            })
            
            if (error) throw error
            
            return { success: true, message: '✅ Contraseña actualizada' }
            
        } catch (error) {
            console.error('❌ Error cambiando contraseña:', error)
            return { success: false, error: error.message }
        }
    }

    // ========== GETTERS ==========
    getUsuario() {
        return usuarioActual
    }

    isAuthenticated() {
        return usuarioActual !== null
    }

    // ========== LISTENERS ==========
    onCambio(callback) {
        listeners.push(callback)
        return () => {
            listeners = listeners.filter(l => l !== callback)
        }
    }

    notificarCambio() {
        listeners.forEach(cb => cb(usuarioActual))
        window.dispatchEvent(new CustomEvent('auth-change', {
            detail: { user: usuarioActual }
        }))
    }
}

// ========== INSTANCIA GLOBAL ==========
export const auth = new AuthManager()
window.auth = auth