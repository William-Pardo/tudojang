
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
    const publicKey = obtenerLlavePublicaWompi(config.esSimulacion);
    const montoCents = config.montoEnPesos * 100;

    // Intentamos generar la firma de integridad
    let signature = {};
    try {
        const hash = await generarFirmaIntegridad(config.referencia, montoCents);
        signature = { integrity: hash };
    } catch (e) {
        console.warn("⚠️ No se pudo generar firma de integridad. El pago podría fallar si el comercio la exige.");
    }

    // @ts-ignore - WidgetCheckout cargado en index.html
    if (typeof WidgetCheckout === 'undefined') {
        alert("⚠️ El sistema de pagos (Wompi) no ha cargado correctamente. Por favor, refresca la página (F5).");
        return;
    }

    // @ts-ignore
    const checkout = new WidgetCheckout({
        currency: 'COP',
        amountInCents: montoCents,
        reference: config.referencia,
        publicKey: publicKey,
        signature: signature,
        redirectUrl: config.redirectUrl,
        customerData: {
            email: config.email,
            fullName: config.nombreCompleto,
            phoneNumber: config.telefono,
            phoneNumberPrefix: '+57'
        }
    });

    checkout.open((result: any) => {
        const transaction = result.transaction;
        if (transaction.status === 'APPROVED') {
            console.log("✅ Wompi: Transacción Aprobada", transaction);
            if (config.onSuccess) config.onSuccess(transaction);
        } else {
            console.warn("❌ Wompi: Estado de transacción", transaction.status);
        }
        if (config.onClose) config.onClose();
    });
};
