#!/usr/bin/env node
/**
 * MIGRACION — normaliza `correo` y `tutor.correo` en la coleccion `estudiantes`.
 *
 * POR QUE EXISTE
 * --------------
 * `resolveLinkedStudent` resuelve los hijos de un acudiente con
 * `where('tutor.correo', '==', <email de Auth>)`, y ese email llega en minusculas. La
 * igualdad de Firestore es EXACTA y SENSIBLE A MAYUSCULAS, asi que un documento guardado
 * con "Papa@Gajog.com" no matchea nunca: el padre entra y ve una pantalla vacia, sin error
 * y sin log. Lo mismo pasa en `firestore.rules` (lineas 182, 183, 489, 496), que compara
 * esos correos contra `request.auth.token.email` -- con datos en mayusculas fallan las dos
 * capas por la misma razon.
 *
 * El alta ya quedo arreglada (functions/academico/estudiantes.js::normalizarCorreos, y
 * components/ModalImportacionMasiva.tsx), pero eso NO toca los documentos ya guardados.
 * Este script es la otra mitad.
 *
 * USO
 * ---
 *   # 1) Diagnostico. NO escribe nada. Es el modo por defecto, a proposito.
 *   GOOGLE_APPLICATION_CREDENTIALS=/ruta/sa.json \
 *     node scripts/normalizar-correos.js --proyecto tudojang
 *
 *   # 2) Aplicar, una vez leido el diagnostico.
 *   GOOGLE_APPLICATION_CREDENTIALS=/ruta/sa.json \
 *     node scripts/normalizar-correos.js --proyecto tudojang --aplicar
 *
 *   # Acotado a un solo club:
 *   ... --proyecto tudojang --tenant tenant-gajog
 *
 * GARANTIAS
 * ---------
 * - Dry-run por defecto: sin `--aplicar` no se escribe absolutamente nada.
 * - Idempotente: correrlo dos veces deja el mismo resultado; la segunda no cambia nada.
 * - Minimo: solo escribe los campos que efectivamente cambian, con `update` (no `set`), asi
 *   que ningun otro campo del estudiante se toca.
 * - Reporta colisiones: si al normalizar dos alumnos distintos quedan con el mismo `correo`,
 *   lo avisa en vez de seguir de largo (no las resuelve: eso es decision humana).
 */

// ---------------------------------------------------------------------------
// Logica pura -- sin Firebase, para poder probarla de verdad.
// ---------------------------------------------------------------------------

const normalizar = (valor) =>
  typeof valor === 'string' ? valor.toLowerCase().trim() : undefined;

/**
 * Decide que hay que cambiar en UN documento de estudiante.
 *
 * Devuelve `null` si el documento ya esta bien (asi el llamador ni lo encola), o un objeto
 * con SOLO los campos a actualizar, en notacion de field path para que `update()` no pise
 * el resto del objeto `tutor`.
 *
 * @returns {{cambios: Record<string, string>, detalle: Array<{campo: string, de: string, a: string}>}|null}
 */
function planificarNormalizacion(datos) {
  const cambios = {};
  const detalle = [];

  const correoAlumno = datos && datos.correo;
  if (typeof correoAlumno === 'string') {
    const limpio = normalizar(correoAlumno);
    if (limpio !== correoAlumno) {
      cambios.correo = limpio;
      detalle.push({ campo: 'correo', de: correoAlumno, a: limpio });
    }
  }

  const correoTutor = datos && datos.tutor && datos.tutor.correo;
  if (typeof correoTutor === 'string') {
    const limpio = normalizar(correoTutor);
    if (limpio !== correoTutor) {
      // Field path anidado: actualiza SOLO ese campo y deja intacto el resto de `tutor`
      // (nombres, telefono, identificacion). Un `update({tutor: {...}})` lo reemplazaria.
      cambios['tutor.correo'] = limpio;
      detalle.push({ campo: 'tutor.correo', de: correoTutor, a: limpio });
    }
  }

  return detalle.length > 0 ? { cambios, detalle } : null;
}

/**
 * Detecta alumnos distintos que, DESPUES de normalizar, comparten el mismo `correo`.
 *
 * No lo arregla -- solo lo reporta. Dos alumnos con el mismo correo pueden romper la
 * resolucion de identidad del rol Estudiante (`resolveStudentsForConsultor` con
 * esTutor=false devolveria dos registros), y decidir cual es el bueno no es algo que
 * un script deba hacer solo.
 *
 * Ojo: colisiones en `tutor.correo` son NORMALES y esperables -- un padre con dos hijos.
 * Por eso solo se mira el correo del alumno.
 */
function detectarColisionesDeCorreo(documentos) {
  const porCorreo = new Map();

  for (const { id, datos } of documentos) {
    const limpio = normalizar(datos && datos.correo);
    if (!limpio) continue;
    porCorreo.set(limpio, [...(porCorreo.get(limpio) || []), id]);
  }

  return [...porCorreo.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([correo, ids]) => ({ correo, ids }));
}

/**
 * Cuenta cuantos documentos tienen SIQUIERA los campos que esta migracion normaliza.
 *
 * Por que hace falta: "0 documentos a corregir" es ambiguo. Puede significar que todo esta
 * bien, o que el campo no existe en ningun lado -- y lo segundo es un problema peor, porque
 * `resolveLinkedStudent` tampoco encontraria nada. Sin el denominador, el diagnostico no
 * dice nada. (Se descubrio corriendo el diagnostico real contra produccion el 2026-07-22:
 * dio "0 a corregir" sobre 11 documentos y no habia forma de saber cual de los dos casos era.)
 */
