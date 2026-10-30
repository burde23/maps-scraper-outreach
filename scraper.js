import { chromium } from 'playwright';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Cleans private-use Unicode glyphs injected by Google Maps icons.
 */
export function cleanGlyphs(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[\uE000-\uF8FF]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes a phone number into digits ready for https://wa.me/<digits>
 */
export function normalizeWhatsAppPhone(rawPhone = '', whatsappUrl = '', defaultCountryCode = '54') {
  // 1. If we already have a wa.me or api.whatsapp.com URL with phone=..., extract digits from it first
  if (whatsappUrl) {
    const waMatch = whatsappUrl.match(/(?:wa\.me\/|phone=)\+?(\d{8,15})/i);
    if (waMatch && waMatch[1]) {
      return waMatch[1];
    }
  }

  if (!rawPhone) return '';
  const cleaned = cleanGlyphs(rawPhone);
  const hasPlus = cleaned.startsWith('+');
  let digits = cleaned.replace(/\D/g, '');
  if (!digits || digits.length < 7) return '';

  const cc = (defaultCountryCode || '54').replace(/\D/g, '');

  // If it already starts with the country code or had a leading '+'
  if (hasPlus) {
    // Argentina mobile fix: +54 011 15-xxxx-xxxx or +54 11 xxxx-xxxx -> 549...
    if (digits.startsWith('54') && !digits.startsWith('549') && digits.length === 12) {
      return '549' + digits.slice(2);
    }
    return digits;
  }

  // Remove leading 00 (international prefix)
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
    return digits;
  }

  // Country-specific local normalization when number doesn't include country code
  if (cc === '54') {
    // Argentina: e.g. 011 4567-8901 or 011 15-4567-8901 or 11 4567-8901 or 0351 15-...
    if (digits.startsWith('549') && digits.length >= 12) return digits;
    if (digits.startsWith('54') && digits.length === 12) return '549' + digits.slice(2);
    if (digits.startsWith('0')) digits = digits.slice(1);
    // Strip embedded '15' after area code (2, 3, or 4 digit area code)
    digits = digits.replace(/^(11|2\d{1,2}|3\d{1,3})15(\d{6,8})$/, '$1$2');
    if (digits.length === 10) {
      return '549' + digits;
    }
    return '54' + digits;
  }

  if (cc === '55') {
    // Brazil: e.g. (48) 99999-9999
    if (digits.startsWith('55') && digits.length >= 12) return digits;
    if (digits.startsWith('0')) digits = digits.slice(1);
    return '55' + digits;
  }

  if (digits.startsWith(cc) && digits.length >= 11) {
    return digits;
  }

  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return cc ? `${cc}${digits}` : digits;
}

/**
 * Normalizes relative URLs into absolute ones.
 */
function makeAbsolute(baseUrl, relativeUrl) {
  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch (e) {
    return null;
  }
}

/**
 * Validates if an email string is standard and not a static asset / placeholder / telemetry.
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const lower = email.toLowerCase().trim();

  if (lower.includes('%') || lower.includes('http') || lower.includes('www.')) return false;

  const invalidExtensions = [
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.css', '.js',
    '.mp4', '.pdf', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.avif'
  ];
  if (invalidExtensions.some(ext => lower.endsWith(ext))) return false;

  const placeholders = [
    'example@', 'email@', 'domain@', 'correo@', 'sentry@', 'wixpress', 'sentry.io',
    'sentry-next', 'test@', 'yourdomain', 'yourcompany', 'tu@email', 'su@email',
    'ejemplo@', 'user@', 'nombre@email', 'foo@bar', 'sample@', 'admin@example',
    'info@example', 'wix.com', 'shopify.com', 'wordpress.org', 'select2', 'bootstrap',
    'font-awesome', 'jquery.com', 'github.com', 'mailinator.com', 'tempmail', 'yopmail',
    'guerrillamail', 'trashmail', '10minutemail', 'ejemplo.com', 'test.com', 'domain.com',
    ' Cloudflare', ' schema.org', 'w3.org', 'google.com', 'googletagmanager'
  ];
  if (placeholders.some(p => lower.includes(p.trim()))) return false;

  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}$/;
  return regex.test(lower);
}

/**
 * Decrypts Cloudflare-obfuscated email strings.
 */
