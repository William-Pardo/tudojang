
// utils/certificateGenerator.ts
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { Estudiante, ConfiguracionClub } from '../tipos';
import { formatearFecha } from './formatters';

interface DatosCertificado {
    estudiante?: Estudiante;
    estudiantes?: Estudiante[]; // Para certificados grupales
    horasMap?: Record<string, number>; // Horas calculadas por estudiante ID
    dirigidoA: string;
    fechaInicio: string;
    fechaFin: string;
    tipo: 'individual' | 'grupal';
}

/**
 * Genera un certificado profesional en formato Carta (8.5x11 in)
 */
export const generarCertificadoPdf = async (
    datos: DatosCertificado,
    config: ConfiguracionClub
) => {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '-4000px'; 
    container.style.width = '816px'; // 8.5in * 96dpi
    container.style.height = '1056px'; // 11in * 96dpi
    container.style.backgroundColor = 'white';
    container.style.fontFamily = "'Poppins', sans-serif";
    container.style.color = '#110e0f';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.padding = '0';

    const colorPrimario = config.colorSecundario;
    const colorAcento = config.colorAcento;
    const hoy = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

    // Cálculo del total para el modo grupal
    const totalHorasGrupo = datos.estudiantes?.reduce((acc, e) => acc + (datos.horasMap?.[e.id] || 0), 0) || 0;

    // Lógica de texto dinámico
    const buildBodyText = () => {
        if (datos.tipo === 'individual' && datos.estudiante) {
            return `
                Certifica que el deportista <b>${datos.estudiante.nombres.toUpperCase()} ${datos.estudiante.apellidos.toUpperCase()}</b>, 
                identificado con documento No. <b>${datos.estudiante.numeroIdentificacion}</b>, perteneciente al grado 
                <b>${datos.estudiante.grado.toUpperCase()}</b> y al grupo <b>${datos.estudiante.grupo.toUpperCase()}</b>, 
                ha cumplido satisfactoriamente con las horas de entrenamiento técnico de Taekwondo WT registradas en nuestro sistema.
                <br/><br/>
                Dichas sesiones fueron realizadas durante el periodo comprendido entre el <b>${formatearFecha(datos.fechaInicio)}</b> 
                y el <b>${formatearFecha(datos.fechaFin)}</b>, demostrando disciplina, marcialidad y compromiso con los valores institucionales.
            `;
        } else {
            return `
                Certifica que el grupo de deportistas listados a continuación, pertenecientes a la escuela de formación deportiva, 
                han cumplido satisfactoriamente con su proceso de formación técnica durante el periodo del 
                <b>${formatearFecha(datos.fechaInicio)}</b> al <b>${formatearFecha(datos.fechaFin)}</b>.
            `;
        }
    };

    container.innerHTML = `
        <div style="width: 100%; height: 100%; padding: 60px; box-sizing: border-box; display: flex; flex-direction: column; border: 20px solid ${colorPrimario}15; position: relative;">
            
            <!-- Marco Decorativo -->
            <div style="position: absolute; inset: 20px; border: 2px solid ${colorPrimario}; pointer-events: none;"></div>
            <div style="position: absolute; inset: 25px; border: 1px solid ${colorAcento}40; pointer-events: none;"></div>

            <!-- Marca de Agua -->
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.05; width: 400px; height: 400px; pointer-events: none; display: flex; align-items: center; justify-content: center;">
                ${config.logoUrl ? `<img src="${config.logoUrl}" style="width: 100%; object-fit: contain;" />` : ''}
            </div>

            <!-- Encabezado -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; z-index: 10;">
                <div style="text-align: left;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: ${colorPrimario}; text-transform: uppercase;">${config.nombreClub}</h1>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #666; font-weight: 700;">NIT: ${config.nit}</p>
                    <p style="margin: 2px 0 0 0; font-size: 11px; color: #888; font-weight: 500;">${config.direccionClub}</p>
                </div>
                ${config.logoUrl ? `<img src="${config.logoUrl}" style="height: 90px; width: auto; object-fit: contain;" />` : ''}
            </div>

            <div style="height: 4px; background: ${colorAcento}; width: 120px; margin-bottom: 50px;"></div>

            <!-- Título Documento -->
            <div style="text-align: center; margin-bottom: 45px; z-index: 10;">
                <h2 style="font-size: 32px; font-weight: 900; color: #1a1a1a; letter-spacing: -1px; margin: 0; text-transform: uppercase;">
                    Certificado de Intensidad Horaria
                </h2>
                <p style="font-size: 14px; font-weight: 600; color: ${colorPrimario}; text-transform: uppercase; margin-top: 10px; letter-spacing: 2px;">
                    Registro Técnico y de Asistencia
                </p>
            </div>

            <!-- Dirigido a -->
            <div style="margin-bottom: 35px; z-index: 10;">
                <p style="font-size: 11px; font-weight: 800; color: #999; text-transform: uppercase; margin-bottom: 5px;">Dirigido a:</p>
                <p style="font-size: 15px; font-weight: 700; color: #1a1a1a; margin: 0;">${datos.dirigidoA.toUpperCase()}</p>
            </div>

            <!-- Cuerpo -->
            <div style="flex-grow: 1; z-index: 10;">
                <p style="font-size: 17px; line-height: 1.8; color: #333; text-align: justify; margin-bottom: 40px;">
                    ${buildBodyText()}
                </p>

                <!-- BLOQUE DE RESUMEN TÉCNICO (Individual) -->
                ${datos.tipo === 'individual' && datos.estudiante ? `
                    <div style="display: flex; gap: 30px; margin-top: 20px;">
                        <div style="flex: 1; border: 2px solid ${colorPrimario}25; border-radius: 20px; padding: 25px; text-align: center; background: ${colorPrimario}05;">
                            <p style="margin: 0; font-size: 10px; color: #888; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px;">Intensidad del Periodo</p>
                            <p style="margin: 8px 0 0 0; font-size: 42px; font-weight: 900; color: ${colorPrimario}; line-height: 1;">${datos.horasMap?.[datos.estudiante.id] || 0}<span style="font-size: 16px; margin-left: 5px; opacity: 0.5;">HRS</span></p>
                        </div>
                        <div style="flex: 1; border: 2px solid #eee; border-radius: 20px; padding: 25px; text-align: center; background: #fafafa;">
                            <p style="margin: 0; font-size: 10px; color: #888; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px;">Total Acumulado Grado</p>
                            <p style="margin: 8px 0 0 0; font-size: 42px; font-weight: 900; color: #1a1a1a; line-height: 1;">${datos.estudiante.horasAcumuladasGrado}<span style="font-size: 16px; margin-left: 5px; opacity: 0.3;">HRS</span></p>
                        </div>
                    </div>
                ` : ''}

                <!-- TABLA GRUPAL CON PIE DE TOTALES -->
                ${datos.tipo === 'grupal' && datos.estudiantes ? `
                    <div style="margin-top: 20px; border: 1px solid #eee; border-radius: 15px; overflow: hidden;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                            <thead>
                                <tr style="background: ${colorPrimario}10; text-align: left;">
                                    <th style="padding: 12px 15px; border-bottom: 2px solid ${colorPrimario};">ESTUDIANTE</th>
                                    <th style="padding: 12px 15px; border-bottom: 2px solid ${colorPrimario};">GRADO</th>
                                    <th style="padding: 12px 15px; border-bottom: 2px solid ${colorPrimario}; text-align: right;">HORAS</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${datos.estudiantes.map(e => `
                                    <tr>
                                        <td style="padding: 10px 15px; border-bottom: 1px solid #eee; font-weight: 700; color: #444;">${e.nombres} ${e.apellidos}</td>
                                        <td style="padding: 10px 15px; border-bottom: 1px solid #eee; color: #666; font-weight: 600;">${e.grado}</td>
                                        <td style="padding: 10px 15px; border-bottom: 1px solid #eee; text-align: right; font-weight: 800; color: ${colorPrimario};">${datos.horasMap?.[e.id] || 0}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot>
                                <tr style="background: #fafafa;">
                                    <td colspan="2" style="padding: 15px; text-align: right; font-weight: 900; text-transform: uppercase; color: #888; font-size: 10px; letter-spacing: 1px;">Gran Total de Horas del Grupo:</td>
                                    <td style="padding: 15px; text-align: right; font-weight: 900; font-size: 14px; color: ${colorAcento};">${totalHorasGrupo}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                ` : ''}
            </div>

            <!-- Footer / Firmas -->
            <div style="margin-top: 40px; z-index: 10;">
                <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                    <div style="text-align: left;">
                        <div style="width: 250px; border-bottom: 2px solid #1a1a1a; margin-bottom: 10px;"></div>
                        <p style="font-size: 13px; font-weight: 900; margin: 0; text-transform: uppercase;">${config.representanteLegal}</p>
                        <p style="font-size: 11px; font-weight: 600; color: #666; margin: 0; text-transform: uppercase;">Representante Legal / Director Técnico</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="font-size: 10px; font-weight: 600; color: #aaa; margin: 0;">Expedido el día ${hoy}</p>
                        <div style="margin-top: 10px; padding: 8px 12px; border: 1px solid #eee; border-radius: 8px; font-size: 9px; font-weight: 800; color: ${colorPrimario}; display: inline-block; background: #fff;">
                            AUTENTICADO POR ALIANTSKD
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(container);

    try {
        const canvas = await html2canvas(container, {
            scale: 2.5,
            useCORS: true,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'px',
            format: [816, 1056]
        });

        pdf.addImage(imgData, 'JPEG', 0, 0, 816, 1056);
        const nombreArchivo = datos.tipo === 'individual' 
            ? `Certificado_${datos.estudiante?.nombres}_${Date.now()}.pdf`
            : `Certificado_Grupal_${Date.now()}.pdf`;
            
        pdf.save(nombreArchivo);
        return true;
    } catch (error) {
        console.error("Error generando certificado:", error);
        return false;
    } finally {
        document.body.removeChild(container);
    }
};
