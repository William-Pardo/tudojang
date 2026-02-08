
// hooks/usePaginaFirma.ts
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Estudiante, ConfiguracionClub, Sede } from '../tipos';
import * as api from '../servicios/api';
import { useNotificacion } from '../context/NotificacionContext';
import * as plantillas from '../servicios/plantillas';

type TipoFirma = 'consentimiento' | 'contrato' | 'imagen';

interface UsePaginaFirmaProps {
    idEstudiante: string | undefined;
    tipo: TipoFirma;
}

export const usePaginaFirma = ({ idEstudiante, tipo }: UsePaginaFirmaProps) => {
    const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
    const [configClub, setConfigClub] = useState<ConfiguracionClub | null>(null);
    const [sede, setSede] = useState<Sede | null>(null); // Añadido: Detalles de la sede del alumno
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [enviadoConExito, setEnviadoConExito] = useState(false);
    const { mostrarNotificacion } = useNotificacion();
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [firmaRealizada, setFirmaRealizada] = useState(false);
    
    const cargarDatos = useCallback(async () => {
        if (!idEstudiante) {
            setError("No se proporcionó un ID de estudiante.");
            setCargando(false);
            return;
        }
        try {
            const [estudianteData, configData, sedesList] = await Promise.all([
                api.obtenerEstudiantePorId(idEstudiante),
                api.obtenerConfiguracionClub(),
                api.obtenerSedes() // Obtenemos sedes para resolver el precio específico
            ]);
            
            // Buscar la sede específica del alumno
            const sedeAlumno = sedesList.find(s => s.id === estudianteData.sedeId);
            setSede(sedeAlumno || null);

            // --- INICIO DE LA VALIDACIÓN ---
            if (!estudianteData.tutor) {
                setError("Este estudiante no es menor de edad o no tiene un tutor asignado. No se puede proceder con la firma.");
                setEstudiante(estudianteData);
                setConfigClub(configData);
                setCargando(false);
                return;
            }

            const { nombres, apellidos, numeroIdentificacion, telefono, correo } = estudianteData.tutor;
            if (!nombres?.trim() || !apellidos?.trim() || !numeroIdentificacion?.trim() || !telefono?.trim() || !correo?.trim()) {
                setError("Los datos del tutor están incompletos en nuestro sistema. Por favor, contacte a la administración de la escuela para actualizarlos antes de poder firmar este documento.");
                setEstudiante(estudianteData);
                setConfigClub(configData);
                setCargando(false);
                return;
            }
            // --- FIN DE LA VALIDACIÓN ---

            const yaFirmado = {
                consentimiento: estudianteData.consentimientoInformado && estudianteData.tutor?.firmaDigital,
                contrato: estudianteData.contratoServiciosFirmado && estudianteData.tutor?.firmaContratoDigital,
                imagen: estudianteData.consentimientoImagenFirmado && estudianteData.tutor?.firmaImagenDigital,
            };

            if (yaFirmado[tipo]) {
                setEnviadoConExito(true);
            }
            setEstudiante(estudianteData);
            setConfigClub(configData);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido al cargar los datos.");
        } finally {
            setCargando(false);
        }
    }, [idEstudiante, tipo]);

    useEffect(() => {
        cargarDatos();
    }, [cargarDatos]);

    // Lógica del lienzo de firma
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || enviadoConExito) return;
        
        const context = canvas.getContext('2d');
        if(!context) return;
        
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
    
    const textoDocumento = useMemo(() => {
        if (!estudiante || !configClub) return "Cargando documento...";
        switch(tipo) {
            case 'consentimiento': return plantillas.generarTextoConsentimientoImagen(estudiante, configClub);
            case 'contrato': return plantillas.generarTextoContrato(estudiante, configClub, sede || undefined);
            case 'imagen': return plantillas.generarTextoConsentimientoImagen(estudiante, configClub);
            default: return "";
        }
    }, [estudiante, configClub, tipo, sede]);

    const isCanvasEmpty = (): boolean => {
        const canvas = canvasRef.current;
        if (!canvas) return true;
        const blankCanvas = document.createElement('canvas');
        blankCanvas.width = canvas.width;
        blankCanvas.height = canvas.height;
        return canvas.toDataURL() === blankCanvas.toDataURL();
    };

    const enviarFirma = async (autorizacionFotos?: boolean) => {
        if (isCanvasEmpty()) {
            mostrarNotificacion('La firma es requerida para poder enviar el documento.', 'error');
            return;
        }
        if (!canvasRef.current || !firmaRealizada || !idEstudiante) return;

        setEnviando(true);
        try {
            const firmaBase64 = canvasRef.current.toDataURL('image/png');
            let notificacionMsg = "";

            switch(tipo) {
                case 'consentimiento':
                    await api.guardarFirmaConsentimiento(idEstudiante, firmaBase64);
                    notificacionMsg = "Consentimiento enviado con éxito.";
                    break;
                case 'contrato':
                    await api.guardarFirmaContrato(idEstudiante, firmaBase64);
                    notificacionMsg = "Contrato firmado y enviado exitosamente.";
                    break;
                case 'imagen':
                    if (autorizacionFotos === undefined) throw new Error("Se requiere una elección de autorización.");
                    await api.guardarFirmaImagen(idEstudiante, firmaBase64, autorizacionFotos);
                    notificacionMsg = "Autorización de imagen guardada exitosamente.";
                    break;
            }
            
            setEnviadoConExito(true);
            mostrarNotificacion(notificacionMsg, "success");
        } catch (err) {
            const mensajeError = err instanceof Error ? err.message : `Error desconocido al guardar la ${tipo}.`;
            setError(mensajeError);
            mostrarNotificacion(mensajeError, "error");
        } finally {
            setEnviando(false);
        }
    };
    
    return {
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
    };
};
