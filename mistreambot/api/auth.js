// ============================================
// API DE AUTENTICACIÓN PARA CLOUDFLARE PAGES
// ============================================

export async function onRequest(context) {
    const { request } = context;
    
    // Solo aceptar POST
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Método no permitido' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    try {
        const { credential } = await request.json();
        
        if (!credential) {
            return new Response(JSON.stringify({ error: 'No se recibió token' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Decodificar el token de Google
        const payload = JSON.parse(atob(credential.split('.')[1]));
        const email = payload.email;
        const AUTH_EMAIL = 'cubazon.oficial@gmail.com';
        
        // Verificar que sea el email autorizado
        if (email !== AUTH_EMAIL) {
            return new Response(JSON.stringify({ 
                error: 'Acceso denegado. Solo el administrador puede entrar.' 
            }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Respuesta exitosa
        return new Response(JSON.stringify({
            success: true,
            user: {
                email: payload.email,
                name: payload.name,
                picture: payload.picture
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
