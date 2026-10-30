import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import { scrapeGoogleMaps, normalizeWhatsAppPhone } from './scraper.js';
import { generateExcel } from './excel-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Dedicated local folder for saved Excel files
const excelsDir = path.join(__dirname, 'excels');
if (!fs.existsSync(excelsDir)) {
  fs.mkdirSync(excelsDir, { recursive: true });
}

// Legacy temp directory (copy any existing .xlsx files into excelsDir so all files appear in the viewer)
const tempDir = path.join(__dirname, 'temp');
if (fs.existsSync(tempDir)) {
  try {
    const legacyFiles = fs.readdirSync(tempDir).filter((f) => f.toLowerCase().endsWith('.xlsx'));
    for (const file of legacyFiles) {
      const src = path.join(tempDir, file);
      const dest = path.join(excelsDir, file);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
      }
    }
  } catch (e) {
    console.error('Aviso migrando Excels antiguos:', e);
  }
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
    whatsappTemplate:
      '¡Hola {nombre}! 👋 Los encontré buscando *{rubro}* en Google Maps ({lugar}) y quería ponerme en contacto con ustedes.'
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
  const sec = db.sections.find((s) => s.id === sectionId);
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
  db.sections = db.sections.filter((s) => s.id !== sectionId);

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
  const sec = db.sections.find((s) => s.id === sectionId);

  if (!sec) {
    return res.status(404).json({ error: 'Sección no encontrada.' });
  }

  const prevCount = sec.contacts.length;
  sec.contacts = sec.contacts.filter((c) => c.id !== contactId);

  if (sec.contacts.length === prevCount) {
    return res.status(404).json({ error: 'Contacto no encontrado en esta sección.' });
  }

  sec.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json({ success: true, section: sec });
});

/**
 * 6. PATCH /api/sections/:sectionId/contacts/:contactId -> Update contact
 */
