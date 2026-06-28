import { getFunctions, httpsCallable } from 'firebase/functions';
import { isFirebaseConfigured } from '../firebase/config';

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
