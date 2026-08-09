// functions/producto.html.js
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const productId = url.searchParams.get('id') || url.searchParams.get('p');
  const userAgent = request.headers.get('user-agent') || '';
  
  // Detectar si es un bot de WhatsApp, Facebook, Twitter, Telegram, etc.
  const isBot = userAgent.includes('WhatsApp') ||
    userAgent.includes('Facebook') ||
    userAgent.includes('Twitterbot') ||
    userAgent.includes('TelegramBot') ||
    userAgent.includes('facebookexternalhit') ||
    userAgent.includes('LinkedInBot') ||
    userAgent.includes('Slackbot') ||
    userAgent.includes('Pinterest') ||
    userAgent.includes('Discordbot');
  
  // 🔥 CREDENCIALES CORRECTAS (USANDO TU SUPABASE)
  const SUPABASE_URL = 'https://ehlebvmalatsdyvopvkn.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVobGVidm1hbGF0c2R5dm9wdmtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMjg2MjAsImV4cCI6MjA5OTYwNDYyMH0.lsV-x6y3e-0fbdUqb--_CVi8c1gUhO4MUoo1grq66ZI';
  
  // Si no es un bot o no hay ID, servir la página normal
  if (!isBot || !productId) {
    return context.next();
  }
  
  try {
    // Consulta DIRECTA a la tabla productos (sin RPC)
    const supabaseResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/productos?id=eq.${productId}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
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
    
    // 🔥 OPTIMIZAR IMAGEN PARA WHATSAPP
    let imagenUrl = producto.imagen_url || 'https://komerzio.dpdns.org/assets/images/komerzio.png';
    
    // Si la imagen es de Supabase, asegurarse que sea pública
    if (imagenUrl.includes('supabase.co')) {
      // Usar la URL directamente (debe ser pública)
      imagenUrl = imagenUrl;
    }
    
    // ✅ HTML COMPLETO CON META TAGS PARA WHATSAPP
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- Título -->
    <title>${producto.nombre} | KOMERZIO</title>
    
    <!-- Meta tags para WhatsApp / Facebook -->
    <meta property="og:title" content="${producto.nombre} | KOMERZIO">
    <meta property="og:description" content="💰 $${parseFloat(precioActual).toFixed(2)} USD | 📦 Stock: ${producto.stock || 0} unidades | 🚚 Envío en Sagua de Tánamo">
    <meta property="og:image" content="${imagenUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:url" content="https://komerzio.dpdns.org/producto.html?id=${productId}">
    <meta property="og:type" content="product">
    <meta property="og:site_name" content="KOMERZIO">
    
    <!-- Twitter Cards -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${producto.nombre} | KOMERZIO">
    <meta name="twitter:description" content="💰 $${parseFloat(precioActual).toFixed(2)} USD | 📦 Stock: ${producto.stock || 0} unidades">
    <meta name="twitter:image" content="${imagenUrl}">
    
    <!-- Redirección automática a la página real (para que el usuario vea el producto) -->
    <meta http-equiv="refresh" content="0; url=https://komerzio.dpdns.org/producto.html?id=${productId}">
    
    <!-- Estilos mínimos para vista previa -->
    <style>
        body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px; 
            background: #f0f2f5;
            margin: 0;
        }
        .product-preview {
            max-width: 500px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            padding: 30px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .product-preview img {
            max-width: 100%;
            max-height: 300px;
            object-fit: contain;
            border-radius: 8px;
        }
        .product-preview h1 { 
            font-size: 24px; 
            color: #0f172a; 
            margin: 15px 0; 
        }
        .product-preview .price { 
            font-size: 28px; 
            color: #dc2626; 
            font-weight: bold; 
        }
        .product-preview .stock { 
            color: #16a34a; 
            margin: 10px 0; 
        }
        .product-preview .btn {
            display: inline-block;
            background: #f97316;
            color: white;
            padding: 12px 30px;
            border-radius: 30px;
            text-decoration: none;
            font-weight: bold;
            margin-top: 15px;
        }
        .product-preview .btn:hover {
            background: #ea580c;
        }
    </style>
</head>
<body>
    <div class="product-preview">
        <img src="${imagenUrl}" alt="${producto.nombre}" onerror="this.src='https://komerzio.dpdns.org/assets/images/komerzio.png'">
        <h1>${producto.nombre}</h1>
        <div class="price">$${parseFloat(precioActual).toFixed(2)} USD</div>
        <div class="stock">📦 Stock: ${producto.stock || 0} unidades</div>
        <p style="color: #64748b;">🚚 Envío en Sagua de Tánamo</p>
        <a href="https://komerzio.dpdns.org/producto.html?id=${productId}" class="btn">Ver producto →</a>
    </div>
</body>
</html>`;
    
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      }
    });
    
  } catch (error) {
    console.error('Worker error:', error);
    return context.next();
  }
}
