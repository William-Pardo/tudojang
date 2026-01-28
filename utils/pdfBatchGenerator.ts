
// utils/pdfBatchGenerator.ts
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { Estudiante, Sede, ConfiguracionClub } from '../tipos';
import { getBeltStyle } from './beltStyles';

const DEFAULT_LOGO_BASE64 = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNTAiIGZpbGw9IiMxZjNlOTAiLz48cGF0aCBkPSJNNTAsMCBhNTAsNTAgMCAwLDAgMCwxMDAiIGZpbGw9IiNkMzIxMjYiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjI1IiByPSIyNSIgZmlsbD0iIzFmM2U5MCIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNzUiIHI9IjI1IiBmaWxsPSIjZDMyMTI2Ii8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNyA1KSBzY2FsZSgwLjkpIj48cGF0aCBkPSJNNDguNyw2OS41bC01LjMtMi4xbC00LjUsNS44bC0zLjMtOGwtOS4xLTMuNmw0LTcuNWwtNi45LTUuNGw3LjEtNS4xbC0yLjYtOS4zbDkuMywyLjZsNS4xLTcuMWw1LjQsNi45bDcuNS00bDMuNiw5LjFsOCwzLjNsLTUuOCw0LjVsMi4xLDUuM2MtMi4zLDQtNS4zLDcuNi05LDEwLjZDNTYuMiw2NC4yLDUyLjYsNjcuMiw0OC43LDY5LjV6IiBmaWxsPSIjZmZmIi8+PGNpcmNsZSBjeD0iNjIiIGN5PSIyMyIgcj0iNSIgZmlsbD0iI2ZmZiIvPjwvZz48L3N2Zz4=`;

const esperarImagen = (img: HTMLImageElement): Promise<void> => {
    return new Promise((resolve) => {
        if (img.complete && img.naturalWidth > 0) return resolve();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        setTimeout(resolve, 3000); // Timeout de seguridad
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
    container.style.zIndex = '-100';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);

    try {
        for (let i = 0; i < estudiantes.length; i++) {
            const est = estudiantes[i];
            const sede = sedes.find(s => s.id === est.sedeId);
            const visual = getBeltStyle(est.grado);
            
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(est.id)}&color=${configClub.colorPrimario.replace('#','')}&bgcolor=ffffff&margin=1`;
            const logoUrl = configClub.logoUrl || DEFAULT_LOGO_BASE64;

            container.innerHTML = `
                <div id="card-batch" style="width: 340px; height: 215px; background-color: ${configClub.colorPrimario}; font-family: 'Poppins', sans-serif; display: flex; flex-direction: column; padding: 19px; box-sizing: border-box; overflow: hidden; position: relative; color: white;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                        <div style="text-align: left;">
                            <div style="font-size: 13px; font-weight: 900; text-transform: uppercase; line-height: 1;">${configClub.nombreClub}</div>
                            <div style="font-size: 8px; opacity: 0.7;">${sede?.nombre || 'Sede Principal'}</div>
                        </div>
                        <div style="background: white; padding: 3px; border-radius: 6px; width: 34px; height: 34px;">
                            <img src="${logoUrl}" crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: contain;" />
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 15px; flex-grow: 1;">
                        <div style="background: white; padding: 5px; border-radius: 10px; width: 65px; height: 65px;">
                            <img src="${qrUrl}" crossorigin="anonymous" style="width: 100%; height: 100%;" />
                        </div>
                        <div>
                            <div style="font-size: 6px; font-weight: 900; opacity: 0.5; letter-spacing: 1px;">IDENTIFICACIÓN ALUMNO</div>
                            <div style="font-size: 16px; font-weight: 900; text-transform: uppercase;">${est.nombres}</div>
                            <div style="font-size: 16px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px;">${est.apellidos}</div>
                            <div style="height: 2px; width: 30px; background: ${configClub.colorSecundario}; margin-bottom: 4px;"></div>
                            <div style="font-size: 9px; font-weight: 700;">ID: ${est.numeroIdentificacion}</div>
                        </div>
                    </div>
                    <div style="margin-top: auto; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="background: ${visual.background}; color: ${visual.color}; font-size: 9px; font-weight: 900; padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(0,0,0,0.1);">${est.grado}</div>
                        <div style="text-align: right; font-size: 8px; opacity: 0.8;">${est.fechaIngreso}</div>
                    </div>
                </div>
            `;

            const cardElement = container.querySelector('#card-batch') as HTMLElement;
            const images = Array.from(cardElement.querySelectorAll('img'));
            await Promise.all(images.map(esperarImagen));
            
            await new Promise(r => requestAnimationFrame(() => setTimeout(r, 50)));

            const canvas = await html2canvas(cardElement, { 
                scale: 2, 
                useCORS: true,
                backgroundColor: null,
                logging: false
            });
            
            const imgData = canvas.toDataURL('image/jpeg', 0.9);

            if (i > 0) pdf.addPage([85.6, 54], 'landscape');
            pdf.addImage(imgData, 'JPEG', 0, 0, 85.6, 54);
            
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
        }, 100);

    } finally {
        if (container.parentNode) {
            document.body.removeChild(container);
        }
    }
};
