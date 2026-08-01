// functions/academico/capacidad.js
// Callable `actualizarExtrasContratados`: unico writer autorizado de
// `sedesExtraContratadas`/`equipoTecnicoExtraContratado` en `tenants/{tenantId}`. Reemplaza
// el write directo de cliente (servicios/configuracionApi.ts::actualizarCapacidadClub, que
// hacia `updateDoc(tenantRef, {[campo]: increment(cantidad)})`), bloqueado sin excepcion por
// firestore.rules a partir de este cambio (ver camposFacturacionInmutables() en
// firestore.rules, match /tenants/{tenantId}). El Admin SDK (esta Cloud Function) sigue
// pudiendo escribir esos campos porque bypasea las reglas -- mismo criterio ya usado para
// sedes/{id} y estudiantes/{id} (ver academico/sedes.js, academico/estudiantes.js):
// mover la puerta de escritura del cliente directo a un callable re-validado server-side.
// SDD pricing-cupo-real, design.md D7 "Protecting billing-affecting tenant fields".
//
// Alcance intencional (D7): SOLO estos 2 campos aditivos. `sedeBonusOtorgada`/
// `sedeBonusOtorgadaEn` (los otros 2 campos que protege el mismo guard de firestore.rules)
// NO se tocan aca -- esos los otorga `crearEstudiante` al cruzar el umbral de 70 estudiantes
// (D4, bloque posterior de este mismo cambio), nunca una compra manual del cliente.

'use strict';

const crearError = (code, message) => Object.assign(new Error(message), { code });

// Los unicos 2 campos que este callable puede escribir -- espejo de
// tipos.ts::ConfiguracionClub y del contrato de entrada de
// utils/facturacion.ts::calcularCapacidad (D7/D8, design.md). Este callable NO es un
// `updateDoc` generico: cualquier otro `campo` se rechaza sin excepcion.
const CAMPOS_EXTRAS_VALIDOS = ['sedesExtraContratadas', 'equipoTecnicoExtraContratado'];

function requireAuth(context) {
  if (!context?.auth?.uid) {
    throw crearError('unauthenticated', 'Usuario no autenticado');
  }
  return context.auth;
}

// Mismo criterio que academico/sedes.js: solo Admin/SuperAdmin gestiona la capacidad
// contratada del tenant (Editor/Asistente/Maestro no compran extras).
function assertEsAdmin(auth) {
  const rol = auth.token?.rol;
  if (rol !== 'Admin' && rol !== 'SuperAdmin') {
    throw crearError('permission-denied', 'Solo un administrador puede gestionar la capacidad contratada');
  }
}

// SuperAdmin opera cross-tenant por diseno (mismo criterio que academico/sedes.js /
// academico/estudiantes.js); Admin queda acotado a su propio tenant.
function assertTenantAutorizado(tenantId, auth) {
  if (auth.token?.rol === 'SuperAdmin') return;
  if (!tenantId || tenantId !== auth.token?.tenantId) {
    throw crearError('permission-denied', 'Tenant no autorizado');
  }
}

function assertCampoValido(campo) {
  if (!CAMPOS_EXTRAS_VALIDOS.includes(campo)) {
    throw crearError(
      'invalid-argument',
      `Campo no válido: "${campo}". Solo se admite ${CAMPOS_EXTRAS_VALIDOS.join(' o ')}.`
    );
  }
}

function assertCantidadValida(cantidad) {
  if (typeof cantidad !== 'number' || !Number.isInteger(cantidad) || !Number.isFinite(cantidad)) {
    throw crearError('invalid-argument', 'La cantidad debe ser un número entero');
  }
}

/**
 * Suma (o resta) `cantidad` al campo de extras contratados indicado, re-validando
 * server-side lo que antes se escribia directo desde el cliente con
 * `updateDoc(tenantRef, {[campo]: increment(cantidad)})` (D7). Read-modify-write en vez de
 * `FieldValue.increment` -- mismo criterio ya documentado en academico/asistencia.js:215,
 * para no depender de FieldValue en los fakes de test.
 *
 * D8 (owner seat accounting, capacidad-tenant): este callable NUNCA toca
 * `incluido.equipoTecnico` (fijo en 3, con el owner ya contado adentro -- ver
 * functions/facturacion-config.json / design.md D8) -- solo suma unidades EXTRA por encima
 * de ese piso incluido. `calcularCapacidad` (functions/facturacion.js) sigue siendo la unica
 * fuente de verdad para el total resultante; este callable solo persiste el insumo.
 */
function crearServicioActualizarExtrasContratados({ firestore }) {
  return async function actualizarExtrasContratados(data, context) {
    const auth = requireAuth(context);
    assertEsAdmin(auth);

    const tenantId = String(data?.tenantId || '').trim();
    assertTenantAutorizado(tenantId, auth);

    const campo = data?.campo;
    assertCampoValido(campo);

    const cantidad = data?.cantidad;
    assertCantidadValida(cantidad);

    const tenantRef = firestore.collection('tenants').doc(tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) {
      throw crearError('not-found', 'El tenant especificado no existe');
    }

    const actual = Number(tenantSnap.data()[campo]) || 0;
    const nuevo = actual + cantidad;
    if (nuevo < 0) {
      throw crearError(
        'failed-precondition',
        `La operación dejaría "${campo}" en un valor negativo (${nuevo})`
      );
    }

    await tenantRef.set({ [campo]: nuevo }, { merge: true });
    return { tenantId, campo, valor: nuevo };
  };
}

module.exports = {
  crearServicioActualizarExtrasContratados,
};
