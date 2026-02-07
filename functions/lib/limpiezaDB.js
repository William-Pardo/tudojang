"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.limpiarDatosPrueba = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const db = admin.firestore();
/**
 * Función de limpieza para eliminar datos de prueba
 * SOLO USAR EN DESARROLLO
 */
exports.limpiarDatosPrueba = functions.https.onRequest(async (req, res) => {
    const email = req.query.email;
    if (!email) {
        res.status(400).send('Falta el parámetro email');
        return;
    }
    try {
        const resultados = {
            usuariosEliminados: 0,
            tenantsEliminados: 0,
            slugsEliminados: []
        };
        // 1. Eliminar usuario de Auth
        try {
            const user = await admin.auth().getUserByEmail(email);
            await admin.auth().deleteUser(user.uid);
            resultados.usuariosEliminados++;
            // Eliminar documento de usuarios_dashboard
            await db.collection('usuarios_dashboard').doc(user.uid).delete();
        }
        catch (e) {
            console.log('Usuario no encontrado en Auth:', email);
        }
        // 2. Eliminar todos los tenants asociados a este email
        const tenantsSnapshot = await db.collection('tenants')
            .where('emailClub', '==', email)
            .get();
        for (const doc of tenantsSnapshot.docs) {
            const data = doc.data();
            resultados.slugsEliminados.push(data.slug || doc.id);
            await doc.ref.delete();
            resultados.tenantsEliminados++;
        }
        res.json({
            success: true,
            mensaje: `✅ Limpieza completada para ${email}`,
            detalles: resultados
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
//# sourceMappingURL=limpiezaDB.js.map