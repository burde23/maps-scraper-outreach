import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Play,
  Square,
  Download,
  Search,
  Hash,
  Eye,
  EyeOff,
  Terminal,
  Building2,
  Globe,
  Mail,
  Phone,
  MapPin,
  Star,
  Infinity as InfinityIcon,
  Compass,
  MessageSquare,
  Trash2,
  FolderOpen,
  FolderPlus,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Share2,
  Edit3,
  ArrowRight,
  Layers,
  Sliders,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

const COUNTRY_OPTIONS = [
  { code: '54', label: '🇦🇷 Argentina (+54)' },
  { code: '55', label: '🇧🇷 Brasil (+55)' },
  { code: '52', label: '🇲🇽 México (+52)' },
  { code: '34', label: '🇪🇸 España (+34)' },
  { code: '56', label: '🇨🇱 Chile (+56)' },
  { code: '57', label: '🇨🇴 Colombia (+57)' },
  { code: '598', label: '🇺🇾 Uruguay (+598)' },
  { code: '51', label: '🇵🇪 Perú (+51)' },
  { code: '1', label: '🇺🇸 EE.UU. / Canadá (+1)' }
];

const QUICK_SEARCH_EXAMPLES = [
  'Ferreterías en Caballito',
  'Gimnasios en Palermo',
  'Restaurantes en Córdoba',
  'Odontólogos en Belgrano',
  'Peluquerías en Rosario',
  'Veterinarias en Mendoza',
  'Estudios Contables en Microcentro',
  'Talleres Mecánicos en Lanús'
];

