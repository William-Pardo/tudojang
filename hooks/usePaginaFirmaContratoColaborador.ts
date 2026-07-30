
// hooks/usePaginaFirmaContratoColaborador.ts
// Flujo de firma de Contrato Laboral/Prestacion de Servicios para Equipo Tecnico
// (Sabonims/Secretarios/Asistentes). Espejo de usePaginaFirma.ts pero simplificado:
// el colaborador firma para si mismo, no hay concepto de tutor ni validacion de
// completitud de datos de tutor (los datos propios del Usuario ya son obligatorios).
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Usuario, ConfiguracionClub } from '../tipos';
import * as usuariosApi from '../servicios/usuariosApi';
import { obtenerConfiguracionClub } from '../servicios/configuracionApi';
import { useNotificacion } from '../context/NotificacionContext';
import * as plantillas from '../servicios/plantillas';

interface UsePaginaFirmaContratoColaboradorProps {
    idUsuario: string | undefined;
}

export const usePaginaFirmaContratoColaborador = ({ idUsuario }: UsePaginaFirmaContratoColaboradorProps) => {
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
            setError("No se proporcionó un ID de colaborador.");
            setCargando(false);
            return;
        }
        try {
            const usuarioData = await usuariosApi.getUser(idUsuario);

            if (!usuarioData) {
                setError("No se encontró el colaborador.");
                setCargando(false);
                return;
            }

            const configData = await obtenerConfiguracionClub(usuarioData.tenantId);

            if (!usuarioData.contrato) {
                setError("Tu contrato aún no fue configurado por administración. Contacta a tu Sabonim.");
                setUsuario(usuarioData);
                setConfigClub(configData);
                setCargando(false);
                return;
            }

            if (usuarioData.contrato?.firmado) {
                setEnviadoConExito(true);
            }
            setUsuario(usuarioData);
            setConfigClub(configData);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido al cargar los datos.");
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
        if (!usuario || !configClub) return "Cargando documento...";
        return plantillas.generarTextoContratoColaborador(usuario, configClub);
    }, [usuario, configClub]);

    const isCanvasEmpty = (): boolean => {
        const canvas = canvasRef.current;
        if (!canvas) return true;
        const blankCanvas = document.createElement('canvas');
        blankCanvas.width = canvas.width;
        blankCanvas.height = canvas.height;
        return canvas.toDataURL() === blankCanvas.toDataURL();
    };

    const enviarFirma = async () => {
        if (isCanvasEmpty()) {
            mostrarNotificacion('La firma es requerida para poder enviar el documento.', 'error');
            return;
        }
        if (!canvasRef.current || !firmaRealizada || !idUsuario || !usuario) return;

        setEnviando(true);
        try {
            const firmaBase64 = canvasRef.current.toDataURL('image/png');

            await usuariosApi.guardarFirmaContratoUsuario(usuario.id, usuario.tenantId, firmaBase64);

            setEnviadoConExito(true);
            mostrarNotificacion("Contrato firmado y enviado exitosamente.", "success");
        } catch (err) {
            const mensajeError = err instanceof Error ? err.message : "Error desconocido al guardar el contrato.";
            setError(mensajeError);
            mostrarNotificacion(mensajeError, "error");
        } finally {
            setEnviando(false);
        }
    };

    return {
        usuario,
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
