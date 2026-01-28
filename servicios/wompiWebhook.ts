
// Este archivo es una representación de lo que iría en tus Firebase Cloud Functions
// No se ejecuta directamente en el navegador, sino en el servidor de Google.

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// admin.initializeApp(); // Solo en entorno real de funciones

export const webhookWompi = functions.https.onRequest(async (req, res) => {
    // 1. Validar que el evento venga de Wompi (Seguridad)
    // Wompi envía una firma para asegurar que nadie más llame a esta URL
    const evento = req.body;

    if (evento.event === 'transaction.updated') {
        const { data } = evento;
        const transaction = data.transaction;

        // 2. Solo procesar si el pago es APROBADO
        if (transaction.status === 'APPROVED') {
            const referencia = transaction.reference; // Ej: "SUSC_gajog_id123"
            const [tipo, slug, id] = referencia.split('_');

            if (tipo === 'SUSC') {
                // CASO 1: Es el pago de la suscripción de una escuela
                await admin.firestore().collection('tenants').doc(id).update({
                    estadoSuscripcion: 'activo',
                    fechaVencimiento: admin.firestore.Timestamp.fromDate(
                        new Date(Date.now() + 31 * 24 * 60 * 60 * 1000) // Sumar 31 días
                    )
                });
                console.log(`Suscripción activada para: ${slug}`);
            } 
            else if (tipo === 'SHOP') {
                // CASO 2: Un alumno pagó un implemento
                // Aquí podrías actualizar el saldo del alumno a $0 automáticamente
                await admin.firestore().collection('estudiantes').doc(id).update({
                    estadoPago: 'Al día',
                    saldoDeudor: 0
                });
            }
        }
    }

    // Responder a Wompi que recibiste el mensaje correctamente
    res.status(200).send('OK');
});
