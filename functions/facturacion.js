'use strict';

// functions/facturacion.js — CJS puro, espejo exacto de utils/facturacion.ts (TS). Ver
// openspec/changes/pricing-cupo-real/design.md D1: el contrato de calculo es JSON versionado
// (facturacion-config.json) + DOS implementaciones delgadas que iteran el mismo archivo de
// vectores dorados (facturacion-vectores.json), NO un modulo compartido -- el repo raiz es ESM
// ("type":"module"), tsconfig.json excluye `functions/` con allowJs:false, y jest.config.js
// solo transforma `.tsx?`. Cualquier cambio aca DEBE reflejarse en utils/facturacion.ts o las
// dos suites (facturacion.test.js / facturacion.test.ts) divergen -- esa divergencia ES la
// senal que este diseno busca, no un bug a esconder.
//
// Ambas funciones son PURAS: nunca tocan Firestore. Eso es lo que permite que el cron de
// cobro (functions/wompiCobroAutomatico.js, Bloque 3) y la calculadora publica
// (utils/facturacion.ts via components/PrecioCalculadora.tsx, Bloque 4) compartan
// exactamente el mismo contrato sin reimplementarlo.

const config = require('./facturacion-config.json');

/**
 * Decide el `estadoMatricula` efectivo de un documento de estudiante. Ausencia TOTAL de
 * valor (documento legacy sin backfill, o documento no provisto) => 'activo' -- unico lugar
 * del repo donde vive esta regla de default (D3, design.md). Cualquier valor explicito
 * DISTINTO de 'retirado' tambien cae a 'activo': esta funcion nunca inventa un tercer estado.
 *
 * @param {{estadoMatricula?: string}|null|undefined} doc
 * @returns {'activo'|'retirado'}
 */
function normalizarEstadoMatricula(doc) {
  return doc && doc.estadoMatricula === 'retirado' ? 'retirado' : 'activo';
}

/**
 * Definicion de "facturable" (matricula-estado-estudiante): un estudiante es facturable si y
 * solo si su estadoMatricula normalizado es 'activo', sin importar estadoPago ni asistencia.
 *
 * @param {{estadoMatricula?: string}|null|undefined} estudiante
 * @returns {boolean}
 */
function esFacturable(estudiante) {
  return normalizarEstadoMatricula(estudiante) === 'activo';
}

/**
 * Capacidad de sede/equipo tecnico de un tenant (capacidad-tenant: fuente unica de verdad).
 * Pura: NUNCA recibe ni lee un conteo de estudiantes -- el bono de sede se otorga una sola
 * vez, vive en un flag persistido (`sedeBonusOtorgada`), y esta funcion solo LEE ese flag;
 * jamas lo recalcula desde un conteo en vivo (D4, design.md). Los 3 campos de entrada son
 * ADITIVOS/opcionales en ConfiguracionClub -- ausentes en un tenant legacy => false/0.
 *
 * @param {{sedeBonusOtorgada?: boolean, sedesExtraContratadas?: number, equipoTecnicoExtraContratado?: number}} tenant
 * @returns {{sedes: number, equipoTecnico: number, estudiantes: null}}
 */
function calcularCapacidad(tenant) {
  const bono = tenant.sedeBonusOtorgada === true ? config.bonoSede.sedesOtorgadas : 0;
  const sedesExtra = Number(tenant.sedesExtraContratadas) || 0;
  const equipoExtra = Number(tenant.equipoTecnicoExtraContratado) || 0;

  return {
    sedes: config.incluido.sedes + bono + sedesExtra,
    equipoTecnico: config.incluido.equipoTecnico + equipoExtra,
    estudiantes: null, // sin tope -- capacidad-tenant: "Sin tope duro de matricula"
  };
}

/**
 * Monto mensual medido (facturacion-metered). Cuando `descuentoVolumenActivo` es false
 * (estado actual), se cobra una tarifa plana `tarifaEstandarPorEstudiante` a todos los
 * estudiantes. Cuando es true, es marginal/progresivo por tramo: cada estudiante paga la
 * tarifa de SU propio tramo y los tramos ya cruzados nunca se recalculan a la tarifa nueva
 * (spec Scenario "Tenant que cruza un tramo"). Extras de sede y equipo tecnico se suman sin
 * descuento por volumen, independientes de los tramos o de la tarifa plana.
 *
 * @param {{estudiantesFacturables: number, sedesExtraContratadas: number, equipoTecnicoExtraContratado: number}} entrada
 */
function calcularFacturacionMensual(entrada) {
  const totalEstudiantes = Number(entrada.estudiantesFacturables) || 0;
  const sedesExtra = Number(entrada.sedesExtraContratadas) || 0;
  const equipoExtra = Number(entrada.equipoTecnicoExtraContratado) || 0;

  const tramos = [];
  let subtotalEstudiantes = 0;

  if (config.descuentoVolumenActivo === false) {
    // Descuento por volumen deshabilitado temporalmente (no eliminado): tarifa plana
    // para todos los estudiantes. tramosEstudiantes queda intacto en el JSON para
    // reactivar el esquema marginal con solo volver descuentoVolumenActivo a true.
    const tarifa = config.tarifaEstandarPorEstudiante;
    subtotalEstudiantes = totalEstudiantes * tarifa;
    if (totalEstudiantes > 0) {
      tramos.push({ desde: 1, hasta: totalEstudiantes, cantidad: totalEstudiantes, tarifa, subtotal: subtotalEstudiantes });
    }
  } else {
    let restantes = totalEstudiantes;
    for (const tramo of config.tramosEstudiantes) {
      if (restantes <= 0) break;
      const tope = tramo.hasta === null ? Infinity : tramo.hasta;
      const capacidadTramo = tope - tramo.desde + 1;
      const cantidad = Math.min(restantes, capacidadTramo);
      const subtotal = cantidad * tramo.tarifa;

      tramos.push({ desde: tramo.desde, hasta: tramo.hasta, cantidad, tarifa: tramo.tarifa, subtotal });
      subtotalEstudiantes += subtotal;
      restantes -= cantidad;
    }
  }

  const sedesExtraSubtotal = sedesExtra * config.extras.sede;
  const equipoExtraSubtotal = equipoExtra * config.extras.equipoTecnico;

  return {
    estudiantes: { cantidad: totalEstudiantes, subtotal: subtotalEstudiantes, tramos },
    sedesExtra: { cantidad: sedesExtra, subtotal: sedesExtraSubtotal },
    equipoTecnicoExtra: { cantidad: equipoExtra, subtotal: equipoExtraSubtotal },
    totalPesos: subtotalEstudiantes + sedesExtraSubtotal + equipoExtraSubtotal,
  };
}

module.exports = {
  calcularFacturacionMensual,
  calcularCapacidad,
  esFacturable,
  normalizarEstadoMatricula,
};
