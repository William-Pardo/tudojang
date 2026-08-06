'use strict';

// functions/vigilanciaFacturacion.js
// SDD pricing-cupo-real (Bloque 3b, D5 "Growth guardrail placement", design.md): reemplaza el
// tope duro de matricula que existia en academico/estudiantes.js (eliminado en este mismo
// bloque, ver 3.9/3.10) por un guardrail que SOLO notifica -- nunca bloquea ni revierte
// ninguna matricula (capacidad-tenant, Scenario "Crecimiento anomalo dispara alerta, no
// bloqueo": "el club MUST seguir operando sin restriccion").
//
// Por que un cron diario y no un hook dentro de crearEstudiante (D5): crearEstudiante es un
// hot path (ModalImportacionMasiva.tsx lo llama una vez por fila de CSV) -- un hook ahi
// dispararia N lecturas y N alertas duplicadas para UNA sola importacion. Ademas no puede ver
// CAIDAS (señal S3), que es la superficie de exploit real ("retirar antes del corte,
// reactivar despues" -- ver design.md, Risks). Factory-DI, mismo estilo que
// wompiCobroAutomatico.js::crearServicioCobroAutomaticoMensual: cada corrida de tenant esta
// aislada en su propio try/catch, un tenant que falla nunca aborta el resto del batch.
//
// Umbrales en functions/vigilancia-config.json (capacidad-tenant: "Umbral configurable") --
// un archivo NUEVO y separado de functions/facturacion-config.json (Bloque 2, no reabierto
// aca): D1 fija ese archivo como "la unica fuente de precios/tramos de facturacion", y estos
// umbrales de guardrail no son ni un precio ni un tramo de facturacion, son un parametro de
// deteccion de anomalias -- una decision de scope, no una obligacion tecnica.

const config = require('./vigilancia-config.json');
const { normalizarFecha } = require('./wompiCobroAutomatico');

const ZONA_HORARIA = 'America/Bogota';
const MS_POR_DIA = 24 * 60 * 60 * 1000;

// Formatea una fecha a YYYY-MM-DD en hora Bogota -- mismo patron (Intl.DateTimeFormat +
// formatToParts, locale 'en-CA') que academico/recordatoriosPago.js::periodoBogota, extendido
// a nivel de dia. Colombia no observa horario de verano, asi que restar N*MS_POR_DIA de un
// instante UTC y reformatear siempre cae en el dia calendario correcto N dias antes.
function fechaBogota(fecha) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const partes = Object.fromEntries(formatter.formatToParts(fecha).map((p) => [p.type, p.value]));
  return `${partes.year}-${partes.month}-${partes.day}`;
}

function haceNDias(fecha, n) {
  return new Date(fecha.getTime() - n * MS_POR_DIA);
}

// Fix facturacion-periodo-vs-snapshot: mismo calculo que
// wompiCobroAutomatico.js::calcularInicioPeriodoFacturable -- aproxima el inicio del periodo
// de facturacion actual como `fechaVencimiento` MENOS 1 mes calendario (no hay un campo
// persistido de "inicio del periodo anterior"; aproximacion deliberada, simple y
// conservadora, misma que ya usa el cobro real). DUPLICADA aca a proposito -- ver la nota
// "cada Cloud Function es un archivo autocontenido" mas abajo -- en vez de importada desde
// wompiCobroAutomatico.js. Reusa normalizarFecha (ya importado arriba) para aceptar tanto
// Timestamp de Firestore como string 'YYYY-MM-DD'.
function calcularInicioPeriodoFacturable(fechaVencimientoValor) {
  const fechaVencimiento = normalizarFecha(fechaVencimientoValor);
  if (!fechaVencimiento) return null;
  return new Date(
    fechaVencimiento.getFullYear(),
    fechaVencimiento.getMonth() - 1,
    fechaVencimiento.getDate()
  );
}

// null si el tenant no tiene fechaVencimiento (o no es parseable) -- S3 exige un valor no-null
// (historial corto/dato faltante es inerte), asi que un tenant sin fecha de corte simplemente
// nunca dispara esa señal, sin lanzar.
function calcularDiasHastaCorte(fechaVencimientoRaw, ahora) {
  const fecha = normalizarFecha(fechaVencimientoRaw);
  if (!fecha) return null;
  return Math.ceil((fecha.getTime() - ahora.getTime()) / MS_POR_DIA);
}

