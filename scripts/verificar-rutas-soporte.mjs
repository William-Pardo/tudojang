#!/usr/bin/env node
// Gate de rutas del catalogo de soporte (openspec/changes/catalogo-soporte-marcadores-vivos,
// Fase 7). Compara, por ARCHIVO enrutado (no por ruta), lo que App.tsx monta efectivamente
// contra la cobertura del catalogo fusionado (nucleo manual + marcadores soporteMeta),
// consumiendo SIEMPRE `scripts/lib/catalogo-fuente.mjs` -- la misma lectura que usa
// generar-catalogo.mjs, para que generador y gate jamas puedan ver catalogos distintos.
//
// Principio rector (design.md): el gate es una funcion pura de (arbol del repo, lista de
// archivos cambiados, baseline del commit base). Todo el plumbing de git vive en el workflow
// (.github/workflows/deploy.yml), nunca aca -- eso lo hace determinista y testeable con
// fixtures sin repositorio git real (ver scripts/verificar-rutas-soporte.test.js).
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { escanearMarcadores, fusionarCatalogo, leerNucleoManual, leerRutasApp } from './lib/catalogo-fuente.mjs';

function aPosix(rutaSistema) {
  return rutaSistema.split(path.sep).join('/');
}

// --- Indice de cobertura por archivo (D9-adjacent: reutiliza sourceFiles del catalogo) --------

function construirIndiceCobertura(catalogo) {
  const indice = new Map();
  for (const entrada of catalogo.entries) {
    const archivos = Array.isArray(entrada.sourceFiles) ? entrada.sourceFiles.map(aPosix) : [];
    for (const archivo of archivos) {
      if (!indice.has(archivo)) indice.set(archivo, []);
      indice.get(archivo).push(entrada);
    }
  }
  return indice;
}

// Escenario (c): ninguno de los roles referenciados por las entradas que cubren un archivo
// tiene status:'active' en ROLES_SOPORTE -- cobertura nominal, cero cobertura real (matcher.ts
// descarta el catalogo local para cualquier rol no activo; ver el bug historico de `Estudiante`
// documentado en shared/soporte/catalogo.v1.ts).
function tieneRolActivo(entradas, roles) {
  const rolesReferenciados = new Set(entradas.flatMap((entrada) => (Array.isArray(entrada.roles) ? entrada.roles : [])));
  return [...rolesReferenciados].some((rol) => roles?.[rol]?.status === 'active');
}

// Escenario (f), D6: `añadidos = actual \ base` sobre `deuda ∪ exentosPermanentes`. Funcion
// pura: no toca disco, no conoce git -- por eso es directamente testeable contra las fixtures
// base/head sin invocar el CLI completo.
export function calcularCrecimientoBaseline(actual, base) {
  const setActual = new Set([...(actual?.deuda ?? []), ...(actual?.exentosPermanentes ?? [])]);
  const setBase = new Set([...(base?.deuda ?? []), ...(base?.exentosPermanentes ?? [])]);
  return [...setActual].filter((elemento) => !setBase.has(elemento)).sort();
}

function cargarBaselineDesdeDisco(root) {
  const ruta = path.resolve(root, 'shared/soporte/deuda-catalogo.json');
  return JSON.parse(readFileSync(ruta, 'utf8'));
}

/**
 * Corre TODOS los chequeos del gate contra `root` y devuelve el resultado, sin tocar
 * `process.exitCode` ni imprimir nada -- eso es responsabilidad exclusiva de `main()`.
 *
 * @param {{
 *   root: string,
 *   changedFiles?: Set<string>,
 *   baselineActual?: object,
 *   baselineBase?: object | null | undefined,
 *   strictBaseline?: boolean,
 * }} opciones
 *   `baselineBase`: `undefined` = flag `--baseline-base` no provisto (se salta el chequeo de
 *   crecimiento por completo); `null` = el flag SI se proveyo pero el archivo no se pudo leer
 *   (bootstrap, D6: "si el archivo no existe en base, se salta con aviso" salvo
 *   `strictBaseline`); objeto parseado = comparacion real.
 * @returns {Promise<{ ok: boolean, errores: string[], avisos: Array<{ archivo: string, mensaje: string }> }>}
 */
