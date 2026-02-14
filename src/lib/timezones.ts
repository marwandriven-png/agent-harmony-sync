/**
 * Timezone detection and sending-window utilities.
 * Country → timezone mapping covers 50+ countries relevant to international real estate.
 */

// Phone country code → country ISO
const PHONE_CODE_TO_COUNTRY: Record<string, string> = {
  '1': 'US', '7': 'RU', '20': 'EG', '27': 'ZA',
  '30': 'GR', '31': 'NL', '32': 'BE', '33': 'FR', '34': 'ES',
  '36': 'HU', '39': 'IT', '40': 'RO', '41': 'CH', '43': 'AT',
  '44': 'GB', '45': 'DK', '46': 'SE', '47': 'NO', '48': 'PL',
  '49': 'DE', '52': 'MX', '55': 'BR', '56': 'CL',
  '60': 'MY', '61': 'AU', '62': 'ID', '63': 'PH', '64': 'NZ',
  '65': 'SG', '66': 'TH', '81': 'JP', '82': 'KR', '86': 'CN',
  '90': 'TR', '91': 'IN', '92': 'PK', '93': 'AF',
  '94': 'LK', '95': 'MM', '98': 'IR',
  '212': 'MA', '213': 'DZ', '216': 'TN', '218': 'LY',
  '220': 'GM', '221': 'SN', '234': 'NG', '254': 'KE', '255': 'TZ',
  '256': 'UG', '260': 'ZM', '263': 'ZW',
  '353': 'IE', '354': 'IS', '358': 'FI', '370': 'LT',
  '371': 'LV', '372': 'EE', '380': 'UA', '381': 'RS',
  '420': 'CZ', '421': 'SK',
  '852': 'HK', '853': 'MO', '855': 'KH', '856': 'LA',
  '880': 'BD', '886': 'TW',
  '960': 'MV', '961': 'LB', '962': 'JO', '963': 'SY',
  '964': 'IQ', '965': 'KW', '966': 'SA', '967': 'YE',
  '968': 'OM', '970': 'PS', '971': 'AE', '972': 'IL',
  '973': 'BH', '974': 'QA', '975': 'BT', '976': 'MN',
  '977': 'NP', '992': 'TJ', '993': 'TM', '994': 'AZ',
  '995': 'GE', '996': 'KG', '998': 'UZ',
};