function decryptCloudflareEmail(encodedString) {
  try {
    let email = '';
    const r = parseInt(encodedString.substring(0, 2), 16);
    for (let n = 2; n < encodedString.length; n += 2) {
      const i = parseInt(encodedString.substring(n, n + 2), 16) ^ r;
      email += String.fromCharCode(i);
    }
    return email;
  } catch (e) {
    return null;
  }
}

/**
 * Checks if a URL is actually a social network or messaging link rather than a standalone website.
 */
function classifyWebsiteUrl(rawUrl) {
  if (!rawUrl) return { isSocialOnly: false, socialType: null };
  const lower = rawUrl.toLowerCase();
  if (lower.includes('instagram.com/')) return { isSocialOnly: true, socialType: 'instagram' };
  if (lower.includes('facebook.com/') || lower.includes('fb.com/')) return { isSocialOnly: true, socialType: 'facebook' };
  if (lower.includes('wa.me/') || lower.includes('whatsapp.com/')) return { isSocialOnly: true, socialType: 'whatsapp' };
  if (lower.includes('tiktok.com/')) return { isSocialOnly: true, socialType: 'tiktok' };
  if (lower.includes('linkedin.com/')) return { isSocialOnly: true, socialType: 'linkedin' };
  if (lower.includes('twitter.com/') || lower.includes('x.com/')) return { isSocialOnly: true, socialType: 'twitter' };
  return { isSocialOnly: false, socialType: null };
}

/**
 * Visits a website (and up to 2 contact subpages) to extract emails and social networks.
 */
