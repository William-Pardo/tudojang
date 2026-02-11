
// utils/pdfBatchGenerator.ts
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { Estudiante, Sede, ConfiguracionClub } from '../tipos';
import { getBeltStyle } from './beltStyles';

const DEFAULT_LOGO_BASE64 = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNTAiIGZpbGw9IiMxZjNlOTAiLz48cGF0aCBkPSJNNTAsMCBhNTAsNTAgMCAwLDAgMCwxMDAiIGZpbGw9IiNkMzIxMjYiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjI1IiByPSIyNSIgZmlsbD0iIzFmM2U5MCIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNzUiIHI9IjI1IiBmaWxsPSIjZDMyMTI2Ii8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNyA1KSBzY2FsZSgwLjkpIj48cGF0aCBkPSJNNDguNyw2OS41bC01LjMtMi4xbC00LjUsNS44bC0zLjMtOGwtOS4xLTMuNmw0LTcuNWwtNi45LTUuNGw3LjEtNS4xbC0yLjYtOS4zbDkuMywyLjZsNS4xLTcuMWw1LjQsNi45bDcuNS00bDMuNiw5LjFsOCwzLjNsLTUuOCw0LjVsMi4xLDUuM2MtMi4zLDQtNS4zLDcuNi05LDEwLjZDNTYuMiw2NC4yLDUyLjYsNjcuMiw0OC43LDY5LjV6IiBmaWxsPSIjZmZmIi8+PGNpcmNsZSBjeD0iNjIiIGN5PSIyMyIgcj0iNSIgZmlsbD0iI2ZmZiIvPjwvZz48L3N2Zz4=`;

import { applyCarnetReadabilityRules } from './carnetReadability';

/**
 * Nota: getContrastColor ha sido removido a favor de applyCarnetReadabilityRules 
 * para cumplir con regulaciones de contraste WCAG y reglas de seguridad de la app.
 */

const esperarImagen = (img: HTMLImageElement): Promise<void> => {
    return new Promise((resolve) => {
        if (img.complete && img.naturalWidth > 0) return resolve();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        setTimeout(resolve, 3000);
    });
};

export const generarLoteCarnetsPdf = async (estudiantes: Estudiante[], sedes: Sede[], configClub: ConfiguracionClub, fileName: string) => {
    if (estudiantes.length === 0) return;

    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [85.6, 54]
    });

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.zIndex = '-1000';
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);

    const { backgroundColor: colorFondo, textColor: colorTexto } = applyCarnetReadabilityRules({
        primary: configClub.colorPrimario || '#111111',
        secondary: configClub.colorSecundario || '#0047A0',
        accent: configClub.colorAcento || '#CD2E3A'
    });

    try {
        for (let i = 0; i < estudiantes.length; i++) {
            const est = estudiantes[i];
            const sede = sedes.find(s => s.id === est.sedeId);
            const visual = getBeltStyle(est.grado);

            // Usamos un proxy de imagen si es necesario o cargamos con CORS
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(est.id)}&color=000000&bgcolor=ffffff&margin=1`;
            const logoUrl = configClub.logoUrl || DEFAULT_LOGO_BASE64;

            container.innerHTML = `
                <div id="card-render-${i}" style="width: 323px; height: 204px; background-color: ${colorFondo}; font-family: 'Poppins', sans-serif; display: flex; flex-direction: column; padding: 18px; box-sizing: border-box; overflow: hidden; position: relative; color: ${colorTexto};">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 5px; height: 45px;">
                        <div style="flex-grow: 1; padding-right: 10px;">
                            <div style="font-size: 13px; font-weight: 950; text-transform: uppercase; line-height: 1.1; margin-bottom: 2px;">${configClub.nombreClub}</div>
                            <div style="font-size: 8px; font-weight: 700; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px;">${sede?.nombre || 'Sede Central'}</div>
                        </div>
                        <div style="background: white; padding: 4px; border-radius: 8px; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.1); border: 1px solid rgba(0,0,0,0.05);">
                            <img src="${logoUrl}" crossorigin="anonymous" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 18px; flex-grow: 1; margin-top: 5px;">
                        <div style="background: white; padding: 6px; border-radius: 12px; width: 68px; height: 68px; flex-shrink: 0; box-shadow: 0 4px 15px rgba(0,0,0,0.12); border: 1px solid rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: center;">
                            <img src="${qrUrl}" crossorigin="anonymous" style="width: 100%; height: 100%;" />
                        </div>
                        <div style="flex-grow: 1; border-left: 2px solid ${colorTexto}33; padding-left: 18px;">
                            <div style="font-size: 7px; font-weight: 900; opacity: 0.6; letter-spacing: 1.5px; text-transform: uppercase;">Estudiante de Taekwondo</div>
                            <div style="font-size: 17px; font-weight: 950; text-transform: uppercase; line-height: 1.1; margin-top: 2px;">${est.nombres}</div>
                            <div style="font-size: 17px; font-weight: 950; text-transform: uppercase; line-height: 1.1;">${est.apellidos}</div>
                            <div style="font-size: 10px; font-weight: 700; margin-top: 6px; font-family: monospace;">ID: ${est.numeroIdentificacion}</div>
                        </div>
                    </div>

                    <div style="margin-top: auto; border-top: 1px solid ${colorTexto}22; padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="background: ${visual.background}; color: ${visual.color}; font-size: 10px; font-weight: 950; padding: 4px 12px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.15); box-shadow: 0 2px 5px rgba(0,0,0,0.1); text-transform: uppercase;">${est.grado}</div>
                        <div style="text-align: right; font-size: 9px; font-weight: 800; opacity: 0.7;">INGRESO: ${est.fechaIngreso}</div>
                    </div>

                    <div style="position: absolute; bottom: 0; right: 0; width: 80px; height: 80px; background: linear-gradient(135deg, transparent 50%, ${colorTexto}11 100%); pointer-events: none;"></div>
                </div>
            `;

            const cardElement = container.querySelector(`#card-render-${i}`) as HTMLElement;
            const imgs = Array.from(cardElement.querySelectorAll('img'));
            await Promise.all(imgs.map(esperarImagen));

            // Pequeña espera para renderizado CSS
            await new Promise(r => setTimeout(r, 150));

            const canvas = await html2canvas(cardElement, {
                scale: 3, // Mayor densidad para impresión nítida
                useCORS: true,
                backgroundColor: null,
                logging: false,
                allowTaint: false
            });

            const imgData = canvas.toDataURL('image/png'); // PNG para mejor calidad de logo y QR

            if (i > 0) pdf.addPage([85.6, 54], 'landscape');
            pdf.addImage(imgData, 'PNG', 0, 0, 85.6, 54);

            container.innerHTML = '';
        }

        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.pdf`;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 200);

    } catch (error) {
        console.error("Error generating ID cards:", error);
    } finally {
        if (container.parentNode) {
            document.body.removeChild(container);
        }
    }
};
