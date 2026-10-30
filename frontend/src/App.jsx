import React, { useState, useEffect, useRef } from 'react';

// ============================================================================
// ICONOS MATERIAL (24x24, fill currentColor)
// ============================================================================
const ICON_PATHS = {
  pin: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z',
  buscar: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  carpeta: 'M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z',
  mundo: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
  lista: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z',
  ojo: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
  apps: 'M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z',
  chat: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z',
  tabla: 'M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 20H4v-4h4v4zm0-6H4v-4h4v4zm0-6H4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4z',
  ajustes: 'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z',
  cerrar: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  editar: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  descargar: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
  borrar: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  agregar: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  detener: 'M6 6h12v12H6z'
};

function MaterialIcon({ name, size = 24, className = '', style = {} }) {
  const path = ICON_PATHS[name] || ICON_PATHS.buscar;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <path d={path} />
    </svg>
  );
}

// ============================================================================
// TOKENS DE COLORES Y DATOS DE CONFIGURACIÓN
// ============================================================================
const AVATAR_PALETTE = [
  { fondo: '#e8f0fe', texto: '#1967d2' },
  { fondo: '#fce8e6', texto: '#c5221f' },
  { fondo: '#fef7e0', texto: '#b06000' },
  { fondo: '#e6f4ea', texto: '#137333' }
];

const DIGITAL_PRESENCE_TAGS = {
  web_propia: { fondo: '#e8f0fe', texto: '#174ea6', etiqueta: 'Web propia' },
  web_y_redes: { fondo: '#e8f0fe', texto: '#174ea6', etiqueta: 'Web propia' },
  solo_web: { fondo: '#e8f0fe', texto: '#174ea6', etiqueta: 'Web propia' },
  solo_redes: { fondo: '#f3e8fd', texto: '#6a1b9a', etiqueta: 'Solo redes' },
  sin_web: { fondo: '#fef7e0', texto: '#7a4a00', etiqueta: 'Sin web' }
};

const COUNTRY_CHIP_OPTIONS = [
  { label: 'Argentina +54', code: '54' },
  { label: 'Brasil +55', code: '55' },
  { label: 'México +52', code: '52' },
  { label: 'España +34', code: '34' }
];

const SUGGESTION_ITEMS = [
  'Ferreterías en Caballito',
  'Gimnasios en Palermo',
  'Restaurantes en Córdoba'
];

const DEMO_BUSINESSES = [
  { nombre: 'Ferretería El Tornillo', detalle: 'Ferretería · Av. Rivadavia', presencia: 'web_propia', telefono: true, phone: '+54 11 4901-2345', website: 'https://ferreteriaeltornillo.com.ar', instagram: 'https://instagram.com/eltornillo' },
  { nombre: 'Corralón Don Pepe', detalle: 'Materiales de construcción · Acoyte', presencia: 'sin_web', telefono: true, phone: '+54 11 4902-6789', website: '', instagram: '' },
  { nombre: 'Ferrecentro Caballito', detalle: 'Ferretería · Díaz Vélez', presencia: 'web_propia', telefono: true, phone: '+54 11 4981-1122', website: 'https://ferrecentro.com.ar', instagram: 'https://instagram.com/ferrecentro' },
  { nombre: 'Casa Lombardi', detalle: 'Herramientas · Pujol', presencia: 'solo_redes', telefono: true, phone: '+54 11 4432-9988', website: '', instagram: 'https://instagram.com/casalombardi' },
  { nombre: 'La Llave Maestra', detalle: 'Cerrajería · Rojas', presencia: 'solo_redes', telefono: false, phone: '', website: '', facebook: 'https://facebook.com/lallavemaestra' },
  { nombre: 'Bulonera Sur', detalle: 'Bulonería · Gaona', presencia: 'sin_web', telefono: true, phone: '+54 11 4582-3344', website: '', instagram: '' },
  { nombre: 'Pinturería Colores', detalle: 'Pinturería · Hidalgo', presencia: 'web_propia', telefono: true, phone: '+54 11 4903-5566', website: 'https://pintureriacolores.com.ar', instagram: 'https://instagram.com/pintureriacolores' },
  { nombre: 'Electro Hogar Mario', detalle: 'Electricidad · Neuquén', presencia: 'solo_redes', telefono: true, phone: '+54 11 4631-7788', website: '', instagram: 'https://instagram.com/electrohogarmario' }
];

