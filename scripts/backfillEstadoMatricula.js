#!/usr/bin/env node
/**
 * BACKFILL — materializa `estadoMatricula:'activo'` en documentos de `estudiantes` que
 * todavia no tienen el campo.
 *
 * POR QUE EXISTE
 * --------------
 * `tipos.ts::Estudiante.estadoMatricula` es ahora un campo obligatorio (SDD
 * pricing-cupo-real, Bloque 1) del que dependera `facturacion-metered` (bloque posterior)
 * para decidir que estudiante es facturable. `crearEstudiante` ya lo estampa en las altas
 * nuevas (functions/academico/estudiantes.js), pero eso NO toca los documentos que ya
 * existian en Firestore antes de este cambio -- este script es la otra mitad.
 *
 * Regla de ausencia (D3 del diseno, openspec/changes/pricing-cupo-real/design.md):
 * ausencia TOTAL de valor => 'activo', NUNCA 'retirado'. Un default 'retirado' ocultaria a
 * todo estudiante existente del club (no solo de la facturacion) -- un incidente de
 * visibilidad de datos, no un simple ajuste de cobro.
 *
 * USO
 * ---
 *   # 1) Diagnostico. NO escribe nada. Es el modo por defecto, a proposito.
 *   GOOGLE_APPLICATION_CREDENTIALS=/ruta/sa.json \
 *     node scripts/backfillEstadoMatricula.js --proyecto tudojang
 *
 *   # 2) Aplicar, una vez leido el diagnostico. Re-ejecutable sin riesgo (ver GARANTIAS).
 *   GOOGLE_APPLICATION_CREDENTIALS=/ruta/sa.json \
 *     node scripts/backfillEstadoMatricula.js --proyecto tudojang --aplicar
 *
 *   # Acotado a un solo club:
 *   ... --proyecto tudojang --tenant tenant-gajog
 *
 * GARANTIAS
 * ---------
 * - Dry-run por defecto: sin `--aplicar` no se escribe absolutamente nada.
 * - Idempotente: correrlo dos veces deja el mismo resultado; la segunda no cambia nada.
 * - Nunca pisa un valor existente: si el documento YA tiene `estadoMatricula` (aunque sea
 *   'retirado', o cualquier otro valor inesperado), se deja intacto -- este script rellena
 *   lo ausente, nunca corrige ni reinterpreta lo que ya esta escrito.
 * - Minimo: escribe SOLO `estadoMatricula` con `update` (no `set`), asi que ningun otro
 *   campo del estudiante (historialPagos, progreso, asistencia) se toca.
 */

// ---------------------------------------------------------------------------
// Logica pura -- sin Firebase, para poder probarla de verdad.
// ---------------------------------------------------------------------------

/**
 * Decide si UN documento de estudiante necesita el backfill.
 *
 * @returns {{cambios: {estadoMatricula: 'activo'}}|null} `null` si el documento ya tiene
 *   CUALQUIER valor en `estadoMatricula` (no se toca); el plan de cambio en caso contrario.
 */
function planificarBackfill(datos) {
  if (datos && datos.estadoMatricula !== undefined) return null;
  return { cambios: { estadoMatricula: 'activo' } };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parsearArgumentos(argv) {
  const leer = (bandera) => {
    const i = argv.indexOf(bandera);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  return {
    proyecto: leer('--proyecto'),
    tenant: leer('--tenant'),
    aplicar: argv.includes('--aplicar'),
  };
}

const LIMITE_LOTE = 400; // Firestore admite 500 por batch; margen para no rozar el limite.

async function backfillEstadoMatricula({ firestore, tenant, aplicar, log = console.log }) {
  let consulta = firestore.collection('estudiantes');
  if (tenant) consulta = consulta.where('tenantId', '==', tenant);

  const snap = await consulta.get();
  const documentos = snap.docs.map((d) => ({ id: d.id, datos: d.data() }));

  log(`Documentos leidos: ${documentos.length}${tenant ? ` (tenant ${tenant})` : ''}`);

  const pendientes = [];
  for (const doc of documentos) {
    const plan = planificarBackfill(doc.datos);
    if (plan) pendientes.push({ id: doc.id, ...plan });
  }

  // El denominador antes que el numerador: "0 a completar" sobre 0 documentos leidos es un
  // resultado muy distinto de "0 a completar" sobre 500 (ahi ya corrio antes, o el filtro
  // de --tenant esta mal escrito).
  log(`  ya tenian estadoMatricula: ${documentos.length - pendientes.length}`);
  log(`  sin estadoMatricula (a completar): ${pendientes.length}`);
  log('');

  log(`Documentos a completar: ${pendientes.length}`);
  for (const p of pendientes) {
    log(`  ${p.id}  estadoMatricula: (ausente) -> "${p.cambios.estadoMatricula}"`);
  }

  if (!aplicar) {
    log('');
    log('DRY-RUN: no se escribio nada. Volve a correr con --aplicar para persistirlo.');
    return { leidos: documentos.length, corregidos: 0, pendientes: pendientes.length };
  }

  let escritos = 0;
  for (let i = 0; i < pendientes.length; i += LIMITE_LOTE) {
    const lote = firestore.batch();
    for (const p of pendientes.slice(i, i + LIMITE_LOTE)) {
      lote.update(firestore.collection('estudiantes').doc(p.id), p.cambios);
    }
    await lote.commit();
    escritos += Math.min(LIMITE_LOTE, pendientes.length - i);
  }

  log('');
  log(`Listo: ${escritos} documento(s) completado(s).`);
  return { leidos: documentos.length, corregidos: escritos, pendientes: pendientes.length };
}

async function main() {
  const { proyecto, tenant, aplicar } = parsearArgumentos(process.argv.slice(2));

  if (!proyecto) {
    console.error('Falta --proyecto <projectId>.');
    console.error('Ej: node scripts/backfillEstadoMatricula.js --proyecto tudojang');
    process.exit(1);
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Falta GOOGLE_APPLICATION_CREDENTIALS apuntando al JSON de la service account.');
    process.exit(1);
  }

  const { default: admin } = await import('firebase-admin');
  admin.initializeApp({ projectId: proyecto });

  console.log(aplicar ? '=== MODO APLICAR (escribe) ===' : '=== DRY-RUN (no escribe) ===');
  await backfillEstadoMatricula({ firestore: admin.firestore(), tenant, aplicar });
}

// Solo corre el CLI cuando se invoca el archivo directamente; importarlo desde el test no
// dispara nada (equivalente ESM de `require.main === module`).
if (process.argv[1] && process.argv[1].endsWith('backfillEstadoMatricula.js')) {
  main().catch((err) => {
    console.error('El backfill fallo:', err);
    process.exit(1);
  });
}

export {
  planificarBackfill,
  parsearArgumentos,
  backfillEstadoMatricula,
};
