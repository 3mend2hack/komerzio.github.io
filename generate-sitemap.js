// generate-sitemap.js
// Now reads credentials from environment variables. Do NOT store secrets in the repo.

require('dotenv').config();
const https = require('https');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY; // service_role or anon depending on usage (prefer service role for server scripts)
const DOMAIN = process.env.DOMAIN || 'https://komerzio.dpdns.org';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_KEY must be set in environment (or .env file).');
  process.exit(1);
}

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
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

    // Productos
    for (const producto of productos) {
      const fecha = producto.updated_at ? new Date(producto.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      xml += `\n    <url>\n        <loc>${DOMAIN}/producto.html?id=${producto.id}</loc>\n        <lastmod>${fecha}</lastmod>\n        <changefreq>weekly</changefreq>\n        <priority>0.7</priority>\n    </url>`;
    }

    // Categorías
    const categorias = ['ofertas', 'Electrónica', 'Ropa', 'Hogar', 'Accesorios', 'Consumibles', 'Limpieza', 'Deportes', 'Juguetes', 'Salud', 'Alimentos'];
    for (const cat of categorias) {
      const prioridad = cat === 'ofertas' ? 0.9 : 0.8;
      xml += `\n    <url>\n        <loc>${DOMAIN}/categoria.html?cat=${encodeURIComponent(cat)}</loc>\n        <changefreq>daily</changefreq>\n        <priority>${prioridad}</priority>\n    </url>`;
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
      xml += `\n    <url>\n        <loc>${DOMAIN}${page.url}</loc>\n        <lastmod>${hoy}</lastmod>\n        <changefreq>${page.freq}</changefreq>\n        <priority>${page.prioridad}</priority>\n    </url>`;
    }

    xml += `\n</urlset>`;

    // Guardar archivo
    fs.writeFileSync('sitemap.xml', xml);
    console.log(`✅ Sitemap guardado como sitemap.xml`);
    console.log(`📊 Total: ${productos.length} productos + ${categorias.length} categorías + ${paginas.length} páginas`);

  } catch (error) {
    console.error('❌ Error:', error.message || error);
    process.exit(1);
  }
}

generateSitemap();
