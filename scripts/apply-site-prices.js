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
    .replace(/club\s+the\s+nuit/g, 'club de nuit')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Quita la marca del inicio del nombre del perfume si ya viene repetida ahí
// (ej. Marca "Halloween", Perfume "Halloween Mystery 125ml edp" -> "Mystery 125ml edp").
function stripLeadingBrand(brand, name) {
  const normBrand = normalize(brand);
  const normName = normalize(name);
  if (normBrand && normName.startsWith(normBrand + ' ')) {
    return name.slice(brand.length).trim();
  }
  return name;
}

function coreName(name) {
  return normalize(name)
    .replace(/\b\d+\s*ml\b/g, '')
    .replace(/\b(edt|edp|edc|parfum|extrait|elixir)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Colapsa todos los espacios - sirve para calzar variantes como "9am" vs "9 am".
function squash(name) {
  return coreName(name).replace(/\s+/g, '');
}

// Combina marca + nombre sin duplicar la marca si el nombre ya la incluye
// (ej. perfume "Bharara king 100ml edp" con marca "Bharara").
function brandPlusName(brand, name) {
  const normBrand = normalize(brand);
  const normName = normalize(name);
  if (normBrand && normName.startsWith(normBrand)) return name;
  return brand + ' ' + name;
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
const bySquashFull = new Map();
const byNameOnly = new Map();
const siteList = []; // para el respaldo final por "contiene" (substring)

let skippedOutliers = 0;
for (const entry of siteEntries) {
  const original = parseMxn(entry.original);
  if (!original) continue; // sin precio tachado -> no aporta nada, se ignora
  const sale = parseMxn(entry.sale);
  // Sanity check: descuentos normales son ~10%-70%. Si "original" es más de 3x
  // el precio de venta, probablemente es un error de captura (dígito de más, etc).
  if (sale && original > sale * 3) {
    skippedOutliers++;
    continue;
  }
  const { productName, brand } = parseSiteName(entry.name);
  const combined = brandPlusName(brand, productName);
  const keyFull = coreName(combined);
  const keySquash = squash(combined);
  const keyNameOnly = coreName(productName);

  if (!byBrandAndName.has(keyFull)) byBrandAndName.set(keyFull, original);
  if (!bySquashFull.has(keySquash)) bySquashFull.set(keySquash, original);
  if (!byNameOnly.has(keyNameOnly)) byNameOnly.set(keyNameOnly, []);
  byNameOnly.get(keyNameOnly).push({ brand, original });
  siteList.push({ brand: normalize(brand), nameKey: keyNameOnly, original });
}

console.log(`[apply-site-prices] ${siteEntries.length} resultados leídos del sitio, ${byBrandAndName.size} con precio tachado único por marca+nombre.`);
console.log(`[apply-site-prices] Outliers descartados (original > 3x el precio de venta, probable error de captura): ${skippedOutliers}`);

// ---- 2. Leer el Excel y actualizar la columna Precio original ----
const wb = XLSX.readFile(EXCEL_PATH);

let totalRows = 0;
let matched = 0;
let clearedNoMatch = 0;
const unmatchedSample = [];
const methodCounts = {};

for (const sheetName of ['Hombre', 'Mujer']) {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) continue;
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  for (const row of rows) {
    totalRows++;
    const marca = String(row['Marca'] || '').trim();
    const perfume = String(row['Perfume'] || '').trim();
    if (!perfume) continue;

    const combined = brandPlusName(marca, perfume);
    const keyFull = coreName(combined);
    let found = byBrandAndName.get(keyFull);
    let method = 'exact';

    if (!found) {
      found = bySquashFull.get(squash(combined));
      method = 'squash';
    }

    const perfumeNoBrand = stripLeadingBrand(marca, perfume);

    if (!found) {
      const keyNameOnly = coreName(perfumeNoBrand);
      const candidates = byNameOnly.get(keyNameOnly);
      if (candidates && candidates.length) {
        const brandMatch = candidates.find(c => normalize(c.brand).includes(normalize(marca)) || normalize(marca).includes(normalize(c.brand)));
        found = (brandMatch || candidates[0]).original;
        method = 'name-only';
      }
    }

    if (!found) {
      // Ultimo respaldo: nombre del excel "contenido" en el nombre del sitio
      // (o viceversa), siempre que la marca coincida. Cubre casos como
      // "Tyrant" (excel) vs "Odyssey Tyrant" (sitio).
      const normMarca = normalize(marca);
      const keyNameOnly = coreName(perfumeNoBrand);
      if (keyNameOnly.length >= 4) {
        const candidate = siteList.find(s =>
          (normMarca.includes(s.brand) || s.brand.includes(normMarca)) &&
          (s.nameKey.includes(keyNameOnly) || keyNameOnly.includes(s.nameKey))
        );
        if (candidate) {
          found = candidate.original;
          method = 'substring';
        }
      }
    }

    if (found) {
      row['Precio original'] = found;
      matched++;
      methodCounts[method] = (methodCounts[method] || 0) + 1;
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
console.log('[apply-site-prices] Por método:', methodCounts);
console.log(`[apply-site-prices] Sin coincidencia (dejadas en blanco): ${clearedNoMatch}`);
console.log('[apply-site-prices] Ejemplos sin coincidencia:');
unmatchedSample.forEach(u => console.log('  - ' + u));
