// utils/certificateGenerator.ts
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { Estudiante, ConfiguracionClub } from '../tipos';
import { formatearFecha } from './formatters';

interface DatosCertificado {
    estudiante?: Estudiante;
    estudiantes?: Estudiante[];
    horasMap?: Record<string, number>;
    dirigidoA: string;
    fechaInicio: string;
    fechaFin: string;
    tipo: 'individual' | 'grupal';
}

const PAGE_WIDTH = 816;
const PAGE_HEIGHT = 1056;
const FILAS_PRIMERA_PAGINA = 8;
const FILAS_CONTINUACION = 17;
const FILAS_ULTIMA_PAGINA = 12;

const chunkEstudiantes = (estudiantes: Estudiante[]): Estudiante[][] => {
    if (estudiantes.length <= FILAS_PRIMERA_PAGINA) return [estudiantes];

    const paginas: Estudiante[][] = [estudiantes.slice(0, FILAS_PRIMERA_PAGINA)];
    let inicio = FILAS_PRIMERA_PAGINA;

    while (estudiantes.length - inicio > FILAS_ULTIMA_PAGINA) {
        const restantesDespuesDePagina = estudiantes.length - inicio - FILAS_CONTINUACION;
        const filasPagina = restantesDespuesDePagina > 0 && restantesDespuesDePagina < FILAS_ULTIMA_PAGINA
            ? estudiantes.length - inicio - FILAS_ULTIMA_PAGINA
            : FILAS_CONTINUACION;
        paginas.push(estudiantes.slice(inicio, inicio + filasPagina));
        inicio += filasPagina;
    }

    paginas.push(estudiantes.slice(inicio));
    return paginas;
};

const escapeHtml = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

/**
 * Genera un certificado profesional en formato Carta (8.5x11 in).
 * En modo grupal genera tantas páginas como sean necesarias para no desbordar la tabla.
 */
