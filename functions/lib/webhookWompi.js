"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookWompi = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const db = admin.firestore();
/**
 * Webhook para recibir notificaciones de pago desde Wompi Colombia.
 */
exports.webhookWompi = functions.https.onRequest(async (req, res) => {
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
        console.log(`Analizando referencia: ${reference}`);
        // Nuevo formato estándar: TDJ_{TIPO}_{IDENTIFICADOR}_{TIMESTAMP}
        if (reference.startsWith('TDJ_')) {
            const parts = reference.split('_');
            const tipo = parts[1]; // PLAN, INS, STORE
            const identificador = parts[2];
            if (tipo === 'PLAN') {
                await procesarSuscripcionDojang(transaction, identificador);
            }
            else if (tipo === 'INS') {
                await procesarInscripcionAlumno(transaction, identificador);
            }
            else if (tipo === 'STORE') {
                await procesarCompraTienda(transaction, identificador);
            }
        }
        // Compatibilidad con formatos anteriores si es necesario
        else if (reference.startsWith('SUSC_')) {
            await procesarSuscripcionDojangLegacy(transaction);
        }
        else if (reference.startsWith('INS_')) {
            await procesarInscripcionAlumnoLegacy(transaction);
        }
        res.status(200).send('Event processed');
    }
    catch (error) {
        console.error('Error procesando webhook de Wompi:', error);
        res.status(500).send('Internal Server Error');
    }
});
/**
 * Procesa la activación de una suscripción de academia.
 * @param transaction Datos de la transacción de Wompi
 * @param tenantId ID del tenant (tnt-...) o slug de la academia
 */
async function procesarSuscripcionDojang(transaction, identifier) {
    if (transaction.status === 'APPROVED') {
        let tenantRef;
        let tenantData;
        // El identificador puede ser el tenantId (tnt-...) o el slug
        if (identifier.startsWith('TNT-')) {
            tenantRef = db.collection('tenants').doc(identifier.toLowerCase());
        }
        else {
            // Buscar por slug
            const snapshot = await db.collection('tenants').where('slug', '==', identifier.toLowerCase()).limit(1).get();
            if (!snapshot.empty) {
                tenantRef = snapshot.docs[0].ref;
            }
        }
        if (tenantRef) {
            const docSnap = await tenantRef.get();
            tenantData = docSnap.data();
            const fechaPago = admin.firestore.FieldValue.serverTimestamp();
            // Calculamos fecha de vencimiento real (mensual)
            const nuevaFechaVencimiento = new Date();
            nuevaFechaVencimiento.setDate(nuevaFechaVencimiento.getDate() + 30); // 1 Mes de suscripción paga
            await tenantRef.update({
                estadoSuscripcion: 'activo',
                fechaUltimoPago: fechaPago,
                wompiTransactionId: transaction.id,
                plan_validado: true,
                fechaVencimiento: nuevaFechaVencimiento.toISOString().split('T')[0] // Actualizamos vencimiento real
            });
            console.log(`✅ Suscripción ACTIVADA para la academia: ${tenantData === null || tenantData === void 0 ? void 0 : tenantData.nombreClub}`);
            // === CREACIÓN DE USUARIO ADMINISTRADOR ===
            if (tenantData === null || tenantData === void 0 ? void 0 : tenantData.emailClub) {
                try {
                    const tempPassword = 'Cambiar123'; // Contraseña temporal fija para pruebas
                    // Verificar si el usuario ya existe en Auth
                    let userRecord;
                    try {
                        userRecord = await admin.auth().getUserByEmail(tenantData.emailClub);
                        console.log("El usuario administrador ya existe. No se modifica su password.");
                    }
                    catch (e) {
                        // Crear usuario nuevo en Firebase Auth
                        userRecord = await admin.auth().createUser({
                            email: tenantData.emailClub,
                            password: tempPassword,
                            displayName: tenantData.representanteLegal || 'Director',
                            disabled: false
                        });
                        console.log(`👤 Usuario Admin creado en Auth: ${tenantData.emailClub}`);
                        // Guardar perfil en Firestore collection 'usuarios' (IGUAL QUE EN EL FRONTEND)
                        await db.collection('usuarios').doc(userRecord.uid).set({
                            tenantId: tenantRef.id,
                            nombreUsuario: tenantData.representanteLegal || 'Director Academia',
                            email: tenantData.emailClub,
                            rol: 'Admin', // Case sensitive para match con enum RolUsuario
                            whatsapp: tenantData.pagoNequi || '',
                            numeroIdentificacion: tenantData.ccRepresentante || '00000000',
                            requiereCambioPassword: true,
                            fcmTokens: []
                        });
                        console.log(`📝 Perfil de usuario creado en Firestore: ${userRecord.uid}`);
                        // ENVIAR EMAIL REAL CON RESEND
                        try {
                            const { enviarEmailBienvenida } = await Promise.resolve().then(() => require('./servicios/emailService'));
                            await enviarEmailBienvenida({
                                emailDestino: tenantData.emailClub,
                                nombreDirector: tenantData.representanteLegal || 'Director',
                                nombreAcademia: tenantData.nombreClub || 'Tu Academia',
                                slug: tenantData.slug || tenantRef.id,
                                passwordTemporal: tempPassword
                            });
                            console.log(`📧 ✅ Email de bienvenida enviado a ${tenantData.emailClub}`);
                        }
                        catch (emailError) {
                            console.error("⚠️ Error enviando email (el usuario fue creado correctamente):", emailError);
                        }
                    }
                }
                catch (authError) {
                    console.error("Error creando usuario administrador:", authError);
                }
            }
        }
        else {
            console.error(`ERROR: No se encontró la academia con identificador: ${identifier}`);
        }
    }
}
async function procesarInscripcionAlumno(transaction, solicitudId) {
    if (transaction.status === 'APPROVED') {
        // En la pasarela de inscripción de alumnos, el identificador es el ID del registro temporal
        const solRef = db.collection('registros_temporales').doc(solicitudId);
        await solRef.update({
            estado: 'pago_validado',
            pagoValidado: true,
            wompiTransactionId: transaction.id,
            fechaPago: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Inscripción VALIDADA para solicitud: ${solicitudId}`);
    }
}
async function procesarCompraTienda(transaction, compraId) {
    if (transaction.status === 'APPROVED') {
        const compraRef = db.collection('solicitudesCompra').doc(compraId);
        await compraRef.update({
            estado: 'pagada',
            wompiTransactionId: transaction.id,
            fechaPago: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Compra de tienda PAGADA: ${compraId}`);
    }
}
// LOGICA LEGACY (PARA MANTENER COMPATIBILIDAD)
async function procesarSuscripcionDojangLegacy(transaction) {
    const parts = transaction.reference.split('_');
    const tenantId = parts[3];
    if (transaction.status === 'APPROVED') {
        await db.collection('configuracion').doc(tenantId).update({
            estadoSuscripcion: 'activo',
            wompiTransactionId: transaction.id
        });
    }
}
async function procesarInscripcionAlumnoLegacy(transaction) {
    const parts = transaction.reference.split('_');
    const solicitudId = parts[1];
    if (transaction.status === 'APPROVED') {
        await db.collection('registros_temporales').doc(solicitudId).update({
            estado: 'pago_validado',
            wompiTransactionId: transaction.id
        });
    }
}
//# sourceMappingURL=webhookWompi.js.map