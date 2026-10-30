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

  if (hasPlus) {
    if (digits.startsWith('54') && !digits.startsWith('549') && digits.length === 12) {
      return '549' + digits.slice(2);
    }
    return digits;
  }

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
    return digits;
  }

  if (cc === '54') {
    if (digits.startsWith('549') && digits.length >= 12) return digits;
    if (digits.startsWith('54') && digits.length === 12) return '549' + digits.slice(2);
    if (digits.startsWith('0')) digits = digits.slice(1);
    digits = digits.replace(/^(11|2\d{1,2}|3\d{1,3})15(\d{6,8})$/, '$1$2');
    if (digits.length === 10) {
      return '549' + digits;
    }
    return '54' + digits;
  }

  if (cc === '55') {
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
 * Validates if an email string is standard and not a static asset / placeholder.
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
    'cloudflare', 'schema.org', 'w3.org', 'google.com', 'googletagmanager'
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
 * Fast website contact & social network extractor (3s timeout, skips subpages if socials already found).
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

  const { isSocialOnly, socialType } = classifyWebsiteUrl(targetUrl);
  if (isSocialOnly && socialType) {
    contacts[socialType] = targetUrl;
    return contacts;
  }

  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  const visited = new Set();

  async function scrapePage(url) {
    if (visited.has(url) || visited.size >= 2) return;
    visited.add(url);

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
        },
        timeout: 3200,
        maxContentLength: 2500000,
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

      // 3. Extract emails via regex
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

      // Only follow 1 contact subpage if we still haven't found socials or email on the homepage
      const hasAnySocialOrEmail = Boolean(
        contacts.instagram || contacts.facebook || contacts.whatsapp || contacts.email.length > 0
      );

      if (url === targetUrl && !hasAnySocialOrEmail) {
        let bestContactLink = null;
        $('a[href]').each((_, el) => {
          if (bestContactLink) return;
          const text = $(el).text().toLowerCase().trim();
          const href = $(el).attr('href') || '';
          const hrefLower = href.toLowerCase();

          const matchTerms = ['contact', 'contacto', 'contato'];
          const isContactPage = matchTerms.some(term => text.includes(term) || hrefLower.includes(term));

          if (isContactPage && href && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('#') && !href.startsWith('javascript:')) {
            const absLink = makeAbsolute(url, href);
            if (absLink && absLink !== url) {
              bestContactLink = absLink;
            }
          }
        });

        if (bestContactLink) {
          await scrapePage(bestContactLink);
        }
      }
    } catch (error) {
      // Quietly ignore external site timeouts/blocks
    }
  }

  await scrapePage(targetUrl);
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
        await page.waitForLoadState('domcontentloaded').catch(() => {});
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
    local.website = '';
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
 * Fast, parallelized Google Maps scraper with 4 concurrent worker tabs and automatic zone expansion.
 */
