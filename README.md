# 🗺️ Maps Scraper & WhatsApp Outreach (Edición Universal 100% Local)

Herramienta de escritorio local para **buscar indiscriminadamente cualquier tipo de comercio, negocio o profesional en Google Maps**, generar **reportes descargables en Excel (`.xlsx`)** y gestionar los prospectos en **secciones dedicadas por búsqueda** con una **grilla interactiva de botones** (Lugar/Maps, Número de Contacto, Página Web, Redes Sociales y Envío de WhatsApp Outreach).

---

## ✨ Características Principales

1. **🔍 Buscador Universal de Google Maps:**
   - Busca cualquier rubro en cualquier ciudad o barrio (*ferreterías, restaurantes, gimnasios, estudios contables, peluquerías, clínicas, talleres, etc.*).
   - Entra automáticamente a la ficha de cada comercio y a su página web (si tiene) para extraer:
     - **Nombre y Rubro/Categoría**
     - **Lugar / Dirección + Link directo a Google Maps**
     - **Número de Contacto (formateado automáticamente para WhatsApp según el país elegido)**
     - **Página Web propia**
     - **Redes Sociales (Instagram, Facebook, TikTok, LinkedIn, X/Twitter) y Emails**
     - **Rating ⭐ y cantidad de reseñas**
2. **📊 Excels Descargables Multicapa:**
   - Genera reportes `.xlsx` con diseño profesional divididos en 4 pestañas:
     1. `Todos los Comercios`
     2. `Con WhatsApp y Teléfono`
     3. `Con Sitio Web Propio`
     4. `Sin Sitio Web (Oportunidad)`
   - Puedes descargar el Excel al terminar la búsqueda, al detenerla a mitad de camino o **en cualquier momento desde cada sección guardada**.
3. **💬 Espacios Dedicados por Sección + WhatsApp Outreach en Grilla:**
   - Cada búsqueda crea automáticamente un **espacio/sección dedicada** (almacenada localmente en `data/database.json`).
   - **Borrado total o individual:** Puedes **borrar una sección entera de búsqueda** con un clic o **borrar contactos individuales** dentro de cada sección.
   - **Grilla de Tarjetas con Botones Interactivos:**
     - 📍 **Botón Lugar / Maps:** Abre la ubicación exacta en Google Maps.
     - 📞 **Botón N° Contacto:** Muestra el teléfono y lo copia al portapapeles con un clic.
     - 🌐 **Botón Página Web:** Abre el sitio web del comercio (o indica si no tiene web).
     - 📸 **Botones de Redes y Canales:** Botones directos a Instagram, Facebook, TikTok, LinkedIn, X y Email.
     - 💬 **Botón Enviar WhatsApp:** Abre WhatsApp con el mensaje personalizado (reemplazando `{nombre}`, `{rubro}`, `{lugar}`, `{web}`) y marca el comercio como **Contactado ✓**.
4. **🖥️ Ejecutable `.exe` Nativo (`MapsScraperOutreach.exe`):**
   - Inicia el servidor local en segundo plano sin consolas negras molestas y abre la aplicación en una ventana dedicada tipo app de escritorio.

---

## 💻 Paso a Paso: Cómo Instalar en Otra Computadora (Windows)

Sigue estos 3 simples pasos para dejar la aplicación corriendo como un programa `.exe` con ícono en el Escritorio en cualquier otra PC:

### Paso 1: Instalar Requisitos Básicos en la otra PC (Solo 1 vez)
1. **Node.js (Versión LTS):**
   - Entra a [https://nodejs.org](https://nodejs.org), descarga el instalador **LTS** para Windows y dale a *Next -> Next -> Install*.
2. **Git (Opcional, si vas a clonar por comando):**
   - Descárgalo de [https://git-scm.com/download/win](https://git-scm.com/download/win) (o simplemente descarga el `.zip` desde GitHub).

---

### Paso 2: Descargar el Proyecto desde GitHub en la otra PC
Tienes dos formas de bajarlo en la otra computadora:

- **Opción A (Sin usar consola - Descargar ZIP):**
  1. Abre el repositorio en GitHub desde el navegador.
  2. Haz clic en el botón verde **`<> Code`** $\rightarrow$ **`Download ZIP`**.
  3. Extrae la carpeta en el Escritorio o en `Documentos`.

- **Opción B (Con Git):**
  Abre una consola en el Escritorio y ejecuta:
  ```bash
  git clone <URL_DE_TU_REPOSITORIO_GITHUB>
  ```

---

### Paso 3: Ejecutar el Instalador Automático (1 solo doble clic)
1. Entra a la carpeta del proyecto descargado.
2. Haz doble clic sobre el archivo **`Instalador_Primera_Vez.bat`**.
3. Espera unos 2 a 3 minutos mientras el instalador automáticamente:
   - Instala todas las librerías del servidor y la interfaz gráfica.
   - Compila la aplicación web en modo producción.
   - Descarga el navegador interno **Chromium de Playwright** para Google Maps.
   - Genera el archivo ejecutable **`MapsScraperOutreach.exe`**.
   - Crea automáticamente en el Escritorio de esa PC el acceso directo **"Maps Scraper & WhatsApp"**.

---

### Paso 4: ¡Usar la Aplicación Día a Día!
- A partir de ese momento, para usar la app solo debes hacer **doble clic en el acceso directo "Maps Scraper & WhatsApp" del Escritorio** (o en **`MapsScraperOutreach.exe`** dentro de la carpeta).
- Se abrirá el pequeño **Controlador Local** y automáticamente se desplegará la ventana de la aplicación lista para buscar comercios, descargar Excels y enviar mensajes de WhatsApp.
- Cuando termines de trabajar, pulsa **"⏹ Apagar Servidor"** en el controlador (o ciérralo) y todo quedará guardado localmente en la carpeta `data/database.json`.
