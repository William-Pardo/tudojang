import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

export const generarLinks = functions.https.onCall(async (data, context) => {
    // Ensure user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { studentId, contractType, expirationHours = 24 } = data;

    if (!studentId || !contractType) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing studentId or contractType.');
    }

    const token = uuidv4();
    const db = admin.firestore();

    // Calculate expiration date
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + expirationHours * 60 * 60 * 1000));

    const contractRequest = {
        studentId,
        contractType,
        token,
        expiresAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending', // pending, signed, expired
        createdBy: context.auth.uid
    };

    try {
        // Store token in a separate collection for quick lookup by token
        await db.collection('contract_requests').doc(token).set(contractRequest);

        // Construct the link
        // Ideally this should use the deployed domain, but returning a relative path is fine for the frontend to handle.
        const link = `/firmar?token=${token}`;

        return { link, token, expiresAt: expiresAt.toDate().toISOString() };
    } catch (error) {
        console.error("Error generating contract link:", error);
        throw new functions.https.HttpsError('internal', 'Failed to generate contract link.');
    }
});
