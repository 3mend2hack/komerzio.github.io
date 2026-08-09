export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const fileName = pathParts[pathParts.length - 1];
  const productId = fileName.replace('imagen-oficial-', '').replace('.jpg', '').replace('.png', '').replace('.webp', '');
  
  const SUPABASE_URL = 'https://houfrgnlctliwkzzelmi.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvdWZyZ25sY3RsaXdrenplbG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MTQ2OTMsImV4cCI6MjA5NjE5MDY5M30.zUfcA755LEjBbn-N05LrmwFqsOFITRP4qLzxjgPIy54';
  
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
      return fetch('https://komerzio.dpdns.org/assets/images/komerzio.png');
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