/**
 * Evalua las 3 señales de crecimiento/caida anomala (D5, design.md) sobre valores YA
 * resueltos -- pura, nunca toca Firestore ni fechas (eso lo resuelve el llamador). Ausencia de
 * dato historico (`nAyer`/`nHace7d`/`diasHastaCorte` null) para una señal puntual la deja
 * inerte, nunca lanza (design.md, Testing Strategy: "empty/short history is inert").
 *
 * - S1 `nHoy >= max(pisoAbsoluto, nHace7d * factorDuplicacion)`: duplicacion sobre una base no
 *   trivial. El piso absoluto evita ruido en numeros chicos (3->6 durante onboarding).
 * - S2 `nHoy - nAyer >= incrementoDiarioMaximo`: un salto de un solo dia (script o import
 *   masivo legitimo -- informa, no bloquea).
 * - S3 `nHoy <= nHace7d * factorCaida` Y `diasHastaCorte <= umbral`: el exploit
 *   "retirar antes del corte, reactivar despues" que el snapshot-sin-prorrateo abre.
 *
 * @param {{nHoy:number, nAyer:number|null, nHace7d:number|null, diasHastaCorte:number|null, config:Object}} entrada
 * @returns {{s1:boolean, s2:boolean, s3:boolean, disparaAlguna:boolean}}
 */
function evaluarSenalesCrecimiento({ nHoy, nAyer, nHace7d, diasHastaCorte, config: cfg }) {
  const { pisoAbsoluto, factorDuplicacion, incrementoDiarioMaximo } = cfg.umbralCrecimiento;
  const { factorCaida, diasHastaCorte: diasHastaCorteUmbral } = cfg.umbralCaida;

  const s1 = nHace7d != null && nHoy >= Math.max(pisoAbsoluto, nHace7d * factorDuplicacion);
  const s2 = nAyer != null && nHoy - nAyer >= incrementoDiarioMaximo;
  const s3 =
    nHace7d != null &&
    nHace7d > 0 &&
    nHoy <= nHace7d * factorCaida &&
    diasHastaCorte != null &&
    diasHastaCorte <= diasHastaCorteUmbral;

  return { s1, s2, s3, disparaAlguna: s1 || s2 || s3 };
}

/**
 * Cron diario `vigilarCrecimientoFacturable` (D5): por cada tenant, cuenta estudiantes
 * facturables HOY, compara contra el historial (ayer / hace 7 dias por fecha, no por indice
 * fijo -- robusto ante una corrida que se salta un dia), evalua las 3 señales, y si alguna
 * dispara notifica al rol SuperAdmin (deduplicado 24h vía `ultimaAlertaEnviada`). El historial
 * de HOY se agrega siempre, dispare o no una señal -- recortado a `config.historialMaximo`
 * entradas. NUNCA bloquea, revierte ni modifica ninguna matricula -- solo lee/escribe
 * `facturacion_vigilancia/{tenantId}` y notifica.
 */
