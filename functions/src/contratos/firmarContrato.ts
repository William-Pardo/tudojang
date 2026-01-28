import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const firmarContrato = functions.https.onCall(async (data: any, context: functions.https.CallableContext) => {
    // Signing might not require authentication if they have a valid token (e.g. sent via email)

    const { token, signatureData, signerName } = data;

    if (!token || !signatureData) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing token or signatureData.');
    }

    const db = admin.firestore();
    const tokenDocRef = db.collection('contract_requests').doc(token);

    try {
        const tokenDoc = await tokenDocRef.get();

        if (!tokenDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Invalid contract token.');
        }

        const requestData = tokenDoc.data();

        if (requestData?.status !== 'pending') {
            throw new functions.https.HttpsError('failed-precondition', 'Contract already signed or invalid.');
        }

        if (requestData.expiresAt.toDate() < new Date()) {
            throw new functions.https.HttpsError('deadline-exceeded', 'Contract link expired.');
        }

        // Perform the signing action
        const signedDate = new Date();

        // 1. Update the request status
        await tokenDocRef.update({
            status: 'signed',
            signedAt: admin.firestore.Timestamp.fromDate(signedDate),
            signerName: signerName || 'Unknown',
            signatureData: signatureData // Store reference or data
        });

        // 2. Create the actual contract record in 'contracts' collection
        const contractData = {
            studentId: requestData.studentId,
            contractType: requestData.contractType,
            signedAt: admin.firestore.Timestamp.fromDate(signedDate),
            status: 'active',
            termsVersion: 'v1.0', // placeholder
            signatureReference: signatureData
        };

        await db.collection('contracts').add(contractData);

        return { success: true, message: 'Contract signed successfully.' };

    } catch (error) {
        console.error("Error signing contract:", error);
        // Be careful not to expose too much internal error info
        throw new functions.https.HttpsError('internal', 'Failed to sign contract.');
    }
});
