
// vistas/FirmaContrato.tsx
import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { usePaginaFirma } from '../hooks/usePaginaFirma';
import { IconoFirma, IconoExitoAnimado } from '../components/Iconos';
import LogoDinamico from '../components/LogoDinamico';
import Loader from '../components/Loader';

const VistaFirmaContrato: React.FC = () => {
    const { idEstudiante } = ReactRouterDOM.useParams<{ idEstudiante: string }>();
    const {
        estudiante,
        cargando,
        error,
        enviando,
        enviadoConExito,
        firmaRealizada,
        metodoFirma,
        setMetodoFirma,
        nombreFirma,
        setNombreFirma,
        canvasRef,
        textoDocumento,
        limpiarFirma,
        enviarFirma,
    } = usePaginaFirma({ idEstudiante, tipo: 'contrato' });

    const renderContent = () => {
        if (cargando) return <Loader texto="Cargando Contrato de Matrícula..." />;
        if (error) return (
            <div className="text-center p-6 bg-red-50 rounded-2xl border border-red-100">
                <p className="text-lg text-tkd-red font-bold uppercase">{error}</p>
                <p className="text-sm text-gray-500 mt-2 italic font-medium">Comunícate con tu Sabonim para verificar tus datos.</p>
            </div>
        );

        if (enviadoConExito) {
            return (
                <div className="text-center animate-fade-in">
                    <IconoExitoAnimado className="mx-auto text-green-500" />
                    <h2 className="text-2xl font-black text-green-600 mt-4 uppercase">Contrato Legalizado</h2>
                    <p className="mt-4 text-gray-700 dark:text-gray-300">El contrato de servicios para <span className="font-bold">{estudiante?.nombres}</span> ha sido firmado y almacenado con validez digital.</p>
                    <p className="mt-6 text-[10px] text-gray-400 font-black uppercase tracking-widest">Muchas gracias por confiar en nuestra academia.</p>
                </div>
            );
        }

        return (
            <>
                <div className="text-center">
                    <h2 className="text-2xl font-black text-tkd-dark dark:text-white uppercase tracking-tight leading-none">Contrato de Prestación <br /> de Servicios</h2>
                    <p className="mt-2 text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">Acuerdo Legal Escuela de Formación</p>
                </div>

                <div className="p-6 border border-gray-100 dark:border-gray-800 rounded-[1.5rem] bg-gray-50 dark:bg-gray-900/50 max-h-72 overflow-y-auto shadow-inner border-l-4 border-l-tkd-blue">
                    <p className="text-[11px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed font-medium">{textoDocumento}</p>
                </div>

                <div className="space-y-6">
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl border border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => setMetodoFirma('lienzo')}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${metodoFirma === 'lienzo' ? 'bg-white dark:bg-gray-700 text-tkd-blue shadow-sm' : 'text-gray-400'}`}
                        >
                            Opción A: Dibujar
                        </button>
                        <button
                            onClick={() => setMetodoFirma('texto')}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${metodoFirma === 'texto' ? 'bg-white dark:bg-gray-700 text-tkd-blue shadow-sm' : 'text-gray-400'}`}
                        >
                            Opción B: Texto
                        </button>
                    </div>

                    {metodoFirma === 'lienzo' ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Firma Manual Tutor</label>
                                <button onClick={limpiarFirma} className="text-[9px] font-black text-tkd-red uppercase hover:underline">Reiniciar</button>
                            </div>
                            <canvas
                                ref={canvasRef}
                                width="500"
                                height="200"
                                className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl bg-white cursor-crosshair hover:border-tkd-blue transition-colors shadow-sm"
                            ></canvas>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Escribe tu nombre completo</label>
                            </div>
                            <input
                                type="text"
                                value={nombreFirma}
                                onChange={(e) => setNombreFirma(e.target.value)}
                                placeholder="NOMBRE DEL PADRE O TUTOR"
                                className="w-full bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 focus:border-tkd-blue rounded-2xl py-4 px-6 font-bold text-lg outline-none transition-all dark:text-white"
                            />
                            <div className="p-10 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-3xl bg-white/50 dark:bg-black/20 text-center flex flex-col items-center justify-center">
                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.3em] mb-4">Vista Previa de Firma Digital</p>
                                <p className="text-5xl text-tkd-blue" style={{ fontFamily: '"Dancing Script", cursive' }}>
                                    {nombreFirma || 'Nombre Completo'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <button
                    onClick={() => enviarFirma()}
                    disabled={(metodoFirma === 'lienzo' ? !firmaRealizada : nombreFirma.trim().length < 4) || enviando}
                    className="w-full bg-tkd-blue text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-blue-800 transition-all shadow-xl disabled:bg-gray-300 active:scale-95 flex items-center justify-center gap-3"
                >
                    <IconoFirma className="w-5 h-5" />
                    <span>{enviando ? 'Verificando Identidad...' : 'Legalizar y Firmar Contrato'}</span>
                </button>
            </>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-tkd-gray dark:bg-tkd-dark p-4">
            <div className="w-full max-w-xl p-10 space-y-8 bg-white dark:bg-gray-950 rounded-[3rem] shadow-2xl relative overflow-hidden">
                <div className="flex justify-center">
                    <LogoDinamico className="h-16 w-auto" />
                </div>
                {renderContent()}
            </div>
        </div>
    );
};

export default VistaFirmaContrato;