// Country ISO → IANA timezone (primary)
const COUNTRY_TO_TIMEZONE: Record<string, string> = {
  'US': 'America/New_York', 'CA': 'America/Toronto', 'MX': 'America/Mexico_City',
  'BR': 'America/Sao_Paulo', 'CL': 'America/Santiago', 'AR': 'America/Buenos_Aires',
  'GB': 'Europe/London', 'IE': 'Europe/Dublin', 'FR': 'Europe/Paris',
  'DE': 'Europe/Berlin', 'IT': 'Europe/Rome', 'ES': 'Europe/Madrid',
  'NL': 'Europe/Amsterdam', 'BE': 'Europe/Brussels', 'CH': 'Europe/Zurich',
  'AT': 'Europe/Vienna', 'SE': 'Europe/Stockholm', 'NO': 'Europe/Oslo',
  'DK': 'Europe/Copenhagen', 'FI': 'Europe/Helsinki', 'PL': 'Europe/Warsaw',
  'CZ': 'Europe/Prague', 'SK': 'Europe/Bratislava', 'HU': 'Europe/Budapest',
  'RO': 'Europe/Bucharest', 'GR': 'Europe/Athens', 'TR': 'Europe/Istanbul',
  'UA': 'Europe/Kiev', 'RU': 'Europe/Moscow', 'RS': 'Europe/Belgrade',
  'LT': 'Europe/Vilnius', 'LV': 'Europe/Riga', 'EE': 'Europe/Tallinn',
  'IS': 'Atlantic/Reykjavik',
  'AE': 'Asia/Dubai', 'SA': 'Asia/Riyadh', 'QA': 'Asia/Qatar',
  'KW': 'Asia/Kuwait', 'BH': 'Asia/Bahrain', 'OM': 'Asia/Muscat',
  'JO': 'Asia/Amman', 'LB': 'Asia/Beirut', 'IL': 'Asia/Jerusalem',
  'IQ': 'Asia/Baghdad', 'IR': 'Asia/Tehran', 'PS': 'Asia/Gaza',
  'SY': 'Asia/Damascus', 'YE': 'Asia/Aden',
  'IN': 'Asia/Kolkata', 'PK': 'Asia/Karachi', 'BD': 'Asia/Dhaka',
  'LK': 'Asia/Colombo', 'NP': 'Asia/Kathmandu', 'MV': 'Indian/Maldives',
  'CN': 'Asia/Shanghai', 'HK': 'Asia/Hong_Kong', 'TW': 'Asia/Taipei',
  'JP': 'Asia/Tokyo', 'KR': 'Asia/Seoul', 'MO': 'Asia/Macau',
  'SG': 'Asia/Singapore', 'MY': 'Asia/Kuala_Lumpur', 'TH': 'Asia/Bangkok',
  'PH': 'Asia/Manila', 'ID': 'Asia/Jakarta', 'KH': 'Asia/Phnom_Penh',
  'MM': 'Asia/Yangon', 'LA': 'Asia/Vientiane', 'MN': 'Asia/Ulaanbaatar',
  'AU': 'Australia/Sydney', 'NZ': 'Pacific/Auckland',
  'EG': 'Africa/Cairo', 'ZA': 'Africa/Johannesburg', 'KE': 'Africa/Nairobi',
  'NG': 'Africa/Lagos', 'MA': 'Africa/Casablanca', 'TN': 'Africa/Tunis',
  'DZ': 'Africa/Algiers', 'GH': 'Africa/Accra',
  'AF': 'Asia/Kabul', 'AZ': 'Asia/Baku', 'GE': 'Asia/Tbilisi',
  'KG': 'Asia/Bishkek', 'TJ': 'Asia/Dushanbe', 'TM': 'Asia/Ashgabat',
  'UZ': 'Asia/Tashkent', 'BT': 'Asia/Thimphu',
};

// Email domain → country (common providers)
const EMAIL_DOMAIN_TO_COUNTRY: Record<string, string> = {
  'co.uk': 'GB', 'co.in': 'IN', 'co.za': 'ZA', 'co.jp': 'JP',
  'co.kr': 'KR', 'com.au': 'AU', 'com.br': 'BR', 'com.sg': 'SG',
  'de': 'DE', 'fr': 'FR', 'it': 'IT', 'es': 'ES', 'nl': 'NL',
  'ae': 'AE', 'sa': 'SA', 'qa': 'QA', 'kw': 'KW', 'bh': 'BH',
  'jp': 'JP', 'cn': 'CN', 'ru': 'RU', 'se': 'SE', 'no': 'NO',
  'dk': 'DK', 'fi': 'FI', 'pl': 'PL', 'ch': 'CH', 'at': 'AT',
  'be': 'BE', 'ie': 'IE', 'pt': 'PT', 'gr': 'GR', 'tr': 'TR',
  'eg': 'EG', 'ng': 'NG', 'ke': 'KE', 'za': 'ZA', 'ma': 'MA',
  'in': 'IN', 'pk': 'PK', 'bd': 'BD', 'ph': 'PH', 'my': 'MY',
  'th': 'TH', 'id': 'ID', 'sg': 'SG', 'hk': 'HK', 'tw': 'TW',
};

/**
 * Detect country from phone number country code.
 */
export function detectCountryFromPhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-()]/g, '').replace(/^\+/, '');
  // Try 3-digit, 2-digit, 1-digit codes
  for (const len of [3, 2, 1]) {
    const code = cleaned.substring(0, len);
    if (PHONE_CODE_TO_COUNTRY[code]) return PHONE_CODE_TO_COUNTRY[code];
  }
  return null;
}

