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
  if (invalidExtensions.some((ext) => lower.endsWith(ext))) return false;

  const placeholders = [
    'example@', 'email@', 'domain@', 'correo@', 'sentry@', 'wixpress', 'sentry.io',
    'sentry-next', 'test@', 'yourdomain', 'yourcompany', 'tu@email', 'su@email',
    'ejemplo@', 'user@', 'nombre@email', 'foo@bar', 'sample@', 'admin@example',
    'info@example', 'wix.com', 'shopify.com', 'wordpress.org', 'select2', 'bootstrap',
    'font-awesome', 'jquery.com', 'github.com', 'mailinator.com', 'tempmail', 'yopmail',
    'guerrillamail', 'trashmail', '10minutemail', 'ejemplo.com', 'test.com', 'domain.com',
    'cloudflare', 'schema.org', 'w3.org', 'google.com', 'googletagmanager'
  ];
  if (placeholders.some((p) => lower.includes(p.trim()))) return false;

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
 * Ultra-fast website contact & social network extractor (2.2s timeout, single HTTP request).
 */
export async function scrapeWebsiteContacts(websiteUrl) {
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

  try {
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      },
      timeout: 2200,
      maxContentLength: 1800000,
      validateStatus: false
    });

    if (!response.data || typeof response.data !== 'string') return contacts;
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

    // 2. Extract standard emails from mailto: links
    $('a[href^="mailto:"]').each((_, el) => {
      let mail = $(el).attr('href') || '';
      mail = mail.replace(/^mailto:/i, '').trim().split('?')[0].toLowerCase();
      if (validateEmail(mail) && !contacts.email.includes(mail)) {
        contacts.email.push(mail);
      }
    });

    // 3. Extract emails via regex
    const sanitizedHtml = html.replace(
      /(\.(?:com|es|org|net|store|shop|online|site|app|dev|biz|info|tech|eu|uk|us|ca|ve|pe|uy|bo|py|co|io|cl|mx|ar|br))\b(?=[a-zA-Z])/gi,
      '$1 '
    );
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
        if (
          !contacts.instagram &&
          !hrefLower.includes('/p/') &&
          !hrefLower.includes('/reel/') &&
          !hrefLower.includes('/tags/') &&
          !hrefLower.includes('/explore/')
        ) {
          contacts.instagram = href;
        }
      } else if (hrefLower.includes('facebook.com/') || hrefLower.includes('fb.com/')) {
        if (
          !contacts.facebook &&
          !hrefLower.includes('sharer') &&
          !hrefLower.includes('share.php') &&
          !hrefLower.includes('/groups/') &&
          !hrefLower.includes('/plugins/')
        ) {
          contacts.facebook = href;
        }
      } else if (
        hrefLower.includes('wa.me/') ||
        hrefLower.includes('api.whatsapp.com/') ||
        hrefLower.includes('whatsapp.com/send')
      ) {
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
  } catch (e) {
    // Ignore slow or unreachable external websites
  }

  return contacts;
}

/**
 * Computes digital status and normalizes contact fields for a place.
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
    local.instagram ||
      local.facebook ||
      local.tiktok ||
      local.linkedin ||
      local.twitter ||
      local.socialWebsite
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
 * Queries Google Maps internal JSON API (tbm=map) for 20 places at a given pagination offset.
 * Executes in ~250ms over HTTP without launching any browser.
 */
async function fetchGoogleMapsApiBatch(query, offset = 0) {
  const pb = `!4m8!1m3!1d50000!2d0!3d0!3m2!1i1024!2i768!4f13.1!7i20!8i${offset}!10b1`;
  const url = `https://www.google.com/search?tbm=map&authuser=0&hl=es&q=${encodeURIComponent(
    query
  )}&pb=${encodeURIComponent(pb)}`;

  const response = await axios.get(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8'
    },
    responseType: 'text',
    timeout: 10000
  });

  let raw = response.data || '';
  if (typeof raw !== 'string') {
    raw = JSON.stringify(raw);
  }
  if (raw.startsWith(")]}'")) {
    raw = raw.slice(4).trim();
  }

  const parsed = JSON.parse(raw);
  const entries = parsed?.[0]?.[1];
  if (!Array.isArray(entries)) return [];

  const parsedPlaces = [];

  for (const entry of entries) {
    const p = entry?.[14];
    if (!Array.isArray(p)) continue;

    const name = cleanGlyphs(p[11]);
    if (!name) continue;

    const category =
      cleanGlyphs(Array.isArray(p[13]) && p[13][0] ? p[13][0] : '') || 'Comercio';

    const address = cleanGlyphs(
      p[39] || (Array.isArray(p[2]) ? p[2].join(', ') : '') || p[18] || ''
    );

    // Extract phone number (prefer international or formatted phone from p[178])
    let phone = '';
    if (Array.isArray(p[178]) && Array.isArray(p[178][0])) {
      const phoneBlock = p[178][0];
      const intlCandidate = phoneBlock?.[1]?.[1]?.[0];
      const localCandidate = phoneBlock?.[0];
      phone = cleanGlyphs(intlCandidate || localCandidate || '');
    }

    // Extract website URL from p[7]
    let website = '';
    if (Array.isArray(p[7]) && p[7][0]) {
      website = String(p[7][0]).trim();
      if (website.includes('google.com/url?')) {
        try {
          const u = new URL(website);
          website = u.searchParams.get('q') || u.searchParams.get('url') || website;
        } catch (e) {}
      }
    }

    // Extract rating & review count from p[4]
    const rating =
      Array.isArray(p[4]) && p[4][7] != null ? String(p[4][7]) : '';
    const reviews =
      Array.isArray(p[4]) && p[4][8] != null ? String(p[4][8]) : '';

    // Extract Place ID & coordinates for direct Google Maps link
    const placeId = p[78] ? String(p[78]) : '';
    const lat = Array.isArray(p[9]) ? p[9][2] : null;
    const lng = Array.isArray(p[9]) ? p[9][3] : null;

    let mapsUrl = '';
    if (placeId) {
      mapsUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`;
    } else if (lat != null && lng != null) {
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    } else {
      mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(
        `${name} ${address}`
      )}`;
    }

    parsedPlaces.push({
      id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      placeId,
      name,
      category,
      address,
      phone,
      whatsappPhone: '',
      website,
      socialWebsite: '',
      rating,
      reviews,
      mapsUrl,
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
    });
  }

  return parsedPlaces;
}

