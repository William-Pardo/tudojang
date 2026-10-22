
// utils/pdfBatchGenerator.ts
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { Estudiante, Sede, ConfiguracionClub } from '../tipos';
import { getBeltStyle } from './beltStyles';
import { getSafeBackground } from './ColorUtils';

export enum FormatoPapel {
    Individual = 'Individual (CR80)',
    Carta = 'Carta (Letter)',
    Oficio = 'Oficio (Legal)'
}

interface PageDimensions {
    width: number;
    height: number;
    orientation: 'portrait' | 'landscape';
}

const PAGE_SIZES: Record<FormatoPapel, PageDimensions> = {
    [FormatoPapel.Individual]: { width: 85.6, height: 54, orientation: 'landscape' },
    [FormatoPapel.Carta]: { width: 215.9, height: 279.4, orientation: 'portrait' },
    [FormatoPapel.Oficio]: { width: 215.9, height: 355.6, orientation: 'portrait' },
};

const MARGEN_PINZA = 10; // 10mm de margen de seguridad para impresión
const SEPARACION_CARNETS = 2; // 2mm entre carnets

const DEFAULT_LOGO_BASE64 = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNTAiIGZpbGw9IiMxZjNlOTAiLz48cGF0aCBkPSJNNTAsMCBhNTAsNTAgMCAwLDAgMCwxMDAiIGZpbGw9IiNkMzIxMjYiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjI1IiByPSIyNSIgZmlsbD0iIzFmM2U5MCIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNzUiIHI9IjI1IiBmaWxsPSIjZDMyMTI2Ii8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNyA1KSBzY2FsZSgwLjkpIj48cGF0aCBkPSJNNDguNyw2OS41bC01LjMtMi4xbC00LjUsNS44bC0zLjMtOGwtOS4xLTMuNmw0LTcuNWwtNi45LTUuNGw3LjEtNS4xbC0yLjYtOS4zbDkuMywyLjZsNS4xLTcuMWw1LjQsNi45bDcuNS00bDMuNiw5LjFsOCwzLjNsLTUuOCw0LjVsMi4xLDUuM2MtMi4zLDQtNS4zLDcuNi05LDEwLjZDNTYuMiw2NC4yLDUyLjYsNjcuMiw0OC43LDY5LjV6IiBmaWxsPSIjZmZmIi8+PGNpcmNsZSBjeD0iNjIiIGN5PSIyMyIgcj0iNSIgZmlsbD0iI2ZmZiIvPjwvZz48L3N2Zz4=`;

const esperarImagen = (img: HTMLImageElement): Promise<void> => {
    return new Promise((resolve) => {
        if (img.complete && img.naturalWidth > 0) return resolve();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        setTimeout(resolve, 3000);
    });
};

export const generarLoteCarnetsPdf = async (
    estudiantes: Estudiante[],
    sedes: Sede[],
    configClub: ConfiguracionClub,
    fileName: string,
    formato: FormatoPapel = FormatoPapel.Individual
) => {
    if (estudiantes.length === 0) return;

    const dimensions = PAGE_SIZES[formato];
    const pdf = new jsPDF({
        orientation: dimensions.orientation,
        unit: 'mm',
        format: [dimensions.width, dimensions.height]
    });

    // Calcular layout
    const cardW = 85.6;
    const cardH = 54;
    const padding = MARGEN_PINZA;
    const gap = SEPARACION_CARNETS;

    const cols = formato === FormatoPapel.Individual ? 1 : Math.floor((dimensions.width - (padding * 2)) / cardW);
    const rows = formato === FormatoPapel.Individual ? 1 : Math.floor((dimensions.height - (padding * 2)) / (cardH + gap));
    const carnetsPorPagina = cols * rows;

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.zIndex = '-100';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);

    // safeBg/textColor retained for QR color continuity with club branding
    const safeBg = getSafeBackground({
        primary: configClub.colorPrimario,
        secondary: configClub.colorSecundario,
        accent: configClub.colorAcento
    });

    try {
        for (let i = 0; i < estudiantes.length; i++) {
            const est = estudiantes[i];
            const sede = sedes.find(s => s.id === est.sedeId);
            const visual = getBeltStyle(est.grado);

            // QR: módulos negros sobre fondo blanco (caja blanca del SVG de referencia)
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(est.id)}&color=000000&bgcolor=ffffff&margin=1`;
            const logoUrl = configClub.logoUrl || DEFAULT_LOGO_BASE64;

            // ─── TEMPLATE CARNET-02 ───────────────────────────────────────────────────
            // Dimensiones físicas del carnet: 85.6×54mm → renderizado a 324×204px (scale×3.78)
            // Todas las medidas provienen de TEMPLATE CARNET-02.svg (viewBox 242.6×153.1)
            // Ratio de conversión: 242.6 / 85.6 = 2.834 → 1 px-SVG ≈ 0.353mm
            //
            // Regla A  — nombre largo: reduce letter-spacing → font-size → line-height
            // Regla B  — sin desplazamientos, solapamientos ni texto cortado
            // Regla C  — márgenes idénticos al SVG: H=5.5mm / V=5.15mm → ~21px / ~19px
            // Regla D  — borde derecho del nombre ≤ x del borde derecho del QR-box (≈ x 265px)
            // Regla E  — colores, radios y posiciones idénticos al SVG de referencia

            // ── Cálculo adaptativo del nombre (Regla A) ──────────────────────────────
            // El nombre completo se divide en nombres y apellidos (dos renglones máx.).
            // Si alguno de los dos supera el ancho de la caja de texto (~175px a 18px),
            // se reduce letter-spacing primero, luego font-size hasta mínimo 13px.
            const NAME_BOX_PX  = 175;   // ancho max de la caja de texto del nombre (Regla D)
            const NAME_SIZE_MAX = 18;    // px base (equivale a aprox. 4.75pt en SVG)
            const NAME_SIZE_MIN = 13;    // px mínimo legible
            const NAME_LS_MAX   = -0.3; // letter-spacing base (px)
            const NAME_LS_MIN   = -1.2; // letter-spacing mínimo

            // Estimación de ancho de texto (aprox. 0.6× el font-size por carácter bold-condensed)
            const estimarAncho = (texto: string, size: number, ls: number): number =>
                texto.length * (size * 0.62 + ls);

            let nameFontSize   = NAME_SIZE_MAX;
            let nameLetterSpacing = NAME_LS_MAX;
            let nameLineHeight = 1.18;

            const maxLen = Math.max(est.nombres.length, est.apellidos.length);
            // Paso 1: reducir letter-spacing
            if (estimarAncho(est.nombres.length > est.apellidos.length ? est.nombres : est.apellidos, nameFontSize, nameLetterSpacing) > NAME_BOX_PX) {
                nameLetterSpacing = NAME_LS_MIN;
            }
            // Paso 2: reducir font-size si sigue sin caber
            if (estimarAncho(est.nombres.length > est.apellidos.length ? est.nombres : est.apellidos, nameFontSize, nameLetterSpacing) > NAME_BOX_PX) {
                nameFontSize = Math.max(NAME_SIZE_MIN, Math.round(NAME_BOX_PX / (maxLen * 0.62)));
            }
            // Paso 3: ajustar line-height de forma segura sin recortar ascendentes en canvas
            if (maxLen > 14) nameLineHeight = 1.12;

            const cardHtml = `
                <div id="card-${i}" style="
                    width: 324px;
                    height: 204px;
                    background-color: #211915;
                    font-family: 'Inter', system-ui, sans-serif;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    overflow: hidden;
                    position: relative;
                    border-radius: 10px;
                ">
                    <!-- Fila superior: nombre del club + logo -->
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        padding: 22px 22px 0 22px;
                        position: relative;
                        z-index: 10;
                    ">
                        <!-- Nombre del club + sede -->
                        <div style="flex: 1; padding-right: 8px; max-width: 240px;">
                            <div style="
                                font-size: 13px;
                                font-weight: 900;
                                text-transform: uppercase;
                                line-height: 1.05;
                                letter-spacing: -0.4px;
                                color: #FFFFFF;
                            ">${configClub.nombreClub}</div>
                            <div style="
                                font-size: 6.5px;
                                font-weight: 700;
                                color: #FFFFFF;
                                opacity: 0.85;
                                margin-top: 3px;
                                text-transform: uppercase;
                                letter-spacing: 0.3px;
                            ">SEDE: ${sede?.nombre.toUpperCase() || 'PRINCIPAL'}</div>
                        </div>

                        <!-- Logo (SVG: x≈201→227, y≈14.7→42.1 → ~34px ancho, 36px alto) -->
                        <div style="
                            background: #FFFFFF;
                            border-radius: 8px;
                            width: 34px;
                            height: 34px;
                            flex-shrink: 0;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            overflow: hidden;
                        ">
                            <img src="${logoUrl}" crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: contain;" />
                        </div>
                    </div>

                    <!-- Fila central: QR + datos del estudiante -->
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 14px;
                        padding: 6px 22px 0 22px;
                        position: relative;
                        z-index: 10;
                    ">
                        <!-- QR (SVG: x=16.6→68.8 = 19.6mm, y=57.3→109.6 = 18.4mm → 74×70px) -->
                        <div style="
                            background: #FFFFFF;
                            border-radius: 10px;
                            width: 74px;
                            height: 70px;
                            flex-shrink: 0;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            overflow: hidden;
                            padding: 4px;
                            box-sizing: border-box;
                        ">
                            <img src="${qrUrl}" crossorigin="anonymous" style="width: 100%; height: 100%;" />
                        </div>

                        <!-- Caja de texto del estudiante (Regla D: borde derecho ≤ x=265px) -->
                        <div style="
                            flex: 1;
                            max-width: 175px;
                        ">
                            <!-- Nombre (Regla A aplicada con padding seguro para no cortar acentos ni ascendentes) -->
                            <div style="
                                font-size: ${nameFontSize}px;
                                font-weight: 900;
                                text-transform: uppercase;
                                line-height: ${nameLineHeight};
                                letter-spacing: ${nameLetterSpacing}px;
                                color: #FFFFFF;
                                white-space: nowrap;
                                padding: 2px 0 1px 0;
                            ">${est.nombres}</div>
                            <div style="
                                font-size: ${nameFontSize}px;
                                font-weight: 900;
                                text-transform: uppercase;
                                line-height: ${nameLineHeight};
                                letter-spacing: ${nameLetterSpacing}px;
                                color: #FFFFFF;
                                margin-bottom: 3px;
                                white-space: nowrap;
                                padding: 2px 0 1px 0;
                            ">${est.apellidos}</div>

                            <!-- Línea decorativa rosa/acento (SVG: y=84.6, x=82.3→110.9 → 38px ancho) -->
                            <div style="
                                height: 2.5px;
                                width: 38px;
                                background: #C34772;
                                border-radius: 2px;
                                margin-bottom: 3px;
                            "></div>

                            <!-- ID (SVG: texto monoespaciado debajo de la línea) -->
                            <div style="
                                font-size: 8.5px;
                                font-weight: 800;
                                color: #FFFFFF;
                                font-family: monospace;
                                letter-spacing: 0.2px;
                                line-height: 1.1;
                            ">ID: ${est.numeroIdentificacion}</div>
                        </div>
                    </div>

                    <!-- Línea divisoria horizontal flotante (centrada entre el final del contenido y el cinturón) -->
                    <div style="
                        position: absolute;
                        bottom: 36px;
                        left: 22px;
                        right: 17px;
                        height: 0.5px;
                        background: rgba(255, 255, 255, 0.15);
                        z-index: 5;
                    "></div>

                    <!-- Fila inferior: cinturón (izq) + año (der) -->
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 0 22px 11px 22px;
                        margin-top: auto;
                        position: relative;
                        z-index: 10;
                    ">
                        <!-- Pill del cinturón (inline-block con line-height==height para centrado vertical perfecto en html2canvas) -->
                        <div style="
                            background: ${visual.background};
                            color: ${visual.color};
                            font-size: 9px;
                            font-weight: 900;
                            height: 18px;
                            line-height: 18px;
                            display: inline-block;
                            text-align: center;
                            vertical-align: middle;
                            padding: 0 9px;
                            border-radius: 5px;
                            text-transform: uppercase;
                            letter-spacing: 0.3px;
                            border: 1px solid rgba(0,0,0,0.15);
                            white-space: nowrap;
                            max-width: 175px;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            box-sizing: border-box;
                        ">${est.grado}</div>

                        <!-- Año de ingreso (SVG: "Desde 2026", alineado a la derecha) -->
                        <div style="
                            font-size: 9px;
                            font-weight: 700;
                            color: #FFFFFF;
                            opacity: 0.75;
                            letter-spacing: 0.2px;
                        ">Desde: ${new Date(est.fechaIngreso).getFullYear()}</div>
                    </div>
                </div>
            `;

            container.innerHTML = cardHtml;
            const cardElement = container.querySelector(`[id^="card-"]`) as HTMLElement;
            const images = Array.from(cardElement.querySelectorAll('img'));
            await Promise.all(images.map(esperarImagen));

            // Pausa pequeña para asegurar renderizado de fuentes/efectos
            await new Promise(r => setTimeout(r, 100));

            const canvas = await html2canvas(cardElement, {
                scale: 3, // Mayor escala para impresión de alta calidad
                useCORS: true,
                backgroundColor: null,
                logging: false,
                removeContainer: true
            });

            const imgData = canvas.toDataURL('image/jpeg', 1.0); // Calidad máxima

            if (formato === FormatoPapel.Individual) {
                if (i > 0) pdf.addPage([85.6, 54], 'landscape');
                pdf.addImage(imgData, 'JPEG', 0, 0, 85.6, 54, undefined, 'FAST');
            } else {
                // Layout Multipage (Carta/Oficio)
                const currentInPage = i % carnetsPorPagina;
                if (i > 0 && currentInPage === 0) {
                    pdf.addPage([dimensions.width, dimensions.height], dimensions.orientation);
                }

                const col = currentInPage % cols;
                const row = Math.floor(currentInPage / cols);

                const posX = padding + col * (cardW + gap);
                const posY = padding + row * (cardH + gap);

                pdf.addImage(imgData, 'JPEG', posX, posY, cardW, cardH, undefined, 'FAST');

                // Opcional: Guías de corte (Crop marks)
                pdf.setDrawColor(200);
                pdf.setLineWidth(0.1);
                pdf.line(posX - 2, posY, posX, posY); // Esquina superior izquierda
                pdf.line(posX, posY - 2, posX, posY);
            }

            container.innerHTML = '';
        }

        pdf.save(`${fileName}.pdf`);

    } finally {
        if (container.parentNode) {
            document.body.removeChild(container);
        }
    }
};
