const https = require('https');
const fs = require('fs');

const SUPABASE_URL = 'https://houfrgnlctliwkzzelmi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvdWZyZ25sY3RsaXdrenplbG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MTQ2OTMsImV4cCI6MjA5NjE5MDY5M30.zUfcA755LEjBbn-N05LrmwFqsOFITRP4qLzxjgPIy54';

function fetchData(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    };
    
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function generateSitemap() {
  console.log('🚀 Generando sitemap...');
  
  try {
    // Obtener productos
    const productos = await fetchData(`${SUPABASE_URL}/rest/v1/productos?select=id,nombre,updated_at&estado=eq.activo`);
    console.log(`📦 ${productos.length} productos encontrados`);
    
    // Generar XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;
    
    // Productos
    for (const producto of productos) {
      const fecha = producto.updated_at ? new Date(producto.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      xml += `
    <url>
        <loc>https://komerzio.dpdns.org/producto.html?id=${producto.id}</loc>
        <lastmod>${fecha}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
    </url>`;
    }
    
    // Categorías
    const categorias = ['ofertas', 'Electrónica', 'Ropa', 'Hogar', 'Accesorios', 'Consumibles', 'Limpieza', 'Deportes', 'Juguetes', 'Salud', 'Alimentos'];
    for (const cat of categorias) {
      const prioridad = cat === 'ofertas' ? 0.9 : 0.8;
      xml += `
    <url>
        <loc>https://komerzio.dpdns.org/categoria.html?cat=${encodeURIComponent(cat)}</loc>
        <changefreq>daily</changefreq>
        <priority>${prioridad}</priority>
    </url>`;
    }
    
    // Páginas
    const paginas = [
      { url: '/', prioridad: 1.0, freq: 'daily' },
      { url: '/index.html', prioridad: 1.0, freq: 'daily' },
      { url: '/buscar.html', prioridad: 0.7, freq: 'weekly' },
      { url: '/novedades.html', prioridad: 0.7, freq: 'daily' },
      { url: '/ofertas-especiales.html', prioridad: 0.9, freq: 'daily' },
      { url: '/destacados.html', prioridad: 0.8, freq: 'daily' },
      { url: '/sobre-nosotros.html', prioridad: 0.5, freq: 'monthly' },
      { url: '/terminos.html', prioridad: 0.3, freq: 'yearly' },
      { url: '/privacidad.html', prioridad: 0.3, freq: 'yearly' },
      { url: '/faq.html', prioridad: 0.5, freq: 'monthly' },
      { url: '/contacto.html', prioridad: 0.5, freq: 'monthly' }
    ];
    
    const hoy = new Date().toISOString().split('T')[0];
    for (const page of paginas) {
      xml += `
    <url>
        <loc>https://komerzio.dpdns.org${page.url}</loc>
        <lastmod>${hoy}</lastmod>
        <changefreq>${page.freq}</changefreq>
        <priority>${page.prioridad}</priority>
    </url>`;
    }
    
    xml += `
</urlset>`;
    
    // Guardar archivo
    fs.writeFileSync('sitemap.xml', xml);
    console.log(`✅ Sitemap guardado como sitemap.xml`);
    console.log(`📊 Total: ${productos.length} productos + ${categorias.length} categorías + ${paginas.length} páginas`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

generateSitemap();