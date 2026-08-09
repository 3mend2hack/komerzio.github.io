export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // Extraer el ID del producto de la URL
  const pathParts = url.pathname.split('/');
  const fileName = pathParts[pathParts.length - 1];
  const productId = fileName.replace('imagen-', '').replace('.jpg', '').replace('.png', '').replace('.webp', '');
  
  const SUPABASE_URL = 'https://houfrgnlctliwkzzelmi.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvdWZyZ25sY3RsaXdrenplbG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MTQ2OTMsImV4cCI6MjA5NjE5MDY5M30.zUfcA755LEjBbn-N05LrmwFqsOFITRP4qLzxjgPIy54';
  
  try {
    // Obtener la URL de la imagen desde Supabase
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
      return new Response('Imagen no disponible', { status: 404 });
    }
    
    // Obtener la imagen real de Supabase
    const imageResponse = await fetch(imagenUrl);
    
    if (!imageResponse.ok) {
      return new Response('Error al obtener la imagen', { status: 500 });
    }
    
    // Devolver la imagen con los headers correctos
    return new Response(imageResponse.body, {
      headers: {
        'Content-Type': imageResponse.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error) {
    return new Response('Error interno', { status: 500 });
  }
}