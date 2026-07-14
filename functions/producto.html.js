export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const productId = url.searchParams.get('id') || url.searchParams.get('p');
  const userAgent = request.headers.get('user-agent') || '';

  // Detectar si es un bot de WhatsApp, Facebook, Twitter, etc.
  const isBot = userAgent.includes('WhatsApp') ||
    userAgent.includes('Facebook') ||
    userAgent.includes('Twitterbot') ||
    userAgent.includes('TelegramBot') ||
    userAgent.includes('facebookexternalhit');

  // Preferir variables en el entorno (Cloudflare Pages/Workers bindings)
  const SUPABASE_URL = env?.SUPABASE_URL || (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '');
  const SUPABASE_ANON_KEY = env?.SUPABASE_ANON_KEY || (typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '');

  // Si no es un bot O no hay ID, servir la página normal
  if (!isBot || !productId) {
    return context.next();
  }

  try {
    const supabaseResponse = await fetch(
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

    const data = await supabaseResponse.json();

    if (!data || data.length === 0) {
      return context.next();
    }

    const producto = data[0];

    // Calcular precio actual (con oferta si existe)
    const precioActual = (producto.precio_oferta && producto.precio_oferta > 0 && producto.precio_oferta < producto.precio) ?
      producto.precio_oferta :
      producto.precio;

    // Optimizar imagen para WhatsApp
    let imagenUrl = producto.imagen_url || 'https://komerzio.dpdns.org/assets/images/komerzio.png';
    if (imagenUrl.includes('supabase.co')) {
      imagenUrl = `https://wsrv.nl/?url=${encodeURIComponent(imagenUrl)}&w=1200&h=630&fit=cover&output=jpg&q=90`;
    }

    // Página ultra simple SOLO para bots
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${producto.nombre} | KOMERZIO</title>
    <meta property="og:title" content="${producto.nombre} | KOMERZIO">
    <meta property="og:description" content="💰 $${parseFloat(precioActual).toFixed(2)} CUP | 📦 Stock: ${producto.stock} unidades | Envío en Sagua de Tánamo">
    <meta property="og:image" content="${imagenUrl}">
    <meta property="og:url" content="https://komerzio.dpdns.org/producto.html?id=${productId}">
    <meta property="og:type" content="product">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${producto.nombre} | KOMERZIO">
    <meta name="twitter:description" content="💰 $${parseFloat(precioActual).toFixed(2)} CUP | 📦 Stock: ${producto.stock} unidades">
    <meta name="twitter:image" content="${imagenUrl}">
</head>
<body>
    <h1>${producto.nombre}</h1>
    <p>Precio: $${parseFloat(precioActual).toFixed(2)} CUP</p>
    <p>Stock: ${producto.stock} unidades</p>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    return context.next();
  }
}
