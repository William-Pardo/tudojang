
// utils/receiptGenerator.ts
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { ConfiguracionClub } from '../tipos';
import { formatearPrecio, formatearFecha } from './formatters';

export const generarReciboPagoPdf = async (
    pago: { periodo: string, monto: number, fecha: string },
    config: ConfiguracionClub,
    profesorNombre: string
) => {
    // Crear contenedor temporal fuera de la vista
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '-2000px';
    container.style.width = '540px';
    // container.style.height = '960px'; // Altura dinámica mejor
    container.style.minHeight = '960px';
    container.style.backgroundColor = '#ffffff';
    container.style.fontFamily = "'Inter', 'Segoe UI', sans-serif";
    container.style.padding = '0'; // Padding manejado internamente
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.boxSizing = 'border-box';

    // Colores de marca con fallbacks seguros
    const colorPrimario = config.colorPrimario || '#0f172a';
    const colorSecundario = config.colorSecundario || '#3b82f6';

    const logoHtml = config.logoUrl
        ? `<div style="width: 80px; height: 80px; background-image: url('${config.logoUrl}'); background-size: contain; background-repeat: no-repeat; background-position: center; margin: 0 auto 15px auto; border-radius: 50%;"></div>`
        : `<div style="width: 80px; height: 80px; background-color: ${colorPrimario}10; color: ${colorPrimario}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 900; margin: 0 auto 15px auto;">${config.nombreClub.charAt(0)}</div>`;

    container.innerHTML = `
        <div style="flex: 1; display: flex; flex-direction: column; padding: 40px; background: white; position: relative; overflow: hidden;">
            
            <!-- Decoración de Fondo -->
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 8px; background: linear-gradient(90deg, ${colorPrimario}, ${colorSecundario});"></div>
            <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 8px; background: linear-gradient(90deg, ${colorSecundario}, ${colorPrimario});"></div>
            
            <!-- Marca de Agua -->
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); opacity: 0.03; font-size: 60px; font-weight: 900; pointer-events: none; white-space: nowrap; color: ${colorPrimario}; z-index: 0;">
                ${config.nombreClub.toUpperCase()}
            </div>

            <div style="position: relative; z-index: 10; flex: 1; display: flex; flex-direction: column;">
                
                <!-- Encabezado -->
                <div style="text-align: center; margin-bottom: 30px;">
                    ${logoHtml}
                    <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: ${colorPrimario}; text-transform: uppercase; letter-spacing: -0.5px; line-height: 1.2;">${config.nombreClub}</h1>
                    <p style="margin: 5px 0 0 0; font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">NIT: ${config.nit || 'NO REGISTRADO'}</p>
                    <p style="margin: 2px 0 0 0; font-size: 10px; color: #94a3b8;">${config.direccionClub || 'Sede Principal'}</p>
                </div>

                <!-- Detalles del Recibo -->
                <div style="background-color: #f8fafc; border-radius: 20px; padding: 25px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px dashed #cbd5e1;">
                        <div>
                            <p style="font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Recibo de Pago</p>
                            <p style="font-size: 14px; font-weight: 700; color: ${colorPrimario}; font-family: monospace;">#PY-${Date.now().toString().slice(-8)}</p>
                        </div>
                        <div style="text-align: right;">
                            <p style="font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Fecha</p>
                            <p style="font-size: 12px; font-weight: 600; color: #334155;">${formatearFecha(pago.fecha)}</p>
                        </div>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <p style="font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px;">Pagado por</p>
                        <p style="font-size: 16px; font-weight: 700; color: #1e293b; text-transform: uppercase;">${profesorNombre}</p>
                    </div>

                    <div>
                        <p style="font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px;">Concepto</p>
                        <p style="font-size: 14px; font-weight: 600; color: #475569;">${pago.periodo}</p>
                    </div>
                </div>

                <!-- Total -->
                <div style="text-align: center; margin: 20px 0 40px 0;">
                    <p style="font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 2px;">Total Pagado</p>
                    <p style="font-size: 36px; font-weight: 900; color: ${colorSecundario}; margin: 0; letter-spacing: -1px;">${formatearPrecio(pago.monto)}</p>
                </div>

                <div style="flex: 1;"></div>

                <!-- Footer -->
                <div style="text-align: center; margin-top: auto;">
                    <div style="width: 150px; border-bottom: 1px solid #cbd5e1; height: 40px; margin: 0 auto 10px auto;"></div>
                    <p style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Firma Autorizada</p>
                    
                    <div style="margin-top: 30px; pt: 20px; border-top: 1px solid #f1f5f9;">
                        <p style="font-size: 8px; color: #cbd5e1; margin: 0;">Generado digitalmente por Tudojang Software</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(container);

    try {
        const canvas = await html2canvas(container, {
            scale: 2, // Mejor calidad pero archivo no tan pesado
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);

        // Formato móvil (9:16 approx)
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [108, 192]
        });

        pdf.addImage(imgData, 'JPEG', 0, 0, 108, 192);
        pdf.save(`Recibo_Tudojang_${profesorNombre.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
    } catch (error) {
        console.error("Error al generar PDF:", error);
        throw error;
    } finally {
        document.body.removeChild(container);
    }
};
