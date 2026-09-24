# OxygeNTools

Sección estática y modular para OxygeNMedia. No requiere backend, Node, build step, Firebase ni framework. La interfaz y el procesamiento de archivos funcionan con HTML, CSS y JavaScript del navegador.

## Contenido

- `index.html`: página principal, SEO básico, carga temprana del tema global y entrada de la aplicación.
- `css/tools.css`: estilos mobile-first; los colores de OxygeNTools se enlazan con variables del tema existente.
- `js/core.js`: utilidades locales, registro de herramientas y carga perezosa de librerías.
- `js/tools.js` y `js/app.js`: catálogo, buscador, navegación y renderizado.
- `js/qr.js`, `image-pdf.js`, `image-compress.js`, `image-convert.js`, `resize.js`, `colors.js`, `palette.js`, `json.js`, `base64.js`, `url.js`, `uuid.js`, `password.js`, `text.js`, `pixel.js`, `extras.js`: herramientas.
- `cloudflare-routes.txt`: reglas de ejemplo para rutas limpias en Cloudflare Pages.

Las URL son `/tools/` y `/tools/<herramienta>/`, por ejemplo `/tools/qr/`, `/tools/image-pdf/`, `/tools/compress/`, `/tools/resize/`, `/tools/colors/`, `/tools/json/` y `/tools/pixel/`. Las otras herramientas siguen el mismo patrón.

## Integración exacta

1. Copia la carpeta `tools/` a la raíz del repositorio de OxygeNMedia. No reemplaces ni muevas archivos existentes.
2. Comprueba que los archivos globales sigan disponibles en el dominio raíz: `/tema-inline.js`, `/temas.js` y `/fuente-inline.js`. `tools/index.html` carga `tema-inline.js` y `fuente-inline.js` sincrónicamente dentro de `<head>`, antes del CSS, y carga `temas.js` con `defer`. No se crean ni sustituyen sistemas de temas o fuentes.
3. Añade al menú existente de OxygeNMedia un enlace normal a `https://oxygenmedia.online/tools/` (o `href="/tools/"`). El botón «← OxygeNMedia» ya vuelve a la portada del dominio.
4. Cloudflare Pages sirve archivos estáticos, pero para que las rutas limpias de las herramientas recarguen sin 404 hay que integrar las reglas de `cloudflare-routes.txt` en el archivo `_redirects` ubicado en la raíz **publicada** del sitio. Si ya tienes `_redirects`, conserva sus reglas y agrega estas rutas antes de una regla catch-all; no sustituyas el archivo completo. Si no existe, créalo en la raíz publicada. Las reglas reescriben solo las rutas enumeradas a `/tools/index.html`; no interceptan CSS ni JavaScript. No se necesitan Workers ni Functions.
5. Asegúrate de que `tools/` esté dentro del directorio de salida que Cloudflare Pages publica. No cambies la configuración de Firebase, autenticación, perfiles, Ox2/Ox3 ni Cloudflare existente.
6. Publica y prueba `/tools/`, una URL de herramienta, una recarga directa, el enlace de regreso, móvil y los botones de descarga. Sin el paso 4, la página principal funciona y la navegación SPA funciona durante la sesión, pero una recarga en una ruta limpia puede responder 404.

### Tema global

Los estilos no importan ni sustituyen `temas.js`. En `css/tools.css`, los tokens `--ot-bg`, `--ot-surface`, `--ot-text`, `--ot-muted`, `--ot-border` y `--ot-accent` leen primero variables CSS comunes del tema de OxygeNMedia y usan un fallback visual si no existen. Si tu implementación publica nombres distintos, modifica **solo las referencias `var(...)` de esos tokens** para apuntar a las variables globales correctas; no dupliques lógica, almacenamiento ni selectores de tema.

### Estructura de rutas

Cada enlace de herramienta es una URL navegable con `history.pushState`; atrás/adelante funciona y `app.js` actualiza title, description y canonical. Cloudflare reescribe las rutas individuales a la misma página estática sin alterar la URL del navegador.

## Librerías y privacidad

Las dependencias se descargan de jsDelivr y se cargan solo al usar la función que las necesita:

| Librería | Uso | Momento de carga |
|---|---|---|
| `qrcode` 1.5.4 | Matriz QR de alta corrección; OxygeNTools dibuja PNG/SVG con los estilos propios | Al escribir texto en QR |
| `jspdf` 2.5.2 | Crear el PDF desde imágenes | Al generar Imagen → PDF |
| `jszip` 3.10.1 | Empaquetar imágenes convertidas en ZIP | Al pedir ZIP |
| `JsBarcode` 3.11.6 | Generar códigos de barras SVG/PNG | Al generar un código |
| `pdf-lib` 1.17.1 | Unir PDF o extraer páginas | Al ejecutar la acción PDF |

No hay telemetría, API propia ni envío de archivos a OxygeNMedia. Imágenes, texto, PDF y contraseñas se procesan localmente. Los navegadores sí descargan el código de las librerías desde jsDelivr cuando el usuario usa esas funciones; como en cualquier CDN, la conexión al CDN puede revelar datos normales de conexión, pero no se le envía el contenido de los archivos. Contraseñas y UUID usan `crypto.getRandomValues()` y `crypto.randomUUID()` cuando está disponible; hashes usan Web Crypto. HTTPS es necesario para las API criptográficas modernas y el portapapeles.

Se mantiene funcionalidad principal sin dependencias externas (incluido el pixel-art). Un error de red al CDN muestra un mensaje comprensible y los datos del usuario no se transmiten con esa solicitud.

## Añadir una herramienta

1. Crea un archivo modular, por ejemplo `js/mi-herramienta.js`, que registre `OxygeNTools.register('mi-herramienta', host => { ... })` y renderice dentro de `host`. Usa `OxygeNTools.esc()` al insertar texto del usuario en HTML y nunca uses `eval()`.
2. Agrega su `<script src="/tools/js/mi-herramienta.js" defer></script>` en `index.html` **antes** de `tools.js` y `app.js`.
3. Agrega su metadata a `OxygeNToolsMeta` y una tarjeta a `OxygeNToolsCatalog` en `js/tools.js`.
4. Agrega dos reglas de ruta a `cloudflare-routes.txt` y al `_redirects` publicado.
5. Usa controles con `<label>`, un mensaje accesible, estado vacío, errores claros y procesamiento local. Si hace falta una dependencia, carga su CDN desde la acción mediante `OxygeNTools.loadScript()`.

## Compatibilidad

Requiere un navegador moderno con Canvas y JavaScript. La compatibilidad de decodificación depende de los formatos que soporte el navegador. Imagen → PDF y herramientas PDF necesitan conexión para descargar su librería la primera vez; las demás herramientas no requieren backend. Las funciones que usan `crypto.subtle`, `crypto.randomUUID` o Clipboard pueden requerir HTTPS. El estado de cada herramienta se mantiene en memoria y no se persiste.