export async function scrapeGoogleMaps({
  query,
  limit = 25,
  logCallback = () => {},
  resultsCallback = () => {},
  headful = false,
  onBrowserCreated = () => {},
  isAborted = () => false,
  isInfinite = false,
  countryCode = '54'
}) {
  const WORKER_CONCURRENCY = 4;
  logCallback(`Iniciando motor rápido (${WORKER_CONCURRENCY} canales en paralelo)...`);

  const browser = await chromium.launch({
    headless: !headful,
    args: [
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  onBrowserCreated(browser);

  const context = await browser.newContext({
    locale: 'es-ES',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 860 },
    extraHTTPHeaders: {
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
    }
  });

  // Speed up all pages by blocking heavy images, fonts, media, and ads
  await context.route('**/*', (route) => {
    const req = route.request();
    const type = req.resourceType();
    const url = req.url();
    if (
      type === 'image' ||
      type === 'media' ||
      type === 'font' ||
      url.includes('ggpht.com') ||
      url.includes('googleusercontent.com') ||
      url.includes('doubleclick.net') ||
      url.includes('google-analytics.com') ||
      url.includes('/maps/vt/')
    ) {
      return route.abort();
    }
    return route.continue();
  });

  const mainPage = await context.newPage();

  // Create reusable worker tabs for fast parallel detail extraction
  const workerPages = [];
  for (let i = 0; i < WORKER_CONCURRENCY; i++) {
    workerPages.push(await context.newPage());
  }

  const placeUrlsQueue = [];
  const queuedOrProcessedUrls = new Set();
  const seenBusinessKeys = new Set();
  const results = [];
  let matchedCount = 0;
  let inspectedCount = 0;

  // Build search queries: main query first; if infinite or high limit (>60), queue automatic zone variations
  // so if a single Google Maps feed ends at ~60-120 results, it keeps finding more businesses!
  const searchQueries = [query.trim()];
  if (isInfinite || limit > 60) {
    const modifiers = ['centro', 'norte', 'sur', 'este', 'oeste', 'cerca'];
    for (const mod of modifiers) {
      if (!query.toLowerCase().includes(mod)) {
        searchQueries.push(`${query.trim()} ${mod}`);
      }
    }
  }

  /**
   * Worker function that pulls URLs from placeUrlsQueue and scrapes details in parallel.
   */
  async function processQueueBatch() {
    const activeTasks = [];

    while (
      placeUrlsQueue.length > 0 &&
      (isInfinite || matchedCount < limit) &&
      !isAborted()
    ) {
      const batch = [];
      for (let w = 0; w < WORKER_CONCURRENCY; w++) {
        if (placeUrlsQueue.length === 0) break;
        if (!isInfinite && matchedCount + batch.length >= limit) break;
        batch.push({ workerPage: workerPages[w], url: placeUrlsQueue.shift() });
      }

      if (batch.length === 0) break;

      const batchResults = await Promise.all(
        batch.map(async ({ workerPage, url }) => {
          if (isAborted() || (!isInfinite && matchedCount >= limit)) return null;
          inspectedCount++;
          try {
            const local = await scrapePlaceDetailsFast(workerPage, url, logCallback);
            if (!local || !local.name) return null;

            const dedupKey = `${local.name.toLowerCase()}|${(local.phone || '').replace(/\D/g, '')}`;
            if (seenBusinessKeys.has(dedupKey)) return null;
            seenBusinessKeys.add(dedupKey);

            return enrichBusinessRecord(local, countryCode);
          } catch (err) {
            return null;
          }
        })
      );

      for (const item of batchResults) {
        if (!item) continue;
        if (isAborted() || (!isInfinite && matchedCount >= limit)) break;

        matchedCount++;
        results.push(item);
        await resultsCallback(item);

        const phoneTag = item.phone ? `📞 ${item.phone}` : 'Sin tel';
        logCallback(`✓ [${matchedCount}${isInfinite ? '' : '/' + limit}] ${item.name} — ${phoneTag}`);
      }
    }

    return activeTasks;
  }

  try {
    for (let qIdx = 0; qIdx < searchQueries.length; qIdx++) {
      if (isAborted() || (!isInfinite && matchedCount >= limit)) break;

      const currentQuery = searchQueries[qIdx];
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(currentQuery)}?hl=es`;

      if (qIdx === 0) {
        logCallback(`Buscando en Google Maps: "${currentQuery}"`);
      } else {
        logCallback(`Expandiendo búsqueda en zona: "${currentQuery}" para encontrar más comercios...`);
      }

      await mainPage.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      if (qIdx === 0) {
        await handleGoogleConsent(mainPage, logCallback);
      }

      // Check if Google Maps redirected directly to a single place page
      const currentUrl = mainPage.url();
      if (currentUrl.includes('/maps/place/')) {
        let local = await scrapePlaceDetailsFast(mainPage, currentUrl, logCallback);
        if (local) {
          local = enrichBusinessRecord(local, countryCode);
          const dedupKey = `${local.name.toLowerCase()}|${(local.phone || '').replace(/\D/g, '')}`;
          if (!seenBusinessKeys.has(dedupKey)) {
            seenBusinessKeys.add(dedupKey);
            matchedCount++;
            results.push(local);
            await resultsCallback(local);
          }
        }
        continue;
      }

      const feedSelector = 'div[role="feed"]';
      try {
        await mainPage.waitForSelector(feedSelector, { timeout: 10000 });
      } catch (e) {
        continue;
      }

      const scrollContainer = mainPage.locator(feedSelector);
      if (!(await scrollContainer.count())) continue;

      let emptyScrollRounds = 0;
      const maxEmptyScrollRounds = 12;

      while ((isInfinite || matchedCount < limit) && !isAborted()) {
        // Harvest all currently loaded place links in a single fast DOM evaluate call
        const hrefs = await scrollContainer
          .evaluate((feedEl) => {
            const anchors = feedEl.querySelectorAll('a[href*="/maps/place/"]');
            return Array.from(anchors)
              .map((a) => a.getAttribute('href'))
              .filter(Boolean);
          })
          .catch(() => []);

        let newlyQueued = 0;
        for (const href of hrefs) {
          const cleanUrl = href.split('?')[0];
          if (!queuedOrProcessedUrls.has(cleanUrl)) {
            queuedOrProcessedUrls.add(cleanUrl);
            placeUrlsQueue.push(cleanUrl);
            newlyQueued++;
          }
        }

        // Process queued URLs in parallel batches of 4
        if (placeUrlsQueue.length > 0) {
          emptyScrollRounds = 0;
          await processQueueBatch();
        }

        if (isAborted() || (!isInfinite && matchedCount >= limit)) break;

        // Scroll feed aggressively to trigger Google Maps lazy loading of next 20 items
        await scrollContainer
          .evaluate((el) => {
            el.scrollTop = el.scrollHeight;
          })
          .catch(() => {});

        const lastCard = scrollContainer.locator('a[href*="/maps/place/"]').last();
        if (await lastCard.count() > 0) {
          await lastCard.scrollIntoViewIfNeeded().catch(() => {});
        }

        await scrollContainer.evaluate((el) => el.scrollBy(0, 2500)).catch(() => {});
        await mainPage.waitForTimeout(650);

        // Check if new links appeared after scrolling
        const afterHrefs = await scrollContainer
          .evaluate((feedEl) => {
            const anchors = feedEl.querySelectorAll('a[href*="/maps/place/"]');
            return Array.from(anchors)
              .map((a) => a.getAttribute('href'))
              .filter(Boolean);
          })
          .catch(() => []);

        let addedAfterScroll = 0;
        for (const href of afterHrefs) {
          const cleanUrl = href.split('?')[0];
          if (!queuedOrProcessedUrls.has(cleanUrl)) {
            queuedOrProcessedUrls.add(cleanUrl);
            placeUrlsQueue.push(cleanUrl);
            addedAfterScroll++;
          }
        }

        if (addedAfterScroll > 0) {
          emptyScrollRounds = 0;
          continue;
        }

        // Check if Google Maps explicitly says we reached the end of the list
        const feedText = await scrollContainer
          .evaluate((el) => el.innerText.slice(-400))
          .catch(() => '');

        const endReached =
          feedText.includes('Fin de la lista') ||
          feedText.includes('final de la lista') ||
          feedText.includes("You've reached the end of the list") ||
          feedText.includes('No hay más resultados');

        if (endReached && placeUrlsQueue.length === 0) {
          logCallback(`Fin de esta lista en Google Maps (${matchedCount} comercios recopilados hasta ahora).`);
          break;
        }

        emptyScrollRounds++;
        if (emptyScrollRounds >= maxEmptyScrollRounds && placeUrlsQueue.length === 0) {
          break;
        }

        // Nudge scroll slightly up and down to unstick Google Maps spinner
        await scrollContainer
          .evaluate((el) => {
            el.scrollBy(0, -300);
            setTimeout(() => {
              el.scrollTop = el.scrollHeight;
            }, 100);
          })
          .catch(() => {});
        await mainPage.waitForTimeout(550);
      }
    }

    logCallback(`✅ Extracción finalizada. Total comercios recopilados: ${results.length}.`);
    await browser.close();
    return results;
  } catch (error) {
    logCallback(`Error en el scraper: ${error.message}`);
    try {
      await browser.close();
    } catch (e) {}
    return results;
  }
}

/**
 * Ultra-fast single-pass DOM extraction for a Google Maps place page.
 */
async function scrapePlaceDetailsFast(page, url, logCallback) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 9000 });
  } catch (err) {
    return null;
  }

  try {
    await page.locator('h1').first().waitFor({ state: 'visible', timeout: 5000 });
  } catch (err) {
    return null;
  }

  // Extract all fields in a single synchronous browser evaluation (takes ~1ms instead of 3000ms)
  const rawDetails = await page
    .evaluate(() => {
      const clean = (s) =>
        (s || '')
          .replace(/[\uE000-\uF8FF]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

      const h1 = document.querySelector('h1');
      const name = clean(h1 ? h1.textContent : '');
      if (!name) return null;

      // Category
      const catEl =
        document.querySelector('button[jsaction*="category"]') ||
        document.querySelector('.DkEaCc') ||
        document.querySelector('button[data-item-id^="category"]');
      const category = clean(catEl ? catEl.textContent : '');

      // Website
      const webEl =
        document.querySelector('a[data-item-id="authority"]') ||
        document.querySelector('a[data-tooltip*="website"]') ||
        document.querySelector('a[data-tooltip*="sitio web"]') ||
        document.querySelector('a[aria-label*="Sitio web"]') ||
        document.querySelector('a[aria-label*="website"]');
      let website = webEl ? (webEl.getAttribute('href') || '').trim() : '';

      // Phone
      const phoneEl =
        document.querySelector('button[data-item-id^="phone:tel:"]') ||
        document.querySelector('button[data-tooltip*="teléfono"]') ||
        document.querySelector('button[data-tooltip*="phone"]') ||
        document.querySelector('button[aria-label*="Teléfono"]') ||
        document.querySelector('a[href^="tel:"]');

      let phone = clean(phoneEl ? phoneEl.textContent : '');
      if (!phone && phoneEl) {
        const itemId = phoneEl.getAttribute('data-item-id') || '';
        if (itemId.startsWith('phone:tel:')) {
          phone = clean(itemId.replace('phone:tel:', ''));
        }
      }

      // Address
      const addrEl =
        document.querySelector('button[data-item-id^="address"]') ||
        document.querySelector('button[data-tooltip*="dirección"]') ||
        document.querySelector('button[data-tooltip*="address"]') ||
        document.querySelector('button[aria-label*="Dirección"]');
      const address = clean(addrEl ? addrEl.textContent : '');

      // Rating & Reviews
      let rating = '';
      let reviews = '';
      const f7 = document.querySelector('.F7nice');
      if (f7 && f7.textContent) {
        const m = f7.textContent.match(/([0-9.,]+)\s*\((.+)\)/);
        if (m) {
          rating = m[1].replace(',', '.');
          reviews = m[2].replace(/[^0-9]/g, '');
        }
      }

      return { name, category, website, phone, address, rating, reviews };
    })
    .catch(() => null);

  if (!rawDetails || !rawDetails.name) return null;

  let website = rawDetails.website;
  if (website && website.includes('google.com/url?')) {
    try {
      const parsed = new URL(website);
      website = parsed.searchParams.get('q') || parsed.searchParams.get('url') || website;
    } catch (e) {}
  }

  const businessData = {
    id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    name: rawDetails.name,
    category: rawDetails.category || 'Comercio',
    address: rawDetails.address || '',
    phone: rawDetails.phone || '',
    whatsappPhone: '',
    website: website || '',
    socialWebsite: '',
    rating: rawDetails.rating || '',
    reviews: rawDetails.reviews || '',
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
    } catch (e) {}
  }

  return businessData;
}