export const generarCertificadoPdf = async (
    datos: DatosCertificado,
    config: ConfiguracionClub
) => {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '-4000px';
    container.style.width = `${PAGE_WIDTH}px`;
    container.style.backgroundColor = 'white';
    container.style.fontFamily = "'Poppins', sans-serif";
    container.style.color = '#110e0f';
    container.style.padding = '0';

    const colorPrimario = config.colorSecundario;
    const colorAcento = config.colorAcento;
    const hoy = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    const totalHorasGrupo = datos.estudiantes?.reduce((acc, e) => acc + (datos.horasMap?.[e.id] || 0), 0) || 0;

    const buildBodyText = () => {
        if (datos.tipo === 'individual' && datos.estudiante) {
            return `
                Certifica que el deportista <b>${escapeHtml(datos.estudiante.nombres.toUpperCase())} ${escapeHtml(datos.estudiante.apellidos.toUpperCase())}</b>,
                identificado con documento No. <b>${escapeHtml(datos.estudiante.numeroIdentificacion)}</b>, perteneciente al grado
                <b>${escapeHtml(datos.estudiante.grado.toUpperCase())}</b> y al grupo <b>${escapeHtml(datos.estudiante.grupo.toUpperCase())}</b>,
                ha cumplido satisfactoriamente con las horas de entrenamiento técnico de Taekwondo WT registradas en nuestro sistema.
                <br/><br/>
                Dichas sesiones fueron realizadas durante el periodo comprendido entre el <b>${formatearFecha(datos.fechaInicio)}</b> 
                y el <b>${formatearFecha(datos.fechaFin)}</b>, demostrando disciplina, marcialidad y compromiso con los valores institucionales.
            `;
        }

        return `
            Certifica que el grupo de deportistas listados a continuación, pertenecientes a la escuela de formación deportiva,
            han cumplido satisfactoriamente con su proceso de formación técnica durante el periodo del
            <b>${formatearFecha(datos.fechaInicio)}</b> al <b>${formatearFecha(datos.fechaFin)}</b>.
        `;
    };

    const renderHeader = (compacto: boolean) => `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: ${compacto ? '24px' : '40px'}; z-index: 10;">
            <div style="text-align: left;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: ${colorPrimario}; text-transform: uppercase;">${escapeHtml(config.nombreClub)}</h1>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #666; font-weight: 700;">NIT: ${escapeHtml(config.nit)}</p>
                <p style="margin: 2px 0 0 0; font-size: 11px; color: #888; font-weight: 500;">${escapeHtml(config.direccionClub)}</p>
            </div>
            ${config.logoUrl ? `<img src="${config.logoUrl}" style="height: 90px; width: auto; object-fit: contain;" />` : ''}
        </div>
    `;

    const renderTablaGrupal = (estudiantesPagina: Estudiante[], esUltimaPagina: boolean) => `
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
                    ${estudiantesPagina.map(e => `
                        <tr>
                            <td style="padding: 10px 15px; border-bottom: 1px solid #eee; font-weight: 700; color: #444;">${escapeHtml(e.nombres)} ${escapeHtml(e.apellidos)}</td>
                            <td style="padding: 10px 15px; border-bottom: 1px solid #eee; color: #666; font-weight: 600;">${escapeHtml(e.grado)}</td>
                            <td style="padding: 10px 15px; border-bottom: 1px solid #eee; text-align: right; font-weight: 800; color: ${colorPrimario};">${datos.horasMap?.[e.id] || 0}</td>
                        </tr>
                    `).join('')}
                </tbody>
                ${esUltimaPagina ? `
                    <tfoot>
                        <tr style="background: #fafafa;">
                            <td colspan="2" style="padding: 15px; text-align: right; font-weight: 900; text-transform: uppercase; color: #888; font-size: 10px; letter-spacing: 1px;">Gran Total de Horas del Grupo:</td>
                            <td style="padding: 15px; text-align: right; font-weight: 900; font-size: 14px; color: ${colorAcento};">${totalHorasGrupo}</td>
                        </tr>
                    </tfoot>
                ` : ''}
            </table>
        </div>
    `;

    const renderFooter = (paginaActual: number, totalPaginas: number) => {
        const mostrarFirma = totalPaginas === 1 || paginaActual === totalPaginas;

        if (!mostrarFirma) {
            return `
                <div style="position: absolute; right: 90px; bottom: 28px; z-index: 10; text-align: right;">
                    <p style="font-size: 9px; font-weight: 800; color: #aaa; margin: 0;">Página ${paginaActual} de ${totalPaginas}</p>
                </div>
            `;
        }

        return `
        <div style="position: absolute; left: 90px; right: 90px; bottom: 72px; z-index: 10;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                <div style="text-align: left;">
                    <div style="width: 250px; border-bottom: 2px solid #1a1a1a; margin-bottom: 10px;"></div>
                    <p style="font-size: 13px; font-weight: 900; margin: 0; text-transform: uppercase;">${escapeHtml(config.representanteLegal)}</p>
                    <p style="font-size: 11px; font-weight: 600; color: #666; margin: 0; text-transform: uppercase;">Representante Legal / Director Técnico</p>
                </div>
                <div style="text-align: right;">
                    <p style="font-size: 10px; font-weight: 600; color: #aaa; margin: 0;">Expedido el día ${hoy}</p>
                    ${totalPaginas > 1 ? `<p style="font-size: 9px; font-weight: 800; color: #aaa; margin: 6px 0 0 0;">Página ${paginaActual} de ${totalPaginas}</p>` : ''}
                    <div style="margin-top: 10px; padding: 8px 12px; border: 1px solid #eee; border-radius: 8px; font-size: 9px; font-weight: 800; color: ${colorPrimario}; display: inline-block; background: #fff;">
                        AUTENTICADO POR ALIANTSKD
                    </div>
                </div>
            </div>
        </div>
    `;
    };

    const renderPagina = (params: {
        estudiantesPagina?: Estudiante[];
        paginaActual: number;
        totalPaginas: number;
    }) => {
        const esGrupal = datos.tipo === 'grupal';
        const esPrimeraPagina = params.paginaActual === 1;
        const esUltimaPagina = params.paginaActual === params.totalPaginas;
        const mostrarFirma = params.totalPaginas === 1 || esUltimaPagina;
        const compacto = esGrupal && !esPrimeraPagina;

        return `
            <div class="cert-page" style="width: ${PAGE_WIDTH}px; height: ${PAGE_HEIGHT}px; padding: 60px; box-sizing: border-box; display: flex; flex-direction: column; border: 20px solid ${colorPrimario}15; position: relative; background: white; overflow: hidden;">
                <div style="position: absolute; inset: 20px; border: 2px solid ${colorPrimario}; pointer-events: none;"></div>
                <div style="position: absolute; inset: 25px; border: 1px solid ${colorAcento}40; pointer-events: none;"></div>

                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.05; width: 400px; height: 400px; pointer-events: none; display: flex; align-items: center; justify-content: center;">
                    ${config.logoUrl ? `<img src="${config.logoUrl}" style="width: 100%; object-fit: contain;" />` : ''}
                </div>

                ${renderHeader(compacto)}

                ${!compacto ? `<div style="height: 4px; background: ${colorAcento}; width: 120px; margin-bottom: 50px;"></div>` : ''}

                <div style="text-align: center; margin-bottom: ${compacto ? '24px' : '45px'}; z-index: 10;">
                    <h2 style="font-size: ${compacto ? '24px' : '32px'}; font-weight: 900; color: #1a1a1a; letter-spacing: -1px; margin: 0; text-transform: uppercase;">
                        Certificado de Intensidad Horaria
                    </h2>
                    <p style="font-size: ${compacto ? '11px' : '14px'}; font-weight: 600; color: ${colorPrimario}; text-transform: uppercase; margin-top: 10px; letter-spacing: 2px;">
                        ${compacto ? 'Continuación del listado grupal' : 'Registro Técnico y de Asistencia'}
                    </p>
                </div>

                ${!compacto ? `
                    <div style="margin-bottom: 35px; z-index: 10;">
                        <p style="font-size: 11px; font-weight: 800; color: #999; text-transform: uppercase; margin-bottom: 5px;">Dirigido a:</p>
                        <p style="font-size: 15px; font-weight: 700; color: #1a1a1a; margin: 0;">${escapeHtml(datos.dirigidoA.toUpperCase())}</p>
                    </div>
                ` : ''}

                <div style="flex-grow: 1; z-index: 10; padding-bottom: ${mostrarFirma ? '150px' : '44px'}; box-sizing: border-box;">
                    ${!compacto ? `
                        <p style="font-size: 17px; line-height: 1.8; color: #333; text-align: justify; margin-bottom: 40px;">
                            ${buildBodyText()}
                        </p>
                    ` : ''}

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

                    ${esGrupal && params.estudiantesPagina ? renderTablaGrupal(params.estudiantesPagina, esUltimaPagina) : ''}
                </div>

                ${renderFooter(params.paginaActual, params.totalPaginas)}
            </div>
        `;
    };

    const paginas = datos.tipo === 'grupal'
        ? chunkEstudiantes(datos.estudiantes || [])
        : [[] as Estudiante[]];

    container.innerHTML = paginas.map((estudiantesPagina, index) => renderPagina({
        estudiantesPagina,
        paginaActual: index + 1,
        totalPaginas: paginas.length,
    })).join('');

    document.body.appendChild(container);

    try {
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'px',
            format: [PAGE_WIDTH, PAGE_HEIGHT]
        });

        const pages = Array.from(container.querySelectorAll<HTMLElement>('.cert-page'));
        for (let i = 0; i < pages.length; i++) {
            const canvas = await html2canvas(pages[i], {
                scale: 2.5,
                useCORS: true,
                backgroundColor: '#ffffff'
            });

            if (i > 0) pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT], 'portrait');
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
        }

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
