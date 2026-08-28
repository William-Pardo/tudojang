
// servicios/pagosEstudiantesApi.ts
import { collection, query, where, getDocs, doc, setDoc, updateDoc, orderBy } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, isFirebaseConfigured } from '../firebase/config';
import { ReportePagoEstudiante, EstadoValidacion, TipoMovimiento, CategoriaFinanciera, EstadoPago, Estudiante, TipoNotificacion } from '../tipos';
import { obtenerEstudiantePorId } from './estudiantesApi';
import { agregarMovimiento } from './finanzasApi';
import { guardarNotificacionEnHistorial } from './notificacionesApi';
import { calcularSaldoTrasPago, estadoPagoPorSaldo } from '../utils/finanzas';
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
 * ADMIN: Busca otro reporte del mismo Tenant con la misma referencia de IA (excluyendo el
 * propio). Chequeo cliente previo a aprobar en lote, para no acreditar dos veces el mismo
 * comprobante -- complementa (no reemplaza) la advertencia que ya calcula la Cloud Function
 * analizarComprobanteEstudiante contra pagos ya Aprobados.
 */
export const buscarReferenciaDuplicada = async (
    tenantId: string,
    referencia: string,
    reporteIdExcluir: string
): Promise<ReportePagoEstudiante | null> => {
    /* istanbul ignore next -- rama exclusiva del modo demo, sin Firebase */
    if (!isFirebaseConfigured) return null;
    const q = query(
        reportesCollection,
        where("tenantId", "==", tenantId),
        where("datosIA.referencia", "==", referencia)
    );
    const snap = await getDocs(q);
    const duplicado = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as ReportePagoEstudiante))
        .find(r => r.id !== reporteIdExcluir);
    return duplicado || null;
};

/**
 * ADMIN: Aprobar varios reportes en lote. Antes de aprobar cada uno, revalida que su
 * referencia (si la IA la extrajo) no esté duplicada -- un fallo individual (duplicado o
 * cualquier error de gestionarReportePago) no aborta el resto del lote.
 */
export const aprobarReportesEnLote = async (
    reportes: ReportePagoEstudiante[],
    adminId: string
): Promise<{ exitosos: string[]; fallidos: { id: string; error: string }[] }> => {
    const resultados = await Promise.allSettled(reportes.map(async (reporte) => {
        const referencia = reporte.datosIA?.referencia;
        if (referencia) {
            const duplicado = await buscarReferenciaDuplicada(reporte.tenantId, referencia, reporte.id);
            if (duplicado) {
                throw new Error(`Referencia duplicada con el reporte ${duplicado.id}.`);
            }
        }
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
 * ADMIN: Gestionar un reporte (Aprobar/Rechazar)
 * Al aprobar, se actualiza el saldo del estudiante y se inyecta en finanzas.
 */
export const gestionarReportePago = async (
    reporte: ReportePagoEstudiante,
    nuevoEstado: EstadoValidacion.Aprobado | EstadoValidacion.Rechazado,
    adminId: string,
    observaciones?: string
): Promise<void> => {
    /* istanbul ignore next -- rama exclusiva del modo demo, sin Firebase */
    if (!isFirebaseConfigured) return;

    const docRef = doc(reportesCollection, reporte.id);

    // D5 (design.md): hoisteado a `let` para reutilizar la MISMA lectura en el paso 7
    // (notificación al tutor) -- el camino de aprobación (hot path del lote,
    // aprobarReportesEnLote) no debe pagar una segunda lectura de Firestore solo para
    // armar destinatario/tutorNombre.
    let estudiante: Estudiante | null = null;

    if (nuevoEstado === EstadoValidacion.Aprobado) {
        // 1. Obtener estudiante actual para asegurar integridad de saldo
        estudiante = await obtenerEstudiantePorId(reporte.estudianteId);

        // 2. Calcular nuevo saldo
        const nuevoSaldo = calcularSaldoTrasPago(estudiante.saldoDeudor, reporte.montoInformado);
        const nuevoEstadoPago = estadoPagoPorSaldo(nuevoSaldo);

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

    // 7. Notificar al tutor (D2/D4/D5 design.md): best-effort, DESPUÉS de que el estado del
    // reporte ya quedó confirmado arriba -- un fallo acá (incluido un permission-denied de
    // Firestore) NUNCA debe tumbar la operación de pago ni propagarse a
    // aprobarReportesEnLote. Aprobado reutiliza el `estudiante` del paso 1 (cero lecturas
    // extra); Rechazado lo resuelve acá porque ese camino nunca lo necesitó antes.
    try {
        if (!estudiante) {
            estudiante = await obtenerEstudiantePorId(reporte.estudianteId);
        }
        const esAprobado = nuevoEstado === EstadoValidacion.Aprobado;
        const tutorNombre = estudiante.tutor
            ? [estudiante.tutor.nombres, estudiante.tutor.apellidos].filter(Boolean).join(' ')
            : '';
        const destinatario = estudiante.tutor?.correo || estudiante.correo || '';

        await guardarNotificacionEnHistorial({
            tenantId: reporte.tenantId,
            estudianteId: reporte.estudianteId,
            estudianteNombre: reporte.estudianteNombre,
            tutorNombre,
            destinatario,
            canal: 'InApp',
            tipo: esAprobado ? TipoNotificacion.PagoAprobado : TipoNotificacion.PagoRechazado,
            // D8 (design.md): el rechazo SIEMPRE usa este texto neutro fijo -- `observaciones`
            // (notas internas del admin) NUNCA se copia al mensaje del tutor.
            mensaje: esAprobado
                ? `Tu pago de $${reporte.montoInformado.toLocaleString('es-CO')} fue aprobado. ¡Gracias por tu puntualidad!`
                : 'Tu comprobante no pudo validarse. Contactá a la academia para más información.',
            leida: false,
            fecha: new Date().toISOString(),
        });
    } catch (err) {
        console.error(`[gestionarReportePago] no se pudo crear la notificación tutor-facing para ${reporte.id}:`, err);
    }
};
