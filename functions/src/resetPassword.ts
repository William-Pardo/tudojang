
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Esta función es temporal para mantenimiento
export const resetearPasswordAdmin = functions.https.onRequest(async (req, res) => {
    const email = req.query.email as string;

    if (!email) {
        res.status(400).send('Falta el email');
        return;
    }

    try {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().updateUser(user.uid, {
            password: 'Cambiar123'
        });

        // También aseguramos que el usuario esté habilitado
        await admin.auth().updateUser(user.uid, { disabled: false });

        res.send(`✅ ÉXITO: Contraseña de ${email} reseteada a 'Cambiar123'. Intenta login ahora.`);
    } catch (error: any) {
        res.status(500).send(`Error: ${error.message}`);
    }
});
