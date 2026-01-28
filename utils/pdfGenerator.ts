
// utils/pdfGenerator.ts
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Exporta un carnet individual a PDF de forma robusta.
 */
export const exportarCarnetAPdf = async (element: HTMLElement, fileName: string) => {
    try {
        // Asegurar que las fuentes estén listas
        if (document.fonts) {
            await document.fonts.ready;
        }

        // Pequeño margen para renderizado
        await new Promise(r => setTimeout(r, 150));

        const canvas = await html2canvas(element, {
            scale: 2, // Calidad estándar de impresión (suficiente y ligera)
            useCORS: true,
            allowTaint: true,
            backgroundColor: null,
            logging: false,
            removeContainer: true
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: [85.6, 54]
        });

        pdf.addImage(imgData, 'JPEG', 0, 0, 85.6, 54);
        
        // MÉTODO DE DESCARGA ROBUSTO:
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.pdf`;
        document.body.appendChild(link);
        link.click();
        
        // Limpieza
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);

        return true;
    } catch (error) {
        console.error("Error en exportación PDF:", error);
        return false;
    }
};
