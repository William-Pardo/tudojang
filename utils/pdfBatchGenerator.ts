
// utils/pdfBatchGenerator.ts
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { Estudiante, Sede, ConfiguracionClub } from '../tipos';
import { getBeltStyle } from './beltStyles';
import { getSafeBackground, getIdealTextColor } from './ColorUtils';

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

    // Determinar colores seguros
    const safeBg = getSafeBackground({
        primary: configClub.colorPrimario,
        secondary: configClub.colorSecundario,
        accent: configClub.colorAcento
    });
    const textColor = getIdealTextColor(safeBg);

    try {
        for (let i = 0; i < estudiantes.length; i++) {
            const est = estudiantes[i];
            const sede = sedes.find(s => s.id === est.sedeId);
            const visual = getBeltStyle(est.grado);

            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(est.id)}&color=${safeBg.replace('#', '')}&bgcolor=ffffff&margin=1`;
            const logoUrl = configClub.logoUrl || DEFAULT_LOGO_BASE64;

            // Template mejorado con reglas de legibilidad
            const cardHtml = `
                <div id="card-${i}" style="width: 324px; height: 204px; background-color: ${safeBg}; font-family: 'Inter', system-ui, sans-serif; display: flex; flex-direction: column; padding: 20px; box-sizing: border-box; overflow: hidden; position: relative; color: ${textColor}; border-radius: 12px;">
                    <!-- Decoración de Fondo (Branding) -->
                    <div style="position: absolute; right: -40px; top: -40px; width: 150px; height: 150px; background: ${configClub.colorSecundario}; opacity: 0.15; border-radius: 50%; filter: blur(40px);"></div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; position: relative; z-index: 10;">
                        <div style="text-align: left;">
                            <div style="font-size: 14px; font-weight: 900; text-transform: uppercase; line-height: 1.1; letter-spacing: -0.5px;">${configClub.nombreClub}</div>
                            <div style="font-size: 8px; font-weight: 700; opacity: 0.8; margin-top: 2px;">SEDE: ${sede?.nombre.toUpperCase() || 'PRINCIPAL'}</div>
                        </div>
                        <div style="background: white; padding: 4px; border-radius: 8px; width: 36px; height: 36px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                            <img src="${logoUrl}" crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: contain;" />
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 18px; flex-grow: 1; position: relative; z-index: 10;">
                        <div style="background: white; padding: 6px; border-radius: 12px; width: 70px; height: 70px; box-shadow: 0 8px 15px rgba(0,0,0,0.1);">
                            <img src="${qrUrl}" crossorigin="anonymous" style="width: 100%; height: 100%;" />
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 7px; font-weight: 900; opacity: 0.6; letter-spacing: 1.5px; margin-bottom: 4px;">ESTUDIANTE ACTIVO</div>
                            <div style="font-size: 18px; font-weight: 950; text-transform: uppercase; line-height: 1; margin-bottom: 2px;">${est.nombres}</div>
                            <div style="font-size: 18px; font-weight: 950; text-transform: uppercase; line-height: 1; margin-bottom: 8px;">${est.apellidos}</div>
                            <div style="height: 3px; width: 40px; background: ${configClub.colorAcento}; border-radius: 2px; margin-bottom: 8px;"></div>
                            <div style="font-size: 10px; font-weight: 800; font-family: monospace;">ID: ${est.numeroIdentificacion}</div>
                        </div>
                    </div>

                    <div style="margin-top: auto; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 10; border-top: 1px solid rgba(255,255,255,0.1);">
                        <div style="background: ${visual.background}; color: ${visual.color}; font-size: 10px; font-weight: 900; padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.2); box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-transform: uppercase;">
                            ${est.grado}
                        </div>
                        <div style="text-align: right; font-size: 9px; font-weight: 700; opacity: 0.7;">
                            DESDE: ${new Date(est.fechaIngreso).getFullYear()}
                        </div>
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