/**
 * High-speed Google Maps API scraper with pagination and sub-zone expansion.
 * No browser window is launched; fetches 20 businesses per ~250ms API call.
 */
export async function scrapeGoogleMaps({
  query,
  limit = 50,
  logCallback = () => {},
  resultsCallback = () => {},
  isAborted = () => false,
  isInfinite = false,
  countryCode = '54'
}) {
  logCallback(
    `Conectando a la API de Google Maps para: "${query}" (${
      isInfinite ? 'Modo Infinito' : `Tope: ${limit}`
    })...`
  );

  const results = [];
  const seenKeys = new Set();
  let matchedCount = 0;

  // Build search variations so that if the user chooses Infinite or a high limit (>100),
  // we automatically expand across sub-zones once the main query pages are exhausted.
  const searchQueries = [query.trim()];
  if (isInfinite || limit > 80) {
    const modifiers = [
      'centro',
      'norte',
      'sur',
      'este',
      'oeste',
      'avenida',
      'barrio',
      'cerca'
    ];
    for (const mod of modifiers) {
      if (!query.toLowerCase().includes(mod)) {
        searchQueries.push(`${query.trim()} ${mod}`);
      }
    }
  }

  try {
    for (let qIdx = 0; qIdx < searchQueries.length; qIdx++) {
      if (isAborted() || (!isInfinite && matchedCount >= limit)) break;

      const activeQuery = searchQueries[qIdx];
      if (qIdx > 0) {
        logCallback(`Expandiendo API en sub-zona: "${activeQuery}"...`);
      }

      // Google Maps tbm=map API paginates in steps of 20 (0, 20, 40, 60, ... up to ~200 per query)
      for (let offset = 0; offset <= 220; offset += 20) {
        if (isAborted() || (!isInfinite && matchedCount >= limit)) break;

        let batch = [];
        try {
          batch = await fetchGoogleMapsApiBatch(activeQuery, offset);
        } catch (err) {
          logCallback(`Aviso consultando página (offset ${offset}): ${err.message}`);
          break;
        }

        if (!batch || batch.length === 0) {
          break; // No more pages for this query
        }

        // Filter duplicates and trim batch to remaining limit
        const uniqueBatch = [];
        for (const candidate of batch) {
          const key =
            candidate.placeId ||
            `${candidate.name.toLowerCase()}|${(candidate.phone || '').replace(/\D/g, '')}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);
          uniqueBatch.push(candidate);
          if (!isInfinite && matchedCount + uniqueBatch.length >= limit) {
            break;
          }
        }

        if (uniqueBatch.length === 0) {
          // If an entire page returned only already-seen places, move to next sub-zone
          break;
        }

        // Enrich websites in parallel (up to 10 at a time) and emit each business immediately as it finishes!
        const CONCURRENCY = 10;
        for (let i = 0; i < uniqueBatch.length; i += CONCURRENCY) {
          if (isAborted() || (!isInfinite && matchedCount >= limit)) break;
          const chunk = uniqueBatch.slice(i, i + CONCURRENCY);

          await Promise.all(
            chunk.map(async (biz) => {
              if (isAborted() || (!isInfinite && matchedCount >= limit)) return;

              if (biz.website) {
                const { isSocialOnly } = classifyWebsiteUrl(biz.website);
                if (!isSocialOnly) {
                  const contacts = await scrapeWebsiteContacts(biz.website);
                  Object.assign(biz, contacts);
                }
              }

              const enriched = enrichBusinessRecord(biz, countryCode);
              if (isAborted() || (!isInfinite && matchedCount >= limit)) return;

              matchedCount++;
              results.push(enriched);
              await resultsCallback(enriched);

              const phoneTag = enriched.phone ? `📞 ${enriched.phone}` : 'Sin tel';
              logCallback(
                `✓ [${matchedCount}${isInfinite ? '' : '/' + limit}] ${enriched.name} — ${phoneTag}`
              );
            })
          );
        }
      }
    }

    logCallback(`✅ Búsqueda API completada: ${results.length} comercios obtenidos.`);
    return results;
  } catch (error) {
    logCallback(`Error en API Google Maps: ${error.message}`);
    return results;
  }
}
