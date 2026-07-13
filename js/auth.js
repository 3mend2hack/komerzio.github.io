// auth.js - VERSIÓN CORREGIDA
// ============================================
import { supabase } from './supabase-client.js'

// ========== ESTADO GLOBAL ==========
let usuarioActual = null
let listeners = []

// ========== CLASE DE AUTENTICACIÓN CORREGIDA ==========
export class AuthManager {
    constructor() {
        this.init()
    }

    async init() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            
            if (session?.user) {
                await this.cargarUsuario(session.user.id)
            } else {
                const localUser = localStorage.getItem('komerzio_user')
                if (localUser) {
                    try {
                        usuarioActual = JSON.parse(localUser)
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
                // ✅ PERFIL EXISTE - usarlo
                usuarioActual = { 
                    id: userId, 
                    ...data,
                    nombre: data.nombre || data.email?.split('@')[0] || 'Usuario',
                    email: data.email || ''
                }
                console.log('✅ Usuario cargado desde perfiles:', usuarioActual.email)
            } else {
                // ⚠️ PERFIL NO EXISTE - intentar crear
                console.log('⚠️ Perfil no encontrado, creando uno básico')
                
                // Obtener datos del usuario de auth
                const { data: userData, error: userError } = await supabase.auth.getUser()
                
                if (userError || !userData?.user) {
                    console.error('❌ No se pudo obtener datos del usuario de auth:', userError)
                    usuarioActual = {
                        id: userId,
                        email: 'usuario@email.com',
                        nombre: 'Usuario',
                        estado: 'activo'
                    }
                    localStorage.setItem('komerzio_user', JSON.stringify(usuarioActual))
                    this.notificarCambio()
                    return usuarioActual
                }
                
                const nuevoPerfil = {
                    id: userId,
                    email: userData.user.email,
                    nombre: userData.user.user_metadata?.nombre || userData.user.email?.split('@')[0] || 'Usuario',
                    telefono: userData.user.user_metadata?.telefono || '',
                    provincia: userData.user.user_metadata?.provincia || '',
                    estado: 'activo',
                    created_at: new Date().toISOString()
                }
                
                // 🔧 VERIFICAR ANTES DE INSERTAR
                const { data: existente, error: checkError } = await supabase
                    .from('perfiles')
                    .select('id')
                    .eq('email', nuevoPerfil.email)
                    .maybeSingle()
                
                if (existente) {
                    // Ya existe un perfil con ese email, cargarlo
                    console.log('⚠️ El perfil ya existe con email:', nuevoPerfil.email)
                    const { data: perfilExistente, error: loadError } = await supabase
                        .from('perfiles')
                        .select('*')
                        .eq('email', nuevoPerfil.email)
                        .maybeSingle()
                    
                    if (perfilExistente) {
                        usuarioActual = { 
                            id: perfilExistente.id, 
                            ...perfilExistente,
                            nombre: perfilExistente.nombre || perfilExistente.email?.split('@')[0] || 'Usuario',
                            email: perfilExistente.email || ''
                        }
                        localStorage.setItem('komerzio_user', JSON.stringify(usuarioActual))
                        this.notificarCambio()
                        return usuarioActual
                    }
                }
                
                // Insertar nuevo perfil
                const { error: insertError } = await supabase
                    .from('perfiles')
                    .insert([nuevoPerfil])
                
                if (insertError) {
                    console.error('❌ Error creando perfil básico:', insertError)
                    // Si falla, usar datos básicos
                    usuarioActual = {
                        id: userId,
                        email: userData.user.email,
                        nombre: userData.user.user_metadata?.nombre || userData.user.email?.split('@')[0] || 'Usuario',
                        telefono: userData.user.user_metadata?.telefono || '',
                        provincia: userData.user.user_metadata?.provincia || '',
                        estado: 'activo'
                    }
                } else {
                    usuarioActual = nuevoPerfil
                    console.log('✅ Perfil creado correctamente')
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
            
            // Verificar si está baneado
            const baneado = await this.verificarBaneo(data.user.id)
            if (baneado) {
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

    async registrar(email, password, datos) {
        try {
            // Validaciones
            if (!email || !email.includes('@')) {
                return { success: false, error: '❌ Ingresa un email válido' }
            }
            if (!password || password.length < 6) {
                return { success: false, error: '❌ La contraseña debe tener al menos 6 caracteres' }
            }
            
            // Verificar si el teléfono ya existe
            if (datos.telefono) {
                const { data: telefonoExiste, error: telefonoError } = await supabase
                    .from('perfiles')
                    .select('id')
                    .eq('telefono', datos.telefono)
                    .maybeSingle()
                
                if (telefonoError) {
                    console.error('Error verificando teléfono:', telefonoError)
                }
                
                if (telefonoExiste) {
                    return { success: false, error: '⚠️ Este número de teléfono ya está registrado' }
                }
            }
            
            // Registrar en Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email.trim(),
                password: password,
                options: {
                    data: {
                        nombre: datos.nombre || '',
                        telefono: datos.telefono || '',
                        provincia: datos.provincia || ''
                    }
                }
            })
            
            if (authError) {
                if (authError.message?.includes('already registered')) {
                    return { success: false, error: '⚠️ Este email ya está registrado' }
                }
                return { success: false, error: `❌ ${authError.message}` }
            }
            
            if (authData?.user) {
                // Crear perfil
                const perfilData = {
                    id: authData.user.id,
                    email: email.trim(),
                    nombre: datos.nombre || '',
                    telefono: datos.telefono || '',
                    provincia: datos.provincia || '',
                    codigo_referido: datos.codigo_referido || null,
                    referido_por: datos.referido_por || null,
                    estado: 'activo',
                    created_at: new Date().toISOString()
                }
                
                const { error: perfilError } = await supabase
                    .from('perfiles')
                    .insert([perfilData])
                
                if (perfilError) {
                    console.error('❌ Error guardando perfil:', perfilError)
                    // Intentar eliminar el usuario de auth
                    try {
                        await supabase.auth.admin.deleteUser(authData.user.id)
                    } catch (e) {
                        console.error('Error eliminando usuario de auth:', e)
                    }
                    return { success: false, error: `❌ Error al crear el perfil: ${perfilError.message}` }
                }
                
                return { 
                    success: true, 
                    user: authData.user,
                    message: '✅ ¡Registro exitoso! Revisa tu email para confirmar tu cuenta'
                }
            }
            
            return { 
                success: true, 
                message: '📧 Te hemos enviado un email de confirmación. Revisa tu bandeja de entrada y SPAM.' 
            }
            
        } catch (error) {
            console.error('❌ Error en registrar:', error)
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
        
        // Verificar si está baneado
        const baneado = await this.verificarBaneo(usuarioActual.id)
        if (baneado) {
            await this.cerrarSesion()
            return { success: false, error: 'Cuenta suspendida' }
        }
        
        try {
            // Construir objeto de actualización
            const updateData = {
                updated_at: new Date().toISOString()
            }
            
            // Mapeo de campos
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
            
            // Actualizar usuario local
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
            // Verificar contraseña actual
            const { error: signError } = await supabase.auth.signInWithPassword({
                email: usuarioActual.email,
                password: passwordActual
            })
            
            if (signError) {
                return { success: false, error: '❌ Contraseña actual incorrecta' }
            }
            
            // Cambiar contraseña
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
