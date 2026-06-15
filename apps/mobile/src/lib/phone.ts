export interface Country {
    dial: string;
    flag: string;
    name: string;
}

export const COUNTRIES: Country[] = [
    { dial: '+972', flag: '🇮🇱', name: 'Israel' },
    { dial: '+1', flag: '🇺🇸', name: 'United States' },
    { dial: '+44', flag: '🇬🇧', name: 'United Kingdom' },
    { dial: '+49', flag: '🇩🇪', name: 'Germany' },
    { dial: '+33', flag: '🇫🇷', name: 'France' },
    { dial: '+39', flag: '🇮🇹', name: 'Italy' },
    { dial: '+91', flag: '🇮🇳', name: 'India' },
];

/**
 * Combine a country dial code + the national part into E.164, collapsing the
 * common ways people type a number: a pasted full +<intl> number, a national
 * field that repeats the country code, a 00-international prefix, and a leading
 * trunk 0. Mirrors the web app's normalization.
 */
export function toE164(countryDial: string, national: string): string {
    const cc = countryDial.replace(/\D/g, '');
    const trimmed = national.trim();

    if (trimmed.startsWith('+')) {
        return '+' + trimmed.replace(/\D/g, '');
    }

    let digits = trimmed.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (cc && digits.startsWith(cc)) digits = digits.slice(cc.length);
    digits = digits.replace(/^0+/, '');

    return `+${cc}${digits}`;
}

export const isValidE164 = (phone: string): boolean => /^\+[1-9]\d{6,14}$/.test(phone);
