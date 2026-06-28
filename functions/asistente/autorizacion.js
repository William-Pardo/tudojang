const crearError = (code, message) => Object.assign(new Error(message), { code });

const validarSolicitudAsistente = (context) => {
  if (!context?.auth?.uid) {
    throw crearError("unauthenticated", "Autenticación requerida");
  }
  if (!context?.app?.appId) {
    throw crearError("failed-precondition", "App Check requerido");
  }
  if (!context.auth.token?.tenantId || !context.auth.token?.rol) {
    throw crearError(
      "permission-denied",
      "Tenant y rol confiables son obligatorios"
    );
  }
};

const obtenerIdentidadConfiable = (context) => {
  validarSolicitudAsistente(context);
  return {
    uid: context.auth.uid,
    tenantId: context.auth.token.tenantId,
    rol: context.auth.token.rol,
  };
};

module.exports = { obtenerIdentidadConfiable, validarSolicitudAsistente };
