// ============================================
// API DE AUTENTICACIÓN - Cloudflare Pages
// ============================================

export async function onRequest(context) {
    const { request } = context;
    
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
        
        const payload = JSON.parse(atob(credential.split('.')[1]));
        const email = payload.email;
        
        // ===== EMAIL AUTORIZADO =====
        const AUTH_EMAIL = 'josuealexander.perez01@gmail.com';
        
        if (email !== AUTH_EMAIL) {
            return new Response(JSON.stringify({ 
                error: 'Acceso denegado. Solo el administrador puede entrar.' 
            }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        return new Response(JSON.stringify({
            success: true,
            user: {
                email: payload.email,
                name: payload.name,
                picture: payload.picture
            }
        }), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
        
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
