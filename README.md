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
  "id": 257,
  "name": "Nombre del perfume",
  "brand": "Marca (opcional)",
  "gender": "Hombre",       // "Hombre" o "Mujer"
  "category": "Nicho",      // "Disenador" | "Arabes" | "Nicho" | "Celebridad"
  "image": "assets/Hombre/Nicho/archivo.jpg",
  "description": ""         // opcional
}
```

3. Guarda y refresca la página. No se requiere build ni backend.

## Notas de diseño

- La paleta de colores (`css/styles.css`, sección `:root`) se definió a partir de los tonos del logo: crema, dorado y marrón profundo.
- Los nombres de los perfumes se generaron automáticamente a partir de los nombres de archivo en `assets/`, limpiando tamaño (ml) y concentración (EDP/EDT/EDC). La marca se asignó solo cuando se pudo inferir con confianza a partir del nombre de la línea; cuando no fue posible, se deja sin marca (no se inventa información).
