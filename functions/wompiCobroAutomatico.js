'use strict';

// Cobro automático mensual vía Wompi (Colombia no tiene suscripciones nativas): el flujo
// es tokenizar la tarjeta una vez en el frontend -> crear un payment_source reutilizable
// (crearFuentePagoWompi) -> un cron propio cobra mensualmente contra ese payment_source
// (cobroAutomaticoMensual). El webhookWompi existente (index.js) reconcilia el resultado
// cuando Wompi notifica `transaction.updated` (misma ruta que el checkout manual).

const axios = require('axios');

const WOMPI_API_BASE = 'https://production.wompi.co/v1';

// Debe coincidir con CONFIGURACION_WOMPI.publicKey en constantes.ts (raíz del repo).
// functions/ es JS puro y no puede importar ese archivo TS del frontend.
const WOMPI_PUBLIC_KEY = 'pub_prod_2XIISLESsoU3kWMce51HMChsMdr1tzVB';

// SDD pricing-cupo-real (Bloque 3b, facturacion-metered): el monto ya NO se infiere del plan
// del tenant (planes-config.json) -- se MIDE con la misma funcion pura que usa la calculadora
// publica (D1, design.md). `calcularFacturacionMensual` nunca toca Firestore; el conteo de
// estudiantes facturables y los extras contratados se resuelven aca (I/O) y se le pasan como
// entrada. `precio`/`totalPesos` estan en pesos COP (no centavos); la conversión a
// amount_in_cents (*100) espeja construirUrlCheckoutWompi en servicios/wompiApi.ts.
const { calcularFacturacionMensual } = require('./facturacion');

const MAX_INTENTOS_FALLIDOS = 3;

const crearError = (code, message) => Object.assign(new Error(message), { code });

function requireAuth(context) {
  if (!context?.auth?.uid) {
    throw crearError('unauthenticated', 'Usuario no autenticado');
  }
  return context.auth;
}

// SuperAdmin opera cross-tenant por diseño (mismo criterio que en usuarios.js /
// datosDemoProgreso.js); Admin queda acotado a su propio tenant.
function assertTenantAutorizado(tenantId, auth) {
  if (auth.token?.rol === 'SuperAdmin') return;
  if (!tenantId || tenantId !== auth.token?.tenantId) {
    throw crearError('permission-denied', 'Tenant no autorizado');
  }
}

// Registrar una fuente de pago activa el débito automático mensual sobre TODA la
// facturación del tenant (plan + addons) sin intervención manual futura -- mismo criterio
// de sensibilidad que assertEsAdmin en usuarios.js. Editor/Asistente/Maestro no deben
// poder comprometer el medio de pago del tenant.
function assertEsAdmin(auth) {
  const rol = auth.token?.rol;
  if (rol !== 'Admin' && rol !== 'SuperAdmin') {
    throw crearError('permission-denied', 'Solo un administrador puede activar el cobro automático');
  }
}