export async function scrapeWebsiteContacts(websiteUrl, logCallback = () => {}) {
  const contacts = {
    email: [],
    instagram: '',
    facebook: '',
    whatsapp: '',
    tiktok: '',
    linkedin: '',
    twitter: ''
  };

  if (!websiteUrl) return contacts;

  let targetUrl = websiteUrl.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'http://' + targetUrl;
  }

  // If the "website" on Google Maps is directly a social media profile or WhatsApp link, assign it directly
  const { isSocialOnly, socialType } = classifyWebsiteUrl(targetUrl);
  if (isSocialOnly && socialType) {
    contacts[socialType] = targetUrl;
    logCallback(`  └─ El enlace web en Maps es directamente ${socialType.toUpperCase()}: ${targetUrl}`);
    return contacts;
  }

  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  const visited = new Set();

  async function scrapePage(url) {
    if (visited.has(url) || visited.size >= 3) return;
    visited.add(url);

    try {
      logCallback(`  ├─ Escaneando web: ${url}`);
      const response = await axios.get(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache'
        },
        timeout: 6000,
        validateStatus: false
      });

      if (!response.data || typeof response.data !== 'string') return;
      const html = response.data;
      const $ = cheerio.load(html);

      // 1. Decrypt Cloudflare-obfuscated emails
      $('[data-cfemail]').each((_, el) => {
        const encoded = $(el).attr('data-cfemail');
        if (encoded) {
          const decoded = decryptCloudflareEmail(encoded);
          if (decoded && validateEmail(decoded) && !contacts.email.includes(decoded.toLowerCase())) {
            contacts.email.push(decoded.toLowerCase());
          }
        }
      });

      $('a[href*="email-protection"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const match = href.match(/email-protection#([a-fA-F0-9]+)/);
        if (match && match[1]) {
          const decoded = decryptCloudflareEmail(match[1]);
          if (decoded && validateEmail(decoded) && !contacts.email.includes(decoded.toLowerCase())) {
            contacts.email.push(decoded.toLowerCase());
          }
        }
      });

      // 2. Extract standard emails from mailto: links
      $('a[href^="mailto:"]').each((_, el) => {
        let mail = $(el).attr('href') || '';
        mail = mail.replace(/^mailto:/i, '').trim().split('?')[0].toLowerCase();
        if (validateEmail(mail) && !contacts.email.includes(mail)) {
          contacts.email.push(mail);
        }
      });

      // 3. Extract emails via regex on HTML & text
      const sanitizedHtml = html.replace(/(\.(?:com|es|org|net|store|shop|online|site|app|dev|biz|info|tech|eu|uk|us|ca|ve|pe|uy|bo|py|co|io|cl|mx|ar|br))\b(?=[a-zA-Z])/gi, '$1 ');
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}\b/gi;

      const rawMatches = sanitizedHtml.match(emailRegex) || [];
      for (let mail of rawMatches) {
        mail = mail.trim().toLowerCase().replace(/[.,;:]+$/, '');
        if (validateEmail(mail) && !contacts.email.includes(mail)) {
          contacts.email.push(mail);
        }
      }

      // 4. Extract Social Media & WhatsApp links
      $('a[href]').each((_, el) => {
        const href = ($(el).attr('href') || '').trim();
        const hrefLower = href.toLowerCase();

        if (hrefLower.includes('instagram.com/')) {
          if (!contacts.instagram && !hrefLower.includes('/p/') && !hrefLower.includes('/reel/') && !hrefLower.includes('/tags/') && !hrefLower.includes('/explore/')) {
            contacts.instagram = href;
          }
        } else if (hrefLower.includes('facebook.com/') || hrefLower.includes('fb.com/')) {
          if (!contacts.facebook && !hrefLower.includes('sharer') && !hrefLower.includes('share.php') && !hrefLower.includes('/groups/') && !hrefLower.includes('/plugins/')) {
            contacts.facebook = href;
          }
        } else if (hrefLower.includes('wa.me/') || hrefLower.includes('api.whatsapp.com/') || hrefLower.includes('whatsapp.com/send')) {
          if (!contacts.whatsapp) {
            contacts.whatsapp = href;
          }
        } else if (hrefLower.includes('tiktok.com/@')) {
          if (!contacts.tiktok) {
            contacts.tiktok = href;
          }
        } else if (hrefLower.includes('linkedin.com/')) {
          if (!contacts.linkedin && !hrefLower.includes('/share') && !hrefLower.includes('/jobs/')) {
            contacts.linkedin = href;
          }
        } else if (hrefLower.includes('twitter.com/') || hrefLower.includes('x.com/')) {
          if (!contacts.twitter && !hrefLower.includes('/intent/') && !hrefLower.includes('/share')) {
            contacts.twitter = href;
          }
        }
      });

      // Follow up to 2 contact/about pages from homepage
      if (url === targetUrl) {
        const contactLinks = [];
        $('a[href]').each((_, el) => {
          const text = $(el).text().toLowerCase().trim();
          const href = $(el).attr('href') || '';
          const hrefLower = href.toLowerCase();

          const matchTerms = ['contact', 'contacto', 'contato', 'nosotros', 'about', 'quienes', 'quiénes', 'ubicacion', 'sucursales'];
          const isContactPage = matchTerms.some(term => text.includes(term) || hrefLower.includes(term));

          if (isContactPage && href && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('#') && !href.startsWith('javascript:')) {
            const absLink = makeAbsolute(url, href);
            if (absLink && absLink !== url && !contactLinks.includes(absLink)) {
              contactLinks.push(absLink);
            }
          }
        });

        await Promise.all(contactLinks.slice(0, 2).map(link => scrapePage(link)));
      }
    } catch (error) {
      // Quietly ignore external site timeouts/blocks
    }
  }

  await scrapePage(targetUrl);

  const foundSocials = [];
  if (contacts.instagram) foundSocials.push('Instagram');
  if (contacts.facebook) foundSocials.push('Facebook');
  if (contacts.whatsapp) foundSocials.push('WhatsApp');
  if (contacts.tiktok) foundSocials.push('TikTok');
  if (contacts.linkedin) foundSocials.push('LinkedIn');
  if (contacts.twitter) foundSocials.push('X/Twitter');

  if (contacts.email.length > 0) {
    logCallback(`  ├─ Emails detectados: ${contacts.email.join(', ')}`);
  }
  if (foundSocials.length > 0) {
    logCallback(`  └─ Redes detectadas: ${foundSocials.join(', ')}`);
  }

  return contacts;
}

/**
 * Accepts Google's cookie consent screens if they cover the page.
 */
