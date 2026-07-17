function porcentajeSeguro(parte, total) {
  if (!Number.isFinite(parte) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((parte / total) * 100)));
}

function calcularPdf({ paginasVistas = [], permanenciaSegundos = 0, totalPaginas = 0, permanenciaMinimaSegundos = 120 }) {
  const paginasUnicas = new Set(
    paginasVistas.filter((pagina) => Number.isInteger(pagina) && pagina >= 1 && pagina <= totalPaginas)
  );
  const porcentaje = porcentajeSeguro(paginasUnicas.size, totalPaginas);
  const completado = porcentaje === 100 && paginasUnicas.has(totalPaginas) && permanenciaSegundos >= permanenciaMinimaSegundos;
  return { porcentaje, completado };
}

function calcularVideo({ segundosUnicos = [], totalSegundos = 0 }) {
  const segundos = Array.isArray(segundosUnicos) ? new Set(segundosUnicos).size : Number(segundosUnicos) || 0;
  const porcentaje = porcentajeSeguro(segundos, totalSegundos);
  return { porcentaje, completado: porcentaje >= 78 };
}

function crearError(message, code = 'failed-precondition') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function crearServicioConsolidateProgress({ obtenerAsignacion, guardarProgreso, actualizarAsignacion = async () => undefined, notificarAvance = async () => undefined }) {
  return async function consolidateProgress(request) {
    const uid = request?.auth?.uid;
    const tenantIdToken = request?.auth?.token?.tenantId;
    const data = request?.data || {};

    if (!uid) throw crearError('Usuario no autenticado', 'unauthenticated');
    if (!data.tenantId || data.tenantId !== tenantIdToken) throw crearError('Tenant no autorizado', 'permission-denied');
    if (!data.asignacionId) throw crearError('Asignacion requerida');

    const asignacion = await obtenerAsignacion(data.tenantId, data.asignacionId);
    if (!asignacion || asignacion.tenantId !== data.tenantId) throw crearError('Tenant no autorizado', 'permission-denied');
    if (!['activa', 'en_progreso', 'publicada'].includes(asignacion.estado)) throw crearError('Asignacion no activa');

    const tipo = data.tipo || asignacion.tipo;
    const resultado = tipo === 'pdf'
      ? calcularPdf({
          paginasVistas: data.paginasVistas,
          permanenciaSegundos: data.permanenciaSegundos,
          totalPaginas: data.totalPaginas || asignacion.totalPaginas,
          permanenciaMinimaSegundos: data.permanenciaMinimaSegundos || asignacion.permanenciaMinimaSegundos,
        })
      : calcularVideo({
          segundosUnicos: data.segundosUnicos,
          totalSegundos: data.totalSegundos || asignacion.totalSegundos,
        });

    const estadoProgreso = resultado.completado ? 'completado' : 'en_progreso';
    const payload = {
      tenantId: data.tenantId,
      asignacionId: data.asignacionId,
      estudianteId: uid,
      tipo,
      porcentaje: resultado.porcentaje,
      estadoProgreso,
      actualizadoEn: new Date().toISOString(),
    };

    await guardarProgreso(['tenants', data.tenantId, 'progreso', uid, 'asignaciones', data.asignacionId], payload);

    if (estadoProgreso === 'completado') {
      await actualizarAsignacion(data.tenantId, data.asignacionId, {
        ultimoEstadoProgreso: estadoProgreso,
        ultimoProgresoPorcentaje: resultado.porcentaje,
        ultimoProgresoEstudianteId: uid,
        actualizadoEn: payload.actualizadoEn,
      });

      // Plan B #2 (fix tutor-role-end-to-end): al completar un material, avisar al buzón del
      // consultor. El adaptador mapea el uid del visor a su estudiante y deduplica por
      // (estudianteId + asignacionId), así que llamar en cada completitud no genera duplicados.
      await notificarAvance({
        tenantId: data.tenantId,
        uid,
        asignacion,
        asignacionId: data.asignacionId,
        porcentaje: resultado.porcentaje,
      });
    }

    return {
      porcentaje: resultado.porcentaje,
      estadoProgreso,
    };
  };
}

function crearAdaptadorConsolidateProgressFirestore(firestore) {
  return {
    obtenerAsignacion: async (tenantId, asignacionId) => {
      const snap = await firestore
        .collection('tenants')
        .doc(tenantId)
        .collection('asignaciones')
        .doc(asignacionId)
        .get();

      return snap.exists ? snap.data() : null;
    },
    guardarProgreso: async (path, data) => {
      await firestore
        .collection(path[0])
        .doc(path[1])
        .collection(path[2])
        .doc(path[3])
        .collection(path[4])
        .doc(path[5])
        .set(data, { merge: true });
    },
    actualizarAsignacion: async (tenantId, asignacionId, data) => {
      await firestore
        .collection('tenants')
        .doc(tenantId)
        .collection('asignaciones')
        .doc(asignacionId)
        .set(data, { merge: true });
    },
  };
}

module.exports = {
  crearServicioConsolidateProgress,
  crearAdaptadorConsolidateProgressFirestore,
  calcularPdf,
  calcularVideo,
};
