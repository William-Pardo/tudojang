import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const obtenerContratoPorToken = functions.https.onCall(async (data: string | { token: string }, context) => {
    // Allow passing token directly or as an object { token: "..." }
    const token = (typeof data === 'string') ? data : data.token;

    if (!token) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing token.');
    }

    const db = admin.firestore();
    try {
        const doc = await db.collection('contract_requests').doc(token).get();

        if (!doc.exists) {
            throw new functions.https.HttpsError('not-found', 'Contract request not found.');
        }

        const requestData = doc.data();

        if (!requestData) {
            throw new functions.https.HttpsError('internal', 'Empty contract data.');
        }

        if (requestData.expiresAt.toDate() < new Date()) {
            throw new functions.https.HttpsError('deadline-exceeded', 'Contract link expired.');
        }

        // Return only what is needed for verify/display
        return {
            contractType: requestData.contractType,
            status: requestData.status,
            studentId: requestData.studentId, // careful, might be PII if not auth'd
            expiresAt: requestData.expiresAt.toDate().toISOString()
        };
    } catch (e) {
        console.error("Error retrieving contract:", e);
        throw new functions.https.HttpsError('internal', 'Error retrieving contract.');
    }
});
