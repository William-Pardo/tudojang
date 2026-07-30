// Modulo compartido de fuente del catalogo de soporte (marcadores vivos).
//
// Lo consumen AMBOS ejecutables (generar-catalogo.mjs y el gate de rutas) para que jamas
// puedan ver catalogos distintos -- una fuente de deriva seria el propio remedio (ver
// openspec/changes/catalogo-soporte-marcadores-vivos/design.md).
//
// Regla de oro (D3): las vistas jamas se ejecutan. `escanearMarcadores` lee `soporteMeta`
// solo por AST de TypeScript (`ts.createSourceFile`); nunca `ts.transpileModule` + `import`
// sobre un archivo de `vistas/`/`components/` -- eso es justo lo que rompe por JSX y globals
// de navegador (ver fixture marcador-jsx-pesado).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const DIRECTORIOS_IGNORADOS = new Set(['node_modules', '.claude', '__mocks__', '__fixtures__', '.git']);
const ARCHIVO_CON_MARCADOR = /\.tsx?$/;
const ARCHIVO_DE_PRUEBA = /\.(test|spec)\./;
const TAGS_REACT_ROUTER_EXCLUIDOS = new Set(['Route', 'Routes', 'Navigate', 'Outlet']);

function aPosix(rutaSistema) {
  return rutaSistema.split(path.sep).join('/');
}

function ubicacionDeNodo(sourceFile, nodo) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(nodo.getStart(sourceFile));
  return { linea: line + 1, columna: character + 1 };
}

function fallaDura(archivo, sourceFile, nodo, mensaje) {
  const { linea, columna } = ubicacionDeNodo(sourceFile, nodo);
  return new Error(`${archivo}:${linea}:${columna}: ${mensaje}`);
}

// --- Evaluador estatico de literales (D3) --------------------------------------------------
//
// Solo acepta string/number/boolean/null, array y objeto literal (desenvolviendo
// `as`/`satisfies`/parentesis). Cualquier otra cosa -- identificador, spread, llamada,
// template con sustitucion o clave computada -- es una falla dura con archivo:linea:columna
// y el SyntaxKind del nodo rechazado.

function desenvolverExpresion(nodo) {
  let actual = nodo;
  while (
    ts.isParenthesizedExpression(actual)
    || ts.isAsExpression(actual)
    || ts.isSatisfiesExpression(actual)
  ) {
    actual = actual.expression;
  }
  return actual;
}