function crearServicioVigilarCrecimientoFacturable({
  listarTenants,
  contarEstudiantesFacturables,
  leerHistorialVigilancia,
  guardarHistorialVigilancia,
  notificarAlerta,
}) {
  return async function vigilarCrecimientoFacturable(ahora = new Date()) {
    const docs = await listarTenants();

    let revisados = 0;
    let alertados = 0;
    let deduped = 0;

    const fechaHoy = fechaBogota(ahora);
    const fechaAyer = fechaBogota(haceNDias(ahora, 1));
    const fechaHace7d = fechaBogota(haceNDias(ahora, 7));

    for (const doc of docs) {
      const tenantId = doc.id;
      const tenant = doc.data() || {};

      try {
        // Fix facturacion-periodo-vs-snapshot: se le pasa la propia fechaVencimiento del
        // tenant -- es el input que contarEstudiantesFacturables necesita para calcular el
        // inicio del periodo actual (ver calcularInicioPeriodoFacturable), mismo criterio
        // que cobroAutomaticoMensual (wompiCobroAutomatico.js) ya aplica para el cobro real.
        const nHoy = await contarEstudiantesFacturables(tenantId, tenant.fechaVencimiento);
        const { historial, ultimaAlertaEnviada } = await leerHistorialVigilancia(tenantId);

        // Lookup por FECHA, no por indice fijo del array -- si el cron se salto un dia (falla
        // transitoria, deploy, etc.), un lookup por `historial[length-2]` apuntaria al dia
        // equivocado; por fecha exacta, simplemente no encuentra dato y la señal queda inerte.
        const porFecha = new Map((historial || []).map((h) => [h.fecha, h.facturables]));
        const nAyer = porFecha.has(fechaAyer) ? porFecha.get(fechaAyer) : null;
        const nHace7d = porFecha.has(fechaHace7d) ? porFecha.get(fechaHace7d) : null;
        const diasHastaCorte = calcularDiasHastaCorte(tenant.fechaVencimiento, ahora);

        const senales = evaluarSenalesCrecimiento({ nHoy, nAyer, nHace7d, diasHastaCorte, config });

        // Una corrida repetida el MISMO dia calendario reemplaza la entrada de hoy en vez de
        // duplicarla -- mantiene el invariante "una entrada por fecha" del que dependen los
        // lookups de ayer/hace-7-dias en corridas futuras.
        const historialSinHoy = (historial || []).filter((h) => h.fecha !== fechaHoy);
        const nuevoHistorial = [...historialSinHoy, { fecha: fechaHoy, facturables: nHoy }].slice(
          -config.historialMaximo
        );

        let nuevaUltimaAlerta = ultimaAlertaEnviada ?? null;

        if (senales.disparaAlguna) {
          const dedupeMs = config.dedupeHoras * 60 * 60 * 1000;
          const dentroDeDedupe =
            ultimaAlertaEnviada != null && ahora.getTime() - new Date(ultimaAlertaEnviada).getTime() < dedupeMs;

          if (dentroDeDedupe) {
            deduped += 1;
          } else {
            await notificarAlerta({ tenantId, tenant, nHoy, nAyer, nHace7d, diasHastaCorte, senales });
            nuevaUltimaAlerta = ahora.toISOString();
            alertados += 1;
          }
        }

        await guardarHistorialVigilancia(tenantId, {
          historial: nuevoHistorial,
          ultimaAlertaEnviada: nuevaUltimaAlerta,
        });
        revisados += 1;
      } catch (error) {
        // Mismo criterio que cobroAutomaticoMensual: un fallo inesperado en UN tenant (ej.
        // .count() no disponible) no debe abortar el resto del batch -- se loguea y se
        // reintenta en la corrida de mañana. Este guardrail NUNCA debe convertirse el mismo
        // en un punto de fallo que bloquee la operacion de otros tenants.
        console.error(`[vigilarCrecimientoFacturable] Error inesperado procesando ${tenantId}:`, error);
      }
    }

    return { tenants: docs.length, revisados, alertados, deduped };
  };
}