// `fechaVencimiento` conviene tratarla como Firestore Timestamp (así la escribe
// webhookWompi al reconciliar un pago), pero tenants creados/editados desde el frontend
// (registrarNuevaEscuela en servicios/configuracionApi.ts) la guardan como string
// ('YYYY-MM-DD'). Normalizamos ambos casos acá para poder comparar de forma confiable.
function normalizarFecha(valor) {
  if (!valor) return null;
  if (typeof valor?.toDate === 'function') return valor.toDate();
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function extraerMensajeErrorWompi(error) {
  const errorWompi = error?.response?.data?.error;
  const mensajeWompi = errorWompi?.reason || errorWompi?.type || errorWompi?.message;
  if (mensajeWompi) return mensajeWompi;
  if (error?.message) return error.message;
  return 'Error desconocido al comunicarse con Wompi';
}

// Misma conversión que construirUrlCheckoutWompi en servicios/wompiApi.ts:
// amountInCents = Math.round(montoEnPesos * 100). `resultadoFacturacion` es el
// ResultadoFacturacion que devuelve calcularFacturacionMensual (facturacion.js, Bloque 2) --
// esta función es el único paso de esa función pura hacia Wompi (que exige centavos enteros).
function calcularMontoFacturableCentavos(resultadoFacturacion) {
  return Math.round(resultadoFacturacion.totalPesos * 100);
}

// Formato pedido: SUSC_<tenantId>_auto_mensual_recurrente_<timestamp>. El tenantId real
// (ver servicios/configuracionApi.ts: `tnt-${Date.now()}`) tiene forma tnt-<dígitos> y
// nunca contiene "_", así que sigue siendo compatible con el regex /tnt-\d+/ que usa
// webhookWompi para extraerlo, y el split('_') sigue dejando "mensual" como segmento
// exacto para el chequeo `segmentosRef.includes('mensual')` que decide el período.
function construirReferenciaCobroAutomatico(tenantId, timestamp) {
  return `SUSC_${tenantId}_auto_mensual_recurrente_${timestamp}`;
}

/**
 * Callable `crearFuentePagoWompi`: recibe un token de tarjeta ya tokenizado por el
 * frontend y crea un payment_source reutilizable en Wompi, dejando al tenant listo para
 * el cobro automático mensual.
 */
function crearServicioCrearFuentePagoWompi({ firestore, wompiPrivateKey }) {
  return async function crearFuentePagoWompi(data, context) {
    const auth = requireAuth(context);
    const tenantId = String(data?.tenantId || '').trim();
    const token = String(data?.token || '').trim();

    if (!tenantId) {
      throw crearError('invalid-argument', 'El tenant es obligatorio');
    }
    assertTenantAutorizado(tenantId, auth);
    assertEsAdmin(auth);

    if (!token) {
      throw crearError('invalid-argument', 'El token de tarjeta es obligatorio');
    }

    const privateKey = wompiPrivateKey();
    if (!privateKey) {
      throw crearError('failed-precondition', 'La llave privada de Wompi no está configurada');
    }

    const tenantRef = firestore.collection('tenants').doc(tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) {
      throw crearError('not-found', 'Tenant no encontrado');
    }

    const tenant = tenantSnap.data();
    const emailClub = tenant?.emailClub;
    if (!emailClub) {
      throw crearError(
        'failed-precondition',
        'El tenant no tiene un email de contacto (emailClub) configurado'
      );
    }

    let merchantData;
    try {
      const respuestaMerchant = await axios.get(`${WOMPI_API_BASE}/merchants/${WOMPI_PUBLIC_KEY}`);
      merchantData = respuestaMerchant?.data?.data;
    } catch (error) {
      throw crearError(
        'unavailable',
        `No fue posible consultar el comercio en Wompi: ${extraerMensajeErrorWompi(error)}`
      );
    }

    const acceptanceToken = merchantData?.presigned_acceptance?.acceptance_token;
    const personalAuthToken = merchantData?.presigned_personal_data_auth?.acceptance_token;
    if (!acceptanceToken || !personalAuthToken) {
      throw crearError('unavailable', 'Wompi no devolvió los tokens de aceptación requeridos');
    }

    let paymentSourceId;
    try {
      const respuestaPaymentSource = await axios.post(
        `${WOMPI_API_BASE}/payment_sources`,
        {
          type: 'CARD',
          token,
          customer_email: emailClub,
          acceptance_token: acceptanceToken,
          accept_personal_auth: personalAuthToken,
        },
        { headers: { Authorization: `Bearer ${privateKey}` } }
      );
      paymentSourceId = respuestaPaymentSource?.data?.data?.id;
    } catch (error) {
      throw crearError(
        'internal',
        `Wompi rechazó la creación de la fuente de pago: ${extraerMensajeErrorWompi(error)}`
      );
    }

    if (!paymentSourceId) {
      throw crearError('internal', 'Wompi no devolvió un identificador de fuente de pago válido');
    }

    // wompiPaymentSourceId vive en el subdocumento privado (no en tenants/{tenantId} raíz)
    // porque ese doc principal es legible por `allow get` a cualquier usuario autenticado del
    // tenant (Instructor/Editor/Asistente/Maestro incluidos) -- ver firestore.rules
    // `match /tenants/{tenantId}/privado/{docId}`, acotado a Admin/SuperAdmin. `merge: true`
    // porque el subdocumento puede no existir todavía (primera vez que este tenant activa
    // cobro automático).
    await tenantRef.collection('privado').doc('facturacion').set(
      { wompiPaymentSourceId: paymentSourceId },
      { merge: true }
    );
    await tenantRef.update({
      cobroAutomaticoActivo: true,
      cobroAutomaticoIntentosFallidos: 0,
    });

    return { ok: true, wompiPaymentSourceId: paymentSourceId };
  };
}

/**
 * Dispara un cobro (POST /v1/transactions) contra un payment_source ya existente.
 * Devuelve siempre un resultado (nunca lanza): { estado: 'APPROVED'|'PENDING'|'DECLINED'|'ERROR', ... }.
 */
async function crearTransaccionRecurrenteWompi({
  amountInCents,
  reference,
  customerEmail,
  paymentSourceId,
  wompiPrivateKey,
}) {
  try {
    const respuesta = await axios.post(
      `${WOMPI_API_BASE}/transactions`,
      {
        amount_in_cents: amountInCents,
        currency: 'COP',
        customer_email: customerEmail,
        reference,
        payment_method: { installments: 1 },
        payment_source_id: paymentSourceId,
      },
      { headers: { Authorization: `Bearer ${wompiPrivateKey}` } }
    );

    const transaccion = respuesta?.data?.data;
    const estado = transaccion?.status;
    if (estado === 'APPROVED' || estado === 'PENDING') {
      return { estado, transactionId: transaccion?.id };
    }
    return { estado: estado || 'DECLINED', mensaje: `Wompi devolvió estado ${estado || 'desconocido'}` };
  } catch (error) {
    return { estado: 'ERROR', mensaje: extraerMensajeErrorWompi(error) };
  }
}

/**
 * Cron diario `cobroAutomaticoMensual`: cobra a todo tenant con `cobroAutomaticoActivo`
 * cuya `fechaVencimiento` ya pasó. Un cobro APPROVED/PENDING no actualiza nada acá -- se
 * deja que webhookWompi (transaction.updated) reconcilie fechaVencimiento/estadoSuscripcion,
 * igual que el checkout manual. Un DECLINED/ERROR incrementa el contador de intentos
 * fallidos y, al tercer fallo consecutivo, suspende la suscripción y notifica por email.
 *
 * SDD pricing-cupo-real (Bloque 3b, facturacion-metered): el monto ya NO se infiere del plan
 * (`calcularMontoMensualPesos`, eliminada) -- se MIDE por tenant en cada corrida: se cuenta
 * cuántos estudiantes están facturables HOY (snapshot sin prorrateo, spec "Corte de conteo en
 * la fecha de facturación") vía `contarEstudiantesFacturables` (inyectada; producción =
 * agregación `.count()`, ver `crearContadorEstudiantesFacturablesFirestore` más abajo) y se
 * alimenta junto a `sedesExtraContratadas`/`equipoTecnicoExtraContratado` del propio doc del
 * tenant a `calcularFacturacionMensual` (facturacion.js, Bloque 2, pura -- misma función que
 * consume la calculadora pública, D1). Si `contarEstudiantesFacturables` lanza (ej. Firestore
 * no disponible), la excepción sube al `catch` exterior de ESE tenant: no se cobra un monto
 * adivinado -- se loguea y se reintenta mañana, igual que cualquier otro fallo inesperado de
 * este bloque (mismo criterio que un `actualizarTenant` que rechaza).
 */
function crearServicioCobroAutomaticoMensual({
  listarTenantsPendientesDeCobro,
  obtenerWompiPaymentSourceId,
  contarEstudiantesFacturables,
  crearTransaccionWompi,
  actualizarTenant,
  incrementarUno,
  enviarCorreoFalloPago,
  maxIntentosFallidos = MAX_INTENTOS_FALLIDOS,
}) {
  return async function cobroAutomaticoMensual(ahora = new Date()) {
    const docs = await listarTenantsPendientesDeCobro(ahora);

    let exitosos = 0;
    let fallidos = 0;
    let suspendidos = 0;

    for (const doc of docs) {
      const tenantId = doc.id;
      const tenant = doc.data();

      try {
        // wompiPaymentSourceId ya no vive en el doc principal del tenant (fix seguridad
        // 2026-07-18, ver firestore.rules) -- se lee del subdocumento privado
        // tenants/{tenantId}/privado/facturacion. Un tenant sin subdocumento/campo se trata
        // igual que antes: se omite con el mismo log de advertencia.
        const wompiPaymentSourceId = await obtenerWompiPaymentSourceId(tenantId);
        if (!wompiPaymentSourceId) {
          console.error(
            `[cobroAutomaticoMensual] Tenant ${tenantId} tiene cobroAutomaticoActivo pero no tiene wompiPaymentSourceId; se omite.`
          );
          continue;
        }

        // Snapshot del conteo facturable EN ESTE MOMENTO -- sin prorrateo (spec
        // facturacion-metered): un alta a mitad de ciclo cuenta completo, un retiro anterior
        // al corte ya no cuenta (estadoMatricula=='activo' es el filtro de la query, ver
        // crearContadorEstudiantesFacturablesFirestore). sedesExtraContratadas/
        // equipoTecnicoExtraContratado son opcionales/aditivos en tenants/{tenantId} (D7) --
        // calcularFacturacionMensual ya los normaliza a 0 si vienen undefined.
        const estudiantesFacturables = await contarEstudiantesFacturables(tenantId);
        const resultadoFacturacion = calcularFacturacionMensual({
          estudiantesFacturables,
          sedesExtraContratadas: tenant.sedesExtraContratadas,
          equipoTecnicoExtraContratado: tenant.equipoTecnicoExtraContratado,
        });
        const amountInCents = calcularMontoFacturableCentavos(resultadoFacturacion);
        const reference = construirReferenciaCobroAutomatico(tenantId, Date.now());

        let resultado;
        try {
          // crearTransaccionRecurrenteWompi (implementación real) ya atrapa sus propios
          // errores y devuelve { estado: 'ERROR', ... }; este try/catch interno es una
          // red de seguridad extra por si una implementación inyectada distinta (ej. en
          // tests) lanza en vez de devolver un resultado.
          resultado = await crearTransaccionWompi({
            amountInCents,
            reference,
            customerEmail: tenant.emailClub,
            paymentSourceId: wompiPaymentSourceId,
          });
        } catch (error) {
          resultado = { estado: 'ERROR', mensaje: error?.message };
        }

        if (resultado.estado === 'APPROVED' || resultado.estado === 'PENDING') {
          exitosos += 1;
          console.log(
            `[cobroAutomaticoMensual] Cobro ${resultado.estado} para ${tenantId} (${reference}, ${amountInCents} COP centavos); webhookWompi reconciliará al confirmarse.`
          );
          continue;
        }

        fallidos += 1;
        const intentosPrevios = Number(tenant.cobroAutomaticoIntentosFallidos) || 0;
        const intentosActuales = intentosPrevios + 1;
        console.error(
          `[cobroAutomaticoMensual] Cobro fallido para ${tenantId} (intento ${intentosActuales}/${maxIntentosFallidos}): ${resultado.mensaje || 'sin detalle'}`
        );

        const actualizacion = { cobroAutomaticoIntentosFallidos: incrementarUno() };
        const debeSuspender = intentosActuales >= maxIntentosFallidos;
        if (debeSuspender) {
          actualizacion.estadoSuscripcion = 'suspendido';
          // Corta el reintento: si no se desactiva, fechaVencimiento sigue vencida y
          // cobroAutomaticoActivo sigue true, así que la corrida de mañana volvería a
          // encontrar este tenant y reintentaría contra la misma tarjeta rechazada
          // indefinidamente (spam de emails de suspensión incluido). Para reactivar, el
          // tenant debe tokenizar una tarjeta nueva (vuelve a llamar crearFuentePagoWompi).
          actualizacion.cobroAutomaticoActivo = false;
        }

        await actualizarTenant(tenantId, actualizacion);

        if (debeSuspender) {
          suspendidos += 1;
          try {
            await enviarCorreoFalloPago(tenant);
          } catch (error) {
            console.error(
              `[cobroAutomaticoMensual] No fue posible enviar el email de suspensión a ${tenantId}:`,
              error
            );
          }
        }
      } catch (error) {
        // Red de seguridad final: un fallo inesperado (ej. actualizarTenant rechaza) no
        // debe abortar el resto del batch -- el tenant se reintenta en la corrida de mañana
        // (fechaVencimiento sigue vencida hasta un cobro exitoso).
        console.error(`[cobroAutomaticoMensual] Error inesperado procesando ${tenantId}:`, error);
      }
    }

    return { procesados: docs.length, exitosos, fallidos, suspendidos };
  };
}

// Solo filtra por igualdad en Firestore (cobroAutomaticoActivo == true, single-field,
// auto-indexado -- no requiere crear un índice compuesto, y evita el deploy adicional
// que eso implicaría). El corte por fechaVencimiento se hace en memoria con
// normalizarFecha() porque el campo convive en dos tipos distintos según quién lo
// escribió (Timestamp desde webhookWompi, string 'YYYY-MM-DD' desde el frontend) -- un
// where('fechaVencimiento', '<=', ...) de Firestore solo compara contra el tipo que vos
// le pasás y silenciosamente excluye los documentos con el otro tipo.
function crearListadoTenantsPendientesDeCobroFirestore(firestore) {
  return async function listarTenantsPendientesDeCobro(ahora) {
    const snapshot = await firestore
      .collection('tenants')
      .where('cobroAutomaticoActivo', '==', true)
      .get();

    return snapshot.docs.filter((doc) => {
      const fechaVencimiento = normalizarFecha(doc.data()?.fechaVencimiento);
      return Boolean(fechaVencimiento) && fechaVencimiento <= ahora;
    });
  };
}

// Lee wompiPaymentSourceId del subdocumento privado (fix seguridad 2026-07-18: ver
// firestore.rules `match /tenants/{tenantId}/privado/{docId}`). Devuelve null tanto si el
// subdocumento no existe como si existe pero no tiene el campo -- ambos casos los trata
// cobroAutomaticoMensual igual que un tenant sin fuente de pago configurada.
function crearLectorWompiPaymentSourceIdFirestore(firestore) {
  return async function obtenerWompiPaymentSourceId(tenantId) {
    const snapshot = await firestore
      .collection('tenants')
      .doc(tenantId)
      .collection('privado')
      .doc('facturacion')
      .get();

    return snapshot.exists ? snapshot.data()?.wompiPaymentSourceId ?? null : null;
  };
}

// Cuenta estudiantes FACTURABLES (estadoMatricula=='activo') de un tenant vía una agregación
// `.count()` de Firestore -- NO un `.get()` completo (design.md, pricing-cupo-real: este cron
// corre a diario por cada tenant vencido; un `.get()` completo sería N lecturas de documento
// innecesarias solo para saber CUÁNTOS hay, ver EntradaFacturacion.estudiantesFacturables en
// design.md, "un count, NOT a doc list"). El predicado `estadoMatricula=='activo'` es también
// el mecanismo por el que un estudiante retirado antes del corte deja de contar (spec
// facturacion-metered, Scenario "Estudiante retirado antes del corte no se factura") --
// Firestore filtra server-side, no hay lógica JS de exclusión que agregar acá.
//
// Nota operativa (documentada, no adivinada -- ver apply-progress/reporte final): esta query
// asume que `scripts/backfillEstadoMatricula.js` (Bloque 1) ya corrió en producción antes de
// que este lector exista ahí. `normalizarEstadoMatricula` (facturacion.js) trata la AUSENCIA
// del campo como 'activo' para lecturas en memoria de un doc completo, pero Firestore no puede
// expresar "campo ausente OR == 'activo'" en un único `where` de agregación -- el rollout de
// design.md (Migration/Rollout, paso 1) ordena el backfill explícitamente ANTES de que este
// lector se despliegue, precisamente para que este `==` sea exacto.
//
// Mismo patrón (independiente, sin módulo compartido -- ver academico/estudiantes.js y
// vigilanciaFacturacion.js, que definen su propia copia de esta misma query por la misma
// razón que el resto de este archivo no comparte `assertEsAdmin`/`assertTenantAutorizado` con
// esos módulos: cada Cloud Function es un archivo autocontenido en este repo).
function crearContadorEstudiantesFacturablesFirestore(firestore) {
  return async function contarEstudiantesFacturables(tenantId) {
    const snapshot = await firestore
      .collection('estudiantes')
      .where('tenantId', '==', tenantId)
      .where('estadoMatricula', '==', 'activo')
      .count()
      .get();

    return snapshot.data().count;
  };
}

module.exports = {
  crearServicioCrearFuentePagoWompi,
  crearServicioCobroAutomaticoMensual,
  crearListadoTenantsPendientesDeCobroFirestore,
  crearLectorWompiPaymentSourceIdFirestore,
  crearContadorEstudiantesFacturablesFirestore,
  crearTransaccionRecurrenteWompi,
  calcularMontoFacturableCentavos,
  construirReferenciaCobroAutomatico,
  extraerMensajeErrorWompi,
  normalizarFecha,
  WOMPI_PUBLIC_KEY,
  WOMPI_API_BASE,
  MAX_INTENTOS_FALLIDOS,
};
