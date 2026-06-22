// auth.js - CORREGIDO PARA USAR IMPORT DIRECTO
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

    async verificarBaneo(userId) {
        try {
            const { data, error } = await supabase
                .from('perfiles')
                .select('estado, motivo_baneo')
                .eq('id', userId)
                .maybeSingle()
            if (error) return false
            return data?.estado === 'baneado'
        } catch (error) { return false }
    }

    async cargarUsuario(userId) {
        try {
            console.log('👤 Cargando usuario:', userId)
            
            const baneado = await this.verificarBaneo(userId)
            if (baneado) {
                await this.cerrarSesion()
                return null
            }
            
            const { data, error } = await supabase
                .from('perfiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle()
            
            if (error) console.error('Error cargando perfil:', error)
            
            if (data) {
                usuarioActual = { id: userId, ...data }
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

    async login(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password })
            
            if (error) {
                if (error.message?.includes('Invalid login credentials')) return { success: false, error: '❌ Email o contraseña incorrectos' }
                if (error.message?.includes('Email not confirmed')) return { success: false, error: '📧 Debes confirmar tu email antes de iniciar sesión' }
                return { success: false, error: error.message }
            }
            
            const baneado = await this.verificarBaneo(data.user.id)
            if (baneado) {
                await supabase.auth.signOut()
                return { success: false, error: '🚫 Tu cuenta ha sido suspendida' }
            }
            
            await this.cargarUsuario(data.user.id)
            return { success: true, user: data.user, session: data.session }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    async registrar(email, password, datos) {
        try {
            if (!email || !email.includes('@')) return { success: false, error: '❌ Ingresa un email válido' }
            if (!password || password.length < 6) return { success: false, error: '❌ La contraseña debe tener al menos 6 caracteres' }
            
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email, password,
                options: { data: { nombre: datos.nombre || '', telefono: datos.telefono || '' } }
            })
            
            if (authError) {
                if (authError.message?.includes('already registered')) return { success: false, error: '⚠️ Este email ya está registrado' }
                return { success: false, error: `❌ Error: ${authError.message}` }
            }
            
            if (authData?.user) {
                const { error: perfilError } = await supabase.from('perfiles').insert([{
                    id: authData.user.id, email: email,
                    nombre: datos.nombre || '', telefono: datos.telefono || '', estado: 'activo'
                }])
                if (perfilError) console.error('❌ Error guardando perfil:', perfilError)
                return { success: true, user: authData.user, message: '✅ ¡Registro exitoso!' }
            }
            
            return { success: true, message: '📧 Te hemos enviado un email de confirmación' }
        } catch (error) {
            return { success: false, error: '❌ Error inesperado' }
        }
    }

    async obtenerPedidos() {
        if (!usuarioActual) return []
        try {
            const { data, error } = await supabase.from('pedidos').select('*').eq('user_id', usuarioActual.id).order('created_at', { ascending: false })
            if (error) throw error
            return data || []
        } catch (error) { return [] }
    }

    async actualizarPerfil(datos) {
        if (!usuarioActual) return { success: false, error: 'No hay usuario autenticado' }
        
        const baneado = await this.verificarBaneo(usuarioActual.id)
        if (baneado) { await this.cerrarSesion(); return { success: false, error: 'Cuenta suspendida' } }
        
        try {
            const updateData = {}
            if (datos.nombre !== undefined) updateData.nombre = datos.nombre
            if (datos.nombre_completo !== undefined) updateData.nombre = datos.nombre_completo
            if (datos.telefono !== undefined) updateData.telefono = datos.telefono
            if (datos.carnet !== undefined) updateData.carnet = datos.carnet
            if (datos.direccion !== undefined) updateData.direccion = datos.direccion
            if (datos.localidad !== undefined) updateData.localidad = datos.localidad
            if (datos.referencia !== undefined) updateData.referencia = datos.referencia
            if (datos.provincia !== undefined) updateData.provincia = datos.provincia
            if (datos.municipio !== undefined) updateData.municipio = datos.municipio
            updateData.updated_at = new Date().toISOString()
            
            const { error } = await supabase.from('perfiles').update(updateData).eq('id', usuarioActual.id)
            if (error) throw error
            
            usuarioActual = { ...usuarioActual, ...datos }
            localStorage.setItem('komerzio_user', JSON.stringify(usuarioActual))
            this.notificarCambio()
            return { success: true, message: '✅ Perfil actualizado' }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    async cambiarPassword(passwordActual, passwordNuevo) {
        if (!usuarioActual) return { success: false, error: 'No hay usuario autenticado' }
        try {
            const { error: signError } = await supabase.auth.signInWithPassword({ email: usuarioActual.email, password: passwordActual })
            if (signError) return { success: false, error: 'Contraseña actual incorrecta' }
            const { error } = await supabase.auth.updateUser({ password: passwordNuevo })
            if (error) throw error
            return { success: true, message: '✅ Contraseña actualizada' }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    async cerrarSesion() {
        await supabase.auth.signOut()
        usuarioActual = null
        localStorage.removeItem('komerzio_user')
        this.notificarCambio()
    }

    getUsuario() { return usuarioActual }
    isAuthenticated() { return usuarioActual !== null }

    onCambio(callback) {
        listeners.push(callback)
        return () => { listeners = listeners.filter(l => l !== callback) }
    }

    notificarCambio() {
        listeners.forEach(cb => cb(usuarioActual))
        window.dispatchEvent(new CustomEvent('auth-change', { detail: { user: usuarioActual } }))
    }
}

export const auth = new AuthManager()
window.auth = auth