export async function verificarRutasSoporte({
  root,
  changedFiles = new Set(),
  baselineActual = null,
  baselineBase = undefined,
  strictBaseline = false,
} = {}) {
  const nucleo = await leerNucleoManual({ root });
  const marcadores = escanearMarcadores({ root });
  const catalogo = fusionarCatalogo(nucleo, marcadores);
  const pares = leerRutasApp({ root });

  const actual = baselineActual ?? cargarBaselineDesdeDisco(root);
  const deudaCongelada = new Set(actual.deuda ?? []);
  const exentos = new Set(actual.exentosPermanentes ?? []);
  const baselineCongelada = new Set([...deudaCongelada, ...exentos]);

  const errores = [];
  const avisos = [];

  // (a) + (c): cobertura por archivo enrutado, deduplicado (un archivo puede aparecer en N
  // pares {route, archivo} -- ver FirmaImagen.tsx/ClaseEnVivoView.tsx en el App.tsx real).
  const indice = construirIndiceCobertura(catalogo);
  const archivosVistos = new Set();
  for (const { route, archivo } of pares) {
    if (archivosVistos.has(archivo)) continue;
    archivosVistos.add(archivo);

    const entradas = indice.get(archivo) ?? [];
    if (entradas.length === 0) {
      if (!baselineCongelada.has(archivo)) {
        errores.push(
          `Archivo enrutado sin cobertura: la ruta "${route}" (${archivo}) no tiene entrada manual ni marcador `
          + 'soporteMeta en el catálogo de soporte, y no está en la línea base de deuda congelada '
          + '(shared/soporte/deuda-catalogo.json).',
        );
      }
      continue;
    }
    if (!tieneRolActivo(entradas, catalogo.roles)) {
      errores.push(
        `Cobertura sin rol activo: la ruta "${route}" (${archivo}) solo tiene entradas cuyos roles están `
        + 'todos inactivos en ROLES_SOPORTE (status !== \'active\'), así que en la práctica no tiene ninguna '
        + 'cobertura real.',
      );
    }
  }

  // (b): cada marcador declara una `route` que debe corresponder a una ruta real de App.tsx.
  const rutasConocidas = new Set(pares.map((par) => par.route));
  for (const marcador of marcadores) {
    const ruta = marcador.entrada.route;
    if (!rutasConocidas.has(ruta)) {
      errores.push(
        `Marcador con ruta no enrutada: el soporteMeta "${marcador.entrada.id}" en ${marcador.archivo} declara `
        + `route="${ruta}", que no corresponde a ningún <Route path> real de App.tsx.`,
      );
    }
  }

  // (d)/(e): aviso no bloqueante SOLO para `deuda` (nunca para `exentosPermanentes`, D5) cuando
  // el archivo routeado ademas aparece en el diff del PR.
  const archivosRouteados = new Set(pares.map((par) => par.archivo));
  for (const archivo of deudaCongelada) {
    if (archivosRouteados.has(archivo) && changedFiles.has(archivo)) {
      avisos.push({
        archivo,
        mensaje: `Archivo en deuda del catálogo de soporte tocado en este cambio: ${archivo}. Considerá migrarlo `
          + 'a un marcador soporteMeta co-locado (ver openspec/changes/catalogo-soporte-migracion-deuda).',
      });
    }
  }

  // (f): la linea base (deuda ∪ exentosPermanentes) solo puede achicarse (D6).
  if (baselineBase !== undefined) {
    if (baselineBase === null) {
      if (strictBaseline) {
        errores.push(
          'No se pudo resolver --baseline-base (archivo ausente o ilegible) con --strict-baseline activo: '
          + 'el chequeo de crecimiento de la línea base no puede omitirse en este modo.',
        );
      }
      // Sin --strict-baseline: bootstrap (PR que introduce el archivo por primera vez), se
      // salta en silencio -- D6.
    } else {
      const agregados = calcularCrecimientoBaseline(actual, baselineBase);
      if (agregados.length > 0) {
        errores.push(
          'La línea base de deuda del catálogo de soporte solo puede achicarse (D6): se agregaron elementos '
          + `en vez de cubrirlos con marcador o entrada manual: ${agregados.join(', ')}.`,
        );
      }
    }
  }

  return { ok: errores.length === 0, errores, avisos };
}