function resumirCobertura(documentos) {
  const resumen = {
    total: documentos.length,
    conCorreoAlumno: 0,
    sinObjetoTutor: 0,
    tutorSinCorreo: 0,
    conCorreoTutor: 0,
    porTenant: {},
  };

  for (const { datos } of documentos) {
    const tenant = (datos && datos.tenantId) || '(sin tenant)';
    // Por tenant se lleva total Y cuantos tienen acudiente: un club donde la mayoria de los
    // alumnos no tiene `tutor.correo` no puede mostrarle nada a ningun padre, aunque los
    // correos que existan esten perfectamente normalizados.
    const t = resumen.porTenant[tenant] || { total: 0, conTutorCorreo: 0 };
    t.total += 1;
    if (datos && datos.tutor && typeof datos.tutor.correo === 'string' && datos.tutor.correo.trim()) {
      t.conTutorCorreo += 1;
    }
    resumen.porTenant[tenant] = t;

    if (datos && typeof datos.correo === 'string' && datos.correo.trim()) {
      resumen.conCorreoAlumno += 1;
    }

    if (!datos || !datos.tutor) resumen.sinObjetoTutor += 1;
    else if (typeof datos.tutor.correo !== 'string' || !datos.tutor.correo.trim()) {
      resumen.tutorSinCorreo += 1;
    } else resumen.conCorreoTutor += 1;
  }

  return resumen;
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

async function migrar({ firestore, tenant, aplicar, log = console.log }) {
  let consulta = firestore.collection('estudiantes');
  if (tenant) consulta = consulta.where('tenantId', '==', tenant);

  const snap = await consulta.get();
  const documentos = snap.docs.map((d) => ({ id: d.id, datos: d.data() }));

  log(`Documentos leidos: ${documentos.length}${tenant ? ` (tenant ${tenant})` : ''}`);

  // El denominador antes que el numerador: sin esto, "0 a corregir" es ambiguo.
  const cobertura = resumirCobertura(documentos);
  log('');
  log('Cobertura de los campos que esta migracion normaliza:');
  log(`  con correo de alumno:    ${cobertura.conCorreoAlumno}`);
  log(`  con tutor.correo usable: ${cobertura.conCorreoTutor}`);
  log(`  SIN objeto tutor:        ${cobertura.sinObjetoTutor}`);
  log(`  tutor SIN correo:        ${cobertura.tutorSinCorreo}`);
  log(`  por tenant:              ${JSON.stringify(cobertura.porTenant)}`);
  log('');

  const pendientes = [];
  for (const doc of documentos) {
    const plan = planificarNormalizacion(doc.datos);
    if (plan) pendientes.push({ id: doc.id, ...plan });
  }

  const colisiones = detectarColisionesDeCorreo(documentos);

  log(`Documentos a corregir: ${pendientes.length}`);
  for (const p of pendientes) {
    for (const d of p.detalle) {
      log(`  ${p.id}  ${d.campo}: "${d.de}" -> "${d.a}"`);
    }
  }

  if (colisiones.length > 0) {
    log('');
    log(`ATENCION -- ${colisiones.length} correo(s) de ALUMNO quedan duplicados al normalizar:`);
    for (const c of colisiones) log(`  "${c.correo}" en: ${c.ids.join(', ')}`);
    log('Esto NO lo resuelve el script: revisar a mano cual registro corresponde.');
  }

  if (!aplicar) {
    log('');
    log('DRY-RUN: no se escribio nada. Volve a correr con --aplicar para persistirlo.');
    return { leidos: documentos.length, corregidos: 0, pendientes: pendientes.length, colisiones };
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
  log(`Listo: ${escritos} documento(s) actualizado(s).`);
  return { leidos: documentos.length, corregidos: escritos, pendientes: pendientes.length, colisiones };
}

async function main() {
  const { proyecto, tenant, aplicar } = parsearArgumentos(process.argv.slice(2));

  if (!proyecto) {
    console.error('Falta --proyecto <projectId>.');
    console.error('Ej: node scripts/normalizar-correos.js --proyecto tudojang');
    process.exit(1);
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Falta GOOGLE_APPLICATION_CREDENTIALS apuntando al JSON de la service account.');
    process.exit(1);
  }

  const { default: admin } = await import('firebase-admin');
  admin.initializeApp({ projectId: proyecto });

  console.log(aplicar ? '=== MODO APLICAR (escribe) ===' : '=== DRY-RUN (no escribe) ===');
  await migrar({ firestore: admin.firestore(), tenant, aplicar });
}

// Solo corre el CLI cuando se invoca el archivo directamente; importarlo desde el test no
// dispara nada (equivalente ESM de `require.main === module`).
if (process.argv[1] && process.argv[1].endsWith('normalizar-correos.js')) {
  main().catch((err) => {
    console.error('La migracion fallo:', err);
    process.exit(1);
  });
}

export {
  planificarNormalizacion,
  resumirCobertura,
  detectarColisionesDeCorreo,
  parsearArgumentos,
  migrar,
};
