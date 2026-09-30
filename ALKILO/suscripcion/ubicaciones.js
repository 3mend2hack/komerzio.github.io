/* ============================================================
   ALKILO - Ubicaciones de Cuba
   Provincias y municipios oficiales (15 + Isla de la Juventud)
   ============================================================ */

/** Lista de las 16 provincias de Cuba */
const LISTA_PROVINCIAS = [
  "Pinar del Río",
  "Artemisa",
  "La Habana",
  "Mayabeque",
  "Matanzas",
  "Villa Clara",
  "Cienfuegos",
  "Sancti Spíritus",
  "Ciego de Ávila",
  "Camagüey",
  "Las Tunas",
  "Holguín",
  "Granma",
  "Santiago de Cuba",
  "Guantánamo",
  "Isla de la Juventud"
];

/** Mapa de provincia → array de municipios */
const MUNICIPIOS_POR_PROVINCIA = {
  "Pinar del Río": [
    "Consolación del Sur", "Guane", "La Palma", "Los Palacios",
    "Mantua", "Minas de Matahambre", "Pinar del Río", "San Juan y Martínez",
    "San Luis", "Sandino", "Viñales"
  ],
  "Artemisa": [
    "Alquízar", "Artemisa", "Bauta", "Caimito", "Candelaria",
    "Guanajay", "Güira de Melena", "Mariel", "San Antonio de los Baños",
    "San Cristóbal", "Bahía Honda"
  ],
  "La Habana": [
    "Arroyo Naranjo", "Boyeros", "Centro Habana", "Cerro", "Cotorro",
    "Diez de Octubre", "Guanabacoa", "Habana del Este", "Habana Vieja",
    "La Lisa", "Marianao", "Playa", "Plaza de la Revolución",
    "Regla", "San Miguel del Padrón"
  ],
  "Mayabeque": [
    "Batabanó", "Bejucal", "Güines", "Jaruco", "Madruga",
    "Melena del Sur", "Nueva Paz", "Quivicán", "San José de las Lajas",
    "San Nicolás", "Santa Cruz del Norte"
  ],
  "Matanzas": [
    "Calimete", "Cárdenas", "Ciénaga de Zapata", "Colón", "Jagüey Grande",
    "Jovellanos", "Limonar", "Los Arabos", "Martí", "Matanzas",
    "Pedro Betancourt", "Perico", "Unión de Reyes"
  ],
  "Villa Clara": [
    "Caibarién", "Camajuaní", "Cifuentes", "Corralillo", "Encrucijada",
    "Manicaragua", "Placetas", "Quemado de Güines", "Ranchuelo",
    "Remedios", "Sagua la Grande", "Santa Clara", "Santo Domingo"
  ],
  "Cienfuegos": [
    "Abreus", "Aguada de Pasajeros", "Cienfuegos", "Cruces",
    "Cumanayagua", "Lajas", "Palmira", "Rodas"
  ],
  "Sancti Spíritus": [
    "Cabaiguán", "Fomento", "Jatibonico", "La Sierpe",
    "Sancti Spíritus", "Taguasco", "Trinidad", "Yaguajay"
  ],
  "Ciego de Ávila": [
    "Baraguá", "Bolivia", "Chambas", "Ciego de Ávila",
    "Ciro Redondo", "Florencia", "Majagua", "Morón",
    "Primero de Enero", "Venezuela"
  ],
  "Camagüey": [
    "Camagüey", "Carlos M. de Céspedes", "Esmeralda", "Florida",
    "Guáimaro", "Jimaguayú", "Minas", "Najasa", "Nuevitas",
    "Santa Cruz del Sur", "Sibanicú", "Sierra de Cubitas", "Vertientes"
  ],
  "Las Tunas": [
    "Amancio", "Colombia", "Jesús Menéndez", "Jobabo",
    "Las Tunas", "Majibacoa", "Manatí", "Puerto Padre"
  ],
  "Holguín": [
    "Antilla", "Báguanos", "Banes", "Cacocum", "Calixto García",
    "Cueto", "Frank País", "Gibara", "Holguín", "Mayarí",
    "Moa", "Rafael Freyre", "Sagua de Tánamo", "Urbano Noris"
  ],
  "Granma": [
    "Bartolomé Masó", "Bayamo", "Buey Arriba", "Campechuela",
    "Cauto Cristo", "Guisa", "Jiguaní", "Manzanillo",
    "Media Luna", "Niquero", "Pilón", "Río Cauto", "Yara"
  ],
  "Santiago de Cuba": [
    "Contramaestre", "Guamá", "Mella", "Palma Soriano",
    "San Luis", "Santiago de Cuba", "Segundo Frente",
    "Songo-La Maya", "Tercer Frente"
  ],
  "Guantánamo": [
    "Baracoa", "Caimanera", "El Salvador", "Guantánamo",
    "Imías", "Maisí", "Manuel Tames", "Niceto Pérez",
    "San Antonio del Sur", "Yateras"
  ],
  "Isla de la Juventud": [
    "Isla de la Juventud"
  ]
};

/** Devuelve el array de municipios de una provincia */
function obtenerMunicipios(provincia) {
  if (!provincia) return [];
  return MUNICIPIOS_POR_PROVINCIA[provincia] || [];
}

/** Valida que una combinación provincia/municipio sea real */
function esUbicacionValida(provincia, municipio) {
  if (!provincia || !municipio) return false;
  if (!LISTA_PROVINCIAS.includes(provincia)) return false;
  const muns = MUNICIPIOS_POR_PROVINCIA[provincia] || [];
  return muns.includes(municipio);
}

/** Devuelve la provincia de un municipio (búsqueda inversa) */
function provinciaDeMunicipio(municipio) {
  if (!municipio) return null;
  for (const prov in MUNICIPIOS_POR_PROVINCIA) {
    if (MUNICIPIOS_POR_PROVINCIA[prov].includes(municipio)) return prov;
  }
  return null;
}