app.patch('/api/sections/:sectionId/contacts/:contactId', (req, res) => {
  const { sectionId, contactId } = req.params;
  const { contacted, phone, notes } = req.body;

  const db = readDb();
  const sec = db.sections.find((s) => s.id === sectionId);
  if (!sec) {
    return res.status(404).json({ error: 'Sección no encontrada.' });
  }

  const contact = sec.contacts.find((c) => c.id === contactId);
  if (!contact) {
    return res.status(404).json({ error: 'Contacto no encontrado.' });
  }

  if (typeof contacted === 'boolean') {
    contact.contacted = contacted;
    contact.contactedAt = contacted ? new Date().toISOString() : null;
  }
  if (typeof phone === 'string') {
    contact.phone = phone.trim();
    contact.whatsappPhone = normalizeWhatsAppPhone(
      contact.phone,
      contact.whatsapp,
      sec.countryCode || db.settings.defaultCountryCode
    );
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
 * 7. POST /api/sections/:sectionId/export-excel -> Generate Excel for a specific saved section
 */
app.post('/api/sections/:sectionId/export-excel', async (req, res) => {
  const { sectionId } = req.params;
  const db = readDb();
  const sec = db.sections.find((s) => s.id === sectionId);

  if (!sec || !sec.contacts || sec.contacts.length === 0) {
    return res.status(400).json({ error: 'Esta sección no tiene contactos para exportar.' });
  }

  try {
    const sanitizedName = sec.name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 28);
    const filename = `contactos_${sanitizedName}_${Date.now()}.xlsx`;
    const filePath = path.join(excelsDir, filename);

    await generateExcel(sec.contacts, filePath);
    sec.excelFilename = filename;
    writeDb(db);

    res.json({ success: true, filename, filePath });
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
 * 9. GET /api/excels -> Lists all saved Excel (.xlsx) files inside local excels/ directory
 */
app.get('/api/excels', (req, res) => {
  try {
    if (!fs.existsSync(excelsDir)) {
      fs.mkdirSync(excelsDir, { recursive: true });
    }
    const files = fs
      .readdirSync(excelsDir)
      .filter((f) => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$'))
      .map((filename) => {
        const fullPath = path.join(excelsDir, filename);
        const stat = fs.statSync(fullPath);
        return {
          filename,
          fullPath,
          sizeBytes: stat.size,
          createdAt: stat.birthtime || stat.mtime,
          modifiedAt: stat.mtime
        };
      })
      .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));

    res.json({
      success: true,
      folderPath: excelsDir,
      files
    });
  } catch (err) {
    console.error('Error listando Excels:', err);
    res.status(500).json({ error: 'Error al leer la carpeta de archivos Excel.' });
  }
});

/**
 * 10. POST /api/excels/:filename/open -> Opens the Excel file natively on the PC (Microsoft Excel / default app)
 */
app.post('/api/excels/:filename/open', (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(excelsDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Archivo Excel no encontrado en la carpeta local.' });
  }

  // Launch the file with the default OS handler on Windows/macOS/Linux
  const cmd =
    process.platform === 'win32'
      ? `cmd /c start "" "${filePath}"`
      : process.platform === 'darwin'
      ? `open "${filePath}"`
      : `xdg-open "${filePath}"`;

  exec(cmd, (err) => {
    if (err) {
      console.error('Error abriendo archivo Excel en la PC:', err);
      return res.status(500).json({ error: 'No se pudo abrir el archivo Excel en el sistema.' });
    }
    res.json({ success: true, opened: filePath });
  });
});

/**
 * 11. POST /api/excels/open-folder -> Opens the local excels/ folder in Windows Explorer
 */
app.post('/api/excels/open-folder', (req, res) => {
  const cmd =
    process.platform === 'win32'
      ? `explorer.exe "${excelsDir}"`
      : process.platform === 'darwin'
      ? `open "${excelsDir}"`
      : `xdg-open "${excelsDir}"`;

  exec(cmd, () => {
    res.json({ success: true, folderPath: excelsDir });
  });
});

/**
 * 12. GET /api/excels/:filename/preview -> Reads the sheets and rows of a local Excel file for the in-app viewer
 */
app.get('/api/excels/:filename/preview', async (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(excelsDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Archivo Excel no encontrado.' });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheets = [];
    workbook.eachSheet((worksheet) => {
      const headers = [];
      const rows = [];

      worksheet.eachRow((row, rowNumber) => {
        const values = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          let val = cell.value;
          if (val && typeof val === 'object') {
            val = val.text || val.hyperlink || JSON.stringify(val);
          }
          values[colNumber - 1] = val != null ? String(val) : '';
        });

        if (rowNumber === 1) {
          headers.push(...values);
        } else if (rows.length < 250) {
          rows.push(values);
        }
      });

      sheets.push({
        name: worksheet.name,
        totalRows: Math.max(0, worksheet.rowCount - 1),
        headers,
        rows
      });
    });

    res.json({
      success: true,
      filename: safeFilename,
      fullPath: filePath,
      sheets
    });
  } catch (err) {
    console.error('Error previsualizando Excel:', err);
    res.status(500).json({ error: 'No se pudo leer el contenido del Excel.' });
  }
});

/**
 * 13. DELETE /api/excels/:filename -> Deletes a local Excel file
 */
app.delete('/api/excels/:filename', (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(excelsDir, safeFilename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  res.json({ success: true });
});

/**
 * 14. GET /api/scrape-stream -> SSE Stream endpoint for real-time Google Maps API scraping
 */
app.get('/api/scrape-stream', async (req, res) => {
  const { query, sectionName, targetSectionId, limit, infinite, countryCode } = req.query;

  if (!query || !query.trim()) {
    res.status(400).json({ error: 'Falta el parámetro de búsqueda (query).' });
    return;
  }

  const isInfinite = infinite === 'true';
  const limitNum = parseInt(limit, 10) || 50;

  const dbInit = readDb();
  const activeCountryCode =
    (countryCode || dbInit.settings.defaultCountryCode || '54').replace(/\D/g, '') || '54';

  // Find or create the dedicated section for this search
  let activeSection = null;
  if (targetSectionId && targetSectionId !== 'new') {
    activeSection = dbInit.sections.find((s) => s.id === targetSectionId);
  }

  if (!activeSection) {
    const cleanSecName = sectionName && sectionName.trim() ? sectionName.trim() : query.trim();
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

  sendEvent('section_created', { section: activeSection });

  const logCallback = (message) => {
    console.log(`[Maps API] ${message}`);
    sendEvent('log', { message });
  };

  const resultsCallback = async (item) => {
    scrapedData.push(item);

    const db = readDb();
    const sec = db.sections.find((s) => s.id === activeSectionId);
    if (sec) {
      const exists = sec.contacts.some(
        (c) =>
          (c.mapsUrl && item.mapsUrl && c.mapsUrl === item.mapsUrl) ||
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

  req.on('close', () => {
    clientConnected = false;
    clearInterval(heartbeatInterval);
  });

  try {
    const results = await scrapeGoogleMaps({
      query: query.trim(),
      limit: limitNum,
      logCallback,
      resultsCallback,
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

    logCallback(`Guardando archivo Excel en carpeta local con ${results.length} comercios...`);
    const sanitizedQuery = query.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 25);
    const filename = `maps_${sanitizedQuery}_${Date.now()}.xlsx`;
    const filePath = path.join(excelsDir, filename);

    await generateExcel(results, filePath);

    const dbFinal = readDb();
    const secFinal = dbFinal.sections.find((s) => s.id === activeSectionId);
    if (secFinal) {
      secFinal.excelFilename = filename;
      secFinal.updatedAt = new Date().toISOString();
      writeDb(dbFinal);
    }

    logCallback(
      `✅ ¡Listo! ${results.length} comercios guardados en "${activeSection.name}" y en excels/${filename}.`
    );
    sendEvent('complete', { filename, sectionId: activeSectionId });
    res.end();
  } catch (error) {
    console.error('Error durante la búsqueda:', error);
    logCallback(`Error crítico: ${error.message}`);
    sendEvent('complete', { error: error.message, sectionId: activeSectionId });
    res.end();
  }
});

/**
 * 15. GET /api/download/:filename -> Excel download endpoint
 */
app.get('/api/download/:filename', (req, res) => {
  const { filename } = req.params;
  const safeFilename = path.basename(filename);
  const filePath = path.join(excelsDir, safeFilename);
  const fallbackTempPath = path.join(tempDir, safeFilename);

  const targetPath = fs.existsSync(filePath)
    ? filePath
    : fs.existsSync(fallbackTempPath)
    ? fallbackTempPath
    : null;

  if (targetPath) {
    res.download(targetPath, safeFilename);
  } else {
    res.status(404).send('Archivo Excel no encontrado.');
  }
});

/**
 * 16. POST /api/export-excel -> Generate Excel from arbitrary results payload
 */
app.post('/api/export-excel', async (req, res) => {
  const { results, query, sectionId } = req.body;

  if (!results || !Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ error: 'No hay datos para exportar.' });
  }

  try {
    const sanitizedQuery = (query || 'busqueda')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .substring(0, 25);
    const filename = `maps_${sanitizedQuery}_${Date.now()}.xlsx`;
    const filePath = path.join(excelsDir, filename);

    await generateExcel(results, filePath);

    if (sectionId) {
      const db = readDb();
      const sec = db.sections.find((s) => s.id === sectionId);
      if (sec) {
        sec.excelFilename = filename;
        writeDb(db);
      }
    }

    res.json({ filename, filePath });
  } catch (error) {
    console.error('Error generando Excel bajo demanda:', error);
    res.status(500).json({ error: 'Error al generar el reporte Excel.' });
  }
});

// Fallback to React app
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
  console.log(` 🚀 MAPS SCRAPER & WHATSAPP OUTREACH (MODO LOCAL API)`);
  console.log(` 🌐 URL Local: http://localhost:${PORT}`);
  console.log(` 📊 Carpeta Excels: ${excelsDir}`);
  console.log(` 💾 Base de datos local: ${dbFilePath}`);
  console.log(`========================================================`);
});
