
// vistas/FirmaImagen.tsx
import React, { useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { usePaginaFirma } from '../hooks/usePaginaFirma';
import { IconoFirma, IconoExitoAnimado } from '../components/Iconos';
import LogoDinamico from '../components/LogoDinamico';
import Loader from '../components/Loader';

const VistaFirmaImagen: React.FC = () => {
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
    } = usePaginaFirma({ idEstudiante, tipo: 'imagen' });

    const [autorizacion, setAutorizacion] = useState<'si' | 'no' | null>(null);

    const handleEnviar = () => {
        if (autorizacion === null) return;
        enviarFirma(autorizacion === 'si');
    };

    const renderContent = () => {
        if (cargando) return <Loader texto="Configurando permisos de imagen..." />;
        if (error) return <div className="text-center p-6 bg-red-50 text-red-600 rounded-2xl font-bold uppercase text-xs">{error}</div>;

        if (enviadoConExito) {
            return (
                <div className="text-center animate-fade-in">
                    <IconoExitoAnimado className="mx-auto text-green-500" />
                    <h2 className="text-2xl font-black text-green-600 mt-4 uppercase">Autorización Guardada</h2>
                    <p className="mt-4 text-gray-700 dark:text-gray-300">Gracias por gestionar los permisos de imagen para <span className="font-bold">{estudiante?.nombres}</span>.</p>
                </div>
            );
        }

        return (
            <>
                <div className="text-center">
                    <h2 className="text-2xl font-black text-tkd-dark dark:text-white uppercase tracking-tight">Manejo de Imagen y Datos</h2>
                    <p className="mt-1 text-[10px] text-gray-500 font-black uppercase tracking-widest">Protocolo de Privacidad Institucional</p>
                </div>

                <div className="p-6 border border-gray-100 dark:border-gray-800 rounded-2xl bg-gray-50 dark:bg-gray-900/50 max-h-52 overflow-y-auto shadow-inner">
                    <p className="text-[11px] text-gray-700 dark:text-gray-300 font-medium leading-relaxed uppercase">{textoDocumento}</p>
                </div>

                <div className="p-6 bg-tkd-blue/5 dark:bg-tkd-blue/10 rounded-[2rem] space-y-4">
                    <p className="text-[10px] font-black uppercase text-tkd-blue tracking-widest text-center mb-2">Tu decisión como tutor:</p>
                    <div className="grid gap-3">
                        <label className={`flex items-center p-4 rounded-2xl cursor-pointer border-2 transition-all ${autorizacion === 'si' ? 'bg-white border-tkd-blue shadow-md' : 'bg-transparent border-gray-200 dark:border-gray-700 opacity-60'}`}>
                            <input type="radio" name="autorizacion" value="si" onChange={() => setAutorizacion('si')} className="h-5 w-5 text-tkd-blue border-gray-300" />
                            <span className="ml-4 text-[10px] font-black uppercase text-gray-800 dark:text-gray-200 leading-tight">Autorizo uso de fotos/videos para fines pedagógicos.</span>
                        </label>
                        <label className={`flex items-center p-4 rounded-2xl cursor-pointer border-2 transition-all ${autorizacion === 'no' ? 'bg-white border-tkd-red shadow-md' : 'bg-transparent border-gray-200 dark:border-gray-700 opacity-60'}`}>
                            <input type="radio" name="autorizacion" value="no" onChange={() => setAutorizacion('no')} className="h-5 w-5 text-tkd-red border-gray-300" />
                            <span className="ml-4 text-[10px] font-black uppercase text-gray-800 dark:text-gray-200 leading-tight">No autorizo registro multimedia (SÓLO ADMINISTRATIVO).</span>
                        </label>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl border border-gray-200 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={() => setMetodoFirma('lienzo')}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${metodoFirma === 'lienzo' ? 'bg-white dark:bg-gray-700 text-tkd-blue shadow-sm' : 'text-gray-400'}`}
                        >
                            Dibujar Firma
                        </button>
                        <button
                            type="button"
                            onClick={() => setMetodoFirma('texto')}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${metodoFirma === 'texto' ? 'bg-white dark:bg-gray-700 text-tkd-blue shadow-sm' : 'text-gray-400'}`}
                        >
                            Firma por Texto
                        </button>
                    </div>

                    {metodoFirma === 'lienzo' ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Firma Manual Tutor</label>
                                <button type="button" onClick={limpiarFirma} className="text-[9px] font-black text-tkd-blue uppercase hover:underline">Referenciar</button>
                            </div>
                            <canvas
                                ref={canvasRef}
                                width="500"
                                height="200"
                                className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl bg-white shadow-sm"
                            ></canvas>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase text-gray-400 block px-1">Escribe tu nombre completo:</label>
                            <input
                                type="text"
                                value={nombreFirma}
                                onChange={(e) => setNombreFirma(e.target.value)}
                                placeholder="NOMBRE ACUDIENTE"
                                className="w-full bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 focus:border-tkd-blue rounded-2xl py-4 px-6 font-bold text-lg outline-none transition-all dark:text-white"
                            />
                            <div className="p-8 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-3xl bg-white/50 dark:bg-black/20 text-center flex flex-col items-center justify-center">
                                <span className="text-4xl text-tkd-blue" style={{ fontFamily: '"Dancing Script", cursive' }}>
                                    {nombreFirma || 'Tu Firma'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleEnviar}
                    disabled={(metodoFirma === 'lienzo' ? !firmaRealizada : nombreFirma.trim().length < 4) || !autorizacion || enviando}
                    className="w-full bg-tkd-red text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-red-700 transition-all shadow-xl disabled:bg-gray-300 active:scale-95 flex items-center justify-center gap-3"
                >
                    <IconoFirma className="w-5 h-5" />
                    <span>{enviando ? 'Guardando...' : 'Finalizar y Enviar'}</span>
                </button>
            </>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-tkd-gray dark:bg-tkd-dark p-4">
            <div className="w-full max-w-xl p-10 space-y-8 bg-white dark:bg-gray-950 rounded-[3rem] shadow-2xl border border-gray-100 dark:border-white/5">
                <div className="text-center">
                    <LogoDinamico className="h-20 w-auto mx-auto" />
                </div>
                {renderContent()}
            </div>
        </div>
    );
};

export default VistaFirmaImagen;