function evaluarLiteral(nodo, sourceFile, archivo) {
  const actual = desenvolverExpresion(nodo);

  if (actual.kind === ts.SyntaxKind.NullKeyword) return null;
  if (actual.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (actual.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isStringLiteral(actual) || ts.isNoSubstitutionTemplateLiteral(actual)) return actual.text;
  if (ts.isNumericLiteral(actual)) return Number(actual.text);
  if (
    ts.isPrefixUnaryExpression(actual)
    && actual.operator === ts.SyntaxKind.MinusToken
    && ts.isNumericLiteral(actual.operand)
  ) {
    return -Number(actual.operand.text);
  }

  if (ts.isArrayLiteralExpression(actual)) {
    return actual.elements.map((elemento) => evaluarLiteral(elemento, sourceFile, archivo));
  }

  if (ts.isObjectLiteralExpression(actual)) {
    const resultado = {};
    for (const propiedad of actual.properties) {
      if (!ts.isPropertyAssignment(propiedad)) {
        throw fallaDura(
          archivo,
          sourceFile,
          propiedad,
          `valor no literal en soporteMeta: no se admite ${ts.SyntaxKind[propiedad.kind]} dentro de un objeto literal`,
        );
      }
      if (propiedad.name.kind === ts.SyntaxKind.ComputedPropertyName) {
        throw fallaDura(archivo, sourceFile, propiedad.name, 'valor no literal en soporteMeta: clave computada no permitida');
      }
      const clave = ts.isIdentifier(propiedad.name) || ts.isStringLiteral(propiedad.name)
        ? propiedad.name.text
        : propiedad.name.getText(sourceFile);
      resultado[clave] = evaluarLiteral(propiedad.initializer, sourceFile, archivo);
    }
    return resultado;
  }

  throw fallaDura(
    archivo,
    sourceFile,
    actual,
    `valor no literal en soporteMeta: se esperaba string/number/boolean/null/array/objeto, se encontro ${ts.SyntaxKind[actual.kind]}`,
  );
}

// --- Colisiones de id/inventoryId, acumuladas y reportadas juntas --------------------------
//
// Un CI que revela un error por corrida es un CI que se corre cinco veces (design.md, seccion
// "Fusion"): se juntan TODAS las colisiones antes de fallar, en vez de abortar en la primera.

function detectarColisiones(candidatos) {
  const ubicacionPorId = new Map();
  const ubicacionPorInventoryId = new Map();
  const mensajes = [];

  for (const candidato of candidatos) {
    if (ubicacionPorId.has(candidato.id)) {
      mensajes.push(`id duplicado "${candidato.id}": ${ubicacionPorId.get(candidato.id)} y ${candidato.ubicacion}`);
    } else {
      ubicacionPorId.set(candidato.id, candidato.ubicacion);
    }

    if (ubicacionPorInventoryId.has(candidato.inventoryId)) {
      mensajes.push(
        `inventoryId duplicado "${candidato.inventoryId}": ${ubicacionPorInventoryId.get(candidato.inventoryId)} y ${candidato.ubicacion}`,
      );
    } else {
      ubicacionPorInventoryId.set(candidato.inventoryId, candidato.ubicacion);
    }
  }

  if (mensajes.length > 0) {
    throw new Error(`Colisiones de id/inventoryId en el catalogo de soporte:\n- ${mensajes.join('\n- ')}`);
  }
}

// --- Escaneo de marcadores (escanearMarcadores) ----------------------------------------------

function listarArchivosFuente(directorioAbsoluto) {
  const resultado = [];

  function recorrer(dir) {
    let entradas;
    try {
      entradas = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // directorio inexistente (p.ej. `components/` todavia no existe en este repo)
    }
    for (const entrada of entradas) {
      if (entrada.isDirectory()) {
        if (DIRECTORIOS_IGNORADOS.has(entrada.name)) continue;
        recorrer(path.join(dir, entrada.name));
      } else if (entrada.isFile()) {
        if (!ARCHIVO_CON_MARCADOR.test(entrada.name)) continue;
        if (ARCHIVO_DE_PRUEBA.test(entrada.name)) continue;
        resultado.push(path.join(dir, entrada.name));
      }
    }
  }

  recorrer(directorioAbsoluto);
  return resultado;
}

function marcadoresDeArchivo(archivoRelativo, rutaAbsoluta, texto) {
  const sourceFile = ts.createSourceFile(rutaAbsoluta, texto, ts.ScriptTarget.ES2022, false, ts.ScriptKind.TSX);
  const encontrados = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const modificadores = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    const esExportado = (modificadores ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!esExportado) continue;

    for (const declaracion of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaracion.name) || declaracion.name.text !== 'soporteMeta' || !declaracion.initializer) {
        continue;
      }

      const valor = evaluarLiteral(declaracion.initializer, sourceFile, archivoRelativo);
      const lista = Array.isArray(valor) ? valor : [valor];
      const expresionDesenvuelta = desenvolverExpresion(declaracion.initializer);
      const nodosElementos = ts.isArrayLiteralExpression(expresionDesenvuelta)
        ? expresionDesenvuelta.elements
        : [declaracion.initializer];

      lista.forEach((entrada, indice) => {
        const nodo = nodosElementos[indice] ?? declaracion.initializer;
        const { linea, columna } = ubicacionDeNodo(sourceFile, nodo);
        encontrados.push({ archivo: archivoRelativo, entrada, linea, columna });
      });
    }
  }

  return encontrados;
}

function verificarAutorreferencia(marcador) {
  const { archivo, entrada, linea, columna } = marcador;
  const sourceFiles = Array.isArray(entrada.sourceFiles) ? entrada.sourceFiles.map(aPosix) : [];
  if (!sourceFiles.includes(archivo)) {
    throw new Error(
      `${archivo}:${linea}:${columna}: la entrada "${entrada.id}" no incluye su propio archivo (${archivo}) en `
      + `sourceFiles (D9, anti-huerfano); declara sourceFiles=${JSON.stringify(entrada.sourceFiles ?? [])}`,
    );
  }
}

