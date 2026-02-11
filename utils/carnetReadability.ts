
// utils/carnetReadability.ts

interface BrandingPalette {
    primary: string;
    secondary: string;
    accent: string;
}

export const hexToRgb = (hex: string) => {
    if (!hex || hex.length < 7) return { r: 0, g: 0, b: 0 };
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
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
    const primary = palette.primary || '#111111';
    const secondary = palette.secondary || '#0047A0';
    const accent = palette.accent || '#CD2E3A';

    const colors = [primary, secondary, accent];

    // Regla 3: Excepción de Marca (Gris de Seguridad)
    const allLight = colors.every(c => getPerceivedBrightness(c) > 70);
    let backgroundColor = primary;

    if (allLight) {
        backgroundColor = '#333333';
    } else {
        // Regla 1: Detección de Fondo > 90%
        if (getPerceivedBrightness(backgroundColor) > 90) {
            // Sustituir por el más oscuro de la paleta
            backgroundColor = [...colors].sort((a, b) => getPerceivedBrightness(a) - getPerceivedBrightness(b))[0];
        }
    }

    // Regla 2: Verificación de Contraste (Garantizar 4.5:1)
    const whiteRatio = getContrastRatio(backgroundColor, '#FFFFFF');
    const blackRatio = getContrastRatio(backgroundColor, '#000000');

    // Decidimos el color de texto que mejor contraste ofrezca, apuntando a > 4.5
    let textColor = '#FFFFFF';
    if (whiteRatio >= 4.5) {
        textColor = '#FFFFFF';
    } else if (blackRatio >= 4.5) {
        textColor = '#000000';
    } else {
        // Fallback: el que sea más legible
        textColor = whiteRatio > blackRatio ? '#FFFFFF' : '#000000';
    }

    return { backgroundColor, textColor };
};
