# Essence Gallery — Catálogo de Perfumes

Sitio estático (HTML + CSS + Bootstrap 5 + JavaScript vanilla) que muestra el catálogo de perfumes de **Essence Gallery**. No es un e-commerce: no hay carrito, pagos ni cuentas de usuario, solo exploración, búsqueda y filtrado.

## Estructura del proyecto

```
/
├── index.html
├── Dockerfile
├── docker-compose.yml
├── netlify.toml
├── css/styles.css
├── js/app.js
├── data/perfumes.js       ← catálogo editable
└── assets/
    ├── logo.png
    ├── Hombre/{Disenador,Arabes,Nicho}/
    └── Mujer/{Disenador,Celebridad,Arabes}/
```

## Ejecutar en local con Docker

```bash
docker compose up -d
```

Luego abre **http://localhost:8090** en tu navegador.

Para detener el contenedor:

```bash
docker compose down
```

## Ejecutar en local sin Docker

Al ser un sitio 100% estático, también puedes abrirlo con cualquier servidor simple, por ejemplo:

```bash
python -m http.server 8000
```

y visitar `http://localhost:8000`.

## Despliegue en Netlify

1. Sube el repositorio a GitHub/GitLab/Bitbucket (o arrastra la carpeta en Netlify).
2. En Netlify, "Add new site" → conecta el repo.
3. Build command: (ninguno). Publish directory: `.` (raíz) — ya definido en `netlify.toml`.
4. Deploy. Netlify servirá `index.html` y todos los assets directamente.

## Agregar un nuevo perfume

1. Coloca la imagen en la subcarpeta correspondiente de `assets/` (por ejemplo `assets/Hombre/Nicho/`).
2. Abre `data/perfumes.js` y agrega un nuevo objeto al arreglo `perfumes`:

```js
{
  "id": 259,
  "name": "Nombre del perfume",
  "brand": "Marca (opcional)",
  "gender": "Hombre",       // "Hombre" o "Mujer"
  "category": "Nicho",      // "Disenador" | "Arabes" | "Nicho" | "Celebridad"
  "image": "assets/Hombre/Nicho/archivo.jpg",
  "priceOriginal": 2500,    // opcional, se muestra tachado
  "pricePromo": 1800,       // opcional, precio destacado
  "description": ""         // opcional
}
```

3. Guarda y refresca la página. No se requiere build ni backend.

## Notas de diseño

- La paleta de colores (`css/styles.css`, sección `:root`) se definió a partir de los tonos del logo: crema, dorado y marrón profundo.
- Los nombres de los perfumes se generaron automáticamente a partir de los nombres de archivo en `assets/`, limpiando tamaño (ml) y concentración (EDP/EDT/EDC).
- **Marca, precios y descripción** se importaron desde `assets/Catalogo_Perfumes.xlsx` (hojas "Hombre" y "Mujer"), cruzando cada fila por el nombre del perfume (columna B) contra el nombre de archivo de imagen correspondiente:
  - `brand` ← columna A (Marca)
  - `priceOriginal` ← columna G (Precio original, se muestra tachado)
  - `pricePromo` ← columna F (Precio al consumidor, precio destacado)
  - `description` ← columna K (Descripción)
  - Si una fila del Excel no tuvo una imagen correspondiente en `assets/`, no se incluyó en el catálogo (no se inventan productos sin imagen).
