// components/academico/EscanerQR.tsx
//
// Componente generico de bajo nivel: camara + deteccion de QR (BarcodeDetector),
// extraido de `components/EscanerAsistencia.tsx` (Fase 3, clase-en-vivo-checkin-
// trigger-agenda). No conoce ninguna regla de negocio (ni "sedeId"+guarderia, ni
// "jornadaId"+Clase en Vivo): solo activa la camara, decodifica el QR del carnet
// (JSON `{"id": "..."}` o texto plano) y delega el `estudianteId` resultante al
// callback `onDetectarEstudiante` de quien lo consuma.
//
// Dos consumidores reales (design.md Fase 3, deviacion documentada en
// apply-progress): `components/EscanerAsistencia.tsx` (flujo de guarderia/
// entrega a tutores, sin cambios de comportamiento) y
// `components/academico/EscanerAsistenciaClase.tsx` (flujo nuevo de Clase en
// Vivo, callable `registrarAsistenciaJornada`).
import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { useNotificacion } from '../../context/NotificacionContext';
import Loader from '../Loader';
import { IconoCerrar, IconoAlertaTriangulo, IconoAprobar, IconoLogoOficial } from '../Iconos';

export interface EscanerQRProps {
    /**
     * Recibe el `estudianteId` ya extraido del QR (JSON `{id}` o texto plano) y
     * ejecuta la logica de negocio especifica de cada consumidor. Si la promesa
     * se rechaza, EscanerQR muestra "Error al procesar el registro" (generico,
     * ver Fase 13 para mensajes especificos por caso) y permite reintentar sin
     * desmontarse. Si resuelve, EscanerQR vuelve a aceptar detecciones -- queda
     * en manos del consumidor llamar a `onClose()` si el flujo debe cerrarse
     * tras un solo escaneo (guarderia) o permanecer abierto para escanear a
     * varios estudiantes seguidos (Clase en Vivo).
     */
    onDetectarEstudiante: (estudianteId: string) => Promise<void>;
    onClose: () => void;
    titulo?: string;
    subtitulo?: string;
    instruccion?: string;
}

// Clave para persistencia en el dispositivo (Actúa como cookie de dispositivo)
const DEVICE_AUTH_KEY = 'tkd_device_camera_authorized';

