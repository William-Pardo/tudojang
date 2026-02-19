// components/ComprobantesPago.tsx
// Generador de comprobante de pago en formato PNG.
// Usa html2canvas para "fotografiar" un componente invisible del DOM y generar la imagen.
// NO requiere servidor, NO requiere Gemini, NO guarda archivos en la nube.

import React, { useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import type { ConfiguracionClub } from '../tipos';
import type { PagoProcesado } from '../servicios/pagosApi';

// --- Tipos ---
export interface DatosComprobante {
    reciboId: string;
    fechaHora: string; // ISO string
    nombreEstudiante: string;
    nombreTutor?: string;
    telefonoTutor?: string;
    itemsPagados: {
        descripcion: string;
        tipo: string;
        monto: number;
    }[];
    montoTotal: number;
    metodoPago: string;
    concepto: string;
}

interface Props {
    datos: DatosComprobante;
    configuracionClub: ConfiguracionClub;
    /** Si se pasa, se renderiza el comprobante en pantalla. Si no, es solo invisible. */
    visible?: boolean;
    /** Callback al terminar de generar el PNG (retorna una image URL Base64). */
    onGenerado?: (imageDataUrl: string) => void;
}

// --- Helpers ---
const formatMoneda = (valor: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(valor);

const formatFecha = (isoString: string) => {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('es-CO', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    }).format(d);
};

// --- Componente Plantilla ---
// Este es el "molde" del comprobante. Está oculto en el DOM y se "fotografía" con html2canvas.
const PlantillaComprobante: React.FC<{ datos: DatosComprobante; config: ConfiguracionClub; compRef: React.RefObject<HTMLDivElement | null> }> = ({ datos, config, compRef }) => {
    const colorPrimario = config.colorPrimario || '#1f3e90';
    const colorSecundario = config.colorSecundario || '#D32126';
    const nombreClub = config.nombreClub || 'Mi Academia';
    const logoUrl = config.logoUrl || '/Logo_TuDojang.png';

    return (
        // El div padre está absolutamente fuera de la vista cuando no es visible
        <div
            ref={compRef}
            style={{
                width: '420px',
                backgroundColor: '#FFFFFF',
                fontFamily: "'Poppins', 'Segoe UI', sans-serif",
                position: 'absolute',
                left: '-9999px',
                top: '0',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                borderRadius: '16px',
                overflow: 'hidden',
            }}
        >
            {/* HEADER */}
            <div style={{
                background: `linear-gradient(135deg, ${colorPrimario} 0%, ${colorSecundario} 100%)`,
                padding: '28px 24px',
                textAlign: 'center',
                color: '#fff',
            }}>
                {logoUrl && (
                    <img
                        src={logoUrl}
                        alt="Logo"
                        crossOrigin="anonymous"
                        style={{ width: '60px', height: '60px', objectFit: 'contain', marginBottom: '8px', filter: 'brightness(0) invert(1)' }}
                    />
                )}
                <div style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    {nombreClub}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '4px', fontWeight: '400' }}>
                    Comprobante de Pago
                </div>
            </div>

            {/* BADGE: Pago Realizado */}
            <div style={{
                background: '#f0fdf4',
                borderBottom: '1px solid #bbf7d0',
                padding: '12px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}>
                <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                    <span style={{ color: '#fff', fontSize: '13px', fontWeight: '700' }}>✓</span>
                </div>
                <div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#15803d' }}>Pago Registrado Exitosamente</div>
                    <div style={{ fontSize: '11px', color: '#4ade80', marginTop: '1px' }}>{formatFecha(datos.fechaHora)}</div>
                </div>
            </div>

            {/* DETALLES */}
            <div style={{ padding: '20px 24px 0' }}>

                {/* Recibo # */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px dashed #e5e7eb' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recibo #</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827', fontFamily: 'monospace' }}>{dados.reciboId || datos.reciboId}</div>
                </div>

                {/* Estudiante / Tutor */}
                <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px dashed #e5e7eb' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Para</div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827' }}>{datos.nombreEstudiante}</div>
                    {datos.nombreTutor && (
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                            Tutor: {datos.nombreTutor}
                        </div>
                    )}
                    {datos.telefonoTutor && (
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>{datos.telefonoTutor}</div>
                    )}
                </div>

                {/* Concepto */}
                <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px dashed #e5e7eb' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Concepto</div>
                    <div style={{ fontSize: '13px', color: '#374151' }}>{datos.concepto}</div>
                </div>

                {/* Ítems Pagados */}
                <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px dashed #e5e7eb' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Detalle</div>
                    {datos.itemsPagados.map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <div style={{ fontSize: '12px', color: '#374151', flex: 1 }}>{item.descripcion}</div>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#111827', flexShrink: 0, marginLeft: '8px' }}>{formatMoneda(item.monto)}</div>
                        </div>
                    ))}
                </div>

                {/* Método de Pago */}
                <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px dashed #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Método</div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>{datos.metodoPago}</div>
                </div>
            </div>

            {/* TOTAL */}
            <div style={{
                margin: '0 24px 20px',
                background: `${colorPrimario}15`,
                border: `2px solid ${colorPrimario}30`,
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div style={{ fontSize: '12px', color: colorPrimario, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Pagado</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: colorPrimario }}>{formatMoneda(datos.montoTotal)}</div>
            </div>

            {/* FOOTER */}
            <div style={{
                background: '#f9fafb',
                borderTop: '1px solid #f3f4f6',
                padding: '14px 24px',
                textAlign: 'center',
            }}>
                <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                    Este comprobante es válido como soporte de pago.
                </div>
                <div style={{ fontSize: '10px', color: '#d1d5db', marginTop: '4px' }}>
                    Generado por Tudojang SaaS · {nombreClub}
                </div>
            </div>
        </div>
    );
};

// --- Hook Principal: useGeneradorComprobante ---
// Esto es lo que importan los demás componentes para generar el PNG.
export const useGeneradorComprobante = () => {
    const compRef = useRef<HTMLDivElement>(null);

    /**
     * Genera la imagen PNG del comprobante.
     * Retorna la imagen como Data URL Base64 (para mostrar en pantalla o descargar).
     */
    const generarImagen = useCallback(async (
        datos: DatosComprobante,
        config: ConfiguracionClub
    ): Promise<string | null> => {
        // 1. Crear el elemento invisible en el DOM
        const contenedor = document.createElement('div');
        contenedor.style.position = 'absolute';
        contenedor.style.left = '-9999px';
        contenedor.style.top = '0';
        document.body.appendChild(contenedor);

        // 2. Renderizar el componente React en ese contenedor (usando innerHTML como fallback)
        // IMPORTANTE: La forma correcta es usar createRoot de React 18
        const { createRoot } = await import('react-dom/client');
        const root = createRoot(contenedor);

        await new Promise<void>(resolve => {
            root.render(
                React.createElement(PlantillaComprobante, {
                    datos,
                    config,
                    compRef: { current: contenedor.querySelector('div') } as any
                })
            );
            // Dar tiempo a React para renderizar
            setTimeout(resolve, 500);
        });

        // 3. Tomar la "foto" del HTML con html2canvas
        try {
            const elementoTarget = contenedor.firstChild as HTMLElement;
            if (!elementoTarget) throw new Error("Elemento no encontrado");

            const canvas = await html2canvas(elementoTarget, {
                scale: 2, // 2x para buena resolución en móviles
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
            });

            const dataUrl = canvas.toDataURL('image/png');

            // 4. Limpiar el DOM
            root.unmount();
            document.body.removeChild(contenedor);

            return dataUrl;
        } catch (err) {
            console.error("[ComprobantesPago] Error al generar imagen:", err);
            root.unmount();
            if (document.body.contains(contenedor)) document.body.removeChild(contenedor);
            return null;
        }
    }, []);

    /**
     * Descarga la imagen PNG directamente al dispositivo.
     */
    const descargarComprobante = useCallback(async (
        datos: DatosComprobante,
        config: ConfiguracionClub
    ) => {
        const dataUrl = await generarImagen(datos, config);
        if (!dataUrl) return;

        const link = document.createElement('a');
        link.download = `Recibo-${datos.reciboId}-${datos.nombreEstudiante.replace(/\s/g, '_')}.png`;
        link.href = dataUrl;
        link.click();
    }, [generarImagen]);

    /**
     * Abre WhatsApp Web con el número del tutor/estudiante y el enlace del recibo.
     * (O prepara el mensaje con el texto de referencia si no se puede adjuntar imagen directamente)
     */
    const compartirPorWhatsApp = useCallback(async (
        datos: DatosComprobante,
        config: ConfiguracionClub,
        telefono: string
    ) => {
        // Generamos la imagen primero
        const dataUrl = await generarImagen(datos, config);

        // WhatsApp Web no permite adjuntar imagenes directamente desde una URL externa.
        // La mejor estrategia es:
        // 1. Descargar la imagen automáticamente al dispositivo del tenant.
        // 2. Abrir WhatsApp Web con el chat del estudiante listo.
        // 3. El tenant solo arrastra la imagen descargada y da Send.

        if (dataUrl) {
            // Descargar imagen primero
            const link = document.createElement('a');
            link.download = `Recibo-${datos.reciboId}.png`;
            link.href = dataUrl;
            link.click();
        }

        // Construir mensaje de texto acompañante
        const mensaje = `Hola ${datos.nombreEstudiante || datos.nombreTutor || ''},\n\n` +
            `✅ *Pago Registrado* - ${config.nombreClub}\n` +
            `📋 Recibo: *${datos.reciboId}*\n` +
            `💰 Total: *${formatMoneda(datos.montoTotal)}*\n` +
            `📅 Fecha: ${formatFecha(datos.fechaHora)}\n\n` +
            `_Adjunto encontrará el comprobante detallado._\n` +
            `Gracias por su pago. 🙏`;

        // Capitalizar telefono (sin +)
        const telefonoLimpio = telefono.replace(/[^0-9]/g, '');
        const waUrl = `https://web.whatsapp.com/send?phone=${telefonoLimpio}&text=${encodeURIComponent(mensaje)}`;

        // Abrir WhatsApp en nueva pestaña
        setTimeout(() => {
            window.open(waUrl, '_blank');
        }, 800); // Esperar a que descargue la imagen
    }, [generarImagen]);

    return {
        generarImagen,
        descargarComprobante,
        compartirPorWhatsApp,
    };
};

export default PlantillaComprobante;
