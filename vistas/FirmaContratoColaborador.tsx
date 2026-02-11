
// vistas/FirmaContratoColaborador.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import * as api from '../servicios/api';
import * as plantillas from '../servicios/plantillas';
import { useNotificacion } from '../context/NotificacionContext';
import { IconoContrato, IconoExitoAnimado, IconoFirma } from '../components/Iconos';
import LogoDinamico from '../components/LogoDinamico';
import Loader from '../components/Loader';
import type { Usuario, ConfiguracionClub } from '../tipos';

const VistaFirmaContratoColaborador: React.FC = () => {
    const { idUsuario } = ReactRouterDOM.useParams<{ idUsuario: string }>();
    const [usuario, setUsuario] = useState<Usuario | null>(null);
    const [configClub, setConfigClub] = useState<ConfiguracionClub | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [enviadoConExito, setEnviadoConExito] = useState(false);

    const { mostrarNotificacion } = useNotificacion();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [firmaRealizada, setFirmaRealizada] = useState(false);

    const cargarDatos = useCallback(async () => {
        if (!idUsuario) {
            setError("No se proporcionó un ID de usuario.");
            setCargando(false);
            return;
        }
        try {
            const usuarios = await api.obtenerUsuarios();
            const u = usuarios.find(x => x.id === idUsuario);

            if (!u) {
                setError("Colaborador no encontrado.");
                return;
            }

            const config = await api.obtenerConfiguracionClub(u.tenantId);

            // Si el contrato no existe, creamos un borrador temporal para que se vea la plantilla
            if (!u.contrato) {
                u.contrato = {
                    valorPago: 0,
                    tipoVinculacion: 'Mes' as any,
                    tipoVinculacionOtro: '',
                    fechaInicio: new Date().toISOString().split('T')[0],
                    lugarEjecucion: config.lugarFirma || 'Bogotá D.C.',
                    firmado: false
                };
            }

            setUsuario(u);
            setConfigClub(config);

            if (u.contrato.firmado) {
                setEnviadoConExito(true);
            }
        } catch (err) {
            setError("Error al cargar los términos legales.");
        } finally {
            setCargando(false);
        }
    }, [idUsuario]);

    useEffect(() => {
        cargarDatos();
    }, [cargarDatos]);

    // Lógica del lienzo de firma
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || enviadoConExito) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        context.lineCap = 'round';
        context.strokeStyle = '#110e0f';
        context.lineWidth = 3;

        let isDrawing = false;
        let lastX = 0;
        let lastY = 0;

        const getCoords = (e: MouseEvent | TouchEvent) => {
            if (e instanceof TouchEvent) {
                const rect = canvas.getBoundingClientRect();
                return {
                    offsetX: e.touches[0].clientX - rect.left,
                    offsetY: e.touches[0].clientY - rect.top
                };
            }
            return { offsetX: e.offsetX, offsetY: e.offsetY };
        }

        const startDrawing = (e: MouseEvent | TouchEvent) => {
            isDrawing = true;
            setFirmaRealizada(true);
            const { offsetX, offsetY } = getCoords(e);
            [lastX, lastY] = [offsetX, offsetY];
        };

        const draw = (e: MouseEvent | TouchEvent) => {
            if (!isDrawing) return;
            e.preventDefault();
            const { offsetX, offsetY } = getCoords(e);
            context.beginPath();
            context.moveTo(lastX, lastY);
            context.lineTo(offsetX, offsetY);
            context.stroke();
            [lastX, lastY] = [offsetX, offsetY];
        };

        const stopDrawing = () => { isDrawing = false; };

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseleave', stopDrawing);
        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDrawing);

        return () => {
            canvas.removeEventListener('mousedown', startDrawing);
            canvas.removeEventListener('mousemove', draw);
            canvas.removeEventListener('mouseup', stopDrawing);
            canvas.removeEventListener('mouseleave', stopDrawing);
            canvas.removeEventListener('touchstart', startDrawing);
            canvas.removeEventListener('touchmove', draw);
            canvas.removeEventListener('touchend', stopDrawing);
        };
    }, [cargando, enviadoConExito]);

    const limpiarFirma = () => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (canvas && context) {
            context.clearRect(0, 0, canvas.width, canvas.height);
            setFirmaRealizada(false);
        }
    };

    const handleEnviarFirma = async () => {
        if (!canvasRef.current || !firmaRealizada || !idUsuario) return;
        setEnviando(true);
        try {
            const firma = canvasRef.current.toDataURL('image/png');
            await api.guardarFirmaContratoColaborador(idUsuario, firma);
            setEnviadoConExito(true);
            mostrarNotificacion("Contrato firmado exitosamente.", "success");
        } catch (err) {
            mostrarNotificacion("Error al legalizar la firma.", "error");
        } finally {
            setEnviando(false);
        }
    };

    if (cargando) return <div className="h-screen flex items-center justify-center bg-tkd-dark"><Loader texto="Cargando Contrato del Colaborador..." /></div>;

    return (
        <div className="flex items-center justify-center min-h-screen bg-tkd-gray dark:bg-tkd-dark p-4">
            <div className="w-full max-w-xl p-10 space-y-8 bg-white dark:bg-gray-950 rounded-[3rem] shadow-2xl relative overflow-hidden">
                <div className="flex justify-center">
                    <LogoDinamico className="h-16 w-auto" />
                </div>

                {error ? (
                    <div className="text-center p-6 bg-red-50 rounded-2xl border border-red-100">
                        <p className="text-lg text-tkd-red font-black uppercase tracking-tight">{error}</p>
                        <p className="text-sm text-gray-500 mt-2 italic font-medium">Comunícate con la dirección para habilitar tu firma.</p>
                        <ReactRouterDOM.Link to="/" className="mt-6 inline-block text-xs font-black uppercase text-tkd-blue underline">Volver al inicio</ReactRouterDOM.Link>
                    </div>
                ) : enviadoConExito ? (
                    <div className="text-center animate-fade-in">
                        <IconoExitoAnimado className="mx-auto text-green-500" />
                        <h2 className="text-2xl font-black text-green-600 mt-4 uppercase">Vínculo Legalizado</h2>
                        <p className="mt-4 text-gray-700 dark:text-gray-300">Tu contrato como <span className="font-bold">{usuario?.rol}</span> ha sido firmado y almacenado con validez digital el día de hoy.</p>
                        <p className="mt-6 text-[10px] text-gray-400 font-black uppercase tracking-widest">Muchas gracias por formar parte del equipo.</p>
                        <ReactRouterDOM.Link to="/mi-perfil" className="mt-8 inline-block bg-tkd-blue text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">Ir a mi Perfil</ReactRouterDOM.Link>
                    </div>
                ) : (
                    <>
                        <div className="text-center">
                            <h2 className="text-2xl font-black text-tkd-dark dark:text-white uppercase tracking-tight leading-none">Contrato de <br /> {usuario?.rol}</h2>
                            <p className="mt-2 text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">{configClub?.nombreClub}</p>
                        </div>

                        <div className="p-6 border border-gray-100 dark:border-gray-800 rounded-[1.5rem] bg-gray-50 dark:bg-gray-900/50 max-h-72 overflow-y-auto shadow-inner border-l-4 border-l-tkd-blue">
                            <p className="text-[11px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed font-medium">
                                {usuario && configClub ? plantillas.generarTextoContratoColaborador(usuario, configClub) : ''}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Firma del Colaborador</label>
                                <button onClick={limpiarFirma} className="text-[9px] font-black text-tkd-red uppercase hover:underline">Reiniciar Lienzo</button>
                            </div>
                            <canvas
                                ref={canvasRef}
                                width="500"
                                height="200"
                                className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl bg-white cursor-crosshair hover:border-tkd-blue transition-colors shadow-sm"
                            ></canvas>
                        </div>

                        <button
                            onClick={handleEnviarFirma}
                            disabled={!firmaRealizada || enviando}
                            className="w-full bg-tkd-blue text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-blue-800 transition-all shadow-xl disabled:bg-gray-300 active:scale-95 flex items-center justify-center gap-3"
                        >
                            <IconoFirma className="w-5 h-5" />
                            <span>{enviando ? 'Legalizando Vínculo...' : 'Aceptar y Firmar Contrato'}</span>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default VistaFirmaContratoColaborador;
