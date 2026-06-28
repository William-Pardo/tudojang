const normalizarEmail = (email) => String(email ?? "").trim().toLowerCase();

const crearErrorValidacion = (message) =>
  Object.assign(new Error(message), { code: "failed-precondition" });

const validarTenantParaProvision = ({ tenant, tenantId, email }) => {
  if (!tenant || tenant.exists === false) {
    throw crearErrorValidacion("Tenant no existe para provisionar usuario");
  }
  const data = typeof tenant.data === "function" ? tenant.data() : tenant;
  if (!data || data.tenantId !== tenantId) {
    throw crearErrorValidacion("Tenant no coincide con la solicitud");
  }
  if (normalizarEmail(data.emailClub) !== normalizarEmail(email)) {
    throw crearErrorValidacion("Email no coincide con el tenant registrado");
  }
  if (data.estadoSuscripcion === "activo") {
    throw crearErrorValidacion("Tenant ya se encuentra activo");
  }
  return data;
};

const validarEvidenciaPagoParaActivacion = ({
  tenant,
  tenantId,
  email,
  transactionId,
}) => {
  if (!tenant || tenant.exists === false) {
    throw crearErrorValidacion("Tenant no existe para activar suscripción");
  }
  const data = typeof tenant.data === "function" ? tenant.data() : tenant;
  if (!data || data.tenantId !== tenantId) {
    throw crearErrorValidacion("Tenant no coincide con la solicitud");
  }
  if (normalizarEmail(data.emailClub) !== normalizarEmail(email)) {
    throw crearErrorValidacion("Email no coincide con el tenant registrado");
  }
  const pago = data.ultimoPagoWompi;
  if (!pago || pago.status !== "APPROVED") {
    throw crearErrorValidacion("No existe evidencia de pago aprobado");
  }
  if (transactionId && String(pago.transactionId) !== String(transactionId)) {
    throw crearErrorValidacion("La transacción no coincide con el pago verificado");
  }
  return { tenant: data, pago };
};

module.exports = {
  validarTenantParaProvision,
  validarEvidenciaPagoParaActivacion,
};