// Cuenta estudiantes FACTURABLES de un tenant en el período actual sumando DOS agregaciones
// `.count()` de Firestore -- NUNCA un `.get()` completo; este cron corre una vez al dia por
// CADA tenant, no solo los que tienen `cobroAutomaticoActivo`, así que la eficiencia de
// `.count()` importa igual:
//   1) estadoMatricula=='activo' HOY.
//   2) estadoMatricula=='retirado' Y fechaRetiro >= inicio del período actual.
//
// Fix facturacion-periodo-vs-snapshot: ANTES esto era solo (1), una foto puntual del momento
// exacto de la corrida diaria -- permitía que un tenant diera de alta un estudiante, lo
// retirara antes de esa corrida y lo reingresara después, de forma que ese estudiante nunca
// coincidiera "activo" el día exacto de la corrida y nunca disparara este guardrail pese a
// haber usado la plataforma la mayor parte del período (mismo patrón de abuso que cerró el
// fix homónimo en wompiCobroAutomatico.js para el cobro real). (2) cierra ese hueco: un
// retiro DENTRO del período actual sigue contando para ESE período, aproximado con
// `calcularInicioPeriodoFacturable` (fechaVencimiento del propio tenant menos 1 mes
// calendario). `fechaRetiro` se guarda como string ISO 8601 (servicios/estudiantesApi.ts,
// retirarEstudiante) -- comparar con `>=` funciona porque ISO 8601 ordena lexicográficamente
// igual que cronológicamente, siempre que el límite del período también se construya como
// ISO string (toISOString()), lo que hace acá.
//
// Mismo patrón (independiente, sin módulo compartido -- ver la nota en wompiCobroAutomatico.js
// y academico/estudiantes.js, que definen su propia copia de esta misma query por la misma
// razón que este archivo no comparte `evaluarSenalesCrecimiento`/`fechaBogota` con esos
// módulos: cada Cloud Function es un archivo autocontenido en este repo). Este fix vive
// también acá (antes vivía SOLO en wompiCobroAutomatico.js -- este guardrail, notify-only,
// había quedado desincronizado con el conteo real de facturación).
function crearContadorEstudiantesFacturablesFirestore(firestore) {
  return async function contarEstudiantesFacturables(tenantId, fechaVencimiento) {
    const snapshotActivos = await firestore
      .collection('estudiantes')
      .where('tenantId', '==', tenantId)
      .where('estadoMatricula', '==', 'activo')
      .count()
      .get();
    const activos = snapshotActivos.data().count;

    const inicioPeriodo = calcularInicioPeriodoFacturable(fechaVencimiento);
    if (!inicioPeriodo) return activos;

    const snapshotRetiradosEnPeriodo = await firestore
      .collection('estudiantes')
      .where('tenantId', '==', tenantId)
      .where('estadoMatricula', '==', 'retirado')
      .where('fechaRetiro', '>=', inicioPeriodo.toISOString())
      .count()
      .get();

    return activos + snapshotRetiradosEnPeriodo.data().count;
  };
}

// Lista TODOS los tenants -- a diferencia del conteo de estudiantes, esto es cardinalidad de
// TENANT (no de estudiante), y el guardrail necesita evaluar cada uno sin importar si tiene
// `cobroAutomaticoActivo` (la anomalia de matricula es independiente de si el cobro esta
// prendido). Mismo patrón de `.get()` sobre `tenants` que
// wompiCobroAutomatico.js::crearListadoTenantsPendientesDeCobroFirestore usa (con un filtro
// distinto) -- la colección `tenants` es chica comparada con `estudiantes`.
function crearListadoTenantsFirestore(firestore) {
  return async function listarTenants() {
    const snapshot = await firestore.collection('tenants').get();
    return snapshot.docs;
  };
}

// D6, design.md "Guardrail history storage": facturacion_vigilancia/{tenantId}, server-only
// (firestore.rules, allow read/write: if false -- ver 3.5b/3.6b). Un tenant sin historial
// previo (primera corrida) devuelve el estado inicial, nunca lanza.
function crearLectorHistorialVigilanciaFirestore(firestore) {
  return async function leerHistorialVigilancia(tenantId) {
    const snapshot = await firestore.collection('facturacion_vigilancia').doc(tenantId).get();
    if (!snapshot.exists) return { historial: [], ultimaAlertaEnviada: null };

    const datos = snapshot.data() || {};
    return {
      historial: Array.isArray(datos.historial) ? datos.historial : [],
      ultimaAlertaEnviada: datos.ultimaAlertaEnviada ?? null,
    };
  };
}

function crearGuardadorHistorialVigilanciaFirestore(firestore) {
  return async function guardarHistorialVigilancia(tenantId, datos) {
    await firestore.collection('facturacion_vigilancia').doc(tenantId).set(datos, { merge: true });
  };
}

module.exports = {
  crearServicioVigilarCrecimientoFacturable,
  crearListadoTenantsFirestore,
  crearContadorEstudiantesFacturablesFirestore,
  crearLectorHistorialVigilanciaFirestore,
  crearGuardadorHistorialVigilanciaFirestore,
  evaluarSenalesCrecimiento,
  calcularInicioPeriodoFacturable,
  fechaBogota,
};