async function handleGoogleConsent(page, logCallback) {
  try {
    const consentButtons = [
      'button:has-text("Aceptar todo")',
      'button:has-text("Accept all")',
      'button:has-text("Aceptar")',
      'button:has-text("Agree")',
      'button[aria-label="Aceptar todo"]',
      'button[aria-label="Accept all"]'
    ];

    for (const selector of consentButtons) {
      const btn = page.locator(selector).first();
      if (await btn.count() > 0) {
        logCallback('Aceptando aviso de cookies de Google...');
        await btn.click();
        await page.waitForLoadState('networkidle').catch(() => {});
        break;
      }
    }
  } catch (e) {
    // ignore
  }
}

/**
 * Computes digital status and normalizes contact fields for a scraped place.
 */
function enrichBusinessRecord(local, defaultCountryCode = '54') {
  const { isSocialOnly, socialType } = classifyWebsiteUrl(local.website);
  if (isSocialOnly && socialType) {
    if (!local[socialType]) {
      local[socialType] = local.website;
    }
    local.socialWebsite = local.website;
    local.website = ''; // Not a standalone domain
  }

  const hasWeb = Boolean(local.website && local.website.trim());
  const hasSocial = Boolean(
    local.instagram || local.facebook || local.tiktok || local.linkedin || local.twitter || local.socialWebsite
  );

  if (hasWeb && hasSocial) {
    local.digitalStatus = 'web_y_redes';
  } else if (hasWeb) {
    local.digitalStatus = 'solo_web';
  } else if (hasSocial) {
    local.digitalStatus = 'solo_redes';
  } else {
    local.digitalStatus = 'sin_web';
  }

  local.whatsappPhone = normalizeWhatsAppPhone(local.phone, local.whatsapp, defaultCountryCode);
  if (!local.whatsapp && local.whatsappPhone) {
    local.whatsapp = `https://wa.me/${local.whatsappPhone}`;
  }

  return local;
}

/**
 * Scrapes Google Maps search results for any general business/commerce.
 */