/**
 * Detect country from email domain (TLD).
 */
export function detectCountryFromEmail(email: string): string | null {
  if (!email || !email.includes('@')) return null;
  const domain = email.split('@')[1].toLowerCase();
  // Try compound TLD first (co.uk, com.au)
  const parts = domain.split('.');
  if (parts.length >= 3) {
    const compound = parts.slice(-2).join('.');
    if (EMAIL_DOMAIN_TO_COUNTRY[compound]) return EMAIL_DOMAIN_TO_COUNTRY[compound];
  }
  const tld = parts[parts.length - 1];
  if (EMAIL_DOMAIN_TO_COUNTRY[tld]) return EMAIL_DOMAIN_TO_COUNTRY[tld];
  return null;
}

/**
 * Detect country with priority: explicit > phone > email.
 */
export function detectCountry(
  explicitCountry?: string | null,
  phone?: string | null,
  email?: string | null
): string | null {
  if (explicitCountry) {
    // Normalize common names
    const map: Record<string, string> = {
      'uae': 'AE', 'united arab emirates': 'AE', 'dubai': 'AE',
      'usa': 'US', 'united states': 'US', 'uk': 'GB', 'united kingdom': 'GB',
      'saudi': 'SA', 'saudi arabia': 'SA', 'qatar': 'QA',
      'india': 'IN', 'china': 'CN', 'japan': 'JP',
    };
    const lower = explicitCountry.toLowerCase().trim();
    if (map[lower]) return map[lower];
    if (explicitCountry.length === 2) return explicitCountry.toUpperCase();
  }
  if (phone) {
    const fromPhone = detectCountryFromPhone(phone);
    if (fromPhone) return fromPhone;
  }
  if (email) {
    const fromEmail = detectCountryFromEmail(email);
    if (fromEmail) return fromEmail;
  }
  return null;
}

/**
 * Get IANA timezone for a country code.
 */
export function getTimezoneForCountry(countryCode: string): string | null {
  return COUNTRY_TO_TIMEZONE[countryCode] || null;
}

/**
 * Check if current time in a timezone is within 09:00–18:00 (sending window).
 */
export function isWithinSendingWindow(timezone: string): boolean {
  try {
    const now = new Date();
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const hour = localTime.getHours();
    return hour >= 9 && hour < 18;
  } catch {
    // If timezone is invalid, default to safe window check
    return false;
  }
}

/**
 * Check if current time in timezone is in the hard-block zone (20:00–08:00).
 */
export function isInBlockedHours(timezone: string): boolean {
  try {
    const now = new Date();
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const hour = localTime.getHours();
    return hour >= 20 || hour < 8;
  } catch {
    return true; // Block by default if unknown
  }
}

/**
 * Check if today is a weekend in the lead's timezone.
 */
export function isWeekend(timezone: string): boolean {
  try {
    const now = new Date();
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const day = localTime.getDay();
    return day === 0 || day === 6;
  } catch {
    return true; // Treat as weekend if unknown
  }
}

/**
 * Get the next sending window start (09:00 local) as a UTC timestamp.
 */
export function getNextSendingWindow(timezone: string): Date {
  const now = new Date();
  const localStr = now.toLocaleString('en-US', { timeZone: timezone });
  const localNow = new Date(localStr);
  
  const target = new Date(localNow);
  target.setHours(9, 0, 0, 0);
  
  if (localNow.getHours() >= 18) {
    target.setDate(target.getDate() + 1);
  }
  
  // Approximate offset
  const offset = now.getTime() - localNow.getTime();
  return new Date(target.getTime() + offset);
}

/**
 * Get current local time string for a timezone (for logging).
 */
export function getLocalTimeString(timezone: string): string {
  try {
    return new Date().toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
  } catch {
    return new Date().toISOString();
  }
}

export { COUNTRY_TO_TIMEZONE, PHONE_CODE_TO_COUNTRY };
