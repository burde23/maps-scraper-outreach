import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapeGoogleMaps, normalizeWhatsAppPhone } from './scraper.js';
import { generateExcel } from './excel-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Ensure temp directory exists for Excel exports
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Ensure data directory and database.json exist for 100% local persistence
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbFilePath = path.join(dataDir, 'database.json');

const DEFAULT_DB = {
  settings: {
    defaultCountryCode: '54',
    whatsappTemplate: '¡Hola {nombre}! 👋 Los encontré buscando *{rubro}* en Google Maps ({lugar}) y quería ponerme en contacto con ustedes.'
  },
  sections: []
};

function readDb() {
  try {
    if (!fs.existsSync(dbFilePath)) {
      fs.writeFileSync(dbFilePath, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
      return structuredClone(DEFAULT_DB);
    }
    const raw = fs.readFileSync(dbFilePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      settings: { ...DEFAULT_DB.settings, ...(parsed.settings || {}) },
      sections: Array.isArray(parsed.sections) ? parsed.sections : []
    };
  } catch (err) {
    console.error('Error leyendo database.json:', err);
    return structuredClone(DEFAULT_DB);
  }
}

function writeDb(dbData) {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(dbData, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error guardando database.json:', err);
  }
}

// Serve static frontend assets if built
app.use(express.static(path.join(__dirname, 'frontend/dist')));

/**
 * 1. GET /api/sections -> Returns all saved search sections + global settings
 */
app.get('/api/sections', (req, res) => {
  const db = readDb();
  res.json({
    success: true,
    settings: db.settings,
    sections: db.sections
  });
});

/**
 * 2. POST /api/sections -> Create a new section manually
 */
app.post('/api/sections', (req, res) => {
  const { name, query } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre de la sección es obligatorio.' });
  }

  const db = readDb();
  const newSection = {
    id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim(),
    query: (query || name).trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    countryCode: db.settings.defaultCountryCode || '54',
    excelFilename: null,
    contacts: []
  };

  db.sections.unshift(newSection);
  writeDb(db);

  res.json({ success: true, section: newSection });
});

/**
 * 3. PUT /api/sections/:sectionId -> Rename a section
 */
app.put('/api/sections/:sectionId', (req, res) => {
  const { sectionId } = req.params;
  const { name } = req.body;

  const db = readDb();
  const sec = db.sections.find(s => s.id === sectionId);
  if (!sec) {
    return res.status(404).json({ error: 'Sección no encontrada.' });
  }

  if (name && name.trim()) {
    sec.name = name.trim();
    sec.updatedAt = new Date().toISOString();
    writeDb(db);
  }

  res.json({ success: true, section: sec });
});

/**
 * 4. DELETE /api/sections/:sectionId -> Delete an entire search section
 */
app.delete('/api/sections/:sectionId', (req, res) => {
  const { sectionId } = req.params;
  const db = readDb();
  const prevLen = db.sections.length;
  db.sections = db.sections.filter(s => s.id !== sectionId);

  if (db.sections.length === prevLen) {
    return res.status(404).json({ error: 'Sección no encontrada.' });
  }

  writeDb(db);
  res.json({ success: true, sections: db.sections });
});

/**
 * 5. DELETE /api/sections/:sectionId/contacts/:contactId -> Delete an individual contact inside a section
 */
app.delete('/api/sections/:sectionId/contacts/:contactId', (req, res) => {
  const { sectionId, contactId } = req.params;
  const db = readDb();
  const sec = db.sections.find(s => s.id === sectionId);

  if (!sec) {
    return res.status(404).json({ error: 'Sección no encontrada.' });
  }

  const prevCount = sec.contacts.length;
  sec.contacts = sec.contacts.filter(c => c.id !== contactId);

  if (sec.contacts.length === prevCount) {
    return res.status(404).json({ error: 'Contacto no encontrado en esta sección.' });
  }

  sec.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json({ success: true, section: sec });
});

/**
 * 6. PATCH /api/sections/:sectionId/contacts/:contactId -> Update contact (e.g., toggle contacted, update phone/notes)
 */
app.patch('/api/sections/:sectionId/contacts/:contactId', (req, res) => {
  const { sectionId, contactId } = req.params;
  const { contacted, phone, notes } = req.body;

  const db = readDb();
  const sec = db.sections.find(s => s.id === sectionId);
  if (!sec) {
    return res.status(404).json({ error: 'Sección no encontrada.' });
  }

  const contact = sec.contacts.find(c => c.id === contactId);
  if (!contact) {
    return res.status(404).json({ error: 'Contacto no encontrado.' });
  }

  if (typeof contacted === 'boolean') {
    contact.contacted = contacted;
    contact.contactedAt = contacted ? new Date().toISOString() : null;
  }
  if (typeof phone === 'string') {
    contact.phone = phone.trim();
    contact.whatsappPhone = normalizeWhatsAppPhone(contact.phone, contact.whatsapp, sec.countryCode || db.settings.defaultCountryCode);
    if (contact.whatsappPhone) {
      contact.whatsapp = `https://wa.me/${contact.whatsappPhone}`;
    }
  }
  if (typeof notes === 'string') {
    contact.notes = notes;
  }

  sec.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json({ success: true, contact, section: sec });
});

