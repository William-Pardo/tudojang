"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.repararRegistroManual = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
// Función HTTP para reparar el registro
exports.repararRegistroManual = functions.https.onRequest(async (req, res) => {
    const email = req.query.email || 'gengepardo@gmail.com';
    const password = 'Cambiar123';
    try {
        const db = admin.firestore();
        // 1. Buscar tenant existente
        const tenantsSnapshot = await db.collection('tenants')
            .where('emailClub', '==', email)
            .get();
        if (tenantsSnapshot.empty) {
            res.status(404).send('❌ NO hay tenants para este email');
            return;
        }
        const tenantDoc = tenantsSnapshot.docs[0];
        const tenantData = tenantDoc.data();
        const tenantId = tenantDoc.id;
        // 2. Crear usuario en Auth
        let userRecord;
        try {
            userRecord = await admin.auth().createUser({
                email: email,
                password: password,
                displayName: tenantData.representanteLegal || 'Director',
                disabled: false
            });
        }
        catch (authError) {
            if (authError.code === 'auth/email-already-exists') {
                userRecord = await admin.auth().getUserByEmail(email);
            }
            else {
                throw authError;
            }
        }
        // 3. Crear documento en colección 'usuarios'
        await db.collection('usuarios').doc(userRecord.uid).set({
            tenantId: tenantId,
            nombreUsuario: tenantData.representanteLegal || 'Director',
            email: email,
            rol: 'Admin',
            whatsapp: tenantData.pagoNequi || '',
            numeroIdentificacion: tenantData.ccRepresentante || '00000000',
            sedeId: 'sede-principal',
            fcmTokens: [],
            requiereCambioPassword: true
        });
        res.json({
            success: true,
            mensaje: '✅ REPARACIÓN COMPLETADA',
            datos: {
                email: email,
                password: password,
                slug: tenantData.slug,
                tenantId: tenantId,
                uid: userRecord.uid
            }
        });
    }
    catch (error) {
        console.error('Error en reparación:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
//# sourceMappingURL=repararRegistro.js.map