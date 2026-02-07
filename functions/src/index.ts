import * as admin from 'firebase-admin';

admin.initializeApp();

export { generarLinks } from './contratos/generarLinks';
export { firmarContrato } from './contratos/firmarContrato';
export { obtenerContratoPorToken } from './contratos/obtenerContratoPorToken';
export { webhookWompi } from './webhookWompi';
export { resetearPasswordAdmin } from './resetPassword';
export { limpiarDatosPrueba } from './limpiezaDB';
