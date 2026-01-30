
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const db = admin.firestore();

/**
 * Webhook para recibir notificaciones de pago desde Wompi Colombia.
 */
export const webhookWompi = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const { event, data, timestamp, signature } = req.body;
    const { transaction } = data;

    // Validación de Checksum de Wompi para seguridad técnica
    const eventSecret = process.env.WOMPI_EVENTS_SECRET;
    if (eventSecret && signature && signature.checksum) {
        const checksumPayload = `${transaction.id}${transaction.status}${transaction.amount_in_cents}${timestamp}${eventSecret}`;
        const generatedChecksum = crypto.createHash('sha256').update(checksumPayload).digest('hex');

        if (generatedChecksum !== signature.checksum) {
            console.error('ALERTA: Checksum de Wompi inválido. La petición no es auténtica.');
            res.status(403).send('Forbidden: Invalid Checksum');
            return;
        }
    }

    console.log(`Evento Wompi recibido: ${event} para transacción ${transaction.id} con estado ${transaction.status}`);

    try {
        const reference = transaction.reference;

        // Identificar qué estamos cobrando por el prefijo de la referencia
        if (reference.startsWith('SUSC_')) {
            // Es una suscripción de academia (SaaS)
            await procesarSuscripcionDojang(transaction);
        } else if (reference.startsWith('INS_')) {
            // Es una inscripción de alumno nuevo
            await procesarInscripcionAlumno(transaction);
        } else if (reference.startsWith('TIENDA_')) {
            // Es una compra en la tienda
            await procesarCompraTienda(transaction);
        }

        res.status(200).send('Event processed');
    } catch (error) {
        console.error('Error procesando webhook de Wompi:', error);
        res.status(500).send('Internal Server Error');
    }
});

async function procesarSuscripcionDojang(transaction: any) {
    const parts = transaction.reference.split('_');
    const tenantId = parts[3]; // SUSC_PRO_ANUAL_TENANTID_TIMESTAMP
    const plan = parts[1].toLowerCase();

    if (transaction.status === 'APPROVED') {
        const tenantRef = db.collection('configuracion').doc(tenantId);
        await tenantRef.update({
            estadoSuscripcion: 'activo',
            plan: plan,
            fechaUltimoPago: admin.firestore.FieldValue.serverTimestamp(),
            wompiTransactionId: transaction.id
        });
        console.log(`Suscripción activada para tenant: ${tenantId}`);
    }
}

async function procesarInscripcionAlumno(transaction: any) {
    const parts = transaction.reference.split('_');
    const solicitudId = parts[1]; // INS_SOLICITUDID_TIMESTAMP

    if (transaction.status === 'APPROVED') {
        const solRef = db.collection('registros_temporales').doc(solicitudId);
        await solRef.update({
            estado: 'pago_validado',
            pagoValidado: true,
            wompiTransactionId: transaction.id,
            fechaPago: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Inscripción validada para solicitud: ${solicitudId}`);
    }
}

async function procesarCompraTienda(transaction: any) {
    const parts = transaction.reference.split('_');
    const compraId = parts[1];

    if (transaction.status === 'APPROVED') {
        const compraRef = db.collection('solicitudesCompra').doc(compraId);
        await compraRef.update({
            estado: 'pagada',
            wompiTransactionId: transaction.id
        });
        console.log(`Compra de tienda pagada: ${compraId}`);
    }
}
