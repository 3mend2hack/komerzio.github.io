// ============================================
// meta-tags.js - Configuración SEO para todas las páginas
// ============================================

export const metaConfig = {
  default: {
    title: 'KOMERZIO · Tienda online Para Cuba',
    description: 'Compra productos en Sagua de Tánamo y toda Cuba. Ropa, electrónica, hogar y más. Vendedores locales verificados.',
    keywords: 'KOMERZIO, tienda online, Sagua de Tánamo, comprar en Cuba, productos Cuba, vendedores locales',
    image: 'https://komerzio.dpdns.org/assets/images/komerzio.png'
  },
  '/producto-vendedor.html': {
    title: ' producto en KOMERZIO',
    description: 'Compra este producto de un vendedor local en Sagua de Tánamo. Pago contra entrega.',
  },
  '/mi-cuenta.html': {
    title: 'Mi cuenta · KOMERZIO',
    description: 'Gestiona tu perfil, pedidos y tienda en KOMERZIO.',
    noindex: true
  },
  '/admin/': {
    noindex: true
  }
};

export function generarMetaTags(path, data = {}) {
  let config = metaConfig.default;
  
  for (const [ruta, conf] of Object.entries(metaConfig)) {
    if (path.includes(ruta)) {
      config = { ...config, ...conf };
      break;
    }
  }
  
  let titulo = config.title;
  let descripcion = config.description;
  
  if (data.producto) {
    titulo = titulo.replace(' producto', ` ${data.producto.nombre}`);
    descripcion = descripcion.replace('este producto', `${data.producto.nombre} por $${data.producto.precio}`);
  }
  
  return {
    title: titulo,
    description: descripcion,
    keywords: config.keywords,
    image: config.image,
    noindex: config.noindex || false
  };
}