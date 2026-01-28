
// components/EscanerAsistencia.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNotificacion } from '../context/NotificacionContext';
import * as api from '../servicios/api';
import Loader from './Loader';
import { IconoCerrar, IconoAlertaTriangulo, IconoAprobar, IconoLogoOficial } from './Iconos';

interface Props {
    sedeId: string;
    onClose: () => void;
}

const EscanerAsistencia: React.FC<Props> = ({ sedeId, onClose }) => {
    const [cargando, setCargando] = useState(true);
    const [errorCamara, setErrorCamara] = useState<string | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const { mostrarNotificacion } = useNotificacion();

    // Clave para persistencia en el dispositivo (Actúa como cookie de dispositivo)
    const DEVICE_AUTH_KEY = 'tkd_device_camera_authorized';

    useEffect(() => {
        const activarCamara = async () => {
            try {
                // Solicitar acceso real a la cámara solo cuando el componente se monta
                const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'environment' } 
                });
                
                setStream(mediaStream);
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
                
                // Guardar la marca de dispositivo autorizado en el navegador
                localStorage.setItem(DEVICE_AUTH_KEY, 'true');
                // También como cookie para mayor compatibilidad si es necesario
                document.cookie = `${DEVICE_AUTH_KEY}=true; max-age=31536000; path=/`;
                
                setCargando(false);
            } catch (err) {
                console.error("Error acceso cámara:", err);
                setErrorCamara("No se pudo acceder a la cámara. Verifique los permisos del navegador.");
                setCargando(false);
            }
        };

        activarCamara();

        // Limpieza estricta: Apagar la cámara al cerrar el componente
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => {
                    track.stop();
                    console.log("Cámara desactivada por protocolo de seguridad.");
                });
            }
        };
    }, []);

    const handleScanSimulated = async (idEstudiante: string) => {
        setCargando(true);
        try {
            const estudiante = await api.obtenerEstudiantePorId(idEstudiante);
            await api.registrarEntrada(idEstudiante, sedeId);
            mostrarNotificacion(`Asistencia registrada: ${estudiante.nombres}`, "success");
            onClose();
        } catch (error) {
            mostrarNotificacion("Error al procesar el registro", "error");
            setCargando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-tkd-dark/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fade-in">
            <button 
                onClick={onClose} 
                className="absolute top-8 right-8 text-white/50 hover:text-white p-2 transition-colors"
            >
                <IconoCerrar className="w-8 h-8" />
            </button>
            
            <div className="w-full max-w-sm space-y-8">
                <div className="text-center text-white space-y-2">
                    <h2 className="text-2xl font-black uppercase tracking-tight">Escáner de Acceso</h2>
                    <p className="text-[10px] text-tkd-blue font-black uppercase tracking-[0.2em]">Validación de Identidad Técnica</p>
                </div>

                <div className="relative aspect-square w-full bg-black rounded-[3rem] border-4 border-white/10 overflow-hidden shadow-2xl">
                    {cargando && (
                        <div className="absolute inset-0 z-10 bg-tkd-dark flex items-center justify-center">
                            <Loader texto="Iniciando Lente..." />
                        </div>
                    )}

                    {errorCamara ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-4">
                            <IconoAlertaTriangulo className="w-12 h-12 text-tkd-red" />
                            <p className="text-white text-sm font-bold uppercase">{errorCamara}</p>
                            <button 
                                onClick={onClose}
                                className="px-6 py-2 bg-white/10 text-white rounded-xl text-[10px] font-black uppercase"
                            >
                                Entendido
                            </button>
                        </div>
                    ) : (
                        <>
                            <video 
                                ref={videoRef} 
                                autoPlay 
                                playsInline 
                                className="w-full h-full object-cover grayscale opacity-60"
                            />
                            {/* Overlay de escaneo */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-64 h-64 border-2 border-tkd-blue rounded-3xl relative">
                                    <div className="absolute inset-0 bg-tkd-blue/10 animate-pulse rounded-3xl" />
                                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl" />
                                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl" />
                                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl" />
                                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl" />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {!errorCamara && !cargando && (
                    <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] text-center animate-slide-in-right">
                        <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-4">Alinee el código QR del carnet</p>
                        <button 
                            onClick={() => handleScanSimulated('1')} // Simula escaneo de Juan Pérez
                            className="bg-tkd-blue text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-800 transition-all active:scale-95 flex items-center justify-center gap-2 mx-auto"
                        >
                            <IconoAprobar className="w-4 h-4" /> Simular Captura
                        </button>
                    </div>
                )}
            </div>

            <footer className="absolute bottom-10 text-center">
                <div className="flex items-center gap-2 justify-center text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">
                    <IconoLogoOficial className="w-4 h-4 opacity-20" />
                    Aliant Security Protocol v2.1
                </div>
            </footer>
        </div>
    );
};

export default EscanerAsistencia;
