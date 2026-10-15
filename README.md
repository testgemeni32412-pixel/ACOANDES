# Recorrido virtual 360° · Institución ACOANDES

Proyecto de integración SENA. Recorrido por los 22 espacios de la Institución ACOANDES en fotografías 360°.

## Estructura

```
acoandes-360/
├── index.html          Estructura de la página
├── css/styles.css      Diseño: fieltro, banderines, animaciones y versión para celular
├── js/rooms.js         Lista de los 22 espacios (nombre, número y zona)
├── js/music.js         Música ambiental generada en el navegador (Web Audio)
├── js/app.js           Lógica del recorrido
├── img/pano/           Fotos 360° (3840×1920) — una por espacio
├── img/thumb/          Miniaturas (320×160)
├── img/logo.png        Escudo recortado en círculo (logo-src.jpg es el original)
└── fonts/              Tipografías Graduate y Atkinson Hyperlegible Next (incluidas)
```

## Publicar en GitHub Pages

1. Sube **todo el contenido de esta carpeta** (no solo `index.html`) a la raíz del repositorio `Recorrido-ACOANDES`. Puedes reemplazar el `index.html` anterior.
2. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. En uno o dos minutos queda en `https://<tu-usuario>.github.io/Recorrido-ACOANDES/`.

## Probarlo en tu computador

Los navegadores bloquean las fotos 360° si abres `index.html` con doble clic (como archivo). Usa un servidor local:

- **VS Code:** instala la extensión *Live Server*, haz clic derecho en `index.html` → *Open with Live Server*.
- **Node.js:** desde esta carpeta, ejecuta `npx http-server -p 5173` y abre `http://localhost:5173`.

## Qué hace cada parte

- **Izada de bandera (pantalla de carga):** el escudo sube por el asta a medida que se descarga la primera foto. El porcentaje es real.
- **Bienvenida:** panel de fieltro sobre la foto 360° que ya está girando. El botón «Entrar al recorrido» arranca la música (los navegadores solo permiten sonido después de un clic).
- **Guirnalda de banderines:** un banderín por espacio, con su número. Azul = exteriores, girasol = zonas comunes, violeta = aulas. Los no visitados se ven punteados y se rellenan al visitarlos (se recuerda en el navegador).
- **Banda del espacio actual:** al cambiar de espacio, la banda baja y vuelve a subir con el nuevo nombre.
- **Controles:** índice con buscador y filtros, anterior/siguiente, recorrido guiado (avanza solo cada 16 s), rotación automática, centrar vista y, en celular, mirar moviendo el teléfono.
- **Música:** `js/music.js` compone en tiempo real un fondo chill (acordes suaves, bajo, piano eléctrico con eco y un leve crujido de vinilo). No usa archivos, así que es 100 % libre de derechos. Cambia de acordes según la zona. El botón de barras arriba a la derecha la silencia; la preferencia se recuerda.
- **Al visitar los 22 espacios** aparece una celebración con banderines de colores.
- **Enlaces directos:** cada espacio tiene su dirección, por ejemplo `.../#biblioteca`.

## Atajos de teclado

| Tecla | Acción |
|---|---|
| ← → | Cambiar de espacio |
| I | Índice de espacios |
| G | Recorrido guiado |
| Espacio | Rotación automática |
| R | Centrar la vista |
| M | Música |
| F | Pantalla completa |

## Cambiar o agregar espacios

1. Copia la foto 360° (formato equirectangular 2:1) en `img/pano/<id>.jpg` y una miniatura en `img/thumb/<id>.jpg`.
2. Agrega una línea en `js/rooms.js` con el mismo `id`, el número, el nombre y la zona (`Accesos y exteriores`, `Zonas comunes` o `Aulas`).
3. Si cambias la cantidad de espacios, actualiza los textos «22 espacios» y la leyenda de `index.html`.

## Créditos técnicos

HTML5, CSS3, JavaScript, [Pannellum](https://pannellum.org) 2.5.6 (visor 360°, licencia MIT), Web Audio API. Tipografías Graduate y Atkinson Hyperlegible Next (SIL Open Font License).
