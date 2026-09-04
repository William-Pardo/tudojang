// functions/pagosValidacion.js
// Callable `gestionarReportePago`: unico writer autorizado de la aprobacion/rechazo de un
// reporte de pago (estudiantes.saldoDeudor/historialPagos/estadoPago, finanzas,
// reportes_pagos_estudiantes.estado). Reemplaza el flujo anterior 100% client-side
// (servicios/pagosEstudiantesApi.ts::gestionarReportePago), que hacia 3 escrituras SEPARADAS
// (updateDoc estudiante, addDoc finanzas, updateDoc reporte) directo desde el navegador.
//
// Bug real (2026-09-03): la regla de Firestore de `finanzas` (allow create: if isAdmin())
// solo permite Admin/SuperAdmin -- pero el panel de "Validar Pagos" (PanelValidacionPagos.tsx)
// es accesible tambien para Editor y Asistente (mismo criterio isInstructor() que ya usan
// `estudiantes`/`reportes_pagos_estudiantes`). Cuando un Editor/Asistente aprobaba un pago: el
// saldo del estudiante SI se actualizaba (isInstructor() cubre `estudiantes` update), pero el
// `addDoc` en `finanzas` fallaba con permission-denied -- dejando el saldo ya descontado, SIN
// registro contable, y el reporte sin marcar Aprobado (el error interrumpe la funcion antes
// del ultimo paso). Si el staff reintentaba aprobar el MISMO reporte (seguia viendolo
// "Pendiente"), el saldo se descontaba una SEGUNDA vez.
//
// Causa raiz real (no solo el rol): la operacion no era atomica. Incluso para Admin, si
// cualquiera de las 3 escrituras separadas fallaba a mitad de camino (red, timeout), el
// sistema quedaba en el mismo estado inconsistente. Fix: todo el ciclo corre server-side
// (Admin SDK, bypasea las reglas de las 3 colecciones) dentro de una unica
// `firestore.runTransaction` -- o se aplican las 3 escrituras completas, o ninguna. Mismo
// patron ya usado en academico/carnets.js (solicitarFabricacionCarnets) y
// asistente/cuotas.js. De paso, el chequeo de "referencia ya aprobada en otro reporte" (bug
// real 2026-09-02, doble acreditacion) ahora corre DENTRO de la transaccion contra el reporte
// releido fresco -- protege tambien el caso de re-aprobar el MISMO reporte dos veces (doble
// click, dos pestañas), no solo dos reportes distintos.

'use strict';

const crearError = (code, message) => Object.assign(new Error(message), { code });

// Mismo set que ya usan asistencia.js/estudiantes.js: Admin/Editor/Asistente/Maestro/
// SuperAdmin -- calca isInstructor() de firestore.rules (el mismo criterio de acceso que ya
// gatea el panel de Validar Pagos en la UI, App.tsx).
const ROLES_AUTORIZADOS = new Set(['Admin', 'Editor', 'Asistente', 'Maestro', 'SuperAdmin']);
const ESTADOS_VALIDOS = new Set(['Aprobado', 'Rechazado']);

function requireAuth(context) {
  if (!context?.auth?.uid) {
    throw crearError('unauthenticated', 'Usuario no autenticado');
  }
  return context.auth;
}

function assertEsInstructor(auth) {
  if (!ROLES_AUTORIZADOS.has(auth.token?.rol)) {
    throw crearError('permission-denied', 'No tienes permiso para gestionar reportes de pago');
  }
}

// SuperAdmin opera cross-tenant por diseno (mismo criterio ya usado en capacidad.js/carnets.js).
function assertTenantAutorizado(tenantId, auth) {
  if (auth.token?.rol === 'SuperAdmin') return;
  if (!tenantId || tenantId !== auth.token?.tenantId) {
    throw crearError('permission-denied', 'Tenant no autorizado');
  }
}

