
// servicios/pagosEstudiantesApi.ts
import { collection, query, where, getDocs, doc, setDoc, orderBy } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, isFirebaseConfigured } from '../firebase/config';
import { ReportePagoEstudiante, EstadoValidacion, Estudiante } from '../tipos';
import { resolveLinkedStudent } from './academico/tutorStudentResolver';

const storage = getStorage();
const reportesCollection = collection(db, 'reportes_pagos_estudiantes');

/**
 * TUTOR: Estudiantes activos vinculados a la cuenta autenticada del tutor.
 * Delega en resolveLinkedStudent (servicios/academico/tutorStudentResolver.ts), el resolver
 * de identidad ya vigente para este mismo vínculo tutor->estudiante (usado por el buzón de
 * notificaciones) -- evita una segunda query paralela para la misma regla de Firestore, y de
 * paso hereda su soporte de modo demo/mock.
 */
export const obtenerEstudiantesDelTutor = async (tenantId: string, correoTutor: string): Promise<Estudiante[]> => {
    const estudiantes = await resolveLinkedStudent(tenantId, correoTutor);
    // ERR-0019: se excluye solo al RETIRADO explícito, nunca `!== 'activo'`. `estadoMatricula`
    // lo introdujo el cambio pricing-cupo-real, así que ningún estudiante dado de alta antes
    // tiene el campo: un filtro `=== 'activo'` los descartaba en silencio y su tutor veía
    // "Sin Estudiantes Vinculados" para siempre, sin poder reportar un pago. Ausente significa
    // que nunca se lo retiró (retirarEstudiante, servicios/estudiantesApi.ts, es el único
    // writer de 'retirado'), así que cuenta como activo -- mismo criterio que ERR-0015 aplicó
    // a los estudiantes legacy sin `carnetGenerado`.
    return estudiantes.filter(e => e.estadoMatricula !== 'retirado');
};

/**
 * ESTUDIANTE/TUTOR: Reportar un nuevo pago subiendo el comprobante.
 * tutorUsuarioId identifica al usuario autenticado que reportó (flujo con login);
 * queda ausente en los reportes creados desde el link público /reportar-pago.
 */
export const reportarPagoEstudiante = async (
    tenantId: string,
    estudianteId: string,
    estudianteNombre: string,
    monto: number,
    imagenBase64: string,
    tutorUsuarioId?: string
): Promise<string> => {
    /* istanbul ignore next -- rama exclusiva del modo demo, sin Firebase */
    if (!isFirebaseConfigured) return "mock-id-reporte";

    // ERR-0017: el documento se crea con UN SOLO write que YA trae la URL real del
    // comprobante -- antes se creaba con `addDoc(..., comprobanteUrl: '')` y se
    // completaba con un `updateDoc` posterior, pero el trigger onCreate
    // (analizarComprobanteEstudiante, functions/index.js) se dispara en la PRIMERA
    // escritura: su guard siempre veía comprobanteUrl vacío y descartaba el análisis en
    // silencio para todo reporte real. 1. Reservar el id del documento localmente para
    // poder subir a Storage antes de escribir en Firestore.
    const docRef = doc(reportesCollection);

    // 2. Subir imagen a Storage con ruta aislada por tenant
    const storageRef = ref(storage, `tenants/${tenantId}/comprobantes/${docRef.id}_${Date.now()}`);
    const snapshot = await uploadString(storageRef, imagenBase64, 'data_url');
    const downloadURL = await getDownloadURL(snapshot.ref);

    // 3. Crear el documento ya con la URL real y en Pendiente
    const nuevoReporte: Omit<ReportePagoEstudiante, 'id'> = {
        tenantId,
        estudianteId,
        estudianteNombre,
        montoInformado: monto,
        fechaReporte: new Date().toISOString(),
        comprobanteUrl: downloadURL,
        estado: EstadoValidacion.Pendiente,
        // Firestore rechaza valores `undefined`: solo se incluye el campo si vino informado.
        ...(tutorUsuarioId ? { tutorUsuarioId } : {})
    };

    await setDoc(docRef, nuevoReporte);

    return docRef.id;
};

/**
 * PUBLICO (sin login, link de WhatsApp): resuelve el estudiante por su ID de documento
 * (opaco) para ReportarPagoPublico.tsx. Bug real (2026-09-02): antes se resolvía con
 * obtenerEstudiantePorNumIdentificacion, un query directo del cliente que SIEMPRE fallaba con
 * permission-denied (firestore.rules exige authenticated() para leer `estudiantes`, sin
 * excepción para este caso) -- el link de WhatsApp nunca funcionaba, ni para el tutor
 * legítimo. Ahora pasa por la Cloud Function `resolverEstudiantePublico` (Admin SDK, bypasea
 * las reglas), que además proyecta SOLO nombres/apellidos/saldoDeudor -- nunca el documento
 * completo (tutor, historialPagos, progreso) -- ver functions/pagosPublicos.js. Devuelve null
 * si no existe o no pertenece al tenant, mismo contrato que resolverTenantPublico.
 */