export async function scrapeGoogleMaps({
  query,
  limit = 20,
  logCallback = () => {},
  resultsCallback = () => {},
  headful = false,
  onBrowserCreated = () => {},
  isAborted = () => false,
  isInfinite = false,
  countryCode = '54'
}) {
  logCallback(`Iniciando navegador Chromium (${headful ? 'Modo Visible' : 'Modo Oculto Rápido'})...`);

  const browser = await chromium.launch({
    headless: !headful,
    args: [
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox'
    ]
  });

  onBrowserCreated(browser);

  const context = await browser.newContext({
    locale: 'es-ES',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: {
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
    }
  });

  const page = await context.newPage();

  try {
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=es`;
    logCallback(`Buscando en Google Maps: "${query}"`);
    await page.goto(searchUrl, { waitUntil: 'load', timeout: 30000 });

    await handleGoogleConsent(page, logCallback);

    const currentUrl = page.url();
    if (currentUrl.includes('/maps/place/')) {
      logCallback('Google Maps redirigió a un comercio único.');
      let local = await scrapePlaceDetails(page, currentUrl, logCallback);
      if (local) {
        local = enrichBusinessRecord(local, countryCode);
        await resultsCallback(local);
        await browser.close();
        return [local];
      }
      await browser.close();
      return [];
    }

    logCallback('Esperando lista de comercios en Google Maps...');
    const feedSelector = 'div[role="feed"]';

    try {
      await Promise.race([
        page.waitForSelector(feedSelector, { timeout: 15000 }),
        page.waitForSelector('text="No se encontraron resultados"', { timeout: 15000 }),
        page.waitForSelector('text="No results found"', { timeout: 15000 })
      ]);
    } catch (e) {
      logCallback('Timeout esperando la lista de resultados de Google Maps.');
      await browser.close();
      return [];
    }

    const scrollContainer = page.locator(feedSelector);
    if (!(await scrollContainer.count())) {
      logCallback('No se encontraron resultados para esta búsqueda.');
      await browser.close();
      return [];
    }

    let matchedCount = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = isInfinite ? 250 : 60;
    const maxInspected = isInfinite ? 999999 : Math.max(150, limit * 4);
    let inspectedCount = 0;

    const placeUrls = [];
    const processedUrls = new Set();
    const results = [];

    if (isInfinite) {
      logCallback(`Extracción continua activa (SIN LÍMITE). Presiona "Detener" cuando quieras finalizar.`);
    } else {
      logCallback(`Extrayendo hasta ${limit} comercios de Google Maps...`);
    }

    while ((isInfinite || matchedCount < limit) && inspectedCount < maxInspected) {
      if (isAborted()) {
        logCallback('⛔ Búsqueda detenida por el usuario.');
        break;
      }

      // 1. Collect visible place links from the feed
      const links = await scrollContainer.locator('a[href*="/maps/place/"]').all();
      for (const link of links) {
        const href = await link.getAttribute('href');
        if (href) {
          const cleanUrl = href.split('?')[0];
          if (!processedUrls.has(cleanUrl) && !placeUrls.includes(cleanUrl)) {
            placeUrls.push(cleanUrl);
          }
        }
      }

      // 2. Scroll feed if queue is empty
      if (placeUrls.length === 0) {
        if (scrollAttempts >= maxScrollAttempts) {
          logCallback('Se alcanzó el límite de desplazamientos en la lista.');
          break;
        }

        logCallback('Desplazando mapa para cargar más comercios...');
        for (let s = 0; s < 3; s++) {
          const lastLink = scrollContainer.locator('a[href*="/maps/place/"]').last();
          if (await lastLink.count() > 0) {
            await lastLink.scrollIntoViewIfNeeded().catch(() => {});
          }
          await scrollContainer.evaluate(el => el.scrollBy(0, 1500)).catch(() => {});
          await page.mouse.wheel(0, 2500).catch(() => {});
          await page.waitForTimeout(900);
        }
        await page.waitForTimeout(1200);

        const linksAfter = await scrollContainer.locator('a[href*="/maps/place/"]').all();
        for (const link of linksAfter) {
          const href = await link.getAttribute('href');
          if (href) {
            const cleanUrl = href.split('?')[0];
            if (!processedUrls.has(cleanUrl) && !placeUrls.includes(cleanUrl)) {
              placeUrls.push(cleanUrl);
            }
          }
        }

        if (placeUrls.length > 0) {
          scrollAttempts = 0;
        }

        const bodyText = await scrollContainer.innerText().catch(() => '');
        const endReached =
          bodyText.includes('Fin de la lista') ||
          bodyText.includes("You've reached the end of the list") ||
          bodyText.includes('final de la lista');

        if (placeUrls.length === 0 && endReached) {
          logCallback('Se llegó al final de la lista de Google Maps.');
          break;
        }

        scrollAttempts++;
        continue;
      }

      // 3. Open next place URL in an isolated tab so feed scroll never resets
      const url = placeUrls.shift();
      processedUrls.add(url);
      inspectedCount++;

      const progressLabel = isInfinite
        ? `[Continuo | Escaneados: ${inspectedCount} | Guardados: ${matchedCount}]`
        : `[Progreso: ${matchedCount + 1}/${limit} | Escaneados: ${inspectedCount}]`;
      logCallback(progressLabel);

      try {
        const detailPage = await context.newPage();
        await detailPage.setExtraHTTPHeaders({
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
        });

        let local = await scrapePlaceDetails(detailPage, url, logCallback);
        await detailPage.close().catch(() => {});

        if (local) {
          local = enrichBusinessRecord(local, countryCode);
          matchedCount++;
          results.push(local);
          await resultsCallback(local);

          const phoneTag = local.phone ? `📞 ${local.phone}` : 'Sin tel';
          const webTag = local.website ? '🌐 Con Web' : (local.instagram || local.facebook ? '📱 Solo Redes' : '📍 Solo Maps');
          logCallback(`✓ Guardado: "${local.name}" (${local.category || 'Comercio'}) — ${phoneTag} | ${webTag}`);
        }
      } catch (err) {
        logCallback(`Aviso procesando local: ${err.message}`);
      }
    }

    logCallback(`✅ Extracción completada. Total comercios recopilados: ${results.length}.`);
    await browser.close();
    return results;
  } catch (error) {
    logCallback(`Error en el scraper: ${error.message}`);
    try {
      await browser.close();
    } catch (e) {}
    return [];
  }
}

/**
 * Extracts details from a single Google Maps place page.
 */
async function scrapePlaceDetails(page, url, logCallback) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
  } catch (err) {
    logCallback(`Aviso navegando a ficha: ${err.message}`);
    return null;
  }

  await handleGoogleConsent(page, logCallback);

  const nameLocator = page.locator('h1').first();
  try {
    await nameLocator.waitFor({ state: 'visible', timeout: 10000 });
  } catch (err) {
    return null;
  }

  const rawName = await nameLocator.textContent().catch(() => '');
  const cleanName = cleanGlyphs(rawName);
  if (!cleanName) return null;

  logCallback(`Analizando: "${cleanName}"`);

  const getDetail = async (selectors, waitTimeout = 800) => {
    for (const sel of selectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.count() > 0) {
          await el.waitFor({ state: 'visible', timeout: waitTimeout });
          const text = await el.textContent();
          const cleaned = cleanGlyphs(text);
          if (cleaned) return cleaned;
        }
      } catch (e) {}
    }
    return '';
  };

  const getAttribute = async (selectors, attr, waitTimeout = 800) => {
    for (const sel of selectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.count() > 0) {
          await el.waitFor({ state: 'visible', timeout: waitTimeout });
          const val = await el.getAttribute(attr);
          if (val && val.trim()) return val.trim();
        }
      } catch (e) {}
    }
    return '';
  };

  const category = await getDetail([
    'button[jsaction*="category"]',
    'span[jsaction*="category"]',
    '.DkEaCc',
    'button[data-item-id^="category"]'
  ]);

  let website = await getAttribute([
    'a[data-item-id="authority"]',
    'a[data-tooltip*="website"]',
    'a[data-tooltip*="sitio web"]',
    'a[aria-label*="Sitio web"]',
    'a[aria-label*="website"]'
  ], 'href');

  // Unwrap Google redirect URLs if present
  if (website && website.includes('google.com/url?')) {
    try {
      const parsed = new URL(website);
      website = parsed.searchParams.get('q') || parsed.searchParams.get('url') || website;
    } catch (e) {}
  }

  let phone = await getDetail([
    'button[data-item-id^="phone:tel:"]',
    'button[data-tooltip*="teléfono"]',
    'button[data-tooltip*="phone"]',
    'button[aria-label*="Teléfono"]',
    'a[href^="tel:"]'
  ]);

  // Fallback: extract phone from data-item-id attribute if text was empty
  if (!phone) {
    const phoneAttr = await getAttribute(['button[data-item-id^="phone:tel:"]'], 'data-item-id');
    if (phoneAttr) {
      phone = cleanGlyphs(phoneAttr.replace('phone:tel:', ''));
    }
  }

  const address = await getDetail([
    'button[data-item-id^="address"]',
    'button[data-tooltip*="dirección"]',
    'button[data-tooltip*="address"]',
    'button[aria-label*="Dirección"]'
  ]);

  let rating = '';
  let reviews = '';
  try {
    const f7nice = page.locator('.F7nice').first();
    if (await f7nice.count() > 0) {
      const text = await f7nice.textContent();
      if (text) {
        const match = text.match(/([0-9.,]+)\s*\((.+)\)/);
        if (match) {
          rating = match[1].replace(',', '.');
          reviews = match[2].replace(/[^0-9]/g, '');
        }
      }
    }
  } catch (e) {}

  const businessData = {
    id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    name: cleanName,
    category: category || 'Comercio',
    address: address || '',
    phone: phone || '',
    whatsappPhone: '',
    website: website || '',
    socialWebsite: '',
    rating,
    reviews,
    mapsUrl: url,
    digitalStatus: 'sin_web',
    email: [],
    instagram: '',
    facebook: '',
    whatsapp: '',
    tiktok: '',
    linkedin: '',
    twitter: '',
    contacted: false,
    contactedAt: null,
    createdAt: new Date().toISOString()
  };

  if (website) {
    try {
      const contacts = await scrapeWebsiteContacts(website, logCallback);
      Object.assign(businessData, contacts);
    } catch (e) {
      logCallback(`Aviso analizando web ${website}: ${e.message}`);
    }
  }

  return businessData;
}
