
// servicios/wompiServicio.ts
import { WOMPI_CONFIG } from '../constantes';

/**
 * Servicio para gestionar la integración con Wompi en modo Sandbox/Producción.
 */
export const obtenerLlavePublicaWompi = (esSimulacion: boolean = true) => {
    // Si esSimulacion es true O si MODO_TEST es true, usamos Sandbox.
    // Solo permitimos Producción si AMBOS son false y hay una llave configurada.
    if (esSimulacion || WOMPI_CONFIG.MODO_TEST || !WOMPI_CONFIG.PUB_KEY_PROD) {
        console.log("🛡️ Wompi: Usando Modo Sandbox (Sin cobros reales)");
        return WOMPI_CONFIG.PUB_KEY_SANDBOX;
    }

    console.warn("💳 Wompi: Usando Modo PRODUCCIÓN (Cargos reales activos)");
    return WOMPI_CONFIG.PUB_KEY_PROD;
};

export const generarReferenciaPago = (slug: string, plan: string) => {
    const timestamp = Date.now();
    return `TDJ-${slug.toUpperCase()}-${plan.toUpperCase()}-${timestamp}`;
};

/**
 * Abre el Widget de Wompi para procesar el pago.
 */
export const abrirCheckoutWompi = (config: {
    referencia: string,
    montoEnPesos: number,
    nombreAcademia: string,
    emailResponsable: string,
    esSimulacion: boolean,
    onSuccess?: (data: any) => void,
    onClose?: () => void
}) => {
    const publicKey = obtenerLlavePublicaWompi(config.esSimulacion);
    const montoCéntimos = config.montoEnPesos * 100;

    // @ts-ignore - El checkout de Wompi se carga por script en el index.html
    const checkout = new WidgetCheckout({
        currency: 'COP',
        amountInCents: montoCéntimos,
        reference: config.referencia,
        publicKey: publicKey,
        // redirectUrl: `${window.location.origin}/pago-confirmado`, // Opcional
        customerData: {
            email: config.emailResponsable,
            fullName: config.nombreAcademia,
        }
    });

    checkout.open((result: any) => {
        const transaction = result.transaction;
        if (transaction.status === 'APPROVED') {
            console.log("✅ Pago aprobado:", transaction);
            if (config.onSuccess) config.onSuccess(transaction);
        } else {
            console.log("❌ Pago no exitoso:", transaction.status);
        }
    });
};