export const resolverEstudiantePublico = async (
    estudianteId: string,
    tenantId: string
): Promise<Pick<Estudiante, 'id' | 'nombres' | 'apellidos' | 'saldoDeudor'> | null> => {
    if (!isFirebaseConfigured) return null;
    const callable = httpsCallable<
        { estudianteId: string; tenantId: string },
        Pick<Estudiante, 'id' | 'nombres' | 'apellidos' | 'saldoDeudor'> | null
    >(getFunctions(), 'resolverEstudiantePublico');
    const { data } = await callable({ estudianteId, tenantId });
    return data;
};

/**
 * PUBLICO (sin login): reporta un pago desde el link de WhatsApp -- mismo resultado final que
 * reportarPagoEstudiante (reporte Pendiente + comprobante en Storage), pero corrido server-side
 * vía la Cloud Function `reportarPagoPublico` (Admin SDK) porque ni Storage ni Firestore
 * permiten esta escritura sin sesión. Ver functions/pagosPublicos.js.
 */
export const reportarPagoPublico = async (
    estudianteId: string,
    tenantId: string,
    monto: number,
    imagenBase64: string
): Promise<string> => {
    if (!isFirebaseConfigured) return "mock-id-reporte";
    const callable = httpsCallable<
        { estudianteId: string; tenantId: string; monto: number; imagenBase64: string },
        { reporteId: string }
    >(getFunctions(), 'reportarPagoPublico');
    const { data } = await callable({ estudianteId, tenantId, monto, imagenBase64 });
    return data.reporteId;
};

/**
 * ADMIN: Obtener reportes pendientes de su Tenant
 */
export const obtenerReportesPendientes = async (tenantId: string): Promise<ReportePagoEstudiante[]> => {
    /* istanbul ignore next -- rama exclusiva del modo demo, sin Firebase */
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
 * ADMIN: Historial de reportes ya resueltos (Aprobados/Rechazados) del Tenant, para la
 * vista de conciliación "quién pagó, cuánto, cuándo".
 */
export const obtenerHistorialReportes = async (tenantId: string): Promise<ReportePagoEstudiante[]> => {
    /* istanbul ignore next -- rama exclusiva del modo demo, sin Firebase */
    if (!isFirebaseConfigured) return [];
    const q = query(
        reportesCollection,
        where("tenantId", "==", tenantId),
        where("estado", "in", [EstadoValidacion.Aprobado, EstadoValidacion.Rechazado]),
        orderBy("fechaValidacion", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ReportePagoEstudiante));
};

/**
 * ADMIN: Aprobar varios reportes en lote -- un fallo individual (referencia duplicada
 * detectada por la Cloud Function, o cualquier otro error) no aborta el resto del lote.
 */
export const aprobarReportesEnLote = async (
    reportes: ReportePagoEstudiante[],
    adminId: string
): Promise<{ exitosos: string[]; fallidos: { id: string; error: string }[] }> => {
    const resultados = await Promise.allSettled(reportes.map(async (reporte) => {
        await gestionarReportePago(reporte, EstadoValidacion.Aprobado, adminId);
    }));

    const exitosos: string[] = [];
    const fallidos: { id: string; error: string }[] = [];

    resultados.forEach((resultado, index) => {
        const reporte = reportes[index];
        if (resultado.status === 'fulfilled') {
            exitosos.push(reporte.id);
        } else {
            const error = resultado.reason instanceof Error ? resultado.reason.message : 'Error desconocido';
            fallidos.push({ id: reporte.id, error });
        }
    });

    return { exitosos, fallidos };
};

/**
 * ADMIN: Gestionar un reporte (Aprobar/Rechazar). Wrapper delgado sobre la Cloud Function
 * `gestionarReportePago` (Admin SDK, mismo patrón ya usado en resolverTenantPublico/
 * verificarDuplicadoAspirante) -- bug real (2026-09-03): esto antes eran 3 escrituras
 * SEPARADAS desde el cliente (updateDoc estudiante, addDoc finanzas, updateDoc reporte). La
 * regla de `finanzas` exige isAdmin() (solo Admin/SuperAdmin), pero el panel de "Validar
 * Pagos" también es accesible para Editor/Asistente -- para ellos, el saldo del estudiante
 * quedaba descontado sin ningún registro contable, y el reporte nunca se marcaba como
 * procesado. Ahora todo el ciclo corre server-side dentro de una única transacción de
 * Firestore -- o se aplican las 3 escrituras completas, o ninguna. Ver
 * functions/pagosValidacion.js para el detalle completo (incluye el chequeo de referencia
 * duplicada, que ahora vive dentro de esa misma transacción).
 * `adminId` ya no se usa (la Cloud Function toma el uid del token de auth, no del cliente) --
 * se mantiene en la firma para no tocar los call-sites existentes (PanelValidacionPagos.tsx).
 */
export const gestionarReportePago = async (
    reporte: ReportePagoEstudiante,
    nuevoEstado: EstadoValidacion.Aprobado | EstadoValidacion.Rechazado,
    _adminId: string,
    observaciones?: string
): Promise<void> => {
    /* istanbul ignore next -- rama exclusiva del modo demo, sin Firebase */
    if (!isFirebaseConfigured) return;

    const callable = httpsCallable<
        { reporteId: string; nuevoEstado: EstadoValidacion.Aprobado | EstadoValidacion.Rechazado; observaciones?: string },
        { ok: boolean }
    >(getFunctions(), 'gestionarReportePago');
    await callable({ reporteId: reporte.id, nuevoEstado, observaciones });
};
