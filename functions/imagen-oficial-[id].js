export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const fileName = pathParts[pathParts.length - 1];
  const productId = fileName.replace('imagen-oficial-', '').replace('.jpg', '').replace('.png', '').replace('.webp', '');
  
  const SUPABASE_URL = 'https://ehlebvmalatsdyvopvkn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVobGVidm1hbGF0c2R5dm9wdmtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMjg2MjAsImV4cCI6MjA5OTYwNDYyMH0.lsV-x6y3e-0fbdUqb--_CVi8c1gUhO4MUoo1grq66ZI';
  
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