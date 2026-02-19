// @ts-nocheck
// Este archivo es una representación de lo que iría en tus Firebase Cloud Functions
// No se ejecuta directamente en el navegador, sino en el servidor de Google.

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// admin.initializeApp(); // Solo en entorno real de funciones

// CONFIGURACIÓN DE SEGURIDAD (Se usarían estas llaves en el entorno de funciones):
// const INTEGRITY_KEY = "prod_integrity_K0vlATDmQxX3kY6aN7UmaBOYkwBrLVFm";
// const EVENTS_KEY = "prod_events_Sliei3JBPRgw0zFfLFQ17OaGq70lRXhw";

export const webhookWompi = functions.https.onRequest(async (req, res) => {
    // 1. Validar que el evento venga de Wompi (Seguridad)
    // Se debe validar el header 'x-wompi-signature' usando la EVENTS_KEY
    const evento = req.body;

    if (evento.event === 'transaction.updated') {
        const { data } = evento;
        const transaction = data.transaction;

        // 2. Solo procesar si el pago es APROBADO
        if (transaction.status === 'APPROVED') {
            const referencia = transaction.reference; // Ej: "SUSC_tenantId_planId_timestamp" o "RENOVACION_tenantId_itemId_timestamp"
            const parts = referencia.split('_');
            const tipo = parts[0];
            const tenantId = parts[1];
            const itemId = parts[2];

            if (tipo === 'SUSC' || tipo === 'RENOVACION') {
                const tenantRef = admin.firestore().collection('tenants').doc(tenantId);
                const tenantDoc = await tenantRef.get();

                if (tenantDoc.exists) {
                    // Actualizar fecha de vencimiento (31 días extra)
                    await tenantRef.update({
                        estadoSuscripcion: 'activo',
                        fechaVencimiento: admin.firestore.Timestamp.fromDate(
                            new Date(Date.now() + 31 * 24 * 60 * 60 * 1000)
                        )
                    });
                    console.log(`Pago procesado exitosamente para: ${tenantId}`);
                }
            }
        }
    }

    // Responder a Wompi que recibiste el mensaje correctamente
    res.status(200).send('OK');
});