const EscanerQR: React.FC<EscanerQRProps> = ({
    onDetectarEstudiante,
    onClose,
    titulo = 'Escáner de Acceso',
    subtitulo = 'Validación de Identidad Técnica',
    instruccion = 'Alinee el código QR del carnet',
}) => {
    const [cargando, setCargando] = useState(true);
    const [errorCamara, setErrorCamara] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const scannerTimerRef = useRef<number | null>(null);
    const procesandoRef = useRef(false);
    const { mostrarNotificacion } = useNotificacion();

    useEffect(() => {
        let activeStream: MediaStream | null = null;
        const activarCamara = async () => {
            try {
                // Solicitar acceso real a la cámara solo cuando el componente se monta
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });

                activeStream = mediaStream;
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }

                // Guardar la marca de dispositivo autorizado en el navegador
                localStorage.setItem(DEVICE_AUTH_KEY, 'true');
                // También como cookie para mayor compatibilidad si es necesario
                document.cookie = `${DEVICE_AUTH_KEY}=true; max-age=31536000; path=/`;

                setCargando(false);

                // Bug real (2026-09-04): Safari -- y por extension CUALQUIER navegador en
                // iOS, obligados por Apple a correr sobre WebKit -- nunca implemento
                // BarcodeDetector (Shape Detection API). Sin este fallback, la camara se
                // activaba pero jamas detectaba nada: el usuario se quedaba mirando el
                // video indefinidamente, sin ningun mensaje, porque el bloque `if (Detector)`
                // completo se saltaba en silencio. jsQR (JS puro, sin dependencia de APIs
                // nativas del navegador) decodifica manualmente cada frame capturado en un
                // canvas offscreen -- mas lento que la API nativa, pero funciona en
                // cualquier navegador. Se usa la API nativa cuando existe (mas eficiente en
                // Chrome/Edge/Android) y jsQR solo como respaldo.
                const Detector = (window as any).BarcodeDetector;
                const detectorNativo = Detector ? new Detector({ formats: ['qr_code'] }) : null;
                const canvasOffscreen = document.createElement('canvas');
                const contextoOffscreen = canvasOffscreen.getContext('2d', { willReadFrequently: true });

                const detectarConJsQR = (video: HTMLVideoElement): string | null => {
                    if (!contextoOffscreen || video.readyState !== video.HAVE_ENOUGH_DATA) return null;
                    canvasOffscreen.width = video.videoWidth;
                    canvasOffscreen.height = video.videoHeight;
                    contextoOffscreen.drawImage(video, 0, 0, canvasOffscreen.width, canvasOffscreen.height);
                    const imageData = contextoOffscreen.getImageData(0, 0, canvasOffscreen.width, canvasOffscreen.height);
                    const codigo = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
                    return codigo?.data || null;
                };

                scannerTimerRef.current = window.setInterval(async () => {
                    if (!videoRef.current || procesandoRef.current) return;
                    try {
                        const valorDetectado = detectorNativo
                            ? (await detectorNativo.detect(videoRef.current))[0]?.rawValue
                            : detectarConJsQR(videoRef.current);
                        if (valorDetectado) {
                            procesandoRef.current = true;
                            await procesarCodigoQR(valorDetectado);
                        }
                    } catch {
                        setErrorCamara("Error del hardware de la cámara.");
                    }
                }, 500);
            } catch (err) {
                console.error("Error acceso cámara:", err);
                setErrorCamara("No se pudo acceder a la cámara. Verifique los permisos del navegador.");
                setCargando(false);
            }
        };

        activarCamara();

        // Limpieza estricta: Apagar la cámara al cerrar el componente
        return () => {
            if (scannerTimerRef.current !== null) window.clearInterval(scannerTimerRef.current);
            if (activeStream) {
                activeStream.getTracks().forEach(track => {
                    track.stop();
                    console.log("Cámara desactivada por protocolo de seguridad.");
                });
            }
        };
    }, []);

    const procesarCodigoQR = async (valor: string) => {
        setCargando(true);
        try {
            let idEstudiante = valor;
            if (valor.trim().startsWith('{')) {
                const parsed = JSON.parse(valor);
                if (typeof parsed.id !== 'string' || !parsed.id) throw new Error("Código QR inválido");
                idEstudiante = parsed.id;
            }
            await onDetectarEstudiante(idEstudiante);
        } catch (error) {
            const err = error as { message?: string; code?: string };
            const invalido = error instanceof SyntaxError || err?.message === "Código QR inválido";
            // Los errores del callable de Firebase (registrarAsistenciaJornada, etc.) llegan con
            // code="functions/<code-servidor>" y message = el texto exacto que armamos server-side
            // (ej. "El estudiante no esta matriculado en la ejecucion de esta jornada") -- ese texto
            // ya esta escrito para el usuario final, mostrarlo tal cual reemplaza el generico y
            // permite diagnosticar sin consola. Cualquier otro error (red, fallos de otros servicios
            // como en el flujo de guarderia) no tiene ese prefijo y sigue mostrando el generico, para
            // no filtrar mensajes tecnicos crudos.
            const esErrorDeCallable = typeof err?.code === 'string' && err.code.startsWith('functions/');
            const texto = invalido
                ? "Código QR inválido"
                : (esErrorDeCallable && err.message ? err.message : "Error al procesar el registro");
            mostrarNotificacion(texto, "error");
        } finally {
            // Se resetea tanto en exito como en error: un consumidor que no
            // cierra el escaner tras un escaneo exitoso (Clase en Vivo, para
            // seguir escaneando estudiantes) necesita poder detectar el
            // siguiente QR sin quedar bloqueado.
            setCargando(false);
            procesandoRef.current = false;
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-tkd-dark/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fade-in">
            {/* Bug real (2026-09-04, reportado por el usuario): la camara se activaba sin
                ninguna forma evidente de cerrarla -- el boton SI existia, pero con opacidad
                50% sobre fondo oscuro y sin texto, facil de no ver (sobre todo en celular).
                Se sube la opacidad base, se agrega fondo/borde para que se perciba como
                boton (no solo un icono flotante), y una etiqueta visible junto al icono. */}
            <button
                onClick={onClose}
                aria-label="Cerrar escáner"
                className="absolute top-8 right-8 flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white/90 hover:text-white pl-4 pr-3 py-2 rounded-full border border-white/20 transition-colors z-10"
            >
                <span className="text-[10px] font-black uppercase tracking-widest">Cerrar</span>
                <IconoCerrar className="w-6 h-6" />
            </button>

            <div className="w-full max-w-sm space-y-8">
                <div className="text-center text-white space-y-2">
                    <h2 className="text-2xl font-black uppercase tracking-tight">{titulo}</h2>
                    <p className="text-[10px] text-tkd-blue font-black uppercase tracking-[0.2em]">{subtitulo}</p>
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
                        <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-4">{instruccion}</p>
                        <button
                            onClick={() => procesarCodigoQR('1')}
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

export default EscanerQR;
