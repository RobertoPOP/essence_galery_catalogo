// Cruza los precios extraídos de nuestrasfragancias.com (site-prices.ndjson)
// con Catalogo_Perfumes.xlsx y escribe la columna "Precio original".
// Los perfumes sin coincidencia (o sin precio tachado en el sitio) quedan en blanco.
//
// Uso: node apply-site-prices.js <ruta-al-ndjson>

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const EXCEL_PATH = path.join(__dirname, '..', 'web', 'Catalogo_Perfumes.xlsx');
const ndjsonPath = process.argv[2];

if (!ndjsonPath || !fs.existsSync(ndjsonPath)) {
  console.error('Uso: node apply-site-prices.js <ruta-al-ndjson-de-precios>');
  process.exit(1);
}

function normalize(s) {
  return (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function coreName(name) {
  return normalize(name)
    .replace(/\b\d+\s*ml\b/g, '')
    .replace(/\b(edt|edp|edc|parfum|extrait|elixir)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMxn(str) {
  if (!str) return null;
  const m = str.replace(/,/g, '').match(/(\d+(\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

// ---- 1. Cargar y parsear los resultados del sitio ----
const lines = fs.readFileSync(ndjsonPath, 'utf-8').split(/\r?\n/).filter(Boolean);
const siteEntries = lines.map(l => JSON.parse(l)).filter(e => e.name);

// El nombre del sitio viene como "Nombre – Marca – Talla Concentracion"
// Separamos por "–" (en-dash) para tener nombre + marca por separado.
function parseSiteName(raw) {
  const parts = raw.split('–').map(p => p.trim());
  if (parts.length >= 3) {
    return { productName: parts[0], brand: parts[1], sizeConc: parts.slice(2).join(' ') };
  }
  if (parts.length === 2) {
    return { productName: parts[0], brand: parts[1], sizeConc: '' };
  }
  return { productName: raw, brand: '', sizeConc: '' };
}

// Mapa: coreName(marca + " " + nombre) -> precio original (numero)
// y tambien coreName(nombre solo) como respaldo, por si la marca no calza exacto.
const byBrandAndName = new Map();
const byNameOnly = new Map();

for (const entry of siteEntries) {
  const original = parseMxn(entry.original);
  if (!original) continue; // sin precio tachado -> no aporta nada, se ignora
  const { productName, brand } = parseSiteName(entry.name);
  const keyFull = coreName(brand + ' ' + productName);
  const keyNameOnly = coreName(productName);
  if (!byBrandAndName.has(keyFull)) byBrandAndName.set(keyFull, original);
  if (!byNameOnly.has(keyNameOnly)) byNameOnly.set(keyNameOnly, []);
  byNameOnly.get(keyNameOnly).push({ brand, original });
}

console.log(`[apply-site-prices] ${siteEntries.length} resultados leídos del sitio, ${byBrandAndName.size} con precio tachado único por marca+nombre.`);

// ---- 2. Leer el Excel y actualizar la columna Precio original ----
const wb = XLSX.readFile(EXCEL_PATH);

let totalRows = 0;
let matched = 0;
let clearedNoMatch = 0;
const unmatchedSample = [];

for (const sheetName of ['Hombre', 'Mujer']) {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) continue;
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  for (const row of rows) {
    totalRows++;
    const marca = String(row['Marca'] || '').trim();
    const perfume = String(row['Perfume'] || '').trim();
    if (!perfume) continue;

    const keyFull = coreName(marca + ' ' + perfume);
    let found = byBrandAndName.get(keyFull);

    if (!found) {
      const keyNameOnly = coreName(perfume);
      const candidates = byNameOnly.get(keyNameOnly);
      if (candidates && candidates.length) {
        const brandMatch = candidates.find(c => normalize(c.brand).includes(normalize(marca)) || normalize(marca).includes(normalize(c.brand)));
        found = (brandMatch || candidates[0]).original;
      }
    }

    if (found) {
      row['Precio original'] = found;
      matched++;
    } else {
      row['Precio original'] = '';
      clearedNoMatch++;
      if (unmatchedSample.length < 40) unmatchedSample.push(`${marca} | ${perfume}`);
    }
  }

  const newSheet = XLSX.utils.json_to_sheet(rows);
  wb.Sheets[sheetName] = newSheet;
}

XLSX.writeFile(wb, EXCEL_PATH);

console.log(`[apply-site-prices] Filas totales: ${totalRows}`);
console.log(`[apply-site-prices] Con precio original encontrado: ${matched}`);
console.log(`[apply-site-prices] Sin coincidencia (dejadas en blanco): ${clearedNoMatch}`);
console.log('[apply-site-prices] Ejemplos sin coincidencia:');
unmatchedSample.forEach(u => console.log('  - ' + u));
