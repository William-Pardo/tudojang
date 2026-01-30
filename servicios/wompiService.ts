
// servicios/wompiService.ts
import { wompiConfig } from '../src/config';

/**
 * Genera una firma de integridad para Wompi usando SubtleCrypto (Nativo en navegadores modernos).
 * @param referencia Referencia única de la transacción.
 * @param montoEnCentavos Monto en centavos.
 * @param moneda Moneda (ej. 'COP').
 * @returns Hash SHA256 en formato hex.
 */
export const generarFirmaIntegridad = async (referencia: string, montoEnCentavos: number, moneda: string = 'COP'): Promise<string> => {
    const cadena = `${referencia}${montoEnCentavos}${moneda}${wompiConfig.integritySecret}`;
    const msgUint8 = new TextEncoder().encode(cadena);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Abre el checkout de Wompi de forma dinámica.
 */
export const abrirCheckoutWompi = async (config: {
    referencia: string;
    montoEnCentavos: number;
    email: string;
    nombreCompleto: string;
    telefono: string;
    redirectUrl: string;
}) => {
    const firma = await generarFirmaIntegridad(config.referencia, config.montoEnCentavos);

    // @ts-ignore
    const checkout = new WidgetCheckout({
        currency: 'COP',
        amountInCents: config.montoEnCentavos,
        reference: config.referencia,
        publicKey: wompiConfig.publicKey,
        signature: { integrity: firma },
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
        console.log('Transacción terminada:', transaction);
    });
};
