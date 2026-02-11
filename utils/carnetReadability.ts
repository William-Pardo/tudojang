
// utils/carnetReadability.ts

interface BrandingPalette {
    primary: string;
    secondary: string;
    accent: string;
}

export const hexToRgb = (hex: string) => {
    if (!hex) return { r: 0, g: 0, b: 0 };
    // Limpiar entrada: remover espacios y asegurar que empiece con #
    let cleanHex = hex.trim();
    if (!cleanHex.startsWith('#')) cleanHex = '#' + cleanHex;

    // Soportar formatos de 3 y 6 dígitos
    if (cleanHex.length === 4) {
        const r = parseInt(cleanHex[1] + cleanHex[1], 16);
        const g = parseInt(cleanHex[2] + cleanHex[2], 16);
        const b = parseInt(cleanHex[3] + cleanHex[3], 16);
        return { r, g, b };
    }

    if (cleanHex.length < 7) return { r: 0, g: 0, b: 0 };

    const r = parseInt(cleanHex.slice(1, 3), 16);
    const g = parseInt(cleanHex.slice(3, 5), 16);
    const b = parseInt(cleanHex.slice(5, 7), 16);
    return { r, g, b };
};

const getRelativeLuminance = (hex: string) => {
    const { r, g, b } = hexToRgb(hex);
    const [rs, gs, bs] = [r, g, b].map(c => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

export const getContrastRatio = (color1: string, color2: string) => {
    const l1 = getRelativeLuminance(color1);
    const l2 = getRelativeLuminance(color2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

export const getPerceivedBrightness = (hex: string) => {
    const rgb = hexToRgb(hex);
    return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 / 2.55; // 0-100
};

/**
 * Aplica las reglas de legibilidad técnica para carnets:
 * 1. Fondo > 90% brillo -> Sustituir por el color más oscuro de la marca.
 * 2. Contraste mínimo 4.5:1 para texto normal.
 * 3. Si toda la marca es pastel (>70% brillo) -> Fondo Gris Antracita (#333333).
 */
export const applyCarnetReadabilityRules = (palette: BrandingPalette) => {
    // Sanitización inicial de la paleta
    const primary = (palette.primary || '#111111').trim();
    const secondary = (palette.secondary || '#0047A0').trim();
    const accent = (palette.accent || '#CD2E3A').trim();

    const colors = [primary, secondary, accent];

    // Regla 3: Si todo es demasiado claro (> 70% de brillo), forzamos un fondo oscuro de seguridad
    // Usamos el secundario corporativo como fallback de seguridad
    const allLight = colors.every(c => getPerceivedBrightness(c) > 70);
    let backgroundColor = primary;

    if (allLight || getPerceivedBrightness(backgroundColor) > 85) {
        // Buscamos el color más oscuro de la paleta del cliente
        const sortedByBrightness = [...colors].sort((a, b) => getPerceivedBrightness(a) - getPerceivedBrightness(b));
        const darkestClientColor = sortedByBrightness[0];

        // Si el más oscuro del cliente sigue siendo muy claro (> 70%), usamos el Azul Corporativo Tudojang
        if (getPerceivedBrightness(darkestClientColor) > 70) {
            backgroundColor = '#0047A0'; // Seguridad: Azul Tudojang
        } else {
            backgroundColor = darkestClientColor;
        }
    }

    // Regla 2: Garantizar Contraste Legible para Texto (Mínimo 4.5:1)
    const ratioWhite = getContrastRatio(backgroundColor, '#FFFFFF');
    const ratioBlack = getContrastRatio(backgroundColor, '#000000');

    let textColor = '#FFFFFF';
    // Priorizamos blanco si cumple, sino negro si cumple.
    if (ratioWhite >= 4.5) {
        textColor = '#FFFFFF';
    } else if (ratioBlack >= 4.5) {
        textColor = '#000000';
    } else {
        // Fallback absoluto al que sea más legible
        textColor = ratioWhite > ratioBlack ? '#FFFFFF' : '#000000';
    }

    // Caso especial de emergencia: Si el texto sigue siendo igual al fondo por alguna falla de data
    if (backgroundColor.toLowerCase() === textColor.toLowerCase()) {
        textColor = getPerceivedBrightness(backgroundColor) > 50 ? '#000000' : '#FFFFFF';
    }

    return { backgroundColor, textColor };
};