export default function App() {
  const backendUrl = import.meta.env.DEV ? 'http://localhost:3005' : '';

  // Estado principal de la pantalla: 'idle' | 'run' | 'done'
  const [pageState, setPageState] = useState('idle');

  // Búsqueda y selector colapsable de tope dentro del buscador
  const [query, setQuery] = useState('');
  const [destIdx, setDestIdx] = useState(0);
  const [countryIdx, setCountryIdx] = useState(0);
  const [customLimit, setCustomLimit] = useState(50);
  const [isInfinite, setIsInfinite] = useState(false);
  const [limitPickerOpen, setLimitPickerOpen] = useState(false);

  // Alternadores de animación popA / popB
  const [chipFlip, setChipFlip] = useState({
    destino: false,
    pais: false,
    cantidad: false
  });
  const [counterFlip, setCounterFlip] = useState(false);
  const [rowFlip, setRowFlip] = useState(false);

  // Menú de 9 puntos y Panel Lateral
  const [menuAppsOpen, setMenuAppsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Vista dentro del panel lateral: 'sections' | 'contacts' | 'excels' | 'template' | 'settings'
  const [drawerView, setDrawerView] = useState('sections');

  // Datos persistidos en el backend (secciones y configuración de WhatsApp)
  const [sections, setSections] = useState([]);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [whatsappTemplate, setWhatsappTemplate] = useState(
    '¡Hola {nombre}! 👋 Los encontré buscando *{rubro}* en Google Maps ({lugar}) y quería ponerme en contacto con ustedes.'
  );
  const [savingSettings, setSavingSettings] = useState(false);

  // Visor de archivos Excel locales guardados en la carpeta excels/
  const [excelFiles, setExcelFiles] = useState([]);
  const [excelFolderPath, setExcelFolderPath] = useState('');
  const [openingExcelName, setOpeningExcelName] = useState(null);
  const [excelPreview, setExcelPreview] = useState(null);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Resultados en vivo de la búsqueda actual
  const [liveResults, setLiveResults] = useState([]);
  const [logs, setLogs] = useState([]);
  const [lastScrapedSectionId, setLastScrapedSectionId] = useState(null);
  const [downloadFilename, setDownloadFilename] = useState(null);

  // Interacción dentro de la vista de contactos (Outreach) en el panel lateral
  const [contactSearch, setContactSearch] = useState('');
  const [contactFilter, setContactFilter] = useState('todos');
  const [copiedId, setCopiedId] = useState(null);
  const [editingContactMsgId, setEditingContactMsgId] = useState(null);
  const [customMessages, setCustomMessages] = useState({});
  const [renamingSectionId, setRenamingSectionId] = useState(null);
  const [renameSectionValue, setRenameSectionValue] = useState('');
  const [exportingSectionId, setExportingSectionId] = useState(null);
  const [simulationMode, setSimulationMode] = useState(false);

  const eventSourceRef = useRef(null);
  const simIntervalRef = useRef(null);
  const menuAppsRef = useRef(null);
  const menuBtnRef = useRef(null);
  const limitPickerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Opciones dinámicas para el chip "Destino"
  const destinationOptions = [
    { id: 'new', label: 'Sección nueva' },
    ...(sections.length > 0
      ? sections.map((s) => ({ id: s.id, label: s.name }))
      : [
          { id: 'new_ferre', label: 'Ferreterías en Caballito' },
          { id: 'new_gim', label: 'Gimnasios en Palermo' }
        ])
  ];

  const safeDestIdx = destIdx < destinationOptions.length ? destIdx : 0;
  const currentDest = destinationOptions[safeDestIdx] || destinationOptions[0];
  const currentCountry = COUNTRY_CHIP_OPTIONS[countryIdx] || COUNTRY_CHIP_OPTIONS[0];
  const effectiveLimit = Math.max(1, parseInt(customLimit, 10) || 50);

  // Cargar lista de archivos Excel locales desde GET /api/excels
  const fetchExcelFiles = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/excels`);
      const data = await res.json();
      if (data.success) {
        setExcelFiles(data.files || []);
        setExcelFolderPath(data.folderPath || '');
      }
    } catch (err) {
      console.error('Error cargando lista de Excels:', err);
    }
  };

  // Cargar secciones y configuración del backend al iniciar
  const fetchSectionsAndSettings = async (selectId = null) => {
    try {
      const res = await fetch(`${backendUrl}/api/sections`);
      const data = await res.json();
      if (data.success) {
        const list = data.sections || [];
        setSections(list);
        if (data.settings) {
          if (data.settings.whatsappTemplate) {
            setWhatsappTemplate(data.settings.whatsappTemplate);
          }
          if (data.settings.defaultCountryCode) {
            const idx = COUNTRY_CHIP_OPTIONS.findIndex(
              (c) => c.code === String(data.settings.defaultCountryCode)
            );
            if (idx !== -1) setCountryIdx(idx);
          }
        }
        if (selectId) {
          setActiveSectionId(selectId);
        } else if (!activeSectionId && list.length > 0) {
          setActiveSectionId(list[0].id);
        } else if (activeSectionId && !list.some((s) => s.id === activeSectionId)) {
          setActiveSectionId(list.length > 0 ? list[0].id : null);
        }
      }
    } catch (err) {
      console.error('Error cargando secciones:', err);
    }
  };

  useEffect(() => {
    fetchSectionsAndSettings();
    fetchExcelFiles();
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, []);

  // Cerrar menú de 9 puntos y selector de tope al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        menuAppsOpen &&
        menuAppsRef.current &&
        !menuAppsRef.current.contains(e.target) &&
        menuBtnRef.current &&
        !menuBtnRef.current.contains(e.target)
      ) {
        setMenuAppsOpen(false);
      }
      if (
        limitPickerOpen &&
        limitPickerRef.current &&
        !limitPickerRef.current.contains(e.target)
      ) {
        setLimitPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuAppsOpen, limitPickerOpen]);

  const addLog = (text) => {
    const time = new Date().toLocaleTimeString('es-AR');
    setLogs((prev) => [...prev, { text, time }]);
  };

  // Guardar configuración global (plantilla WhatsApp y código de país)
  const handleSaveSettings = async (
    newTemplate = whatsappTemplate,
    newCountryCode = currentCountry.code
  ) => {
    setSavingSettings(true);
    try {
      await fetch(`${backendUrl}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsappTemplate: newTemplate,
          defaultCountryCode: newCountryCode
        })
      });
    } catch (err) {
      console.error('Error guardando ajustes:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  // Rotar valor de un chip con animación popA / popB
  const handleRotateChip = (chipKey) => {
    setChipFlip((prev) => ({ ...prev, [chipKey]: !prev[chipKey] }));

    if (chipKey === 'destino') {
      setDestIdx((prev) => (prev + 1) % destinationOptions.length);
    } else if (chipKey === 'pais') {
      const nextIdx = (countryIdx + 1) % COUNTRY_CHIP_OPTIONS.length;
      setCountryIdx(nextIdx);
      handleSaveSettings(whatsappTemplate, COUNTRY_CHIP_OPTIONS[nextIdx].code);
    }
  };

  // Agregar un resultado en vivo activando animaciones de contador y fila
  const pushLiveResult = (item) => {
    setCounterFlip((prev) => !prev);
    setRowFlip((prev) => !prev);
    setLiveResults((prev) => [...prev, item]);
  };

  // Simulación de respaldo o demostración (420 ms por comercio)
  const startSimulationRun = (effectiveQuery, maxItems) => {
    let count = 0;
    const targetLimit = maxItems || 50;

    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    simIntervalRef.current = setInterval(() => {
      const sample = DEMO_BUSINESSES[count % DEMO_BUSINESSES.length];
      count += 1;

      const simulatedItem = {
        id: `sim_${Date.now()}_${count}`,
        name: sample.nombre,
        category: sample.detalle.split('·')[0]?.trim() || 'Comercio',
        address: sample.detalle.split('·')[1]?.trim() || effectiveQuery,
        detalle: sample.detalle,
        digitalStatus: sample.presencia,
        phone: sample.telefono ? sample.phone : '',
        whatsappPhone: sample.telefono ? sample.phone.replace(/\D/g, '') : '',
        website: sample.website || '',
        instagram: sample.instagram || '',
        facebook: sample.facebook || '',
        contacted: false
      };

      pushLiveResult(simulatedItem);

      if (maxItems !== null && count >= targetLimit) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
        setPageState('done');
      }
    }, 420);
  };

  // Iniciar búsqueda (GET /api/scrape-stream vía API de Google Maps)
  const handleStartSearch = () => {
    const effectiveQuery = query.trim() || 'Ferreterías en Caballito';
    if (!query.trim()) {
      setQuery(effectiveQuery);
    }

    setMenuAppsOpen(false);
    setLimitPickerOpen(false);
    setPageState('run');
    setLiveResults([]);
    setDownloadFilename(null);
    setLogs([]);

    if (simulationMode) {
      addLog(`Modo demostración (420ms): "${effectiveQuery}"`);
      startSimulationRun(effectiveQuery, isInfinite ? null : effectiveLimit);
      return;
    }

    const targetSectionId =
      currentDest.id && currentDest.id.startsWith('sec_') ? currentDest.id : 'new';
    const sectionName =
      targetSectionId === 'new' && currentDest.id !== 'new'
        ? currentDest.label
        : effectiveQuery;

    const params = new URLSearchParams({
      query: effectiveQuery,
      sectionName,
      targetSectionId,
      limit: String(effectiveLimit),
      infinite: String(isInfinite),
      countryCode: currentCountry.code
    });

    const sseUrl = `${backendUrl}/api/scrape-stream?${params.toString()}`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'section_created' && data.section) {
          setLastScrapedSectionId(data.section.id);
          setActiveSectionId(data.section.id);
          fetchSectionsAndSettings(data.section.id);
        } else if (data.type === 'log') {
          addLog(data.message);
        } else if (data.type === 'result' && data.data) {
          if (data.sectionId) {
            setLastScrapedSectionId(data.sectionId);
          }
          pushLiveResult(data.data);
          fetchSectionsAndSettings(data.sectionId);
        } else if (data.type === 'complete') {
          es.close();
          eventSourceRef.current = null;
          setPageState('done');
          if (data.filename) setDownloadFilename(data.filename);
          if (data.sectionId) {
            setLastScrapedSectionId(data.sectionId);
            setActiveSectionId(data.sectionId);
          }
          fetchSectionsAndSettings(data.sectionId);
          fetchExcelFiles();
        }
      } catch (err) {
        console.error('Error SSE:', err);
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setPageState((prev) => (prev === 'run' ? 'done' : prev));
      fetchSectionsAndSettings();
      fetchExcelFiles();
    };
  };

  // Detener y guardar lo recopilado
  const handleStopAndSave = async () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setPageState('done');
    await fetchSectionsAndSettings(lastScrapedSectionId || activeSectionId);

    if (liveResults.length > 0 && !downloadFilename) {
      try {
        const res = await fetch(`${backendUrl}/api/export-excel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            results: liveResults,
            query: query || 'Ferreterías en Caballito',
            sectionId: lastScrapedSectionId
          })
        });
        const data = await res.json();
        if (data.filename) {
          setDownloadFilename(data.filename);
          fetchExcelFiles();
        }
      } catch (err) {
        console.error('Error generando Excel parcial:', err);
      }
    }
  };

  // Acción del botón redondo azul del buscador
  const handleSearchButtonClick = () => {
    if (pageState === 'run') {
      handleStopAndSave();
    } else {
      handleStartSearch();
    }
  };

  // Abrir un archivo Excel directamente en el sistema (Microsoft Excel / app predeterminada)
  const handleOpenExcelOnPc = async (filename, e) => {
    if (e) e.stopPropagation();
    setOpeningExcelName(filename);
    try {
      const res = await fetch(
        `${backendUrl}/api/excels/${encodeURIComponent(filename)}/open`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (!data.success) {
        // Fallback: descargar si no hay lector instalado
        window.open(`${backendUrl}/api/download/${encodeURIComponent(filename)}`, '_blank');
      }
    } catch (err) {
      window.open(`${backendUrl}/api/download/${encodeURIComponent(filename)}`, '_blank');
    } finally {
      setTimeout(() => setOpeningExcelName(null), 1200);
    }
  };

  // Abrir la carpeta local excels/ en el Explorador de Windows
  const handleOpenExcelsFolder = async () => {
    try {
      await fetch(`${backendUrl}/api/excels/open-folder`, { method: 'POST' });
    } catch (err) {
      console.error('Error abriendo carpeta de Excels:', err);
    }
  };

  // Ver el contenido del Excel (hojas y filas) dentro del visor de la app
  const handlePreviewExcelInApp = async (filename, e) => {
    if (e) e.stopPropagation();
    setLoadingPreview(true);
    setActiveSheetIdx(0);
    try {
      const res = await fetch(
        `${backendUrl}/api/excels/${encodeURIComponent(filename)}/preview`
      );
      const data = await res.json();
      if (data.success) {
        setExcelPreview(data);
      }
    } catch (err) {
      alert('No se pudo previsualizar el archivo Excel.');
    } finally {
      setLoadingPreview(false);
    }
  };

  // Eliminar un archivo Excel local
  const handleDeleteExcelFile = async (filename, e) => {
    if (e) e.stopPropagation();
    const ok = window.confirm(`¿Borrar el archivo Excel "${filename}" de tu carpeta local?`);
    if (!ok) return;
    try {
      await fetch(`${backendUrl}/api/excels/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      if (excelPreview?.filename === filename) {
        setExcelPreview(null);
      }
      fetchExcelFiles();
    } catch (err) {
      alert('Error eliminando archivo Excel.');
    }
  };

  // Abrir o descargar Excel de la búsqueda en vivo
  const handleDownloadLiveExcel = async () => {
    if (downloadFilename) {
      await handleOpenExcelOnPc(downloadFilename);
      return;
    }
    const targetSecId = lastScrapedSectionId || activeSectionId;
    if (targetSecId) {
      try {
        const res = await fetch(`${backendUrl}/api/sections/${targetSecId}/export-excel`, {
          method: 'POST'
        });
        const data = await res.json();
        if (data.filename) {
          setDownloadFilename(data.filename);
          await fetchExcelFiles();
          await handleOpenExcelOnPc(data.filename);
          return;
        }
      } catch (err) {
        console.error(err);
      }
    }
    if (liveResults.length > 0) {
      try {
        const res = await fetch(`${backendUrl}/api/export-excel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            results: liveResults,
            query: query || 'comercios',
            sectionId: lastScrapedSectionId
          })
        });
        const data = await res.json();
        if (data.filename) {
          setDownloadFilename(data.filename);
          await fetchExcelFiles();
          await handleOpenExcelOnPc(data.filename);
        }
      } catch (err) {
        alert('No se pudo generar el Excel.');
      }
    }
  };

  // Generar y abrir Excel de una sección específica
  const handleDownloadSectionExcel = async (section, e) => {
    if (e) e.stopPropagation();
    if (!section.contacts || section.contacts.length === 0) {
      alert('Esta sección aún no tiene comercios guardados para exportar.');
      return;
    }
    setExportingSectionId(section.id);
    try {
      const res = await fetch(`${backendUrl}/api/sections/${section.id}/export-excel`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.filename) {
        await fetchExcelFiles();
        await handleOpenExcelOnPc(data.filename);
        fetchSectionsAndSettings(activeSectionId);
      }
    } catch (err) {
      alert('Error al generar el Excel de la sección.');
    } finally {
      setExportingSectionId(null);
    }
  };

  // Crear nueva sección vacía manualmente
  const handleCreateManualSection = async () => {
    const name = window.prompt('Nombre de la nueva sección:');
    if (!name || !name.trim()) return;
    try {
      const res = await fetch(`${backendUrl}/api/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), query: name.trim() })
      });
      const data = await res.json();
      if (data.success && data.section) {
        await fetchSectionsAndSettings(data.section.id);
      }
    } catch (err) {
      alert('Error al crear la sección.');
    }
  };

  // Renombrar sección
  const handleRenameSection = async (sectionId, e) => {
    if (e) e.stopPropagation();
    if (!renameSectionValue.trim()) {
      setRenamingSectionId(null);
      return;
    }
    try {
      const res = await fetch(`${backendUrl}/api/sections/${sectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameSectionValue.trim() })
      });
      const data = await res.json();
      if (data.success && data.section) {
        setSections((prev) => prev.map((s) => (s.id === sectionId ? data.section : s)));
      }
    } catch (err) {
      console.error('Error renombrando sección:', err);
    } finally {
      setRenamingSectionId(null);
    }
  };

  // Borrar sección entera
  const handleDeleteSection = async (section, e) => {
    if (e) e.stopPropagation();
    const ok = window.confirm(
      `¿Borrar la sección entera "${section.name}" (${section.contacts?.length || 0} contactos)?`
    );
    if (!ok) return;
    try {
      const res = await fetch(`${backendUrl}/api/sections/${section.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        const remaining = data.sections || [];
        setSections(remaining);
        if (activeSectionId === section.id) {
          setActiveSectionId(remaining.length > 0 ? remaining[0].id : null);
          if (drawerView === 'contacts') setDrawerView('sections');
        }
      }
    } catch (err) {
      alert('Error al borrar la sección.');
    }
  };

  // Borrar un contacto individual dentro de una sección
  const handleDeleteContact = async (sectionId, contact) => {
    const ok = window.confirm(`¿Borrar a "${contact.name}" de esta sección?`);
    if (!ok) return;
    try {
      const res = await fetch(`${backendUrl}/api/sections/${sectionId}/contacts/${contact.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success && data.section) {
        setSections((prev) => prev.map((s) => (s.id === sectionId ? data.section : s)));
      }
    } catch (err) {
      alert('Error al borrar el contacto.');
    }
  };

  // Marcar / desmarcar como contactado por WhatsApp
  const handleToggleContacted = async (sectionId, contact, forceValue = null) => {
    const nextVal = typeof forceValue === 'boolean' ? forceValue : !contact.contacted;
    try {
      const res = await fetch(`${backendUrl}/api/sections/${sectionId}/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacted: nextVal })
      });
      const data = await res.json();
      if (data.success && data.section) {
        setSections((prev) => prev.map((s) => (s.id === sectionId ? data.section : s)));
      }
    } catch (err) {
      console.error('Error actualizando contacto:', err);
    }
  };

  // Copiar texto al portapapeles
  const handleCopyText = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 1600);
  };

  // Construir mensaje y link de WhatsApp para un contacto
  const buildWhatsAppMessage = (contact) => {
    if (customMessages[contact.id] !== undefined) {
      return customMessages[contact.id];
    }
    return (whatsappTemplate || '')
      .replace(/\{nombre\}/gi, contact.name || '')
      .replace(/\{rubro\}/gi, contact.category || 'comercio')
      .replace(/\{categoria\}/gi, contact.category || 'comercio')
      .replace(/\{lugar\}/gi, contact.address || 'su zona')
      .replace(/\{direccion\}/gi, contact.address || 'su zona')
      .replace(/\{web\}/gi, contact.website || '');
  };

  const buildWhatsAppUrl = (contact) => {
    const cleanPhone = (contact.whatsappPhone || contact.phone || '').replace(/\D/g, '');
    if (!cleanPhone) return null;
    const msg = buildWhatsAppMessage(contact);
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  // Abrir panel lateral en vista de secciones, contactos o excels
  const openDrawer = (view = 'sections', sectionId = null) => {
    setMenuAppsOpen(false);
    if (sectionId) {
      setActiveSectionId(sectionId);
    }
    fetchSectionsAndSettings(sectionId || activeSectionId);
    if (view === 'excels') {
      fetchExcelFiles();
      setExcelPreview(null);
    }
    setDrawerView(view);
    setDrawerOpen(true);
  };

  const closeAllOverlays = () => {
    setDrawerOpen(false);
    setMenuAppsOpen(false);
  };

  // Métricas e indicadores en vivo
  const liveCount = liveResults.length;
  const progressPct = isInfinite
    ? 100
    : Math.min(100, Math.round((liveCount / effectiveLimit) * 100));

  const countWithWhatsApp = liveResults.filter((r) =>
    Boolean(r.whatsappPhone || r.phone || r.whatsapp)
  ).length;
  const countWithOwnWeb = liveResults.filter(
    (r) =>
      r.digitalStatus === 'web_propia' ||
      r.digitalStatus === 'web_y_redes' ||
      r.digitalStatus === 'solo_web' ||
      Boolean(r.website)
  ).length;
  const countWithSocials = liveResults.filter(
    (r) =>
      r.digitalStatus === 'solo_redes' ||
      Boolean(r.instagram || r.facebook || r.tiktok || r.linkedin)
  ).length;
  const countWithoutWeb = liveResults.filter(
    (r) =>
      r.digitalStatus === 'sin_web' ||
      r.digitalStatus === 'solo_redes' ||
      !r.website
  ).length;

  // Los 4 comercios más nuevos arriba para la lista en vivo
  const latestFourBusinesses = [...liveResults].reverse().slice(0, 4);

  // Sección activa para la vista de Outreach en el panel lateral
  const activeSection = sections.find((s) => s.id === activeSectionId) || sections[0] || null;
  const activeContacts = activeSection?.contacts || [];

  const filteredContacts = activeContacts.filter((c) => {
    if (contactFilter === 'pendientes' && c.contacted) return false;
    if (contactFilter === 'contactados' && !c.contacted) return false;
    if (contactFilter === 'con_whatsapp' && !c.phone && !c.whatsappPhone) return false;
    if (contactFilter === 'sin_web' && c.website) return false;

    if (contactSearch.trim()) {
      const q = contactSearch.toLowerCase();
      return (
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.category && c.category.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Formateo amigable de fecha
  const formatSectionDate = (isoStr) => {
    if (!isoStr) return 'Hoy';
    try {
      const date = new Date(isoStr);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const timeStr = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      if (isToday) return `Hoy, ${timeStr}`;
      return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Reciente';
    }
  };

  const formatFileSize = (bytes = 0) => {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  // Mosaicos del menú de 9 puntos
  const appMenuTiles = [
    {
      etiqueta: 'Buscador',
      icono: 'buscar',
      fondo: '#e8f0fe',
      color: '#1967d2',
      onClick: () => {
        setMenuAppsOpen(false);
        setDrawerOpen(false);
        setPageState('idle');
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    },
    {
      etiqueta: 'Mis secciones',
      icono: 'carpeta',
      fondo: '#fef7e0',
      color: '#b06000',
      onClick: () => openDrawer('sections')
    },
    {
      etiqueta: 'WhatsApp',
      icono: 'chat',
      fondo: '#e6f4ea',
      color: '#137333',
      onClick: () => openDrawer(sections.length > 0 ? 'contacts' : 'sections')
    },
    {
      etiqueta: 'Excels',
      icono: 'tabla',
      fondo: '#e6f4ea',
      color: '#137333',
      onClick: () => openDrawer('excels')
    },
    {
      etiqueta: 'Mensaje',
      icono: 'editar',
      fondo: '#f3e8fd',
      color: '#8430ce',
      onClick: () => openDrawer('template')
    },
    {
      etiqueta: 'Ajustes',
      icono: 'ajustes',
      fondo: '#f1f3f4',
      color: '#3c4043',
      onClick: () => openDrawer('settings')
    }
  ];

  const rootClasses = `${pageState}${drawerOpen ? ' dr' : ''}`;

  return (
    <div id="pagina" className={rootClasses}>
      {/* ================================================================== */}
      {/* BARRA SUPERIOR (#barra_superior)                                   */}
      {/* ================================================================== */}
      <header id="barra_superior" className="rise-1">
        <div id="estado_app">
          <span className="status-dot" aria-hidden="true" />
          <span>App local · API Google Maps</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Botón directo al Visor de Archivos Excel locales */}
          <button
            type="button"
            id="boton_mis_secciones"
            style={{ color: '#137333' }}
            onClick={() => openDrawer('excels')}
            title="Ver y abrir archivos Excel guardados en tu PC"
          >
            <MaterialIcon name="tabla" size={18} />
            <span>Excels</span>
            <span className="section-badge" style={{ backgroundColor: '#1e8e3e' }}>
              {excelFiles.length}
            </span>
          </button>

          {/* Botón Mis secciones */}
          <button
            id="boton_mis_secciones"
            type="button"
            onClick={() => openDrawer('sections')}
          >
            <span>Mis secciones</span>
            <span className="section-badge">{sections.length}</span>
          </button>

          <button
            id="boton_menu_apps"
            ref={menuBtnRef}
            type="button"
            className={menuAppsOpen ? 'active' : ''}
            aria-label="Todas las herramientas"
            onClick={() => setMenuAppsOpen((prev) => !prev)}
          >
            <MaterialIcon name="apps" size={24} />
          </button>
        </div>
      </header>

      {/* ================================================================== */}
      {/* MENÚ DE 9 PUNTOS (#menu_apps)                                      */}
      {/* ================================================================== */}
      {menuAppsOpen && (
        <div id="menu_apps" ref={menuAppsRef} role="menu" aria-label="Menú de herramientas">
          {appMenuTiles.map((tile, idx) => (
            <button
              key={tile.etiqueta}
              type="button"
              className="app-tile"
              style={{ animationDelay: `${idx * 45}ms` }}
              onClick={tile.onClick}
            >
              <span
                className="app-tile-icon"
                style={{ backgroundColor: tile.fondo, color: tile.color }}
              >
                <MaterialIcon name={tile.icono} size={24} />
              </span>
              <span className="app-tile-label">{tile.etiqueta}</span>
            </button>
          ))}
        </div>
      )}

      {/* ================================================================== */}
      {/* ESCENARIO CENTRAL (#escenario)                                     */}
      {/* ================================================================== */}
      <main id="escenario">
        {/* 1. Título (Visible en idle) */}
        <h1 className="stage-title rise-2">¿Qué comercios buscamos?</h1>

        {/* 2. Buscador Pastilla de 64px con selector de tope colapsable en un solo botón */}
        <div className="search-pill-outer rise-3">
          <div className="search-pill-inner">
            <MaterialIcon
              name="pin"
              size={24}
              style={{ color: '#5f6368', flexShrink: 0 }}
            />

            <input
              ref={searchInputRef}
              type="text"
              className="search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (pageState === 'run') {
                    handleStopAndSave();
                  } else {
                    handleStartSearch();
                  }
                }
              }}
              placeholder="Ferreterías en Caballito, gimnasios en Palermo…"
              aria-label="Buscar comercios"
            />

            {/* Seleccionador de Tope / Infinito que se cierra en un único botón con el valor elegido */}
            <div ref={limitPickerRef} className="flex items-center">
              {!limitPickerOpen ? (
                <button
                  type="button"
                  className="single-limit-btn"
                  onClick={() => setLimitPickerOpen(true)}
                  title="Tope de comercios a buscar (tocar para cambiar)"
                  aria-label="Cambiar tope de comercios"
                >
                  <span style={{ fontSize: isInfinite ? '18px' : '14px', lineHeight: 1 }}>
                    {isInfinite ? '∞' : effectiveLimit}
                  </span>
                </button>
              ) : (
                <div className="in-search-limits" role="group" aria-label="Seleccionar tope de comercios">
                  {[25, 50, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`in-search-limit-btn ${
                        !isInfinite && Number(customLimit) === preset ? 'active' : ''
                      }`}
                      onClick={() => {
                        setIsInfinite(false);
                        setCustomLimit(preset);
                        setLimitPickerOpen(false);
                      }}
                      title={`Tope de ${preset} comercios`}
                    >
                      {preset}
                    </button>
                  ))}

                  <input
                    type="number"
                    min="1"
                    max="5000"
                    value={customLimit}
                    onClick={() => setIsInfinite(false)}
                    onChange={(e) => {
                      setIsInfinite(false);
                      const val = e.target.value;
                      setCustomLimit(val === '' ? '' : Math.max(1, parseInt(val, 10) || 1));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!customLimit || Number(customLimit) < 1) setCustomLimit(50);
                        setLimitPickerOpen(false);
                      }
                    }}
                    onBlur={() => {
                      if (!customLimit || Number(customLimit) < 1) setCustomLimit(50);
                    }}
                    aria-label="Tope personalizado"
                    title="Escribí un número y presioná Enter"
                    className={`in-search-limit-input ${
                      !isInfinite && ![25, 50, 100].includes(Number(customLimit)) ? 'active' : ''
                    }`}
                  />

                  <button
                    type="button"
                    className={`in-search-limit-btn ${isInfinite ? 'active' : ''}`}
                    onClick={() => {
                      setIsInfinite(true);
                      setLimitPickerOpen(false);
                    }}
                    title="Infinitos hasta que ya no encuentre más comercios"
                    aria-label="Infinitos sin límite"
                    style={{ fontSize: '16px' }}
                  >
                    ∞
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="search-submit-btn"
              onClick={handleSearchButtonClick}
              aria-label={pageState === 'run' ? 'Detener y guardar' : 'Buscar'}
            >
              <MaterialIcon
                name={pageState === 'run' ? 'detener' : 'buscar'}
                size={24}
              />
            </button>
          </div>
        </div>

        {/* 3. Chips de Ajustes (Destino y País de WhatsApp) */}
        <div className="chips-row rise-4">
          {/* Chip 1: Destino */}
          <button
            type="button"
            className="setting-chip"
            aria-label="Destino: tocar para cambiar"
            onClick={() => handleRotateChip('destino')}
          >
            <MaterialIcon name="carpeta" size={18} className="setting-chip-icon" />
            <span className={chipFlip.destino ? 'chip-val-a' : 'chip-val-b'}>
              {currentDest.label}
            </span>
          </button>

          {/* Chip 2: País de WhatsApp */}
          <button
            type="button"
            className="setting-chip"
            aria-label="País de WhatsApp: tocar para cambiar"
            onClick={() => handleRotateChip('pais')}
          >
            <MaterialIcon name="mundo" size={18} className="setting-chip-icon" />
            <span className={chipFlip.pais ? 'chip-val-a' : 'chip-val-b'}>
              {currentCountry.label}
            </span>
          </button>
        </div>

        {/* 4. Sugerencias rápidas (Visibles en idle) */}
        <div className="suggestions-row rise-5">
          {SUGGESTION_ITEMS.map((item) => (
            <button
              key={item}
              type="button"
              className="suggestion-pill"
              onClick={() => {
                setQuery(item);
                searchInputRef.current?.focus();
              }}
            >
              {item}
            </button>
          ))}
        </div>

        {/* 5. Panel en Vivo (Visible en run y done) */}
        <section className="live-panel-grid" aria-live="polite">
          <div className="live-panel-inner">
            {/* Encabezado con contador de 56px y botones de acción */}
            <div className="live-header">
              <div>
                <div
                  className={`live-counter-num ${
                    counterFlip ? 'chip-val-a' : 'chip-val-b'
                  }`}
                >
                  {liveCount}
                </div>
                <div className="live-counter-sub">
                  {pageState === 'run'
                    ? 'comercios recopilados'
                    : 'comercios guardados en tu sección'}
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {pageState === 'run' && (
                  <button
                    type="button"
                    className="btn-tonal"
                    onClick={handleStopAndSave}
                  >
                    Detener y guardar
                  </button>
                )}

                {pageState === 'done' && (
                  <>
                    <button
                      type="button"
                      className="btn-tonal"
                      onClick={() => openDrawer('excels')}
                    >
                      Abrir Visor Excels
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() =>
                        openDrawer(
                          'contacts',
                          lastScrapedSectionId || activeSectionId
                        )
                      }
                    >
                      Ver en Outreach
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Barra de progreso de 4px */}
            <div className="live-progress-track">
              <div
                className="live-progress-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* 4 Indicadores de presencia digital y WhatsApp */}
            <div className="live-indicators">
              <div className="live-indicator-item">
                <span
                  className="live-indicator-dot"
                  style={{ backgroundColor: '#1e8e3e' }}
                />
                <span className="live-indicator-count">{countWithWhatsApp}</span>
                <span>con WhatsApp</span>
              </div>

              <div className="live-indicator-item">
                <span
                  className="live-indicator-dot"
                  style={{ backgroundColor: '#1a73e8' }}
                />
                <span className="live-indicator-count">{countWithOwnWeb}</span>
                <span>con web propia</span>
              </div>

              <div className="live-indicator-item">
                <span
                  className="live-indicator-dot"
                  style={{ backgroundColor: '#8430ce' }}
                />
                <span className="live-indicator-count">{countWithSocials}</span>
                <span>con redes</span>
              </div>

              <div className="live-indicator-item">
                <span
                  className="live-indicator-dot"
                  style={{ backgroundColor: '#e37400' }}
                />
                <span className="live-indicator-count">{countWithoutWeb}</span>
                <span>sin web, oportunidad</span>
              </div>
            </div>

            {/* Lista de los 4 comercios más recientes con máscara inferior */}
            <div className="live-business-list">
              {latestFourBusinesses.map((biz, idx) => {
                const avatarStyle = AVATAR_PALETTE[idx % AVATAR_PALETTE.length];
                const initial = (biz.name || 'C').trim().charAt(0).toUpperCase();
                const detailText =
                  biz.detalle ||
                  `${biz.category || 'Comercio'} · ${biz.address || 'Google Maps'}`;

                let presenceKey = biz.digitalStatus || 'sin_web';
                if (!DIGITAL_PRESENCE_TAGS[presenceKey]) {
                  if (biz.website) presenceKey = 'web_propia';
                  else if (biz.instagram || biz.facebook || biz.tiktok || biz.linkedin)
                    presenceKey = 'solo_redes';
                  else presenceKey = 'sin_web';
                }
                const badge = DIGITAL_PRESENCE_TAGS[presenceKey];

                return (
                  <div
                    key={biz.id || `${biz.name}_${idx}`}
                    className={`live-business-row ${
                      idx === 0 ? (rowFlip ? 'row-anim-a' : 'row-anim-b') : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="business-avatar"
                        style={{
                          backgroundColor: avatarStyle.fondo,
                          color: avatarStyle.texto
                        }}
                      >
                        {initial}
                      </span>
                      <div className="min-w-0">
                        <div
                          className="truncate"
                          style={{ fontSize: '15px', fontWeight: 400, color: '#1f1f1f' }}
                        >
                          {biz.name}
                        </div>
                        <div
                          className="truncate"
                          style={{ fontSize: '13px', fontWeight: 400, color: '#5f6368' }}
                        >
                          {detailText}
                        </div>
                      </div>
                    </div>

                    <span
                      className="presence-badge"
                      style={{
                        backgroundColor: badge.fondo,
                        color: badge.texto
                      }}
                    >
                      {badge.etiqueta}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* ================================================================== */}
      {/* PIE DE PÁGINA (#pie)                                               */}
      {/* ================================================================== */}
      <footer id="pie">Todo se guarda en tu equipo</footer>

      {/* ================================================================== */}
      {/* SCRIM (#scrim)                                                     */}
      {/* ================================================================== */}
      <div
        id="scrim"
        className={drawerOpen ? 'open' : ''}
        onClick={closeAllOverlays}
        aria-hidden="true"
      />

      {/* ================================================================== */}
      {/* PANEL LATERAL DERECHO (#panel_secciones)                           */}
      {/* ================================================================== */}
      <aside
        id="panel_secciones"
        className={`${drawerOpen ? 'open' : ''} ${
          drawerView === 'contacts' || (drawerView === 'excels' && excelPreview)
            ? 'expanded'
            : ''
        }`}
        aria-label="Panel lateral de secciones y archivos Excel"
      >
        {/* ---------------------------------------------------------------- */}
        {/* VISTA 1 DEL PANEL: LISTADO DE MIS SECCIONES                      */}
        {/* ---------------------------------------------------------------- */}
        {drawerView === 'sections' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ fontSize: '22px', fontWeight: 500, margin: 0 }}>
                Mis secciones
              </h2>
              <button
                type="button"
                className="card-icon-btn"
                aria-label="Cerrar"
                onClick={closeAllOverlays}
              >
                <MaterialIcon name="cerrar" size={22} />
              </button>
            </div>

            <button
              type="button"
              className="btn-tonal w-full mb-4"
              style={{ height: '44px' }}
              onClick={handleCreateManualSection}
            >
              <MaterialIcon name="agregar" size={20} />
              <span>Nueva sección</span>
            </button>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {sections.length === 0 ? (
                <div
                  className="text-center py-12 px-4 rounded-[20px]"
                  style={{ border: '1px dashed #dadce0', color: '#5f6368' }}
                >
                  <p style={{ fontSize: '14px', margin: '0 0 6px 0', color: '#1f1f1f' }}>
                    Aún no tenés secciones guardadas
                  </p>
                  <p style={{ fontSize: '13px', margin: 0 }}>
                    Hacé una búsqueda en el buscador principal para crear tu primera sección automáticamente.
                  </p>
                </div>
              ) : (
                sections.map((sec) => {
                  const total = sec.contacts?.length || 0;
                  const contacted = (sec.contacts || []).filter((c) => c.contacted).length;
                  const pct = total > 0 ? Math.round((contacted / total) * 100) : 0;

                  return (
                    <div
                      key={sec.id}
                      className="section-card"
                      onClick={() => {
                        setActiveSectionId(sec.id);
                        setDrawerView('contacts');
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {renamingSectionId === sec.id ? (
                          <div
                            className="flex items-center gap-2 flex-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={renameSectionValue}
                              onChange={(e) => setRenameSectionValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameSection(sec.id, e);
                              }}
                              autoFocus
                              className="flex-1 px-3 py-1.5 rounded-full text-sm"
                              style={{ border: '1px solid #1a73e8' }}
                            />
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
                              onClick={(e) => handleRenameSection(sec.id, e)}
                            >
                              Guardar
                            </button>
                          </div>
                        ) : (
                          <div className="min-w-0 flex-1">
                            <div
                              className="truncate"
                              style={{ fontSize: '16px', fontWeight: 500, color: '#1f1f1f' }}
                            >
                              {sec.name}
                            </div>
                            <div
                              style={{
                                fontSize: '13px',
                                color: '#5f6368',
                                marginTop: '2px'
                              }}
                            >
                              {formatSectionDate(sec.createdAt)}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button
                            type="button"
                            className="card-icon-btn"
                            aria-label="Renombrar"
                            title="Renombrar"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingSectionId(sec.id);
                              setRenameSectionValue(sec.name);
                            }}
                          >
                            <MaterialIcon name="editar" size={18} />
                          </button>

                          <button
                            type="button"
                            className="card-icon-btn"
                            aria-label="Generar y abrir Excel"
                            title="Generar y abrir Excel de esta sección"
                            disabled={exportingSectionId === sec.id}
                            onClick={(e) => handleDownloadSectionExcel(sec, e)}
                          >
                            <MaterialIcon name="descargar" size={18} />
                          </button>

                          <button
                            type="button"
                            className="card-icon-btn danger"
                            aria-label="Borrar sección"
                            title="Borrar sección"
                            onClick={(e) => handleDeleteSection(sec, e)}
                          >
                            <MaterialIcon name="borrar" size={18} />
                          </button>
                        </div>
                      </div>

                      <div
                        className="w-full overflow-hidden mt-3 mb-2"
                        style={{
                          height: '6px',
                          borderRadius: '6px',
                          backgroundColor: '#e8eaed'
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            borderRadius: '6px',
                            backgroundColor: '#1e8e3e',
                            transition: 'width 0.3s cubic-bezier(.2,.9,.2,1)'
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span style={{ fontSize: '13px', color: '#5f6368' }}>
                          {contacted} de {total} contactados
                        </span>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 500,
                            color: '#1a73e8'
                          }}
                        >
                          Ver contactos →
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* VISTA 2 DEL PANEL: VISOR DE ARCHIVOS EXCEL EN CARPETA LOCAL      */}
        {/* ---------------------------------------------------------------- */}
        {drawerView === 'excels' && (
          <>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                {excelPreview && (
                  <button
                    type="button"
                    className="btn-tonal"
                    style={{ height: '36px', padding: '0 14px', fontSize: '13px' }}
                    onClick={() => setExcelPreview(null)}
                  >
                    ← Archivos
                  </button>
                )}
                <h2
                  className="truncate"
                  style={{ fontSize: '20px', fontWeight: 500, margin: 0 }}
                >
                  {excelPreview ? excelPreview.filename : 'Archivos Excel locales'}
                </h2>
              </div>

              <button
                type="button"
                className="card-icon-btn"
                aria-label="Cerrar"
                onClick={closeAllOverlays}
              >
                <MaterialIcon name="cerrar" size={22} />
              </button>
            </div>

            {!excelPreview ? (
              <>
                {/* Ruta de carpeta local y botón para abrir la carpeta en Windows */}
                <div
                  className="rounded-[18px] p-3 mb-4 flex items-center justify-between gap-2"
                  style={{ backgroundColor: '#f8f9fa', border: '1px solid #e8eaed' }}
                >
                  <div className="min-w-0 flex-1">
                    <div style={{ fontSize: '11px', fontWeight: 500, color: '#5f6368' }}>
                      Carpeta local de Excels
                    </div>
                    <div
                      className="truncate"
                      style={{ fontSize: '12px', color: '#1f1f1f' }}
                      title={excelFolderPath}
                    >
                      {excelFolderPath || 'excels/'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-tonal"
                    style={{ height: '34px', padding: '0 12px', fontSize: '12px' }}
                    onClick={handleOpenExcelsFolder}
                  >
                    <MaterialIcon name="carpeta" size={16} />
                    <span>Abrir carpeta</span>
                  </button>
                </div>

                <p style={{ fontSize: '13px', color: '#5f6368', margin: '0 0 12px 0' }}>
                  Tocá cualquier archivo Excel de la lista para <strong>abrirlo directamente en tu PC</strong>:
                </p>

                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {excelFiles.length === 0 ? (
                    <div
                      className="text-center py-12 px-4 rounded-[20px]"
                      style={{ border: '1px dashed #dadce0', color: '#5f6368' }}
                    >
                      <p style={{ fontSize: '14px', margin: '0 0 6px 0', color: '#1f1f1f' }}>
                        Aún no hay archivos Excel en la carpeta local
                      </p>
                      <p style={{ fontSize: '13px', margin: 0 }}>
                        Al completar o exportar cualquier búsqueda, tus archivos <code>.xlsx</code> aparecerán acá listos para abrir con un clic.
                      </p>
                    </div>
                  ) : (
                    excelFiles.map((file) => {
                      const isOpening = openingExcelName === file.filename;
                      return (
                        <div
                          key={file.filename}
                          className="section-card"
                          onClick={(e) => handleOpenExcelOnPc(file.filename, e)}
                          title="Clic para abrir este Excel directamente en tu PC"
                          style={
                            isOpening
                              ? { borderColor: '#1e8e3e', backgroundColor: '#e6f4ea' }
                              : {}
                          }
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span
                                className="business-avatar"
                                style={{
                                  backgroundColor: '#e6f4ea',
                                  color: '#137333'
                                }}
                              >
                                <MaterialIcon name="tabla" size={20} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div
                                  className="truncate"
                                  style={{
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    color: '#1f1f1f'
                                  }}
                                >
                                  {file.filename}
                                </div>
                                <div style={{ fontSize: '12px', color: '#5f6368', marginTop: '2px' }}>
                                  {isOpening
                                    ? '✓ Abriendo en Excel en tu PC…'
                                    : `${formatSectionDate(file.modifiedAt)} · ${formatFileSize(
                                        file.sizeBytes
                                      )}`}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                className="card-icon-btn"
                                title="Ver tabla aquí dentro de la app"
                                aria-label="Ver tabla en la app"
                                onClick={(e) => handlePreviewExcelInApp(file.filename, e)}
                              >
                                <MaterialIcon name="ojo" size={18} />
                              </button>
                              <button
                                type="button"
                                className="card-icon-btn"
                                title="Descargar copia"
                                aria-label="Descargar copia"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(
                                    `${backendUrl}/api/download/${encodeURIComponent(
                                      file.filename
                                    )}`,
                                    '_blank'
                                  );
                                }}
                              >
                                <MaterialIcon name="descargar" size={18} />
                              </button>
                              <button
                                type="button"
                                className="card-icon-btn danger"
                                title="Borrar archivo Excel"
                                aria-label="Borrar archivo Excel"
                                onClick={(e) => handleDeleteExcelFile(file.filename, e)}
                              >
                                <MaterialIcon name="borrar" size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              /* Vista de tabla interna cuando el usuario toca el ícono de ojo en un Excel */
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                  <div className="flex flex-wrap gap-1.5">
                    {(excelPreview.sheets || []).map((sh, idx) => (
                      <button
                        key={sh.name}
                        type="button"
                        onClick={() => setActiveSheetIdx(idx)}
                        className="px-3 py-1 rounded-full text-xs font-medium cursor-pointer"
                        style={
                          activeSheetIdx === idx
                            ? {
                                backgroundColor: '#e6f4ea',
                                color: '#137333',
                                border: '1px solid #a8dab5'
                              }
                            : {
                                backgroundColor: '#ffffff',
                                color: '#3c4043',
                                border: '1px solid #dadce0'
                              }
                        }
                      >
                        {sh.name} ({sh.totalRows})
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="btn-primary"
                    style={{
                      height: '34px',
                      padding: '0 14px',
                      fontSize: '12px',
                      backgroundColor: '#1e8e3e'
                    }}
                    onClick={() => handleOpenExcelOnPc(excelPreview.filename)}
                  >
                    Abrir en Microsoft Excel
                  </button>
                </div>

                {loadingPreview ? (
                  <div className="py-12 text-center" style={{ color: '#5f6368', fontSize: '14px' }}>
                    Cargando hojas del Excel…
                  </div>
                ) : (
                  <div
                    className="flex-1 overflow-auto rounded-[16px]"
                    style={{ border: '1px solid #dadce0' }}
                  >
                    {(() => {
                      const sheet =
                        excelPreview.sheets?.[activeSheetIdx] || excelPreview.sheets?.[0];
                      if (!sheet) return null;
                      return (
                        <table
                          className="w-full text-left border-collapse"
                          style={{ fontSize: '12px' }}
                        >
                          <thead>
                            <tr style={{ backgroundColor: '#f1f3f4' }}>
                              {sheet.headers.map((h, i) => (
                                <th
                                  key={i}
                                  className="px-3 py-2 font-medium whitespace-nowrap"
                                  style={{
                                    borderBottom: '1px solid #dadce0',
                                    color: '#1f1f1f'
                                  }}
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sheet.rows.map((row, rIdx) => (
                              <tr
                                key={rIdx}
                                style={{
                                  backgroundColor: rIdx % 2 === 0 ? '#ffffff' : '#f8f9fa',
                                  borderBottom: '1px solid #e8eaed'
                                }}
                              >
                                {sheet.headers.map((_, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className="px-3 py-2 max-w-[200px] truncate"
                                    style={{ color: '#3c4043' }}
                                    title={row[cIdx] || ''}
                                  >
                                    {row[cIdx] || ''}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* VISTA 3 DEL PANEL: CONTACTOS DE LA SECCIÓN & WHATSAPP OUTREACH   */}
        {/* ---------------------------------------------------------------- */}
        {drawerView === 'contacts' && (
          <>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  className="btn-tonal"
                  style={{ height: '36px', padding: '0 14px', fontSize: '13px' }}
                  onClick={() => setDrawerView('sections')}
                >
                  ← Secciones
                </button>
                <h2
                  className="truncate"
                  style={{ fontSize: '20px', fontWeight: 500, margin: 0 }}
                  title={activeSection?.name}
                >
                  {activeSection?.name || 'Contactos'}
                </h2>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {activeSection && (
                  <>
                    <button
                      type="button"
                      className="card-icon-btn"
                      aria-label="Editar plantilla de WhatsApp"
                      title="Configurar plantilla de WhatsApp"
                      onClick={() => setDrawerView('template')}
                    >
                      <MaterialIcon name="editar" size={18} />
                    </button>
                    <button
                      type="button"
                      className="card-icon-btn"
                      aria-label="Generar y abrir Excel"
                      title="Generar y abrir Excel de esta sección"
                      onClick={(e) => handleDownloadSectionExcel(activeSection, e)}
                    >
                      <MaterialIcon name="descargar" size={18} />
                    </button>
                    <button
                      type="button"
                      className="card-icon-btn danger"
                      aria-label="Borrar sección"
                      title="Borrar esta sección entera"
                      onClick={(e) => handleDeleteSection(activeSection, e)}
                    >
                      <MaterialIcon name="borrar" size={18} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="card-icon-btn"
                  aria-label="Cerrar"
                  onClick={closeAllOverlays}
                >
                  <MaterialIcon name="cerrar" size={22} />
                </button>
              </div>
            </div>

            {/* Buscador interno y chips de filtro */}
            <div className="space-y-2.5 mb-3">
              <div
                className="flex items-center gap-2 px-3.5 py-2 rounded-full"
                style={{ backgroundColor: '#f1f3f4' }}
              >
                <MaterialIcon name="buscar" size={18} style={{ color: '#5f6368' }} />
                <input
                  type="text"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Filtrar por nombre, dirección o teléfono…"
                  aria-label="Filtrar contactos de la sección"
                  className="flex-1 bg-transparent border-none text-sm focus:outline-none"
                  style={{ color: '#1f1f1f' }}
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'todos', label: `Todos (${activeContacts.length})` },
                  {
                    id: 'pendientes',
                    label: `Pendientes (${activeContacts.filter((c) => !c.contacted).length})`
                  },
                  {
                    id: 'contactados',
                    label: `Contactados (${activeContacts.filter((c) => c.contacted).length})`
                  },
                  {
                    id: 'con_whatsapp',
                    label: `Con teléfono (${
                      activeContacts.filter((c) => c.phone || c.whatsappPhone).length
                    })`
                  },
                  {
                    id: 'sin_web',
                    label: `Sin web (${activeContacts.filter((c) => !c.website).length})`
                  }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setContactFilter(tab.id)}
                    className="px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors"
                    style={
                      contactFilter === tab.id
                        ? {
                            backgroundColor: '#e8f0fe',
                            color: '#174ea6',
                            border: '1px solid #d2e3fc'
                          }
                        : {
                            backgroundColor: '#ffffff',
                            color: '#3c4043',
                            border: '1px solid #dadce0'
                          }
                    }
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grilla de tarjetas de contacto con botones de Lugar, Teléfono, Web, Redes y WhatsApp */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {filteredContacts.length === 0 ? (
                <div
                  className="text-center py-12 px-4 rounded-[20px]"
                  style={{ border: '1px dashed #dadce0', color: '#5f6368' }}
                >
                  <p style={{ fontSize: '14px', margin: 0 }}>
                    No hay comercios en esta vista.
                  </p>
                </div>
              ) : (
                filteredContacts.map((contact, idx) => {
                  const avatar = AVATAR_PALETTE[idx % AVATAR_PALETTE.length];
                  const initial = (contact.name || 'C').trim().charAt(0).toUpperCase();
                  const waUrl = buildWhatsAppUrl(contact);
                  const previewMsg = buildWhatsAppMessage(contact);
                  const isEditingMsg = editingContactMsgId === contact.id;

                  let presenceKey = contact.digitalStatus || 'sin_web';
                  if (!DIGITAL_PRESENCE_TAGS[presenceKey]) {
                    if (contact.website) presenceKey = 'web_propia';
                    else if (
                      contact.instagram ||
                      contact.facebook ||
                      contact.tiktok ||
                      contact.linkedin
                    )
                      presenceKey = 'solo_redes';
                    else presenceKey = 'sin_web';
                  }
                  const badge = DIGITAL_PRESENCE_TAGS[presenceKey];

                  return (
                    <div
                      key={contact.id || idx}
                      className="rounded-[20px] p-4 transition-colors"
                      style={{
                        border: contact.contacted
                          ? '1px solid #a8dab5'
                          : '1px solid #e8eaed',
                        backgroundColor: contact.contacted ? '#f6fbf7' : '#ffffff'
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="business-avatar"
                            style={{
                              backgroundColor: avatar.fondo,
                              color: avatar.texto
                            }}
                          >
                            {initial}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="truncate"
                                style={{
                                  fontSize: '15px',
                                  fontWeight: 500,
                                  color: '#1f1f1f'
                                }}
                              >
                                {contact.name}
                              </span>
                              <span
                                className="presence-badge"
                                style={{
                                  backgroundColor: badge.fondo,
                                  color: badge.texto
                                }}
                              >
                                {badge.etiqueta}
                              </span>
                            </div>
                            <div
                              className="truncate"
                              style={{ fontSize: '13px', color: '#5f6368' }}
                            >
                              {contact.category || 'Comercio'}
                              {contact.rating ? ` · ★ ${contact.rating}` : ''}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="card-icon-btn danger"
                          aria-label="Borrar contacto"
                          title="Borrar este contacto de la sección"
                          onClick={() => handleDeleteContact(activeSection.id, contact)}
                        >
                          <MaterialIcon name="borrar" size={18} />
                        </button>
                      </div>

                      {/* GRILLA 2x2 DE BOTONES: Lugar, Teléfono, Página Web y Redes */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <a
                          href={
                            contact.mapsUrl ||
                            `https://www.google.com/maps/search/${encodeURIComponent(
                              `${contact.name} ${contact.address || ''}`
                            )}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2.5 px-3 py-2 rounded-[14px] no-underline transition-colors"
                          style={{
                            border: '1px solid #dadce0',
                            backgroundColor: '#f8f9fa',
                            color: '#3c4043'
                          }}
                          title={contact.address || 'Abrir en Google Maps'}
                        >
                          <MaterialIcon
                            name="pin"
                            size={18}
                            style={{ color: '#ea4335', flexShrink: 0 }}
                          />
                          <div className="min-w-0 flex-1">
                            <div style={{ fontSize: '11px', fontWeight: 500, color: '#5f6368' }}>
                              Lugar / Maps
                            </div>
                            <div
                              className="truncate"
                              style={{ fontSize: '13px', color: '#1f1f1f' }}
                            >
                              {contact.address || 'Ver ubicación'}
                            </div>
                          </div>
                        </a>

                        <button
                          type="button"
                          disabled={!contact.phone}
                          onClick={() => handleCopyText(contact.phone, `tel_${contact.id}`)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-[14px] text-left cursor-pointer disabled:opacity-50"
                          style={{
                            border: '1px solid #dadce0',
                            backgroundColor: '#f8f9fa',
                            color: '#3c4043'
                          }}
                          title="Tocar para copiar teléfono"
                        >
                          <MaterialIcon
                            name="chat"
                            size={18}
                            style={{ color: '#1e8e3e', flexShrink: 0 }}
                          />
                          <div className="min-w-0 flex-1">
                            <div style={{ fontSize: '11px', fontWeight: 500, color: '#5f6368' }}>
                              {copiedId === `tel_${contact.id}` ? '¡Copiado!' : 'Teléfono'}
                            </div>
                            <div
                              className="truncate"
                              style={{ fontSize: '13px', color: '#1f1f1f' }}
                            >
                              {contact.phone || 'Sin teléfono'}
                            </div>
                          </div>
                        </button>

                        {contact.website ? (
                          <a
                            href={contact.website}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2.5 px-3 py-2 rounded-[14px] no-underline"
                            style={{
                              border: '1px solid #d2e3fc',
                              backgroundColor: '#e8f0fe',
                              color: '#174ea6'
                            }}
                          >
                            <MaterialIcon
                              name="mundo"
                              size={18}
                              style={{ color: '#1a73e8', flexShrink: 0 }}
                            />
                            <div className="min-w-0 flex-1">
                              <div style={{ fontSize: '11px', fontWeight: 500 }}>
                                Página web
                              </div>
                              <div className="truncate" style={{ fontSize: '13px' }}>
                                {contact.website.replace(/^https?:\/\/(www\.)?/i, '')}
                              </div>
                            </div>
                          </a>
                        ) : (
                          <div
                            className="flex items-center gap-2.5 px-3 py-2 rounded-[14px]"
                            style={{
                              border: '1px solid #e8eaed',
                              backgroundColor: '#fef7e0',
                              color: '#7a4a00'
                            }}
                          >
                            <MaterialIcon
                              name="mundo"
                              size={18}
                              style={{ color: '#b06000', flexShrink: 0 }}
                            />
                            <div className="min-w-0 flex-1">
                              <div style={{ fontSize: '11px', fontWeight: 500 }}>
                                Página web
                              </div>
                              <div className="truncate" style={{ fontSize: '13px' }}>
                                Sin web propia
                              </div>
                            </div>
                          </div>
                        )}

                        <div
                          className="flex flex-col justify-center px-3 py-2 rounded-[14px]"
                          style={{
                            border: '1px solid #dadce0',
                            backgroundColor: '#f8f9fa'
                          }}
                        >
                          <div
                            style={{
                              fontSize: '11px',
                              fontWeight: 500,
                              color: '#5f6368',
                              marginBottom: '4px'
                            }}
                          >
                            Redes sociales
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {contact.instagram && (
                              <a
                                href={contact.instagram}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-0.5 rounded-full text-[11px] font-medium no-underline"
                                style={{ backgroundColor: '#f3e8fd', color: '#6a1b9a' }}
                              >
                                Instagram
                              </a>
                            )}
                            {contact.facebook && (
                              <a
                                href={contact.facebook}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-0.5 rounded-full text-[11px] font-medium no-underline"
                                style={{ backgroundColor: '#e8f0fe', color: '#174ea6' }}
                              >
                                Facebook
                              </a>
                            )}
                            {contact.tiktok && (
                              <a
                                href={contact.tiktok}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-0.5 rounded-full text-[11px] font-medium no-underline"
                                style={{ backgroundColor: '#fce8e6', color: '#c5221f' }}
                              >
                                TikTok
                              </a>
                            )}
                            {contact.linkedin && (
                              <a
                                href={contact.linkedin}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-0.5 rounded-full text-[11px] font-medium no-underline"
                                style={{ backgroundColor: '#e8f0fe', color: '#1967d2' }}
                              >
                                LinkedIn
                              </a>
                            )}
                            {contact.email && contact.email.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyText(contact.email[0], `mail_${contact.id}`)
                                }
                                className="px-2 py-0.5 rounded-full text-[11px] font-medium border-none cursor-pointer"
                                style={{ backgroundColor: '#e6f4ea', color: '#137333' }}
                              >
                                {copiedId === `mail_${contact.id}` ? '¡Email copiado!' : 'Email'}
                              </button>
                            )}
                            {!contact.instagram &&
                              !contact.facebook &&
                              !contact.tiktok &&
                              !contact.linkedin &&
                              (!contact.email || contact.email.length === 0) && (
                                <span style={{ fontSize: '12px', color: '#70757a' }}>
                                  No detectadas
                                </span>
                              )}
                          </div>
                        </div>
                      </div>

                      <div
                        className="rounded-[14px] p-2.5 mb-3"
                        style={{ backgroundColor: '#f8f9fa', border: '1px solid #e8eaed' }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span style={{ fontSize: '11px', fontWeight: 500, color: '#5f6368' }}>
                            Mensaje de WhatsApp
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingContactMsgId(isEditingMsg ? null : contact.id)
                            }
                            className="border-none bg-transparent cursor-pointer"
                            style={{ fontSize: '12px', fontWeight: 500, color: '#1a73e8' }}
                          >
                            {isEditingMsg ? 'Listo' : 'Editar texto'}
                          </button>
                        </div>
                        {isEditingMsg ? (
                          <textarea
                            rows={2}
                            value={previewMsg}
                            onChange={(e) =>
                              setCustomMessages((prev) => ({
                                ...prev,
                                [contact.id]: e.target.value
                              }))
                            }
                            className="w-full rounded-lg p-2 text-xs"
                            style={{ border: '1px solid #1a73e8', color: '#1f1f1f' }}
                          />
                        ) : (
                          <div
                            className="line-clamp-2"
                            style={{ fontSize: '13px', color: '#3c4043' }}
                          >
                            {previewMsg}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {waUrl ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => {
                              if (!contact.contacted) {
                                handleToggleContacted(activeSection.id, contact, true);
                              }
                            }}
                            className="btn-primary flex-1 no-underline"
                            style={{ backgroundColor: '#1e8e3e' }}
                          >
                            <MaterialIcon name="chat" size={18} />
                            <span>Enviar WhatsApp</span>
                          </a>
                        ) : (
                          <div
                            className="flex-1 flex items-center justify-center rounded-full"
                            style={{
                              height: '40px',
                              backgroundColor: '#f1f3f4',
                              color: '#70757a',
                              fontSize: '13px',
                              fontWeight: 500
                            }}
                          >
                            Sin teléfono para WhatsApp
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleToggleContacted(activeSection.id, contact)}
                          className="btn-tonal"
                          style={
                            contact.contacted
                              ? { backgroundColor: '#e6f4ea', color: '#137333' }
                              : {}
                          }
                        >
                          {contact.contacted ? '✓ Contactado' : 'Marcar'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* VISTA 4 DEL PANEL: EDITOR DE PLANTILLA DE MENSAJE DE WHATSAPP    */}
        {/* ---------------------------------------------------------------- */}
        {drawerView === 'template' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-tonal"
                  style={{ height: '36px', padding: '0 14px', fontSize: '13px' }}
                  onClick={() => setDrawerView('sections')}
                >
                  ← Volver
                </button>
                <h2 style={{ fontSize: '22px', fontWeight: 500, margin: 0 }}>
                  Mensaje WhatsApp
                </h2>
              </div>
              <button
                type="button"
                className="card-icon-btn"
                aria-label="Cerrar"
                onClick={closeAllOverlays}
              >
                <MaterialIcon name="cerrar" size={22} />
              </button>
            </div>

            <p style={{ fontSize: '14px', color: '#5f6368', marginTop: 0 }}>
              Personalizá la plantilla predeterminada para contactar a los comercios. Tocá una etiqueta para insertarla:
            </p>

            <div className="flex flex-wrap gap-2 mb-3">
              {['{nombre}', '{rubro}', '{lugar}', '{web}'].map((variable) => (
                <button
                  key={variable}
                  type="button"
                  className="suggestion-pill"
                  onClick={() => {
                    const updated = `${whatsappTemplate} ${variable}`;
                    setWhatsappTemplate(updated);
                    handleSaveSettings(updated, currentCountry.code);
                  }}
                >
                  + {variable}
                </button>
              ))}
            </div>

            <textarea
              rows={5}
              value={whatsappTemplate}
              onChange={(e) => setWhatsappTemplate(e.target.value)}
              onBlur={() => handleSaveSettings(whatsappTemplate, currentCountry.code)}
              aria-label="Plantilla de mensaje de WhatsApp"
              className="w-full rounded-[20px] p-4 text-sm mb-4"
              style={{
                border: '1px solid #dadce0',
                backgroundColor: '#f8f9fa',
                color: '#1f1f1f',
                fontFamily: 'inherit'
              }}
            />

            <div className="flex items-center justify-between">
              <span style={{ fontSize: '13px', color: '#1e8e3e', fontWeight: 500 }}>
                {savingSettings ? 'Guardando…' : '✓ Guardado en tu equipo'}
              </span>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  handleSaveSettings(whatsappTemplate, currentCountry.code);
                  setDrawerView('sections');
                }}
              >
                Listo
              </button>
            </div>
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* VISTA 5 DEL PANEL: AJUSTES Y REGISTRO DE ACTIVIDAD               */}
        {/* ---------------------------------------------------------------- */}
        {drawerView === 'settings' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-tonal"
                  style={{ height: '36px', padding: '0 14px', fontSize: '13px' }}
                  onClick={() => setDrawerView('sections')}
                >
                  ← Volver
                </button>
                <h2 style={{ fontSize: '22px', fontWeight: 500, margin: 0 }}>
                  Ajustes
                </h2>
              </div>
              <button
                type="button"
                className="card-icon-btn"
                aria-label="Cerrar"
                onClick={closeAllOverlays}
              >
                <MaterialIcon name="cerrar" size={22} />
              </button>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div className="section-card" onClick={() => setSimulationMode((p) => !p)}>
                <div className="flex items-center justify-between">
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 500, color: '#1f1f1f' }}>
                      Modo demostración rápida (420 ms)
                    </div>
                    <div style={{ fontSize: '13px', color: '#5f6368', marginTop: '2px' }}>
                      {simulationMode
                        ? 'Activado: simula comercios de prueba cada 420 ms'
                        : 'Desactivado: usa la API real de Google Maps'}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={simulationMode}
                    onChange={(e) => setSimulationMode(e.target.checked)}
                    aria-label="Activar modo demostración rápida"
                    style={{ width: '18px', height: '18px', accentColor: '#1a73e8' }}
                  />
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#1f1f1f',
                    marginBottom: '8px'
                  }}
                >
                  Actividad reciente de la API ({logs.length})
                </div>
                <div
                  className="rounded-[20px] p-3.5 overflow-y-auto space-y-1.5"
                  style={{
                    height: '280px',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #e8eaed',
                    fontSize: '12px',
                    color: '#3c4043'
                  }}
                >
                  {logs.length === 0 ? (
                    <div style={{ color: '#70757a' }}>
                      Sin eventos recientes. Iniciá una búsqueda para ver el progreso.
                    </div>
                  ) : (
                    logs.map((l, i) => (
                      <div key={i}>
                        <span style={{ color: '#70757a', marginRight: '6px' }}>
                          [{l.time}]
                        </span>
                        <span>{l.text}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