function crearServicioGestionarReportePago({ firestore }) {
  return async function gestionarReportePago(data, context) {
    const auth = requireAuth(context);
    assertEsInstructor(auth);

    const reporteId = String(data?.reporteId || '').trim();
    const nuevoEstado = data?.nuevoEstado;
    const observaciones = String(data?.observaciones || '');

    if (!reporteId) {
      throw crearError('invalid-argument', 'Falta reporteId');
    }
    if (!ESTADOS_VALIDOS.has(nuevoEstado)) {
      throw crearError('invalid-argument', 'nuevoEstado debe ser "Aprobado" o "Rechazado"');
    }

    const reporteRef = firestore.collection('reportes_pagos_estudiantes').doc(reporteId);

    const resultado = await firestore.runTransaction(async (tx) => {
      // Todas las lecturas de la transaccion van antes que cualquier escritura (mismo
      // criterio ya documentado en academico/carnets.js).
      const reporteSnap = await tx.get(reporteRef);
      if (!reporteSnap.exists) {
        throw crearError('not-found', 'No se encontró el reporte de pago');
      }
      const reporte = reporteSnap.data();

      assertTenantAutorizado(reporte.tenantId, auth);

      if (reporte.estado === 'Aprobado' || reporte.estado === 'Rechazado') {
        throw crearError(
          'failed-precondition',
          `Este reporte ya fue ${reporte.estado === 'Aprobado' ? 'aprobado' : 'rechazado'} -- no se puede procesar dos veces`
        );
      }

      let estudianteSnap = null;
      let duplicado = null;
      const estudianteRef = firestore.collection('estudiantes').doc(reporte.estudianteId);

      if (nuevoEstado === 'Aprobado') {
        estudianteSnap = await tx.get(estudianteRef);
        if (!estudianteSnap.exists) {
          throw crearError('not-found', 'No se encontró el estudiante');
        }

        const referencia = reporte.datosIA?.referencia;
        if (referencia) {
          const dupSnap = await tx.get(
            firestore
              .collection('reportes_pagos_estudiantes')
              .where('tenantId', '==', reporte.tenantId)
              .where('datosIA.referencia', '==', referencia)
              .where('estado', '==', 'Aprobado')
          );
          duplicado = dupSnap.docs.find((d) => d.id !== reporteId) || null;
          if (duplicado) {
            throw crearError(
              'failed-precondition',
              `Referencia duplicada: ya existe un pago aprobado (reporte ${duplicado.id}) con esta misma referencia.`
            );
          }
        }
      }

      let estudianteData = null;
      if (nuevoEstado === 'Aprobado') {
        estudianteData = estudianteSnap.data();
        const nuevoSaldo = Number(estudianteData.saldoDeudor || 0) - Number(reporte.montoInformado || 0);
        const nuevoEstadoPago = nuevoSaldo <= 0 ? 'Al día' : 'Pendiente';
        const pagoHistorial = {
          id: `PAGO-REP-${reporteId}`,
          fecha: new Date().toISOString(),
          monto: reporte.montoInformado,
          metodo: 'Transferencia (IA)',
          referencia: reporte.datosIA?.referencia || 'REPORTE-APP',
          reporteId,
        };

        tx.update(estudianteRef, {
          saldoDeudor: nuevoSaldo,
          estadoPago: nuevoEstadoPago,
          historialPagos: [pagoHistorial, ...(estudianteData.historialPagos || [])],
        });

        // Nota de saldo a favor en la descripcion (nuevoSaldo < 0) para que el libro de
        // tesoreria quede trazable sin cruzar contra la ficha del estudiante -- mismo criterio
        // que servicios/pagosApi.ts (registro manual de pago en Tesoreria).
        const notaSaldoAFavor = nuevoSaldo < 0 ? ` [Genera saldo a favor de $${Math.abs(nuevoSaldo)}]` : '';
        tx.set(firestore.collection('finanzas').doc(), {
          tenantId: reporte.tenantId,
          tipo: 'Ingreso',
          categoria: 'Mensualidad',
          monto: reporte.montoInformado,
          descripcion: `PAGO REPORTADO APP: ${reporte.estudianteNombre}${notaSaldoAFavor}`,
          fecha: new Date().toISOString().split('T')[0],
          sedeId: estudianteData.sedeId || '1',
        });
      }

      tx.update(reporteRef, {
        estado: nuevoEstado,
        validadoPor: auth.uid,
        fechaValidacion: new Date().toISOString(),
        observaciones,
      });

      return {
        tenantId: reporte.tenantId,
        estudianteId: reporte.estudianteId,
        estudianteNombre: reporte.estudianteNombre,
        montoInformado: reporte.montoInformado,
        estudianteData,
      };
    });

    // Notificacion al tutor: best-effort, DESPUES de que la transaccion ya confirmo -- un
    // fallo aca (incluido un permission-denied) nunca debe tumbar la operacion de pago ya
    // aplicada. Mismo criterio D4 ya documentado en el flujo original.
    try {
      let estudianteData = resultado.estudianteData;
      if (!estudianteData) {
        const snap = await firestore.collection('estudiantes').doc(resultado.estudianteId).get();
        estudianteData = snap.exists ? snap.data() : {};
      }
      const esAprobado = nuevoEstado === 'Aprobado';
      const tutorNombre = estudianteData.tutor
        ? [estudianteData.tutor.nombres, estudianteData.tutor.apellidos].filter(Boolean).join(' ')
        : '';
      const destinatario = estudianteData.tutor?.correo || estudianteData.correo || '';

      await firestore.collection('historialNotificaciones').add({
        tenantId: resultado.tenantId,
        estudianteId: resultado.estudianteId,
        estudianteNombre: resultado.estudianteNombre,
        tutorNombre,
        destinatario,
        canal: 'InApp',
        tipo: esAprobado ? 'PagoAprobado' : 'PagoRechazado',
        mensaje: esAprobado
          ? `Tu pago de $${Number(resultado.montoInformado).toLocaleString('es-CO')} fue aprobado. ¡Gracias por tu puntualidad!`
          : 'Tu comprobante no pudo validarse. Contactá a la academia para más información.',
        leida: false,
        fecha: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`[gestionarReportePago] no se pudo crear la notificación tutor-facing para ${reporteId}:`, err);
    }

    return { ok: true };
  };
}

module.exports = {
  crearServicioGestionarReportePago,
};
