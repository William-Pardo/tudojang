
// vistas/FirmaConsentimiento.tsx
import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { usePaginaFirma } from '../hooks/usePaginaFirma';
import { IconoFirma, IconoExitoAnimado } from '../components/Iconos';
import LogoDinamico from '../components/LogoDinamico';
import Loader from '../components/Loader';

const VistaFirmaConsentimiento: React.FC = () => {
    const { idEstudiante } = ReactRouterDOM.useParams<{ idEstudiante: string }>();
    const {
        estudiante,
        cargando,
        error,
        enviando,
        enviadoConExito,
        firmaRealizada,
        canvasRef,
        textoDocumento,
        limpiarFirma,
        enviarFirma,
    } = usePaginaFirma({ idEstudiante, tipo: 'consentimiento' });


    const renderContent = () => {
        if (cargando) {
            return <Loader texto="Cargando entorno de firma..." />;
        }
        if (error) {
            return (
                <div className="text-center p-6 bg-red-50 rounded-2xl border border-red-100">
                    <p className="text-lg text-tkd-red font-bold uppercase">{error}</p>
                    <p className="text-sm text-gray-500 mt-2">Por favor contacta a la administración de tu club.</p>
                </div>
            );
        }
        if (enviadoConExito) {
             return (
                <div className="text-center animate-fade-in">
                    <IconoExitoAnimado className="mx-auto text-green-500" />
                    <h2 className="text-2xl font-black text-green-600 mt-4 uppercase">¡Documento Firmado!</h2>
                    <p className="mt-4 text-gray-700 dark:text-gray-300">El consentimiento informado para <span className="font-bold">{estudiante?.nombres}</span> ha sido registrado exitosamente en nuestro sistema.</p>
                    <p className="mt-2 text-gray-500 dark:text-gray-400 font-medium uppercase text-[10px] tracking-widest">Ya puedes cerrar esta ventana con seguridad.</p>
                </div>
             );
        }
        if (!estudiante) return null;

        return (
            <>
                <div className="text-center">
                    <h2 className="text-2xl font-black text-tkd-dark dark:text-white uppercase tracking-tight">Consentimiento de Riesgos</h2>
                    <p className="mt-1 text-xs text-gray-500 font-bold uppercase tracking-widest">Taekwondo WT - Proceso de Formación</p>
                </div>
                
                <div className="p-4 bg-tkd-blue/5 dark:bg-tkd-blue/10 rounded-2xl border border-tkd-blue/20">
                    <h3 className="text-xs font-black text-tkd-blue uppercase tracking-wider mb-2">Instrucciones de Firma</h3>
                    <ul className="text-[11px] text-gray-600 dark:text-gray-400 space-y-1 font-medium uppercase">
                        <li>• Revisa el contenido del documento.</li>
                        <li>• Firma con tu dedo o mouse en el recuadro blanco.</li>
                        <li>• Presiona el botón para guardar el registro.</li>
                    </ul>
                </div>

                <div className="p-6 border border-gray-100 dark:border-gray-800 rounded-2xl bg-gray-50 dark:bg-gray-900/50 max-h-60 overflow-y-auto shadow-inner">
                    <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed font-medium">{textoDocumento}</p>
                </div>

                <div>
                    <div className="flex justify-between items-end mb-2 px-1">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Firma del Tutor / Acudiente</label>
                        <button onClick={limpiarFirma} className="text-[9px] font-black text-tkd-blue uppercase hover:underline">Borrar y Reintentar</button>
                    </div>
                    <div className="relative group">
                        <canvas
                            ref={canvasRef}
                            width="500"
                            height="200"
                            className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl bg-white cursor-crosshair group-hover:border-tkd-blue transition-colors shadow-sm"
                        ></canvas>
                        {!firmaRealizada && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Firme Aquí</span>
                            </div>
                        )}
                    </div>
                </div>

                 <button
                    onClick={() => enviarFirma()}
                    disabled={!firmaRealizada || enviando}
                    className="w-full bg-tkd-red text-white py-5 px-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:opacity-90 transition-all shadow-xl disabled:bg-gray-300 flex items-center justify-center gap-3 active:scale-95"
                >
                    <IconoFirma className="w-5 h-5"/>
                    <span>{enviando ? 'Guardando Registro...' : 'Acepto y Firmo el Documento'}</span>
                </button>
            </>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-tkd-gray dark:bg-tkd-dark p-4 sm:p-6">
            <div className="w-full max-w-xl p-8 space-y-8 bg-white dark:bg-gray-950 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-white/5 relative overflow-hidden">
                <div className="text-center">
                     <LogoDinamico className="w-20 h-20 mx-auto" />
                </div>
               {renderContent()}
            </div>
        </div>
    );
};

export default VistaFirmaConsentimiento;
