export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const fileName = pathParts[pathParts.length - 1];
  const productId = fileName.replace('imagen-oficial-', '').replace('.jpg', '').replace('.png', '').replace('.webp', '');
  
  const SUPABASE_URL = 'https://sxxntcaobektiltyppwz.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4eG50Y2FvYmVrdGlsdHlwcHd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMTU4NzIsImV4cCI6MjA4NjY5MTg3Mn0.Fi3SMNxUQeBm0fdMEJzNY_orgag5siD0IjDZsbJ2upg';
  
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_producto_oficial_meta`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id_param: parseInt(productId) })
      }
    );
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      return new Response('Producto no encontrado', { status: 404 });
    }
    
    const producto = data[0];
    const imagenUrl = producto.imagen_url;
    
    if (!imagenUrl) {
      // Redirigir a imagen por defecto
      return fetch('https://cubazon.dpdns.org/android-chrome-512x512.png');
    }
    
    const imageResponse = await fetch(imagenUrl);
    const imageData = await imageResponse.arrayBuffer();
    
    return new Response(imageData, {
      headers: {
        'Content-Type': imageResponse.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error) {
    return new Response('Error interno', { status: 500 });
  }
}