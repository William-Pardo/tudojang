
// servicios/wompiService.ts
import { WOMPI_CONFIG } from '../constantes';

/**
 * Servicio robusto para la integración con Wompi (Sandbox y Producción).
 * Este archivo consolida la lógica de pagos tanto para el registro de escuelas (SaaS)
 * como para la inscripción premium de alumnos (In-app).
 */

/**
 * Obtiene la llave pública según el entorno (Sandbox siempre prevalece si MODO_TEST es true).
 */
export const obtenerLlavePublicaWompi = (esSimulacion: boolean = true) => {
    if (esSimulacion || WOMPI_CONFIG.MODO_TEST || !WOMPI_CONFIG.PUB_KEY_PROD) {
        return WOMPI_CONFIG.PUB_KEY_SANDBOX;
    }
    return WOMPI_CONFIG.PUB_KEY_PROD;
};

/**
 * Genera una firma de integridad para Wompi usando SubtleCrypto.
 * Requerida para transacciones seguras en el checkout.
 */
export const generarFirmaIntegridad = async (referencia: string, montoEnCentavos: number, moneda: string = 'COP'): Promise<string> => {
    // El secreto de integridad debería estar en constantes o env. 
    // Para simplificar, usamos el del config si está disponible o uno de prueba.
    const integritySecret = import.meta.env.VITE_WOMPI_INTEGRITY_SECRET || 'test_integrity_secret_xxxxx';

    const cadena = `${referencia}${montoEnCentavos}${moneda}${integritySecret}`;
    const msgUint8 = new TextEncoder().encode(cadena);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Genera una referencia de pago estándar para Tudojang.
 */
export const generarReferenciaPago = (identificador: string, tipo: 'PLAN' | 'INS' | 'STORE') => {
    const timestamp = Date.now();
    const cleanId = identificador.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `TDJ-${tipo}-${cleanId}-${timestamp}`;
};

/**
 * Interfaz unificada para el checkout.
 */
interface CheckoutConfig {
    referencia: string;
    montoEnPesos: number;
    email: string;
    nombreCompleto: string;
    telefono?: string;
    esSimulacion?: boolean;
    redirectUrl?: string;
    onSuccess?: (transaction: any) => void;
    onClose?: () => void;
}

/**
 * Abre el Widget de Wompi de forma dinámica y segura.
 */
export const abrirCheckoutWompi = async (config: CheckoutConfig) => {
    console.log("🛠️ Configurando checkout de Wompi...", { referencia: config.referencia, monto: config.montoEnPesos });

    const publicKey = obtenerLlavePublicaWompi(config.esSimulacion);
    const montoCents = Math.round(config.montoEnPesos * 100);

    // Intentamos generar la firma de integridad
    let signature = {};
    try {
        const hash = await generarFirmaIntegridad(config.referencia, montoCents);
        signature = { integrity: hash };
        console.log("🔐 Firma de integridad generada.");
    } catch (e) {
        console.warn("⚠️ No se pudo generar firma de integridad. Continuando sin ella...");
    }

    // @ts-ignore - WidgetCheckout cargado en index.html
    if (typeof WidgetCheckout === 'undefined') {
        const msg = "⚠️ El script de Wompi no ha cargado. Verifica tu conexión o bloqueadores de anuncios.";
        console.error(msg);
        alert(msg);
        if (config.onClose) config.onClose();
        return;
    }

    try {
        // Limpieza y validación de datos del pagador (Crucial para evitar error 'datos inválidos')
        const emailLimpio = config.email.trim();
        let nombreLimpio = config.nombreCompleto.trim();

        // Wompi a veces rechaza nombres de una sola palabra
        if (!nombreLimpio.includes(' ')) {
            nombreLimpio = `${nombreLimpio} Director`;
        }

        const options: any = {
            currency: 'COP',
            amountInCents: montoCents,
            reference: config.referencia,
            publicKey: publicKey,
            customerData: {
                email: emailLimpio,
                fullName: nombreLimpio,
                phoneNumber: config.telefono || '3001234567', // Valor por defecto necesario en algunas configs
                phoneNumberPrefix: '+57'
            }
        };

        // Solo añadir firma si se generó correctamente
        if (signature && Object.keys(signature).length > 0) {
            options.signature = signature;
        }

        // Solo añadir redirect si existe
        if (config.redirectUrl) {
            options.redirectUrl = config.redirectUrl;
        }

        console.log("💳 Abriendo modal de Wompi con opciones finales:", options);

        // @ts-ignore
        const checkout = new WidgetCheckout(options);

        checkout.open((result: any) => {
            const transaction = result?.transaction;
            console.log("📡 Resultado Wompi:", transaction?.status);

            if (transaction?.status === 'APPROVED') {
                if (config.onSuccess) config.onSuccess(transaction);
            } else if (transaction?.status === 'DECLINED' || transaction?.status === 'ERROR') {
                alert(`El pago fue ${transaction?.status === 'DECLINED' ? 'declinado' : 'fallido'}. Por favor intenta de nuevo.`);
            }

            if (config.onClose) config.onClose();
        });
    } catch (error: any) {
        console.error("🔥 Error crítico al abrir el checkout de Wompi:", error);

        let errorDetalle = "Error desconocido";
        try {
            errorDetalle = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
        } catch (e) { errorDetalle = String(error); }

        alert("Error al iniciar la pasarela de pagos: " + errorDetalle);
        if (config.onClose) config.onClose();
    }
};
