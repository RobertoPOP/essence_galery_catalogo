#!/usr/bin/env node
// Genera web/js/products.js a partir de:
//   - web/Catalogo_Perfumes.xlsx (precios, marca, tipo, descripcion)
//   - las imagenes dentro de web/assets/Hombre y web/assets/Mujer
//   - scripts/notes-db.json (notas olfativas ya investigadas, por nombre de producto)
//
// Uso: node scripts/build-products.js
// (Netlify lo corre automaticamente en cada deploy, ver netlify.toml)

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.join(__dirname, '..');
const EXCEL_PATH = path.join(ROOT, 'web', 'Catalogo_Perfumes.xlsx');
const ASSETS_ROOT = path.join(ROOT, 'web', 'assets');
const NOTES_DB_PATH = path.join(__dirname, 'notes-db.json');
const OUTPUT_PATH = path.join(ROOT, 'web', 'js', 'products.js');

const ACRONYMS = new Set(['vip', 'ck', 'ch', 'mp', 'ysl', 'jpg', 'ba', 'ha', 'mas', 'dkny', 'edp', 'edt', 'edc']);
const TIPO_TO_LINE = { 'Árabe': 'Arabes', 'Diseñador': 'Disenador', 'Nicho': 'Nicho', 'Celebridad': 'Celebridad' };

