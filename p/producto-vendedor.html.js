export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const productId = url.searchParams.get('id') || url.searchParams.get('p');
  const userAgent = request.headers.get('user-agent') || '';
  
  // Detectar si es un bot de WhatsApp, Facebook, Twitter, etc.
  const isBot = userAgent.includes('WhatsApp') ||
    userAgent.includes('Facebook') ||
    userAgent.includes('Twitterbot') ||
    userAgent.includes('TelegramBot') ||
    userAgent.includes('facebookexternalhit');
  
  const SUPABASE_URL = 'https://sxxntcaobektiltyppwz.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4eG50Y2FvYmVrdGlsdHlwcHd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMTU4NzIsImV4cCI6MjA4NjY5MTg3Mn0.Fi3SMNxUQeBm0fdMEJzNY_orgag5siD0IjDZsbJ2upg';
  
  // Si no es un bot O no hay ID, servir la página normal
  if (!isBot || !productId) {
    return context.next();
  }
  
  try {
    const supabaseResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_producto_meta`,
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
    
    const data = await supabaseResponse.json();
    
    if (!data || data.length === 0) {
      return context.next();
    }
    
    const producto = data[0];
    
    // Página ultra simple SOLO para bots
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${producto.nombre} - ${producto.nombre_tienda} | CUBAZON</title>
    <meta property="og:title" content="${producto.nombre} - ${producto.nombre_tienda} | CUBAZON">
    <meta property="og:description" content="💰 Precio: $${parseFloat(producto.precio).toFixed(2)} CUP | 🏪 ${producto.nombre_tienda} | 📦 Stock: ${producto.stock} unidades">
    <meta property="og:image" content="https://cubazon.dpdns.org/imagen-${productId}.jpg">
    <meta property="og:url" content="https://cubazon.dpdns.org/producto-vendedor.html?id=${productId}">
    <meta property="og:type" content="product">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${producto.nombre} - ${producto.nombre_tienda} | CUBAZON">
    <meta name="twitter:description" content="💰 Precio: $${parseFloat(producto.precio).toFixed(2)} CUP | 🏪 ${producto.nombre_tienda} | 📦 Stock: ${producto.stock} unidades">
    <meta name="twitter:image" content="https://cubazon.dpdns.org/imagen-${productId}.jpg">
</head>
<body>
    <h1>${producto.nombre}</h1>
    <p>Precio: $${parseFloat(producto.precio).toFixed(2)} CUP</p>
    <p>Vendedor: ${producto.nombre_tienda}</p>
</body>
</html>`;
    
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });
    
  } catch (error) {
    return context.next();
  }
}