// --- CLI -----------------------------------------------------------------------------------

function leerListaArchivos(rutaTxt) {
  if (!rutaTxt) return new Set();
  try {
    const texto = readFileSync(rutaTxt, 'utf8');
    return new Set(
      texto
        .split('\n')
        .map((linea) => linea.trim())
        .filter(Boolean)
        .map(aPosix),
    );
  } catch {
    return new Set();
  }
}

function leerBaselineBase(rutaJson) {
  if (!rutaJson) return undefined;
  try {
    return JSON.parse(readFileSync(rutaJson, 'utf8'));
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const valorDe = (nombre) => {
    const indice = argv.indexOf(nombre);
    return indice >= 0 ? argv[indice + 1] : undefined;
  };
  return {
    sourceRoot: path.resolve(valorDe('--source-root') ?? process.cwd()),
    changedFilesPath: valorDe('--changed-files'),
    baselineBasePath: valorDe('--baseline-base'),
    strictBaseline: argv.includes('--strict-baseline'),
  };
}

// D7: `::notice file={path},line=1::…` en stdout cuando corre en GitHub Actions -- cero
// permisos adicionales, aparece en la pestaña Files del PR y en la pagina del run. Fuera de CI
// (`GITHUB_ACTIONS` ausente, p.ej. un dry run local) imprime texto plano.
function emitirAviso({ archivo, mensaje }) {
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::notice file=${archivo},line=1::${mensaje}`);
  } else {
    console.log(`[aviso] ${mensaje}`);
  }
}

function emitirError(mensaje) {
  if (process.env.GITHUB_ACTIONS) {
    console.error(`::error::${mensaje}`);
  } else {
    console.error(`[error] ${mensaje}`);
  }
}

function escribirResumenGithub(resultado) {
  const resumenPath = process.env.GITHUB_STEP_SUMMARY;
  if (!resumenPath) return;
  const lineas = [
    '## Gate de rutas del catálogo de soporte',
    resultado.ok ? 'Estado: OK' : 'Estado: FALLÓ',
  ];
  if (resultado.errores.length > 0) {
    lineas.push('### Errores', ...resultado.errores.map((error) => `- ${error}`));
  }
  if (resultado.avisos.length > 0) {
    lineas.push('### Avisos (no bloqueantes)', ...resultado.avisos.map((aviso) => `- ${aviso.mensaje}`));
  }
  appendFileSync(resumenPath, `${lineas.join('\n')}\n`);
}

async function main() {
  const { sourceRoot, changedFilesPath, baselineBasePath, strictBaseline } = parseArgs(process.argv.slice(2));
  const changedFiles = leerListaArchivos(changedFilesPath);
  const baselineBase = leerBaselineBase(baselineBasePath);

  const resultado = await verificarRutasSoporte({
    root: sourceRoot,
    changedFiles,
    baselineBase,
    strictBaseline,
  });

  for (const aviso of resultado.avisos) emitirAviso(aviso);
  for (const error of resultado.errores) emitirError(error);
  escribirResumenGithub(resultado);

  if (!resultado.ok) {
    process.exitCode = 1;
  }
}

// Solo ejecuta main() cuando el archivo corre como CLI (node scripts/verificar-rutas-soporte.mjs
// [...]), nunca cuando se importa desde el test (scripts/verificar-rutas-soporte.test.js importa
// `calcularCrecimientoBaseline` directamente).
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