export default function App() {
  const backendUrl = import.meta.env.DEV ? 'http://localhost:3005' : '';

  // Main View: 'scraper' | 'outreach'
  const [mainView, setMainView] = useState('scraper');

  // Saved Sections & Settings (Persisted in local backend data/database.json)
  const [sections, setSections] = useState([]);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [whatsappTemplate, setWhatsappTemplate] = useState(
    '¡Hola {nombre}! 👋 Los encontré buscando *{rubro}* en Google Maps ({lugar}) y quería ponerme en contacto con ustedes.'
  );
  const [countryCode, setCountryCode] = useState('54');
  const [savingSettings, setSavingSettings] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);

  // Scraper Search Form State
  const [query, setQuery] = useState('Ferreterías en Caballito');
  const [customSectionName, setCustomSectionName] = useState('');
  const [targetSectionChoice, setTargetSectionChoice] = useState('new'); // 'new' or section.id
  const [limit, setLimit] = useState(25);
  const [isInfinite, setIsInfinite] = useState(false);
  const [headful, setHeadful] = useState(false);

  // Live Scraping State
  const [isScraping, setIsScraping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [liveResults, setLiveResults] = useState([]);
  const [downloadFilename, setDownloadFilename] = useState(null);
  const [lastScrapedSectionId, setLastScrapedSectionId] = useState(null);
  const [liveFilterTab, setLiveFilterTab] = useState('todos');

  // Outreach Section View State
  const [contactSearch, setContactSearch] = useState('');
  const [contactFilter, setContactFilter] = useState('todos'); // 'todos' | 'pendientes' | 'contactados' | 'con_web' | 'sin_web' | 'con_whatsapp'
  const [copiedId, setCopiedId] = useState(null);
  const [editingContactMsgId, setEditingContactMsgId] = useState(null);
  const [customMessages, setCustomMessages] = useState({});
  const [renamingSectionId, setRenamingSectionId] = useState(null);
  const [renameSectionValue, setRenameSectionValue] = useState('');
  const [exportingSectionId, setExportingSectionId] = useState(null);

  const logsEndRef = useRef(null);
  const eventSourceRef = useRef(null);

  // Load sections and settings on startup
  const fetchSectionsAndSettings = async (selectId = null) => {
    try {
      const res = await fetch(`${backendUrl}/api/sections`);
      const data = await res.json();
      if (data.success) {
        const list = data.sections || [];
        setSections(list);
        if (data.settings) {
          setWhatsappTemplate(data.settings.whatsappTemplate || whatsappTemplate);
          setCountryCode(data.settings.defaultCountryCode || '54');
        }
        if (selectId) {
          setActiveSectionId(selectId);
        } else if (!activeSectionId && list.length > 0) {
          setActiveSectionId(list[0].id);
        } else if (activeSectionId && !list.some(s => s.id === activeSectionId)) {
          setActiveSectionId(list.length > 0 ? list[0].id : null);
        }
      }
    } catch (err) {
      console.error('Error cargando secciones:', err);
    }
  };

  useEffect(() => {
    fetchSectionsAndSettings();
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const addLog = (text, type = 'info') => {
    const time = new Date().toLocaleTimeString('es-AR');
    setLogs(prev => [...prev, { text, type, time }]);
  };

  // Save WhatsApp template & country code settings
  const handleSaveSettings = async (newTemplate = whatsappTemplate, newCountry = countryCode) => {
    setSavingSettings(true);
    try {
      await fetch(`${backendUrl}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsappTemplate: newTemplate,
          defaultCountryCode: newCountry
        })
      });
    } catch (err) {
      console.error('Error guardando configuración:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  // Start Google Maps Scraping
  const handleStartScraping = () => {
    if (!query.trim()) {
      alert('Por favor escribe qué comercios quieres buscar en Google Maps.');
      return;
    }

    setIsScraping(true);
    setProgress(0);
    setLogs([]);
    setLiveResults([]);
    setDownloadFilename(null);
    setLiveFilterTab('todos');

    const secNameParam = customSectionName.trim() || query.trim();
    addLog(`Iniciando búsqueda universal en Google Maps para: "${query}"...`, 'info');

    const params = new URLSearchParams({
      query: query.trim(),
      sectionName: secNameParam,
      targetSectionId: targetSectionChoice,
      limit: String(limit),
      headful: String(headful),
      infinite: String(isInfinite),
      countryCode
    });

    const sseUrl = `${backendUrl}/api/scrape-stream?${params.toString()}`;
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'section_created' && data.section) {
          setLastScrapedSectionId(data.section.id);
          setActiveSectionId(data.section.id);
          fetchSectionsAndSettings(data.section.id);
        } else if (data.type === 'log') {
          let logType = 'info';
          const msgLower = data.message.toLowerCase();
          if (msgLower.includes('error') || msgLower.includes('crítico')) logType = 'error';
          else if (msgLower.includes('✓') || msgLower.includes('✅') || msgLower.includes('éxito') || msgLower.includes('completada')) logType = 'success';
          else if (msgLower.includes('aviso') || msgLower.includes('⛔')) logType = 'warning';

          addLog(data.message, logType);
        } else if (data.type === 'result') {
          const item = data.data;
          if (data.sectionId) {
            setLastScrapedSectionId(data.sectionId);
          }
          setLiveResults(prev => {
            const updated = [...prev, item];
            if (!isInfinite) {
              setProgress(Math.min(Math.round((updated.length / limit) * 100), 100));
            } else {
              setProgress(100);
            }
            return updated;
          });
          // Refresh sections state so counts update live
          fetchSectionsAndSettings(data.sectionId);
        } else if (data.type === 'complete') {
          setIsScraping(false);
          eventSource.close();
          fetchSectionsAndSettings(data.sectionId);

          if (data.error) {
            addLog(`Finalizado con aviso: ${data.error}`, 'warning');
          } else {
            addLog(`¡Proceso completado! Contactos guardados en su sección y Excel generado.`, 'success');
            setDownloadFilename(data.filename);
            if (data.sectionId) setLastScrapedSectionId(data.sectionId);
            setProgress(100);

            confetti({
              particleCount: 130,
              spread: 75,
              origin: { y: 0.6 }
            });
          }
        }
      } catch (err) {
        console.error('Error parseando mensaje SSE:', err);
      }
    };

    eventSource.onerror = () => {
      addLog('Conexión con el proceso de scraping finalizada o interrumpida.', 'warning');
      setIsScraping(false);
      eventSource.close();
      fetchSectionsAndSettings();
    };
  };

  // Stop Scraping and generate partial Excel
  const handleStopScraping = async () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setIsScraping(false);
    await fetchSectionsAndSettings(lastScrapedSectionId);

    if (liveResults.length > 0) {
      addLog(`Proceso detenido por el usuario. Generando Excel con los ${liveResults.length} comercios recopilados...`, 'warning');
      try {
        const res = await fetch(`${backendUrl}/api/export-excel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            results: liveResults,
            query,
            sectionId: lastScrapedSectionId
          })
        });
        const data = await res.json();
        if (data.filename) {
          setDownloadFilename(data.filename);
          addLog(`¡Excel listo para descargar (${liveResults.length} comercios)! También quedaron guardados en su sección.`, 'success');
        }
      } catch (err) {
        addLog(`Error generando Excel parcial: ${err.message}`, 'error');
      }
    } else {
      addLog('Búsqueda detenida sin resultados.', 'warning');
    }
  };

  // Download Excel from live scraper
  const handleDownloadLiveExcel = async () => {
    if (downloadFilename) {
      window.open(`${backendUrl}/api/download/${downloadFilename}`, '_blank');
      return;
    }
    if (liveResults.length > 0) {
      try {
        const res = await fetch(`${backendUrl}/api/export-excel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ results: liveResults, query, sectionId: lastScrapedSectionId })
        });
        const data = await res.json();
        if (data.filename) {
          setDownloadFilename(data.filename);
          window.open(`${backendUrl}/api/download/${data.filename}`, '_blank');
        }
      } catch (err) {
        alert('Error descargando el Excel: ' + err.message);
      }
    }
  };

  // Download Excel for any saved section
  const handleDownloadSectionExcel = async (section, e) => {
    if (e) e.stopPropagation();
    if (!section.contacts || section.contacts.length === 0) {
      alert('Esta sección no tiene contactos para exportar a Excel.');
      return;
    }
    setExportingSectionId(section.id);
    try {
      const res = await fetch(`${backendUrl}/api/sections/${section.id}/export-excel`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.filename) {
        window.open(`${backendUrl}/api/download/${data.filename}`, '_blank');
        fetchSectionsAndSettings(activeSectionId);
      }
    } catch (err) {
      alert('Error generando Excel de la sección.');
    } finally {
      setExportingSectionId(null);
    }
  };

  // Delete an entire search section
  const handleDeleteSection = async (section, e) => {
    if (e) e.stopPropagation();
    const confirmDelete = window.confirm(
      `¿Estás seguro de que quieres BORRAR la sección entera "${section.name}" con sus ${section.contacts?.length || 0} contactos recopilados?\n\nEsta acción no se puede deshacer.`
    );
    if (!confirmDelete) return;

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
        }
      }
    } catch (err) {
      alert('Error al eliminar la sección: ' + err.message);
    }
  };

  // Rename a section
  const handleRenameSection = async (sectionId) => {
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
      if (data.success) {
        setSections(prev => prev.map(s => (s.id === sectionId ? data.section : s)));
      }
    } catch (err) {
      console.error('Error renombrando sección:', err);
    } finally {
      setRenamingSectionId(null);
    }
  };

  // Create a manual empty section
  const handleCreateManualSection = async () => {
    const name = window.prompt('Nombre para la nueva sección de contactos:');
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
      alert('Error creando sección.');
    }
  };

  // Delete an individual contact inside a section
  const handleDeleteContact = async (sectionId, contact) => {
    const confirmDelete = window.confirm(
      `¿Eliminar el contacto "${contact.name}" de esta sección?`
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${backendUrl}/api/sections/${sectionId}/contacts/${contact.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success && data.section) {
        setSections(prev => prev.map(s => (s.id === sectionId ? data.section : s)));
      }
    } catch (err) {
      alert('Error eliminando contacto: ' + err.message);
    }
  };

  // Toggle contacted status for a contact
  const handleToggleContacted = async (sectionId, contact, forceValue = null) => {
    const newValue = typeof forceValue === 'boolean' ? forceValue : !contact.contacted;
    try {
      const res = await fetch(`${backendUrl}/api/sections/${sectionId}/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacted: newValue })
      });
      const data = await res.json();
      if (data.success && data.section) {
        setSections(prev => prev.map(s => (s.id === sectionId ? data.section : s)));
      }
    } catch (err) {
      console.error('Error actualizando estado de contacto:', err);
    }
  };

  // Copy text to clipboard helper
  const handleCopyText = (text, idKey) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(idKey);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Build personalized WhatsApp message for a contact
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

  // Build wa.me URL for a contact
  const buildWhatsAppUrl = (contact) => {
    const cleanPhone = (contact.whatsappPhone || contact.phone || '').replace(/\D/g, '');
    if (!cleanPhone) return null;
    const msg = buildWhatsAppMessage(contact);
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  // Live Scraper Metrics
  const liveMetrics = {
    total: liveResults.length,
    withWhatsApp: liveResults.filter(r => Boolean(r.whatsappPhone || r.phone || r.whatsapp)).length,
    withOwnWeb: liveResults.filter(r => r.digitalStatus === 'web_y_redes' || r.digitalStatus === 'solo_web').length,
    withSocials: liveResults.filter(r => Boolean(r.instagram || r.facebook || r.tiktok || r.linkedin || r.twitter)).length,
    withoutWeb: liveResults.filter(r => r.digitalStatus === 'sin_web' || r.digitalStatus === 'solo_redes').length
  };

  const filteredLiveResults = liveResults.filter(item => {
    if (liveFilterTab === 'con_whatsapp') return Boolean(item.whatsappPhone || item.phone || item.whatsapp);
    if (liveFilterTab === 'con_web') return item.digitalStatus === 'web_y_redes' || item.digitalStatus === 'solo_web';
    if (liveFilterTab === 'sin_web') return item.digitalStatus === 'sin_web' || item.digitalStatus === 'solo_redes';
    if (liveFilterTab === 'con_redes') return Boolean(item.instagram || item.facebook || item.tiktok || item.linkedin || item.twitter);
    return true;
  });

  // Active Section for Outreach View
  const activeSection = sections.find(s => s.id === activeSectionId) || null;
  const activeContacts = activeSection?.contacts || [];

  const filteredSectionContacts = activeContacts.filter(c => {
    if (contactFilter === 'pendientes' && c.contacted) return false;
    if (contactFilter === 'contactados' && !c.contacted) return false;
    if (contactFilter === 'con_whatsapp' && !c.whatsappPhone && !c.phone) return false;
    if (contactFilter === 'con_web' && !c.website) return false;
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

  const totalStoredContacts = sections.reduce((acc, s) => acc + (s.contacts?.length || 0), 0);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ================================================================== */}
      {/* TOP NAVIGATION HEADER                                              */}
      {/* ================================================================== */}
      <header className="sticky top-0 z-40 bg-[#070b17]/90 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 border border-white/10">
              <Compass className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-extrabold tracking-tight text-white">
                  MAPS <span className="text-indigo-400">SCRAPER</span> & <span className="text-emerald-400">WHATSAPP</span>
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                  App Local
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Buscador universal de comercios en Google Maps, reportes Excel y envío de WhatsApp por secciones
              </p>
            </div>
          </div>

          {/* Main Section Switcher Tabs */}
          <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 w-full md:w-auto">
            <button
              onClick={() => setMainView('scraper')}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mainView === 'scraper'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Buscador Google Maps</span>
              {isScraping && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              )}
            </button>

            <button
              onClick={() => {
                fetchSectionsAndSettings(activeSectionId);
                setMainView('outreach');
              }}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mainView === 'outreach'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Mis Secciones & WhatsApp Outreach</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                mainView === 'outreach'
                  ? 'bg-white text-emerald-700'
                  : 'bg-slate-800 text-emerald-400'
              }`}>
                {sections.length} secc. / {totalStoredContacts}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ================================================================== */}
      {/* VIEW 1: UNIVERSAL GOOGLE MAPS SCRAPER & EXCEL GENERATOR            */}
      {/* ================================================================== */}
      {mainView === 'scraper' && (
        <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Search Controls & Console (4 cols) */}
          <section className="lg:col-span-4 flex flex-col gap-5">
            <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Search className="w-4 h-4 text-indigo-400" />
                  Buscar Comercios en Google Maps
                </h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                  Cualquier Rubro
                </span>
              </div>

              {/* Search Query Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  ¿Qué comercios y en qué lugar quieres buscar?
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={isScraping}
                    placeholder="Ej: ferreterías en Córdoba, gimnasios en Palermo, restaurantes..."
                    className="w-full bg-slate-950/90 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                  />
                </div>

                {/* Quick Example Chips */}
                <div className="pt-1">
                  <span className="text-[10px] text-slate-500 block mb-1.5">Ejemplos rápidos (clic para probar):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_SEARCH_EXAMPLES.slice(0, 6).map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        disabled={isScraping}
                        onClick={() => setQuery(ex)}
                        className="text-[10px] px-2 py-1 rounded-lg bg-slate-950 hover:bg-indigo-950/50 text-slate-400 hover:text-indigo-300 border border-slate-800 hover:border-indigo-500/30 transition-colors cursor-pointer"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section Destination Selector */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <FolderPlus className="w-3.5 h-3.5" />
                    Espacio / Sección donde guardar contactos:
                  </label>
                </div>

                <select
                  value={targetSectionChoice}
                  onChange={(e) => setTargetSectionChoice(e.target.value)}
                  disabled={isScraping}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="new">✨ Crear nueva sección dedicada para esta búsqueda</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>
                      📂 Agregar a sección existente: "{s.name}" ({s.contacts?.length || 0} contactos)
                    </option>
                  ))}
                </select>

                {targetSectionChoice === 'new' && (
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Nombre personalizado de la sección (opcional):
                    </label>
                    <input
                      type="text"
                      value={customSectionName}
                      onChange={(e) => setCustomSectionName(e.target.value)}
                      disabled={isScraping}
                      placeholder={`Por defecto se llamará: "${query || 'Nueva Búsqueda'}"`}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}
              </div>

              {/* Country Code for WhatsApp formatting */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400 block">
                  País para formatear números de WhatsApp:
                </label>
                <select
                  value={countryCode}
                  onChange={(e) => {
                    setCountryCode(e.target.value);
                    handleSaveSettings(whatsappTemplate, e.target.value);
                  }}
                  disabled={isScraping}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {COUNTRY_OPTIONS.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Continuous / Infinite Search Toggle */}
              <div className={`p-3 rounded-xl border transition-all flex items-start gap-2.5 ${
                isInfinite
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-slate-950/60 border-slate-800'
              }`}>
                <input
                  type="checkbox"
                  id="isInfinite"
                  checked={isInfinite}
                  onChange={(e) => setIsInfinite(e.target.checked)}
                  disabled={isScraping}
                  className="mt-1 accent-amber-500 cursor-pointer"
                />
                <label htmlFor="isInfinite" className="text-xs text-slate-200 cursor-pointer select-none">
                  <span className="font-bold text-amber-400 flex items-center gap-1">
                    <InfinityIcon className="w-3.5 h-3.5" />
                    Búsqueda Continua (Sin límite)
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Recorre toda la lista de Google Maps hasta que presiones "Detener".
                  </span>
                </label>
              </div>

              {/* Limit & Headful Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">
                    {isInfinite ? 'Límite (Sin límite)' : 'Cantidad de Comercios'}
                  </label>
                  <div className="relative">
                    <Hash className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={limit}
                      onChange={(e) => setLimit(parseInt(e.target.value, 10) || 1)}
                      disabled={isScraping || isInfinite}
                      className={`w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white font-mono ${
                        isInfinite ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">
                    Ventana del Navegador
                  </label>
                  <button
                    type="button"
                    onClick={() => setHeadful(!headful)}
                    disabled={isScraping}
                    className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      headful
                        ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {headful ? <Eye className="w-3.5 h-3.5 text-indigo-400" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{headful ? 'Visible' : 'Oculto (Rápido)'}</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2.5">
                {!isScraping ? (
                  <button
                    onClick={handleStartScraping}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Iniciar Búsqueda en Google Maps
                  </button>
                ) : (
                  <button
                    onClick={handleStopScraping}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-sm shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    Detener y Guardar Recopilados ({liveResults.length})
                  </button>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={handleDownloadLiveExcel}
                    disabled={liveResults.length === 0 || isScraping}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
                      liveResults.length > 0 && !isScraping
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-600/20 cursor-pointer'
                        : 'bg-slate-950/60 text-slate-600 border-slate-800/80 cursor-not-allowed'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar Excel {liveResults.length > 0 ? `(${liveResults.length})` : ''}</span>
                  </button>

                  <button
                    onClick={() => {
                      if (lastScrapedSectionId) setActiveSectionId(lastScrapedSectionId);
                      fetchSectionsAndSettings(lastScrapedSectionId || activeSectionId);
                      setMainView('outreach');
                    }}
                    disabled={liveResults.length === 0 && sections.length === 0}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
                      liveResults.length > 0 || sections.length > 0
                        ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-emerald-500/30 cursor-pointer'
                        : 'bg-slate-950/60 text-slate-600 border-slate-800/80 cursor-not-allowed'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Ver en WhatsApp Outreach</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Real-time Event Console */}
            <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-4 shadow-xl flex flex-col h-72">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  Consola de Scrapeo en Vivo
                </h3>
                <span className="text-[11px] font-mono text-slate-500">{logs.length} eventos</span>
              </div>
              <div className="flex-1 bg-[#03060c] border border-slate-800/80 rounded-xl p-3 overflow-y-auto font-mono text-xs space-y-1.5">
                {logs.length === 0 ? (
                  <div className="text-slate-600 italic text-center pt-12">
                    Consola lista. Ingresa cualquier rubro o comercio y presiona "Iniciar Búsqueda"...
                  </div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="leading-relaxed break-words">
                      <span className="text-slate-600 text-[10px] mr-2">[{log.time}]</span>
                      <span className={
                        log.type === 'error' ? 'text-rose-400' :
                        log.type === 'success' ? 'text-emerald-400' :
                        log.type === 'warning' ? 'text-amber-400' :
                        'text-sky-300'
                      }>
                        {log.text}
                      </span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          </section>

          {/* Right Column: Live Metrics & Results Preview (8 cols) */}
          <section className="lg:col-span-8 flex flex-col gap-5">
            {/* Live Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="font-bold uppercase text-[10px]">Recopilados</span>
                  <Building2 className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-extrabold text-white">{liveMetrics.total}</div>
                <div className="text-[10px] text-slate-500">comercios totales</div>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 border-l-2 border-l-emerald-500 rounded-2xl p-4">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="font-bold uppercase text-[10px]">Con Tel / WA</span>
                  <Phone className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-extrabold text-emerald-400">{liveMetrics.withWhatsApp}</div>
                <div className="text-[10px] text-slate-500">listos para WhatsApp</div>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 border-l-2 border-l-sky-500 rounded-2xl p-4">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="font-bold uppercase text-[10px]">Con Web Propia</span>
                  <Globe className="w-4 h-4 text-sky-400" />
                </div>
                <div className="text-2xl font-extrabold text-sky-400">{liveMetrics.withOwnWeb}</div>
                <div className="text-[10px] text-slate-500">dominio web activo</div>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 border-l-2 border-l-pink-500 rounded-2xl p-4">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="font-bold uppercase text-[10px]">Con Redes</span>
                  <Share2 className="w-4 h-4 text-pink-400" />
                </div>
                <div className="text-2xl font-extrabold text-pink-400">{liveMetrics.withSocials}</div>
                <div className="text-[10px] text-slate-500">IG / FB / TikTok / IN</div>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 border-l-2 border-l-amber-500 rounded-2xl p-4 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="font-bold uppercase text-[10px]">Sin Sitio Web</span>
                  <EyeOff className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-extrabold text-amber-400">{liveMetrics.withoutWeb}</div>
                <div className="text-[10px] text-slate-500">solo Maps o red social</div>
              </div>
            </div>

            {/* Progress Bar while scraping */}
            {isScraping && (
              <div className="bg-slate-900/80 border border-indigo-500/30 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-indigo-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                    {isInfinite
                      ? 'Extracción continua en curso (guardando automáticamente en la sección)...'
                      : `Extrayendo y guardando comercios (${liveResults.length} de ${limit})...`}
                  </span>
                  <span className="font-mono text-indigo-400">{isInfinite ? `${liveResults.length} guardados` : `${progress}%`}</span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                    style={{ width: isInfinite ? '100%' : `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Live Results Panel */}
            <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-5 shadow-xl flex flex-col min-h-[480px]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-400" />
                    Comercios Recopilados en esta Búsqueda
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Todos estos contactos ya se están guardando automáticamente en su sección dedicada de WhatsApp Outreach.
                  </p>
                </div>

                {liveResults.length > 0 && (
                  <button
                    onClick={() => {
                      if (lastScrapedSectionId) setActiveSectionId(lastScrapedSectionId);
                      setMainView('outreach');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
                  >
                    <span>Abrir Grilla de WhatsApp</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { id: 'todos', label: `Todos (${liveMetrics.total})` },
                  { id: 'con_whatsapp', label: `📞 Con Teléfono/WhatsApp (${liveMetrics.withWhatsApp})` },
                  { id: 'con_web', label: `🌐 Con Web Propia (${liveMetrics.withOwnWeb})` },
                  { id: 'con_redes', label: `📸 Con Redes (${liveMetrics.withSocials})` },
                  { id: 'sin_web', label: `🚀 Sin Sitio Web (${liveMetrics.withoutWeb})` }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setLiveFilterTab(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      liveFilterTab === tab.id
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-slate-950/70 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Live Results Table / Cards */}
              {filteredLiveResults.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
                  <Building2 className="w-12 h-12 text-slate-700" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-400">Todavía no hay comercios en esta vista</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Escribe cualquier búsqueda arriba a la izquierda (ej. "Restaurantes en Palermo") y pulsa Iniciar.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/90 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-3">Comercio & Rubro</th>
                        <th className="py-3 px-3">Lugar / Dirección</th>
                        <th className="py-3 px-3">Contacto</th>
                        <th className="py-3 px-3">Página Web</th>
                        <th className="py-3 px-3">Redes & Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredLiveResults.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-3 max-w-[200px]">
                            <div className="font-bold text-white truncate" title={item.name}>{item.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                                {item.category || 'Comercio'}
                              </span>
                              {item.rating && (
                                <span className="text-[10px] text-amber-400 font-mono flex items-center gap-0.5">
                                  <Star className="w-3 h-3 fill-current" />
                                  {item.rating} ({item.reviews})
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3 max-w-[200px]">
                            {item.mapsUrl ? (
                              <a
                                href={item.mapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-300 hover:text-indigo-300 flex items-start gap-1 group"
                                title="Abrir ubicación en Google Maps"
                              >
                                <MapPin className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                                <span className="line-clamp-2 group-hover:underline">{item.address || 'Ver en Maps'}</span>
                              </a>
                            ) : (
                              <span className="text-slate-500">{item.address || '-'}</span>
                            )}
                          </td>

                          <td className="py-3 px-3 font-mono whitespace-nowrap">
                            {item.phone ? (
                              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {item.phone}
                              </span>
                            ) : (
                              <span className="text-slate-600">Sin teléfono</span>
                            )}
                          </td>

                          <td className="py-3 px-3 max-w-[160px] truncate">
                            {item.website ? (
                              <a
                                href={item.website}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-400 hover:underline flex items-center gap-1 truncate"
                              >
                                <Globe className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{item.website.replace(/^https?:\/\/(www\.)?/i, '')}</span>
                              </a>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Sin Web Propia
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex flex-wrap gap-1">
                              {item.instagram && (
                                <a href={item.instagram} target="_blank" rel="noreferrer" className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-500/15 text-pink-400 border border-pink-500/30 hover:bg-pink-500/25">
                                  IG
                                </a>
                              )}
                              {item.facebook && (
                                <a href={item.facebook} target="_blank" rel="noreferrer" className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25">
                                  FB
                                </a>
                              )}
                              {item.tiktok && (
                                <a href={item.tiktok} target="_blank" rel="noreferrer" className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25">
                                  TikTok
                                </a>
                              )}
                              {item.linkedin && (
                                <a href={item.linkedin} target="_blank" rel="noreferrer" className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25">
                                  IN
                                </a>
                              )}
                              {item.email && item.email.length > 0 && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 truncate max-w-[140px]" title={item.email.join(', ')}>
                                  ✉ {item.email[0]}
                                </span>
                              )}
                              {!item.instagram && !item.facebook && !item.tiktok && !item.linkedin && (!item.email || item.email.length === 0) && (
                                <span className="text-slate-600">-</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </main>
      )}

      {/* ================================================================== */}
      {/* VIEW 2: DEDICATED SECTIONS & WHATSAPP OUTREACH GRID                */}
      {/* ================================================================== */}
      {mainView === 'outreach' && (
        <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Sidebar: Dedicated Search Sections (3 cols) */}
          <aside className="lg:col-span-3 bg-slate-900/75 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-4 shadow-xl flex flex-col gap-4 lg:sticky lg:top-24">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-emerald-400" />
                  Secciones de Búsqueda
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Espacios dedicados por cada búsqueda
                </p>
              </div>
              <button
                onClick={handleCreateManualSection}
                className="p-2 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Crear nueva sección vacía"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            </div>

            {sections.length === 0 ? (
              <div className="py-12 px-3 text-center space-y-3">
                <FolderOpen className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  Aún no hay secciones guardadas. Realiza una búsqueda en Google Maps para crear tu primera sección automáticamente.
                </p>
                <button
                  onClick={() => setMainView('scraper')}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                >
                  Ir al Buscador Maps
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-1">
                {sections.map((sec) => {
                  const isSelected = sec.id === activeSectionId;
                  const total = sec.contacts?.length || 0;
                  const contactedCount = (sec.contacts || []).filter(c => c.contacted).length;
                  const pct = total > 0 ? Math.round((contactedCount / total) * 100) : 0;

                  return (
                    <div
                      key={sec.id}
                      onClick={() => setActiveSectionId(sec.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer group ${
                        isSelected
                          ? 'bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border-emerald-500/50 shadow-lg shadow-emerald-950/30'
                          : 'bg-slate-950/70 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {renamingSectionId === sec.id ? (
                          <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                            <input
                              type="text"
                              value={renameSectionValue}
                              onChange={e => setRenameSectionValue(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleRenameSection(sec.id)}
                              autoFocus
                              className="w-full bg-slate-900 border border-emerald-500 rounded px-2 py-1 text-xs text-white"
                            />
                            <button
                              onClick={() => handleRenameSection(sec.id)}
                              className="p-1 bg-emerald-600 text-white rounded text-xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="min-w-0 flex-1">
                            <h3 className={`text-xs font-extrabold truncate ${isSelected ? 'text-emerald-300' : 'text-white'}`}>
                              {sec.name}
                            </h3>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {new Date(sec.createdAt).toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        )}

                        {/* Section Action Buttons: Rename, Excel, Delete Entire Section */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingSectionId(sec.id);
                              setRenameSectionValue(sec.name);
                            }}
                            className="p-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            title="Renombrar sección"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>

                          <button
                            onClick={(e) => handleDownloadSectionExcel(sec, e)}
                            disabled={exportingSectionId === sec.id || total === 0}
                            className="p-1.5 rounded-lg bg-slate-900/90 hover:bg-indigo-600/30 text-indigo-400 hover:text-indigo-200 transition-colors"
                            title="Descargar Excel de esta sección"
                          >
                            <Download className="w-3 h-3" />
                          </button>

                          <button
                            onClick={(e) => handleDeleteSection(sec, e)}
                            className="p-1.5 rounded-lg bg-slate-900/90 hover:bg-rose-600/30 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Borrar esta sección entera y todos sus contactos"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Contacts Progress inside Section */}
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-semibold text-slate-300">{total} comercios</span>
                          <span className="text-emerald-400 font-mono">
                            {contactedCount}/{total} contactados ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          {/* Right Main Area: Section Header, WhatsApp Template & Button Grid of Contacts (9 cols) */}
          <section className="lg:col-span-9 flex flex-col gap-5">
            {!activeSection ? (
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-16 text-center space-y-4">
                <MessageSquare className="w-14 h-14 text-slate-700 mx-auto" />
                <h3 className="text-lg font-bold text-white">Selecciona o crea una sección de búsqueda</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Cada vez que realices una búsqueda en el Buscador de Google Maps, se creará aquí una sección dedicada con todos los comercios listos para contactar por WhatsApp.
                </p>
                <button
                  onClick={() => setMainView('scraper')}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                >
                  Ir a Buscar Comercios en Google Maps
                </button>
              </div>
            ) : (
              <>
                {/* Active Section Top Header */}
                <div className="bg-slate-900/75 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-extrabold">
                          📂 Sección Activa
                        </span>
                        <h2 className="text-xl font-extrabold text-white">{activeSection.name}</h2>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Búsqueda original: <span className="text-slate-300 font-medium">"{activeSection.query}"</span> ·{' '}
                        <span className="text-emerald-400 font-semibold">{activeContacts.length} contactos guardados</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setShowTemplateEditor(!showTemplateEditor)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                          showTemplateEditor
                            ? 'bg-indigo-600 text-white border-indigo-500'
                            : 'bg-slate-950 hover:bg-slate-800 text-indigo-300 border-indigo-500/30'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Configurar Mensaje WhatsApp</span>
                      </button>

                      <button
                        onClick={(e) => handleDownloadSectionExcel(activeSection, e)}
                        disabled={activeContacts.length === 0 || exportingSectionId === activeSection.id}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Descargar Excel ({activeContacts.length})</span>
                      </button>

                      <button
                        onClick={(e) => handleDeleteSection(activeSection, e)}
                        className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Borrar Sección Entera</span>
                      </button>
                    </div>
                  </div>

                  {/* Collapsible WhatsApp Message Template Editor */}
                  {showTemplateEditor && (
                    <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-extrabold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            Plantilla de Mensaje para WhatsApp Outreach
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            Se reemplazará automáticamente con los datos de cada comercio al pulsar "Enviar WhatsApp".
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-400">Insertar variable:</span>
                          {['{nombre}', '{rubro}', '{lugar}', '{web}'].map(variable => (
                            <button
                              key={variable}
                              type="button"
                              onClick={() => {
                                const updated = `${whatsappTemplate} ${variable}`;
                                setWhatsappTemplate(updated);
                                handleSaveSettings(updated, countryCode);
                              }}
                              className="px-2 py-0.5 rounded bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono cursor-pointer"
                            >
                              + {variable}
                            </button>
                          ))}
                        </div>
                      </div>

                      <textarea
                        rows={3}
                        value={whatsappTemplate}
                        onChange={(e) => setWhatsappTemplate(e.target.value)}
                        onBlur={() => handleSaveSettings(whatsappTemplate, countryCode)}
                        placeholder="Escribe el mensaje predeterminado para WhatsApp..."
                        className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs text-white focus:outline-none leading-relaxed"
                      />

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          💡 Tip: También puedes editar el mensaje individual de cualquier comercio antes de enviarlo.
                        </span>
                        <span className="text-emerald-400 font-semibold">
                          {savingSettings ? 'Guardando...' : '✓ Guardado automático'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Search & Filter Bar inside Section */}
                  <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        placeholder="Filtrar por nombre, dirección, rubro o teléfono..."
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        { id: 'todos', label: `Todos (${activeContacts.length})` },
                        { id: 'pendientes', label: `⏳ Pendientes (${activeContacts.filter(c => !c.contacted).length})` },
                        { id: 'contactados', label: `✅ Contactados (${activeContacts.filter(c => c.contacted).length})` },
                        { id: 'con_whatsapp', label: `📞 Con Teléfono (${activeContacts.filter(c => c.phone || c.whatsappPhone).length})` },
                        { id: 'con_web', label: `🌐 Con Web (${activeContacts.filter(c => c.website).length})` },
                        { id: 'sin_web', label: `🚀 Sin Web (${activeContacts.filter(c => !c.website).length})` }
                      ].map(f => (
                        <button
                          key={f.id}
                          onClick={() => setContactFilter(f.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            contactFilter === f.id
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ============================================================ */}
                {/* GRID OF CONTACT CARDS WITH ACTION BUTTONS                    */}
                {/* ============================================================ */}
                {filteredSectionContacts.length === 0 ? (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-14 text-center space-y-2">
                    <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
                    <h4 className="text-sm font-bold text-white">No hay contactos que coincidan con este filtro</h4>
                    <p className="text-xs text-slate-400">
                      Prueba cambiando el filtro superior o realiza una nueva búsqueda en Google Maps.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredSectionContacts.map((contact) => {
                      const waUrl = buildWhatsAppUrl(contact);
                      const previewMsg = buildWhatsAppMessage(contact);
                      const isEditingMsg = editingContactMsgId === contact.id;
                      const hasSocials = Boolean(
                        contact.instagram || contact.facebook || contact.tiktok || contact.linkedin || contact.twitter || (contact.email && contact.email.length > 0)
                      );

                      return (
                        <div
                          key={contact.id}
                          className={`rounded-2xl border p-5 flex flex-col justify-between transition-all shadow-lg ${
                            contact.contacted
                              ? 'bg-slate-900/45 border-emerald-500/30'
                              : 'bg-slate-900/80 border-slate-800/90 hover:border-indigo-500/40'
                          }`}
                        >
                          <div>
                            {/* Card Header: Name, Category, Rating & Individual Delete Button */}
                            <div className="flex items-start justify-between gap-3 mb-3.5">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-base font-extrabold text-white truncate" title={contact.name}>
                                    {contact.name}
                                  </h3>
                                  {contact.contacted && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      Contactado
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                                    {contact.category || 'Comercio'}
                                  </span>

                                  {contact.rating && (
                                    <span className="text-xs font-mono text-amber-400 flex items-center gap-1">
                                      <Star className="w-3.5 h-3.5 fill-current" />
                                      <strong>{contact.rating}</strong>
                                      <span className="text-slate-500 text-[10px]">({contact.reviews || 0} reseñas)</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Delete Individual Contact Button */}
                              <button
                                onClick={() => handleDeleteContact(activeSection.id, contact)}
                                className="p-2 rounded-xl bg-slate-950/90 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 transition-all cursor-pointer flex-shrink-0"
                                title="Borrar este contacto de la sección"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* ================================================== */}
                            {/* WELL-DESIGNED BUTTON GRID: LUGAR, TEL, WEB, REDES */}
                            {/* ================================================== */}
                            <div className="grid grid-cols-2 gap-2.5 mb-3.5">
                              {/* 1. Botón LUGAR / UBICACIÓN */}
                              {contact.mapsUrl || contact.address ? (
                                <a
                                  href={contact.mapsUrl || `https://www.google.com/maps/search/${encodeURIComponent(contact.name + ' ' + contact.address)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-2.5 rounded-xl bg-slate-950/90 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-500/40 flex items-center gap-2.5 group transition-all"
                                  title={contact.address || 'Ver ubicación en Google Maps'}
                                >
                                  <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0 text-rose-400 group-hover:scale-105 transition-transform">
                                    <MapPin className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">
                                      Lugar / Maps
                                    </span>
                                    <span className="text-xs text-slate-200 font-medium truncate block">
                                      {contact.address || 'Abrir en Google Maps'}
                                    </span>
                                  </div>
                                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-rose-400 flex-shrink-0" />
                                </a>
                              ) : (
                                <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/50 flex items-center gap-2.5 opacity-50">
                                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500">
                                    <MapPin className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Lugar</span>
                                    <span className="text-xs text-slate-500">No especificado</span>
                                  </div>
                                </div>
                              )}

                              {/* 2. Botón NÚMERO DE CONTACTO (Click para copiar) */}
                              {contact.phone ? (
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(contact.phone, `phone_${contact.id}`)}
                                  className="p-2.5 rounded-xl bg-slate-950/90 hover:bg-emerald-950/30 border border-slate-800 hover:border-emerald-500/40 flex items-center gap-2.5 text-left group transition-all cursor-pointer"
                                  title="Clic para copiar número de teléfono"
                                >
                                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 text-emerald-400 group-hover:scale-105 transition-transform">
                                    <Phone className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                                      {copiedId === `phone_${contact.id}` ? '¡Copiado!' : 'N° Contacto'}
                                    </span>
                                    <span className="text-xs font-mono font-bold text-white truncate block">
                                      {contact.phone}
                                    </span>
                                  </div>
                                  {copiedId === `phone_${contact.id}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 flex-shrink-0" />
                                  )}
                                </button>
                              ) : (
                                <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/50 flex items-center gap-2.5 opacity-50">
                                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500">
                                    <Phone className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-500 block">N° Contacto</span>
                                    <span className="text-xs text-slate-500">Sin teléfono</span>
                                  </div>
                                </div>
                              )}

                              {/* 3. Botón PÁGINA WEB */}
                              {contact.website ? (
                                <a
                                  href={contact.website}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-2.5 rounded-xl bg-slate-950/90 hover:bg-sky-950/30 border border-slate-800 hover:border-sky-500/40 flex items-center gap-2.5 group transition-all"
                                  title={contact.website}
                                >
                                  <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center flex-shrink-0 text-sky-400 group-hover:scale-105 transition-transform">
                                    <Globe className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">
                                      Página Web
                                    </span>
                                    <span className="text-xs text-slate-200 font-medium truncate block">
                                      {contact.website.replace(/^https?:\/\/(www\.)?/i, '')}
                                    </span>
                                  </div>
                                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 flex-shrink-0" />
                                </a>
                              ) : (
                                <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/50 flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
                                    <EyeOff className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 block">
                                      Página Web
                                    </span>
                                    <span className="text-xs text-slate-400 truncate block">
                                      Sin Sitio Web Propio
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* 4. Grilla / Bloque de Botones REDES SOCIALES & EMAIL */}
                              <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col justify-center">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400 mb-1.5 flex items-center gap-1">
                                  <Share2 className="w-3 h-3" />
                                  Redes & Canales
                                </span>
                                {hasSocials ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {contact.instagram && (
                                      <a
                                        href={contact.instagram}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-2 py-1 rounded-lg bg-pink-500/15 hover:bg-pink-500/30 text-pink-300 border border-pink-500/30 text-[10px] font-bold flex items-center gap-1 transition-colors"
                                        title="Abrir Instagram"
                                      >
                                        <span>Instagram</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    )}
                                    {contact.facebook && (
                                      <a
                                        href={contact.facebook}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-2 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 text-[10px] font-bold flex items-center gap-1 transition-colors"
                                        title="Abrir Facebook"
                                      >
                                        <span>Facebook</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    )}
                                    {contact.tiktok && (
                                      <a
                                        href={contact.tiktok}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-2 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-[10px] font-bold flex items-center gap-1 transition-colors"
                                        title="Abrir TikTok"
                                      >
                                        <span>TikTok</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    )}
                                    {contact.linkedin && (
                                      <a
                                        href={contact.linkedin}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-2 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-[10px] font-bold flex items-center gap-1 transition-colors"
                                        title="Abrir LinkedIn"
                                      >
                                        <span>LinkedIn</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    )}
                                    {contact.twitter && (
                                      <a
                                        href={contact.twitter}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-2 py-1 rounded-lg bg-slate-700/40 hover:bg-slate-700 text-slate-200 border border-slate-600 text-[10px] font-bold flex items-center gap-1 transition-colors"
                                        title="Abrir X / Twitter"
                                      >
                                        <span>X</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    )}
                                    {contact.email && contact.email.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => handleCopyText(contact.email[0], `email_${contact.id}`)}
                                        className="px-2 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono flex items-center gap-1 cursor-pointer"
                                        title={`Copiar email: ${contact.email[0]}`}
                                      >
                                        <Mail className="w-2.5 h-2.5" />
                                        <span>{copiedId === `email_${contact.id}` ? '¡Email copiado!' : 'Email'}</span>
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-500">Sin redes detectadas</span>
                                )}
                              </div>
                            </div>

                            {/* Message Preview / Individual Customizer */}
                            <div className="bg-slate-950/75 border border-slate-800/80 rounded-xl p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  Mensaje de WhatsApp listo para enviar:
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setEditingContactMsgId(isEditingMsg ? null : contact.id)}
                                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>{isEditingMsg ? 'Listo' : 'Personalizar texto'}</span>
                                </button>
                              </div>

                              {isEditingMsg ? (
                                <textarea
                                  rows={3}
                                  value={previewMsg}
                                  onChange={(e) =>
                                    setCustomMessages(prev => ({ ...prev, [contact.id]: e.target.value }))
                                  }
                                  className="w-full bg-slate-900 border border-indigo-500/50 rounded-lg p-2 text-xs text-white focus:outline-none"
                                />
                              ) : (
                                <p className="text-xs text-slate-300 italic line-clamp-2 leading-relaxed">
                                  "{previewMsg}"
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Card Footer: Send WhatsApp Button & Mark Contacted Button */}
                          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2">
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
                                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
                              >
                                <MessageSquare className="w-4 h-4" />
                                <span>Enviar WhatsApp</span>
                                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                              </a>
                            ) : (
                              <div className="flex-1 py-2.5 px-4 rounded-xl bg-slate-950 text-slate-600 border border-slate-800 font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed">
                                <Phone className="w-4 h-4" />
                                <span>Sin Teléfono para WhatsApp</span>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => handleToggleContacted(activeSection.id, contact)}
                              className={`py-2.5 px-3.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                contact.contacted
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-slate-800'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                              }`}
                              title={contact.contacted ? 'Desmarcar como contactado' : 'Marcar como contactado'}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{contact.contacted ? 'Enviado' : 'Marcar'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        </main>
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 py-4 text-center text-xs text-slate-500">
        Maps Scraper & WhatsApp Outreach · Ejecución 100% Local · Almacenamiento Persistente por Secciones
      </footer>
    </div>
  );
}