function normalize(s) {
  return (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function stripSizeToken(name) {
  return name.replace(/\(?\d{2,3}\s*m?l\)?/gi, '').replace(/\s+/g, ' ').trim();
}

function fixKnownTypos(name) {
  return name.replace(/club\s+the\s+nuit/i, 'Club de Nuit');
}

function coreName(name) {
  return normalize(name)
    .replace(/\b\d+\s*ml\b/g, '')
    .replace(/\b(edt|edp|edc|parfum|extrait|elixir)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCaseWord(word) {
  if (/\d/.test(word)) return word;
  const lower = word.toLowerCase();
  if (ACRONYMS.has(lower)) return word.toUpperCase();
  if (word.startsWith('(') && word.endsWith(')')) return '(' + titleCaseWord(word.slice(1, -1)) + ')';
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function toDisplayName(rawBase) {
  return fixKnownTypos(stripSizeToken(rawBase))
    .split(/\s+/)
    .map(titleCaseWord)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripExt(filename) {
  return filename.slice(0, -path.extname(filename).length);
}

function readExcelRows() {
  const wb = XLSX.readFile(EXCEL_PATH);
  const rows = [];
  for (const sheetName of ['Hombre', 'Mujer']) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const sheetRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    for (const r of sheetRows) {
      const perfume = String(r['Perfume'] || '').trim();
      if (!perfume) continue;
      rows.push({
        sheet: sheetName,
        marca: String(r['Marca'] || '').trim(),
        perfume,
        tipo: String(r['Tipo'] || '').trim(),
        precioMenudeo: r['Precio menudeo'] !== '' ? Number(r['Precio menudeo']) : null,
        precioMayoreo: r['Precio mayoreo'] !== '' ? Number(r['Precio mayoreo']) : null,
        precioConsumidor: r['Precio al consumidor'] !== '' ? Number(r['Precio al consumidor']) : null,
        precioOriginal: r['Precio original'] !== '' ? Number(r['Precio original']) : null,
        descripcion: String(r['Descripción'] || r['Descripcion'] || '').trim() || null,
      });
    }
  }
  return rows;
}

function scanImages() {
  const products = [];
  for (const gender of ['Hombre', 'Mujer']) {
    const genderDir = path.join(ASSETS_ROOT, gender);
    if (!fs.existsSync(genderDir)) continue;
    const lines = fs.readdirSync(genderDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const line of lines) {
      const dir = path.join(genderDir, line);
      const files = fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png|webp|avif)$/i.test(f));
      files.sort((a, b) => a.localeCompare(b, 'es'));
      for (const f of files) {
        const rawTitle = stripExt(f);
        products.push({
          name: toDisplayName(rawTitle),
          gender,
          line,
          image: `assets/${gender}/${line}/${f}`,
          file: f,
          rawMatchName: rawTitle,
        });
      }
    }
  }
  return products;
}

// Si el mismo producto (mismo nombre de archivo sin talla) aparece en más de una
// carpeta del mismo género (ej. subido dos veces por error, o en la categoría
// equivocada), nos quedamos con la copia cuya carpeta coincide con el "Tipo"
// del Excel, y avisamos por consola de las demás para que se puedan limpiar.
function resolveDuplicateFolders(images, excelRows) {
  const excelTipoByKey = new Map();
  for (const r of excelRows) {
    const key = normalize(r.perfume);
    if (!excelTipoByKey.has(key)) excelTipoByKey.set(key, r.tipo);
  }

  const byGenderKey = new Map();
  for (const img of images) {
    const key = img.gender + '|' + normalize(img.rawMatchName);
    if (!byGenderKey.has(key)) byGenderKey.set(key, []);
    byGenderKey.get(key).push(img);
  }

  const resolved = [];
  for (const group of byGenderKey.values()) {
    if (group.length === 1) {
      resolved.push(group[0]);
      continue;
    }
    const excelTipo = excelTipoByKey.get(normalize(group[0].rawMatchName));
    const expectedLine = TIPO_TO_LINE[excelTipo];
    const correct = group.find(g => g.line === expectedLine);
    const chosen = correct || group[0];
    resolved.push(chosen);
    console.warn(
      `[build-products] Aviso: "${chosen.rawMatchName}" (${chosen.gender}) aparece en ${group.length} carpetas (${group.map(g => g.line).join(', ')}).` +
      (correct ? ` Se usó "${chosen.line}" (coincide con el Excel).` : ' Ninguna coincide con el Excel, revisa manualmente.')
    );
    for (const dup of group) {
      if (dup !== chosen) console.warn(`  -> Ignorado: ${dup.image}`);
    }
  }
  return resolved;
}

function buildExcelMatchMaps(excelRows) {
  const exactMap = new Map();
  const strippedMap = new Map();
  for (const r of excelRows) {
    const exactKey = normalize(r.perfume);
    if (!exactMap.has(exactKey)) exactMap.set(exactKey, []);
    exactMap.get(exactKey).push(r);

    const strippedKey = normalize(stripSizeToken(r.perfume));
    if (!strippedMap.has(strippedKey)) strippedMap.set(strippedKey, []);
    strippedMap.get(strippedKey).push(r);
  }
  return { exactMap, strippedMap };
}

function findExcelMatch(product, maps, excelRows) {
  const exactKey = normalize(product.rawMatchName);
  let candidates = maps.exactMap.get(exactKey);

  if (!candidates) {
    const strippedKey = normalize(stripSizeToken(product.rawMatchName));
    candidates = maps.strippedMap.get(strippedKey);
  }

  if (candidates && candidates.length) {
    const sheetMatch = candidates.find(c => c.sheet === product.gender);
    return sheetMatch || candidates[0];
  }

  // Fallback: nombre de archivo con la marca pegada al inicio, ej. "Bharara king 100ml edp"
  const brands = [...new Set(excelRows.map(r => r.marca))].sort((a, b) => b.length - a.length);
  for (const brand of brands) {
    if (!brand) continue;
    if (product.rawMatchName.toLowerCase().startsWith(brand.toLowerCase() + ' ')) {
      const rest = product.rawMatchName.slice(brand.length).trim();
      const restCandidates = maps.exactMap.get(normalize(rest));
      if (restCandidates) {
        const match = restCandidates.find(r => normalize(r.marca) === normalize(brand));
        if (match) return match;
      }
    }
  }

  return null;
}

function loadNotesDb() {
  if (!fs.existsSync(NOTES_DB_PATH)) return {};
  return JSON.parse(fs.readFileSync(NOTES_DB_PATH, 'utf-8'));
}

function findNotes(product, brand, notesDb) {
  const key = coreName(product.name);
  if (notesDb[key]) return notesDb[key];
  if (brand) {
    const brandNorm = normalize(brand);
    if (key.startsWith(brandNorm + ' ')) {
      const altKey = key.slice(brandNorm.length).trim();
      if (notesDb[altKey]) return notesDb[altKey];
    }
  }
  return null;
}

function main() {
  const excelRows = readExcelRows();
  const rawImages = scanImages();
  const images = resolveDuplicateFolders(rawImages, excelRows);
  const matchMaps = buildExcelMatchMaps(excelRows);
  const notesDb = loadNotesDb();

  let id = 1;
  const noPriceMatch = [];
  const noNotesMatch = [];

  const products = images.map(img => {
    const match = findExcelMatch(img, matchMaps, excelRows);
    if (!match) noPriceMatch.push(`${img.rawMatchName} (${img.gender}/${img.line})`);
    const notes = findNotes(img, match ? match.marca : null, notesDb);
    if (!notes) noNotesMatch.push(img.name);

    return {
      id: id++,
      name: img.name,
      gender: img.gender,
      line: img.line,
      image: img.image,
      file: img.file,
      rawMatchName: img.rawMatchName,
      brand: match ? match.marca || null : null,
      priceMenudeo: match ? match.precioMenudeo : null,
      priceMayoreo: match ? match.precioMayoreo : null,
      priceConsumidor: match ? match.precioConsumidor : null,
      priceOriginal: match ? match.precioOriginal : null,
      excelTipo: match ? match.tipo || null : null,
      notes: notes || null,
      description: match ? match.descripcion : null,
    };
  });

  const header =
    '// ARCHIVO GENERADO AUTOMÁTICAMENTE por scripts/build-products.js — no lo edites a mano.\n' +
    '// Para actualizar el catálogo: edita Catalogo_Perfumes.xlsx y/o las imágenes en web/assets,\n' +
    '// y sube los cambios a GitHub. Netlify vuelve a correr este script en cada deploy.\n';
  const out = header + 'const PRODUCTS = ' + JSON.stringify(products, null, 2) + ';\n';
  fs.writeFileSync(OUTPUT_PATH, out, 'utf-8');

  console.log(`\n[build-products] Generados ${products.length} productos en web/js/products.js`);
  console.log(`[build-products] Sin coincidencia de precio en el Excel: ${noPriceMatch.length}`);
  noPriceMatch.forEach(n => console.log('  - ' + n));
  console.log(`[build-products] Sin notas olfativas: ${noNotesMatch.length}`);
  if (noNotesMatch.length) {
    console.log('  (son productos nuevos; hay que investigar sus notas y agregarlas a scripts/notes-db.json)');
    noNotesMatch.forEach(n => console.log('  - ' + n));
  }
}

main();
