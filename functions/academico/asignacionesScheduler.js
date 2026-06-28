'use strict';

function parseFecha(value) {
  if (!value) return null;
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function estaVencida(asignacion, ahora) {
  if (asignacion?.estado !== 'publicada') return false;
  const cierre = parseFecha(asignacion.fechaCierre);
  return Boolean(cierre && ahora > cierre);
}

function crearServicioVencerAsignaciones({ listarAsignacionesPublicadas }) {
  return async function vencerAsignaciones(ahora = new Date()) {
    const snapshots = await listarAsignacionesPublicadas();
    let vencidas = 0;

    for (const snap of snapshots) {
      const asignacion = snap.data();
      if (!estaVencida(asignacion, ahora)) continue;

      await snap.ref.update({
        estado: 'vencida',
        actualizadoEn: ahora.toISOString(),
      });
      vencidas += 1;
    }

    return {
      procesadas: snapshots.length,
      vencidas,
    };
  };
}

function crearListadoAsignacionesFirestore(firestore) {
  return async function listarAsignacionesPublicadas() {
    const snapshot = await firestore
      .collectionGroup('asignaciones')
      .where('estado', '==', 'publicada')
      .get();

    return snapshot.docs;
  };
}

module.exports = {
  crearServicioVencerAsignaciones,
  crearListadoAsignacionesFirestore,
  estaVencida,
};
