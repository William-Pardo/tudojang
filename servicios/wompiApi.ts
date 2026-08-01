import { getFunctions, httpsCallable } from 'firebase/functions';
import { isFirebaseConfigured } from '../firebase/config';
import { CONFIGURACION_WOMPI } from '../constantes';

interface FirmarCheckoutWompiRequest {
    reference: string;
    amountInCents: number;
    currency: 'COP';
}

interface FirmarCheckoutWompiResponse {
    signature: string;
}

export const firmarCheckoutWompi = async (
    payload: FirmarCheckoutWompiRequest
): Promise<string> => {
    if (!isFirebaseConfigured) {
        return 'firma_simulada_desarrollo_local';
    }

    const callable = httpsCallable<
        FirmarCheckoutWompiRequest,
        FirmarCheckoutWompiResponse
    >(getFunctions(), 'firmarCheckoutWompi');
    const response = await callable(payload);
    return response.data.signature;
};

interface CrearFuentePagoWompiRequest {
    tenantId: string;
    token: string;
}

interface CrearFuentePagoWompiResponse {
    wompiPaymentSourceId: number;
}

/**
 * Registra una fuente de pago (tarjeta tokenizada) en Wompi para el tenant y activa
 * el cobro automático mensual. El callable actualiza en el backend el doc del tenant
 * con `wompiPaymentSourceId`, `cobroAutomaticoActivo: true` y
 * `cobroAutomaticoIntentosFallidos: 0`. El `token` debe obtenerse previamente vía
 * tokenización directa contra la API de Wompi (POST /v1/tokens/cards) — nunca se debe
 * enviar el número de tarjeta/CVC crudo a este callable.
 */
export const crearFuentePagoWompi = async (
    payload: CrearFuentePagoWompiRequest
): Promise<number | null> => {
    if (!isFirebaseConfigured) {
        return null;
    }

    const callable = httpsCallable<
        CrearFuentePagoWompiRequest,
        CrearFuentePagoWompiResponse
    >(getFunctions(), 'crearFuentePagoWompi');
    const response = await callable(payload);
    return response.data.wompiPaymentSourceId;
};

// SDD pricing-cupo-real (Bloque 4b, tarea 4.11 -- "review copy"): sin planes fijos, el
// registro de una escuela nueva ya no pasa por este checkout (vistas/RegistroEscuela.tsx --
// el trial de 7 días activa directo) y comprar sede/equipo técnico extra tampoco (Configuracion.tsx
// llama directo a la Cloud Function actualizarExtrasContratados, efecto inmediato). Los
// únicos llamadores que quedan son vistas/PasarelaPagos.tsx y vistas/LicenciaSuspendida.tsx
// -- ambos reactivan una suscripción vencida con `itemType:'alta', itemId:'renovacion'` y un
// monto calculado en vivo (calcularFacturacionMensual, no un precio de plan). `'plan'`/
// `'addon'` se retiran del union type: ya no hay un flujo que los produzca.
interface ConstruirUrlCheckoutWompiParams {
    tenantId: string;
    itemType: 'alta';
    itemId: string;
    periodo: 'mensual' | 'anual';
    montoEnPesos: number;
    redirectUrl: string;
}

/**
 * Punto único de armado del Web Checkout de Wompi para reactivar una suscripción vencida.
 * Unifica el formato de `reference` (siempre
 * `SUSC_<tenantId>_<itemType>_<itemId>_<periodo>_<timestamp>`, con el tenantId siempre en la
 * misma posición) y garantiza que la URL SIEMPRE vaya firmada con `signature:integrity` --
 * nunca se debe armar esta URL a mano en otro lugar.
 */
export const construirUrlCheckoutWompi = async (
    params: ConstruirUrlCheckoutWompiParams
): Promise<string> => {
    const { tenantId, itemType, itemId, periodo, montoEnPesos, redirectUrl } = params;

    const amountInCents = Math.round(montoEnPesos * 100);
    const reference = `SUSC_${tenantId}_${itemType}_${itemId}_${periodo}_${Date.now()}`;

    const signature = await firmarCheckoutWompi({
        reference,
        amountInCents,
        currency: 'COP',
    });

    return `https://checkout.wompi.co/p/?` +
        `public-key=${CONFIGURACION_WOMPI.publicKey}&` +
        `currency=COP&` +
        `amount-in-cents=${amountInCents}&` +
        `reference=${reference}&` +
        `signature:integrity=${signature}&` +
        `redirect-url=${encodeURIComponent(redirectUrl)}`;
};