/**
 * Escanea `dirs` (por defecto, el propio `root`) en busca de exports `soporteMeta` y los
 * evalua por AST puro, sin ejecutar ningun modulo de vista.
 *
 * @param {{ root: string, dirs?: string[] }} opciones
 * @returns {Array<{ archivo: string, entrada: object, linea: number, columna: number }>}
 *   Ordenado por ruta relativa POSIX (comparacion byte a byte) y, dentro de cada archivo, por
 *   orden de declaracion en el array de `soporteMeta`.
 */
export function escanearMarcadores({ root, dirs } = {}) {
  const directorios = (dirs && dirs.length > 0 ? dirs : ['.']).map((dir) => path.resolve(root, dir));
  const archivosAbsolutos = [...new Set(directorios.flatMap(listarArchivosFuente))];

  const archivos = archivosAbsolutos
    .map((abs) => ({ abs, rel: aPosix(path.relative(root, abs)) }))
    .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));

  const encontrados = [];
  for (const { abs, rel } of archivos) {
    const texto = readFileSync(abs, 'utf8');
    // Pre-filtro barato (design.md): si el texto no contiene la subcadena, ni se parsea.
    if (!texto.includes('soporteMeta')) continue;

    const marcadores = marcadoresDeArchivo(rel, abs, texto);
    for (const marcador of marcadores) {
      verificarAutorreferencia(marcador); // D9: falla dura inmediata, es un chequeo por-entrada
      encontrados.push(marcador);
    }
  }

  detectarColisiones(
    encontrados.map((m) => ({
      id: m.entrada.id,
      inventoryId: m.entrada.inventoryId,
      ubicacion: `${m.archivo}:${m.linea}:${m.columna}`,
    })),
  );

  return encontrados;
}

// --- Escaneo de App.tsx (leerRutasApp) --------------------------------------------------------
//
// Dos pasadas sobre el mismo SourceFile: (1) mapa de imports -- para saber a que archivo
// resuelve cada identificador JSX usado como componente, y cuales identificadores vienen de
// `react-router-dom`; (2) recorrido de rutas -- cada <Route> real produce pares {route, archivo}.

