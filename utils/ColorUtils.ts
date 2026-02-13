
/**
 * Utilidades para manejo de color y legibilidad según estándares WCAG y reglas del usuario.
 */

export const hexToRgb = (hex: string) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
};

/**
 * Calcula la luminancia relativa (0-1)
 */
export const getLuminance = (hex: string) => {
    const rgb = hexToRgb(hex);
    const a = [rgb.r, rgb.g, rgb.b].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
};

/**
 * Calcula el ratio de contraste entre dos colores
 */
export const getContrastRatio = (color1: string, color2: string) => {
    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
};

export interface Palette {
    primary: string;
    secondary: string;
    accent: string;
}

/**
 * Implementa la regla de legibilidad para carnets del usuario:
 * 1. Prueba Primario. Si Lumi >= 75%, prueba Secundario.
 * 2. Si Secundario >= 75%, prueba Acento.
 * 3. Si todos >= 75%, usa Gris Antracita (#333333).
 * 4. Si el final es > 90%, usa el más oscuro de la paleta.
 */
export const getSafeBackground = (palette: Palette): string => {
    const colors = [palette.primary, palette.secondary, palette.accent];
    let selected = "";

    for (const color of colors) {
        if (getLuminance(color) < 0.75) {
            selected = color;
            break;
        }
    }

    if (!selected) {
        // Excepción de marca: Gris Antracita
        selected = "#333333";
    }

    // Regla de Detección de Fondo (Lumi > 90%)
    if (getLuminance(selected) > 0.90) {
        // Buscar el más oscuro de la paleta original
        selected = colors.reduce((darkest, current) =>
            getLuminance(current) < getLuminance(darkest) ? current : darkest
        );
    }

    return selected;
};

/**
 * Retorna el mejor color de texto (blanco o negro) para un fondo dado
 */
export const getIdealTextColor = (backgroundHex: string): string => {
    const whiteContrast = getContrastRatio(backgroundHex, "#FFFFFF");
    const blackContrast = getContrastRatio(backgroundHex, "#000000");
    return whiteContrast > blackContrast ? "#FFFFFF" : "#000000";
};