/**
 * 7. POST /api/sections/:sectionId/export-excel -> Generate downloadable Excel for a specific saved section
 */
app.post('/api/sections/:sectionId/export-excel', async (req, res) => {
  const { sectionId } = req.params;
  const db = readDb();
  const sec = db.sections.find(s => s.id === sectionId);

  if (!sec || !sec.contacts || sec.contacts.length === 0) {
    return res.status(400).json({ error: 'Esta sección no tiene contactos para exportar.' });
  }

  try {
    const sanitizedName = sec.name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 25);
    const filename = `contactos_${sanitizedName}_${Date.now()}.xlsx`;
    const filePath = path.join(tempDir, filename);

    await generateExcel(sec.contacts, filePath);
    sec.excelFilename = filename;
    writeDb(db);

    res.json({ success: true, filename });
  } catch (err) {
    console.error('Error exportando Excel de sección:', err);
    res.status(500).json({ error: 'Error al generar el Excel de la sección.' });
  }
});

/**
 * 8. PUT /api/settings -> Update global WhatsApp template and default country code
 */
app.put('/api/settings', (req, res) => {
  const { defaultCountryCode, whatsappTemplate } = req.body;
  const db = readDb();

  if (typeof defaultCountryCode === 'string' && defaultCountryCode.trim()) {
    db.settings.defaultCountryCode = defaultCountryCode.replace(/\D/g, '') || '54';
  }
  if (typeof whatsappTemplate === 'string') {
    db.settings.whatsappTemplate = whatsappTemplate;
  }

  writeDb(db);
  res.json({ success: true, settings: db.settings });
});

/**
 * 9. GET /api/scrape-stream -> SSE Stream endpoint for real-time Google Maps scraping
 * Automatically creates/updates a dedicated search section in local storage!
 */