function resolverEspecificadorRelativo(root, especificador) {
  const base = path.resolve(root, especificador);
  const candidatos = [`${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')];
  const encontrado = candidatos.find((candidato) => existsSync(candidato));
  return aPosix(path.relative(root, encontrado ?? `${base}.tsx`));
}

function construirMapaImports(sourceFile, root) {
  const componentePorNombre = new Map();
  let namespaceReactRouter = null;
  const nombresReactRouter = new Set();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const especificador = statement.moduleSpecifier.text;
    const clause = statement.importClause;

    if (especificador === 'react-router-dom') {
      if (clause.name) nombresReactRouter.add(clause.name.text);
      if (clause.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) {
          namespaceReactRouter = clause.namedBindings.name.text;
        } else if (ts.isNamedImports(clause.namedBindings)) {
          for (const elemento of clause.namedBindings.elements) nombresReactRouter.add(elemento.name.text);
        }
      }
      continue;
    }

    if (!especificador.startsWith('.')) continue; // solo resolvemos specifiers relativos a archivo

    const rutaResuelta = resolverEspecificadorRelativo(root, especificador);
    if (clause.name) componentePorNombre.set(clause.name.text, rutaResuelta);
    if (clause.namedBindings) {
      if (ts.isNamespaceImport(clause.namedBindings)) {
        componentePorNombre.set(clause.namedBindings.name.text, rutaResuelta);
      } else if (ts.isNamedImports(clause.namedBindings)) {
        for (const elemento of clause.namedBindings.elements) componentePorNombre.set(elemento.name.text, rutaResuelta);
      }
    }
  }

  return { componentePorNombre, namespaceReactRouter, nombresReactRouter };
}

function nombreSimpleDeTag(tagName) {
  if (ts.isIdentifier(tagName)) return tagName.text;
  if (ts.isPropertyAccessExpression(tagName) && ts.isIdentifier(tagName.name)) return tagName.name.text;
  return null;
}

function calificadorDeTag(tagName) {
  return ts.isPropertyAccessExpression(tagName) && ts.isIdentifier(tagName.expression)
    ? tagName.expression.text
    : null;
}

function esTagRoute(tagName) {
  const nombre = nombreSimpleDeTag(tagName);
  return typeof nombre === 'string' && nombre.endsWith('Route');
}

function esTagReactRouterExcluido(tagName, mapaImports) {
  const nombre = nombreSimpleDeTag(tagName);
  if (!nombre || !TAGS_REACT_ROUTER_EXCLUIDOS.has(nombre)) return false;
  const calificador = calificadorDeTag(tagName);
  if (calificador) return calificador === mapaImports.namespaceReactRouter;
  return mapaImports.nombresReactRouter.has(nombre);
}

function archivoDeTag(tagName, mapaImports, archivoPropio) {
  const nombre = nombreSimpleDeTag(tagName);
  if (!nombre) return archivoPropio;
  return mapaImports.componentePorNombre.get(nombre) ?? archivoPropio;
}

function recolectarTagsJsx(nodo, salida) {
  if (ts.isJsxSelfClosingElement(nodo) || ts.isJsxOpeningElement(nodo)) {
    salida.push(nodo.tagName);
  }
  ts.forEachChild(nodo, (hijo) => recolectarTagsJsx(hijo, salida));
}

function obtenerAtributo(nodoRoute, nombre) {
  return nodoRoute.attributes.properties.find(
    (attr) => ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name) && attr.name.text === nombre,
  );
}

/**
 * Lee `${root}/${archivo}` (por defecto `App.tsx`) y devuelve los pares {route, archivo} de
 * cada <Route> real que monta: path literal, "*" excluido, rutas de layout sin `path`
 * salteadas (pero sus hijas anidadas se siguen recorriendo), y el subarbol COMPLETO de un
 * `element` ternario (excluyendo tags de react-router-dom).
 *
 * @param {{ root: string, archivo?: string }} opciones
 * @returns {Array<{ route: string, archivo: string }>}
 */
export function leerRutasApp({ root, archivo = 'App.tsx' } = {}) {
  const rutaAbsoluta = path.resolve(root, archivo);
  const texto = readFileSync(rutaAbsoluta, 'utf8');
  const sourceFile = ts.createSourceFile(rutaAbsoluta, texto, ts.ScriptTarget.ES2022, false, ts.ScriptKind.TSX);
  const mapaImports = construirMapaImports(sourceFile, root);
  const archivoPropio = aPosix(path.relative(root, rutaAbsoluta));

  const pares = [];

  function procesarRoute(nodoRoute) {
    const atributoPath = obtenerAtributo(nodoRoute, 'path');
    if (!atributoPath || !atributoPath.initializer || !ts.isStringLiteral(atributoPath.initializer)) return;
    const rutaTexto = atributoPath.initializer.text;
    if (rutaTexto === '*') return;

    const atributoElement = obtenerAtributo(nodoRoute, 'element');
    if (
      !atributoElement
      || !atributoElement.initializer
      || !ts.isJsxExpression(atributoElement.initializer)
      || !atributoElement.initializer.expression
    ) {
      return;
    }

    const tags = [];
    recolectarTagsJsx(atributoElement.initializer.expression, tags);
    for (const tag of tags) {
      if (esTagReactRouterExcluido(tag, mapaImports)) continue;
      pares.push({ route: rutaTexto, archivo: archivoDeTag(tag, mapaImports, archivoPropio) });
    }
  }

  function recorrer(nodo) {
    if ((ts.isJsxSelfClosingElement(nodo) || ts.isJsxOpeningElement(nodo)) && esTagRoute(nodo.tagName)) {
      procesarRoute(nodo);
    }
    ts.forEachChild(nodo, recorrer);
  }

  recorrer(sourceFile);
  return pares;
}
