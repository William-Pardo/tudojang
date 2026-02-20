
// servicios/pagosEstudiantesApi.ts
import { collection, addDoc, query, where, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, isFirebaseConfigured } from '../firebase/config';
import { ReportePagoEstudiante, EstadoValidacion, TipoMovimiento, CategoriaFinanciera, EstadoPago } from '../tipos';
import { obtenerEstudiantePorId } from './estudiantesApi';
import { agregarMovimiento } from './finanzasApi';

const storage = getStorage();
const reportesCollection = collection(db, 'reportes_pagos_estudiantes');

/**
 * ESTUDIANTE: Reportar un nuevo pago subiendo el comprobante
 */
export const reportarPagoEstudiante = async (
    tenantId: string,
    estudianteId: string,
    estudianteNombre: string,
    monto: number,
    imagenBase64: string
): Promise<string> => {
    if (!isFirebaseConfigured) return "mock-id-reporte";

    // 1. Crear el documento inicial en Pendiente
    const nuevoReporte: Omit<ReportePagoEstudiante, 'id'> = {
        tenantId,
        estudianteId,
        estudianteNombre,
        montoInformado: monto,
        fechaReporte: new Date().toISOString(),
        comprobanteUrl: '', // Se actualizará tras la subida
        estado: EstadoValidacion.Pendiente
    };

    const docRef = await addDoc(reportesCollection, nuevoReporte);

    // 2. Subir imagen a Storage
    const storageRef = ref(storage, `comprobantes/${tenantId}/${docRef.id}_${Date.now()}`);
    const snapshot = await uploadString(storageRef, imagenBase64, 'data_url');
    const downloadURL = await getDownloadURL(snapshot.ref);

    // 3. Actualizar con la URL final
    await updateDoc(docRef, { comprobanteUrl: downloadURL });

    return docRef.id;
};

/**
 * ADMIN: Obtener reportes pendientes de su Tenant
 */
export const obtenerReportesPendientes = async (tenantId: string): Promise<ReportePagoEstudiante[]> => {
    if (!isFirebaseConfigured) return [];
    const q = query(
        reportesCollection,
        where("tenantId", "==", tenantId),
        where("estado", "in", [EstadoValidacion.Pendiente, EstadoValidacion.Analizando, EstadoValidacion.ValidadoIA, EstadoValidacion.ErrorIA]),
        orderBy("fechaReporte", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ReportePagoEstudiante));
};

/**
 * ADMIN: Gestionar un reporte (Aprobar/Rechazar)
 * Al aprobar, se actualiza el saldo del estudiante y se inyecta en finanzas.
 */
export const gestionarReportePago = async (
    reporte: ReportePagoEstudiante,
    nuevoEstado: EstadoValidacion.Aprobado | EstadoValidacion.Rechazado,
    adminId: string,
    observaciones?: string
): Promise<void> => {
    if (!isFirebaseConfigured) return;

    const docRef = doc(reportesCollection, reporte.id);

    if (nuevoEstado === EstadoValidacion.Aprobado) {
        // 1. Obtener estudiante actual para asegurar integridad de saldo
        const estudiante = await obtenerEstudiantePorId(reporte.estudianteId);

        // 2. Calcular nuevo saldo
        const nuevoSaldo = Math.max(0, estudiante.saldoDeudor - reporte.montoInformado);
        const nuevoEstadoPago = nuevoSaldo <= 0 ? EstadoPago.AlDia : estudiante.estadoPago;

        // 3. Preparar entrada de historial
        const pagoHistorial = {
            id: `PAGO-REP-${reporte.id}`,
            fecha: new Date().toISOString(),
            monto: reporte.montoInformado,
            metodo: 'Transferencia (IA)',
            referencia: reporte.datosIA?.referencia || 'REPORTE-APP',
            reporteId: reporte.id
        };

        // 4. Actualizar Estudiante (Saldo + Historial)
        const estudianteRef = doc(db, 'estudiantes', reporte.estudianteId);
        await updateDoc(estudianteRef, {
            saldoDeudor: nuevoSaldo,
            estadoPago: nuevoEstadoPago,
            historialPagos: [pagoHistorial, ...(estudiante.historialPagos || [])]
        });

        // 5. Inyectar en Finanzas
        await agregarMovimiento({
            tenantId: reporte.tenantId,
            tipo: TipoMovimiento.Ingreso,
            categoria: CategoriaFinanciera.Mensualidad,
            monto: reporte.montoInformado,
            descripcion: `PAGO REPORTADO APP: ${reporte.estudianteNombre}`,
            fecha: new Date().toISOString().split('T')[0],
            sedeId: estudiante.sedeId || '1'
        });
    }

    // 6. Actualizar estado del reporte
    await updateDoc(docRef, {
        estado: nuevoEstado,
        validadoPor: adminId,
        fechaValidacion: new Date().toISOString(),
        observaciones: observaciones || ''
    });
};