app.get('/api/scrape-stream', async (req, res) => {
  const { query, sectionName, targetSectionId, limit, headful, infinite, countryCode } = req.query;

  if (!query || !query.trim()) {
    res.status(400).json({ error: 'Falta el parámetro de búsqueda (query).' });
    return;
  }

  const isInfinite = infinite === 'true';
  const limitNum = parseInt(limit, 10) || 20;
  const showBrowser = headful === 'true';

  const dbInit = readDb();
  const activeCountryCode = (countryCode || dbInit.settings.defaultCountryCode || '54').replace(/\D/g, '') || '54';

  // Find or create the dedicated section for this search
  let activeSection = null;
  if (targetSectionId && targetSectionId !== 'new') {
    activeSection = dbInit.sections.find(s => s.id === targetSectionId);
  }

  if (!activeSection) {
    const cleanSecName = (sectionName && sectionName.trim()) ? sectionName.trim() : query.trim();
    activeSection = {
      id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: cleanSecName,
      query: query.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      countryCode: activeCountryCode,
      excelFilename: null,
      contacts: []
    };
    dbInit.sections.unshift(activeSection);
    writeDb(dbInit);
  }

  const activeSectionId = activeSection.id;

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let browserInstance = null;
  let clientConnected = true;
  const scrapedData = [];

  const heartbeatInterval = setInterval(() => {
    if (clientConnected) {
      res.write(`:heartbeat\n\n`);
    } else {
      clearInterval(heartbeatInterval);
    }
  }, 8000);

  const sendEvent = (type, payload) => {
    if (!clientConnected) return;
    res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
  };

  // Notify frontend immediately which section is storing these contacts
  sendEvent('section_created', { section: activeSection });

  const logCallback = (message) => {
    console.log(`[Maps Scraper] ${message}`);
    sendEvent('log', { message });
  };

  // Save each scraped business immediately to the dedicated section on disk
  const resultsCallback = async (item) => {
    scrapedData.push(item);

    const db = readDb();
    const sec = db.sections.find(s => s.id === activeSectionId);
    if (sec) {
      const exists = sec.contacts.some(
        c => (c.mapsUrl && item.mapsUrl && c.mapsUrl === item.mapsUrl) ||
             (c.name.toLowerCase() === item.name.toLowerCase() && c.phone === item.phone)
      );
      if (!exists) {
        sec.contacts.push(item);
        sec.updatedAt = new Date().toISOString();
        writeDb(db);
      }
    }

    sendEvent('result', {
      data: item,
      count: scrapedData.length,
      sectionId: activeSectionId
    });
  };

  req.on('close', async () => {
    clientConnected = false;
    clearInterval(heartbeatInterval);
    if (browserInstance) {
      try {
        await browserInstance.close();
        console.log('Navegador Playwright cerrado tras desconexión del cliente.');
      } catch (err) {
        console.error('Error cerrando navegador:', err);
      }
    }
  });

  try {
    const searchDescription = isInfinite
      ? `Iniciando búsqueda continua en Google Maps para: "${query}" (Sección: "${activeSection.name}")`
      : `Iniciando búsqueda en Google Maps para: "${query}" (Límite: ${limitNum} comercios | Sección: "${activeSection.name}")`;
    logCallback(searchDescription);

    const results = await scrapeGoogleMaps({
      query: query.trim(),
      limit: limitNum,
      logCallback,
      resultsCallback,
      headful: showBrowser,
      onBrowserCreated: (browser) => { browserInstance = browser; },
      isAborted: () => !clientConnected,
      isInfinite,
      countryCode: activeCountryCode
    });

    if (!clientConnected) return;

    if (results.length === 0) {
      logCallback('No se encontraron comercios en esta búsqueda.');
      sendEvent('complete', { error: 'No se encontraron comercios.', sectionId: activeSectionId });
      res.end();
      return;
    }

    logCallback(`Generando archivo Excel descargable con ${results.length} comercios...`);
    const sanitizedQuery = query.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 22);
    const filename = `maps_${sanitizedQuery}_${Date.now()}.xlsx`;
    const filePath = path.join(tempDir, filename);

    await generateExcel(results, filePath);

    // Update section's excelFilename in DB
    const dbFinal = readDb();
    const secFinal = dbFinal.sections.find(s => s.id === activeSectionId);
    if (secFinal) {
      secFinal.excelFilename = filename;
      secFinal.updatedAt = new Date().toISOString();
      writeDb(dbFinal);
    }

    logCallback(`✅ ¡Búsqueda finalizada! Los ${results.length} contactos quedaron guardados en la sección "${activeSection.name}" y el Excel está listo.`);
    sendEvent('complete', { filename, sectionId: activeSectionId });
    res.end();
  } catch (error) {
    console.error('Error durante el streaming de scraping:', error);
    logCallback(`Error crítico: ${error.message}`);
    sendEvent('complete', { error: error.message, sectionId: activeSectionId });
    res.end();
  }
});

/**
 * 10. GET /api/download/:filename -> Excel download endpoint
 */
app.get('/api/download/:filename', (req, res) => {
  const { filename } = req.params;
  const safeFilename = path.basename(filename);
  const filePath = path.join(tempDir, safeFilename);

  if (fs.existsSync(filePath)) {
    res.download(filePath, safeFilename, (err) => {
      if (err) {
        console.error('Error enviando archivo:', err);
        res.status(500).send('Error al descargar el archivo.');
      }
    });
  } else {
    res.status(404).send('Archivo Excel no encontrado.');
  }
});

/**
 * 11. POST /api/export-excel -> Generate Excel from arbitrary results payload (e.g. after stopping mid-search)
 */
app.post('/api/export-excel', async (req, res) => {
  const { results, query, sectionId } = req.body;

  if (!results || !Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ error: 'No hay datos para exportar.' });
  }

  try {
    const sanitizedQuery = (query || 'busqueda').toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 22);
    const filename = `maps_${sanitizedQuery}_${Date.now()}.xlsx`;
    const filePath = path.join(tempDir, filename);

    await generateExcel(results, filePath);

    if (sectionId) {
      const db = readDb();
      const sec = db.sections.find(s => s.id === sectionId);
      if (sec) {
        sec.excelFilename = filename;
        writeDb(db);
      }
    }

    res.json({ filename });
  } catch (error) {
    console.error('Error generando Excel bajo demanda:', error);
    res.status(500).json({ error: 'Error al generar el reporte Excel.' });
  }
});

// Fallback to React app if URL doesn't match API endpoints
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'frontend/dist/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ message: '🚀 Servidor Maps Scraper & WhatsApp Outreach Activo en puerto ' + PORT });
  }
});

app.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(` 🚀 MAPS SCRAPER & WHATSAPP OUTREACH (MODO LOCAL)`);
  console.log(` 🌐 URL Local: http://localhost:${PORT}`);
  console.log(` 💾 Base de datos local: ${dbFilePath}`);
  console.log(`========================================================`);
});
