
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
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '-2000px'; 
    container.style.width = '540px';
    container.style.height = '960px';
    container.style.backgroundColor = 'white';
    container.style.fontFamily = "'Poppins', sans-serif";
    container.style.padding = '40px';
    container.style.color = '#110e0f';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';

    const colorPrimario = config.colorSecundario; // Usamos el azul/color principal de la marca como primario del doc
    const colorAcento = config.colorAcento;

    container.innerHTML = `
        <div style="border: 3px solid ${colorPrimario}; border-radius: 25px; padding: 40px; flex: 1; display: flex; flex-direction: column; position: relative; overflow: hidden; background: #fff;">
            
            <!-- Marca de agua decorativa -->
            <div style="position: absolute; top: 55%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); opacity: 0.04; font-size: 80px; font-weight: 900; pointer-events: none; white-space: nowrap;">
                ${config.nombreClub.toUpperCase()}
            </div>

            <!-- Header Centrado -->
            <div style="text-align: center; margin-bottom: 40px;">
                ${config.logoUrl ? `<img src="${config.logoUrl}" style="width: 100px; height: 100px; object-fit: contain; margin: 0 auto 20px auto; display: block;" />` : ''}
                <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: ${colorPrimario}; text-transform: uppercase; line-height: 1.2;">${config.nombreClub}</h1>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #666; font-weight: 600;">NIT: ${config.nit}</p>
                <p style="margin: 2px 0 0 0; font-size: 12px; color: #888;">${config.direccionClub}</p>
            </div>

            <div style="height: 2px; background: linear-gradient(90deg, transparent, ${colorPrimario}44, transparent); margin-bottom: 40px;"></div>

            <!-- Info Pago -->
            <div style="text-align: center; margin-bottom: 50px;">
                <span style="background: ${colorPrimario}; color: white; padding: 6px 20px; border-radius: 50px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Comprobante de Pago</span>
                <p style="margin: 15px 0 0 0; font-size: 14px; font-weight: 700; color: #999;">REF: #PY-${Date.now().toString().slice(-6)}</p>
            </div>

            <!-- Cuerpo del Recibo -->
            <div style="flex-grow: 1;">
                <div style="margin-bottom: 35px;">
                    <p style="font-size: 14px; color: #555; margin-bottom: 8px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Pagado a:</p>
                    <h2 style="font-size: 24px; font-weight: 800; margin: 0; text-transform: uppercase; color: #000;">${profesorNombre}</h2>
                </div>
                
                <div style="background: #f8fafc; border-radius: 20px; padding: 30px; border: 1px solid #e2e8f0;">
                    <div style="margin-bottom: 20px;">
                        <p style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 5px;">Concepto de Servicio</p>
                        <p style="font-size: 18px; font-weight: 700; color: ${colorPrimario};">${pago.periodo}</p>
                    </div>
                    <div>
                        <p style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 5px;">Fecha de Emisión</p>
                        <p style="font-size: 18px; font-weight: 700;">${formatearFecha(pago.fecha)}</p>
                    </div>
                </div>
            </div>

            <!-- Total -->
            <div style="text-align: center; margin-top: 40px; margin-bottom: 60px;">
                <p style="font-size: 13px; font-weight: 700; color: #64748b; margin-bottom: 10px; text-transform: uppercase;">Valor Total Pagado</p>
                <p style="font-size: 42px; font-weight: 900; color: ${colorAcento}; margin: 0; letter-spacing: -1px;">${formatearPrecio(pago.monto)}</p>
            </div>

            <!-- Footer / Firmas -->
            <div style="margin-top: auto;">
                <div style="width: 100%; display: flex; flex-direction: column; align-items: center; gap: 10px;">
                    <div style="width: 200px; border-bottom: 1px solid #cbd5e1; height: 50px;"></div>
                    <p style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Firma Autorizada</p>
                </div>
                
                <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px dashed #e2e8f0;">
                    <p style="font-size: 10px; color: #94a3b8; margin: 0;">Soporte contable digital emitido por</p>
                    <p style="font-size: 11px; font-weight: 800; color: ${colorPrimario}; margin: 2px 0 0 0;">SISTEMA DE GESTIÓN ${config.nombreClub.toUpperCase()}</p>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(container);

    try {
        const canvas = await html2canvas(container, {
            scale: 3, 
            useCORS: true,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [108, 192]
        });

        pdf.addImage(imgData, 'JPEG', 0, 0, 108, 192);
        pdf.save(`Recibo_${profesorNombre.replace(' ', '_')}_${pago.periodo.replace(' ', '_')}.pdf`);
    } finally {
        document.body.removeChild(container);
    }
};
