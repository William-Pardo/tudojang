
// vistas/ReportarPagoPublico.tsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTenant } from '../components/BrandingProvider';
import MediosPagoResumen from '../components/MediosPagoResumen';
import { resolverEstudiantePublico, reportarPagoPublico } from '../servicios/pagosEstudiantesApi';
import { IconoExitoAnimado, IconoEnviar, IconoUsuario, IconoInformacion, IconoAprobar, IconoLogoOficial, IconoBillete } from '../components/Iconos';
import LogoDinamico from '../components/LogoDinamico';
import Loader from '../components/Loader';
import { formatearPrecio } from '../utils/formatters';
import type { Estudiante } from '../tipos';

type EstudiantePublico = Pick<Estudiante, 'id' | 'nombres' | 'apellidos' | 'saldoDeudor'>;

const ReportarPagoPublico: React.FC = () => {
    const [searchParams] = useSearchParams();
    const { tenant, estaCargado } = useTenant();

    // El valor de `id` es el ID REAL del documento de Firestore (opaco, no enumerable) --
    // bug real (2026-09-02): antes era el numeroIdentificacion del estudiante (dato no
    // secreto) y el query que lo resolvía SIEMPRE fallaba con permission-denied, sin importar
    // login. Ver servicios/pagosEstudiantesApi.ts::resolverEstudiantePublico.
    const [idUrl] = useState(searchParams.get('id') || '');
    const [estudiante, setEstudiante] = useState<EstudiantePublico | null>(null);
    const [buscando, setBuscando] = useState(false);
    const [monto, setMonto] = useState<string>('');
    const [imagen, setImagen] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [exito, setExito] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Búsqueda automática e instantánea si viene ID en el link
    useEffect(() => {
        const cargarInicial = async () => {
            if (idUrl && estaCargado && tenant) {
                setBuscando(true);
                try {
                    const res = await resolverEstudiantePublico(idUrl, tenant.tenantId);
                    if (res) {
                        setEstudiante(res);
                        // Bug real (2026-09-03, reportado vía WhatsApp/iPhone): con saldoDeudor <= 0
                        // (alumno al día, adelantando el mes siguiente) el campo quedaba vacío sin
                        // ninguna pista visual -- el botón de enviar se ve activo pero permanece
                        // disabled por `!monto` indefinidamente. Se pre-llena con la mensualidad
                        // configurada por la academia; si tampoco existe, el placeholder cubre el resto.
                        setMonto(res.saldoDeudor > 0 ? res.saldoDeudor.toString() : (tenant?.valorMensualidad ? tenant.valorMensualidad.toString() : ''));
                    }
                } catch (e) {
                    console.error("Error en carga inicial", e);
                } finally {
                    setBuscando(false);
                }
            }
        };
        cargarInicial();
    }, [estaCargado, idUrl, tenant]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagen(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleEnviarReporte = async () => {
        if (!estudiante || !imagen || !monto || !tenant) return;

        setEnviando(true);
        setError(null);
        try {
            await reportarPagoPublico(
                estudiante.id,
                tenant.tenantId,
                parseInt(monto),
                imagen
            );
            setExito(true);
        } catch (err) {
            setError("No se pudo enviar el reporte. Intenta de nuevo.");
        } finally {
            setEnviando(false);
        }
    };

    if (!estaCargado || (buscando && !estudiante)) {
        return <div className="h-screen bg-tkd-dark flex items-center justify-center"><Loader texto="Identificando Alumno..." /></div>;
    }

    return (
        <div className="min-h-screen py-6 px-4 flex flex-col items-center font-sans transition-all" style={{ backgroundColor: tenant?.colorPrimario }}>

            {/* Header Compacto */}
            <div className="mb-6 text-center animate-fade-in">
                <div className="bg-white p-4 rounded-3xl shadow-xl inline-block mb-3">
                    <LogoDinamico className="w-12 h-12" />
                </div>
                <h1 className="text-white text-2xl font-black uppercase tracking-tighter">Portal de Pago</h1>
                <p className="text-white/60 text-[8px] font-black uppercase tracking-[0.3em]">{tenant?.nombreClub}</p>
            </div>

            <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/10">
                <AnimatePresence mode="wait">
                    {exito ? (
                        <motion.div
                            key="exito" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            className="p-10 text-center space-y-6"
                        >
                            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                                <IconoExitoAnimado className="text-green-600 w-12 h-12" />
                            </div>
                            <h2 className="text-2xl font-black uppercase tracking-tighter text-tkd-dark dark:text-white">¡Reporte Enviado!</h2>
                            <p className="text-gray-500 font-bold uppercase text-[9px] tracking-widest leading-relaxed">
                                {/* SDD notificaciones-pagos (design.md, File Changes -> ReportarPagoPublico.tsx:111):
                                    este flujo público (link sin login) no tiene buzón in-app --
                                    copia neutra, sin prometer WhatsApp y SIN referenciar un
                                    buzón que este flujo no puede mostrar. */}
                                El Sabonim verificará tu pago pronto. <br />
                                <span className="text-tkd-blue">Contactá a la academia si tenés dudas sobre el estado.</span>
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="reporte" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            className="p-6 space-y-6"
                        >
                            {/* Información del Estudiante (Cargada automáticamente) */}
                            {estudiante && (
                                <div className="bg-blue-600 p-6 rounded-[2rem] text-white shadow-xl flex items-center gap-4 border-b-4 border-blue-800">
                                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                                        <IconoUsuario className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black uppercase leading-none">{estudiante.nombres} {estudiante.apellidos}</h3>
                                        <p className="text-[9px] font-bold opacity-80 uppercase tracking-widest mt-1">Saldo a pagar: {formatearPrecio(estudiante.saldoDeudor)}</p>
                                    </div>
                                </div>
                            )}

                            {!estudiante && (
                                <div className="p-4 bg-red-50 rounded-2xl">
                                    <p className="text-red-600 text-[10px] font-black uppercase text-center">No se pudo identificar al alumno automáticamente. Por favor solicita un nuevo link.</p>
                                </div>
                            )}

                            {estudiante && (
                                <div className="space-y-6">
                                    {/* Campo de Monto (Pre-llenado) */}
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-2 block ml-2">Monto Transferido ($)</label>
                                        <input
                                            type="number"
                                            value={monto}
                                            onChange={(e) => setMonto(e.target.value)}
                                            placeholder="Ej: 50000"
                                            className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-transparent rounded-2xl py-4 px-6 font-black text-2xl text-tkd-blue focus:border-tkd-blue transition-all dark:text-white"
                                        />
                                        {!monto && (
                                            <p className="text-[9px] font-bold text-tkd-red text-center mt-2">Escribí el monto que transferiste para poder enviar el reporte</p>
                                        )}
                                    </div>

                                    {/* Link de Pago en Línea (Opcional, lo configura la academia) */}
                                    {tenant?.linkPagoMensualidad && (
                                        <div className="space-y-2">
                                            <button
                                                onClick={() => window.open(tenant.linkPagoMensualidad, '_blank', 'noopener,noreferrer')}
                                                className="w-full py-6 bg-tkd-blue text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                                            >
                                                <IconoBillete className="w-5 h-5" />
                                                <span>Pagar en Línea</span>
                                            </button>
                                            <p className="text-[9px] font-bold text-gray-400 text-center flex items-center justify-center gap-1">
                                                <IconoInformacion className="w-3 h-3 flex-shrink-0" />
                                                Después de pagar, subí tu comprobante abajo para que se registre tu pago
                                            </p>
                                        </div>
                                    )}

                                    {/* Medios de pago manual (Nequi, Daviplata, Bre-B, Banco) */}
                                    {(tenant?.pagoNequi || tenant?.pagoDaviplata || tenant?.pagoBreB || tenant?.pagoBanco) && (
                                        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 space-y-3">
                                            <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Medios de Pago Directo</p>
                                            <MediosPagoResumen
                                                pagoNequi={tenant?.pagoNequi}
                                                pagoDaviplata={tenant?.pagoDaviplata}
                                                pagoBreB={tenant?.pagoBreB}
                                                pagoBanco={tenant?.pagoBanco}
                                            />
                                        </div>
                                    )}

                                    {/* Zona de adjuntar SCREENSHOT (Gran área de clic) */}
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-2 block ml-2">Adjuntar Comprobante (Screenshot)</label>
                                        <div className={`relative h-56 border-3 border-dashed rounded-[2rem] flex flex-col items-center justify-center transition-all ${imagen ? 'border-green-500 bg-green-50/20' : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 hover:border-tkd-blue'}`}>
                                            {imagen ? (
                                                <div className="relative w-full h-full p-4 group">
                                                    <img src={imagen} alt="Pago" className="w-full h-full object-contain rounded-xl" />
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => setImagen(null)} className="bg-white text-tkd-red py-2 px-4 rounded-xl font-black uppercase text-[9px] tracking-widest">Cambiar Imagen</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="bg-tkd-blue text-white p-4 rounded-full shadow-lg mb-3 animate-pulse">
                                                        <IconoEnviar className="w-6 h-6 -rotate-45" />
                                                    </div>
                                                    <p className="text-[10px] font-black uppercase tracking-tighter text-tkd-dark dark:text-white">Toca aquí para subir Screenshot</p>
                                                    <p className="text-[8px] font-bold text-gray-400 mt-1">Nequi, Daviplata o Banco</p>
                                                    <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Único Botón de Acción */}
                                    <button
                                        onClick={handleEnviarReporte}
                                        disabled={enviando || !imagen || !monto}
                                        className="w-full py-6 bg-tkd-dark dark:bg-blue-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                    >
                                        {enviando ? (
                                            <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                <IconoAprobar className="w-5 h-5" />
                                                <span>REPORTAR PAGO AHORA</span>
                                            </>
                                        )}
                                    </button>

                                    <div className="flex items-center justify-center gap-2 opacity-40">
                                        <IconoLogoOficial className="w-3 h-3" />
                                        <p className="text-[7px] font-black uppercase tracking-widest">Procesado por Inteligencia Artificial Tudojang</p>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default ReportarPagoPublico;
