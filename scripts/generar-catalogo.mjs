import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { escanearMarcadores, fusionarCatalogo, leerNucleoManual } from './lib/catalogo-fuente.mjs';

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const outputRootIndex = args.indexOf('--output-root');
const outputRoot = outputRootIndex >= 0 ? path.resolve(args[outputRootIndex + 1]) : process.cwd();
const sourceRootIndex = args.indexOf('--source-root');
const sourceRoot = sourceRootIndex >= 0 ? path.resolve(args[sourceRootIndex + 1]) : process.cwd();

function serialize(catalog) {
    return `${JSON.stringify(catalog)}\n`;
}

function checksum(serialized) {
    return createHash('sha256').update(serialized).digest('hex');
}

async function loadCatalog() {
    // Escanea marcadores primero: es sincronico y falla rapido (D3/D9). El nucleo manual se lee
    // despues, via `catalogo-fuente.mjs` (la MISMA lectura que consume el gate de rutas), para
    // que generador y gate jamas puedan ver catalogos distintos (design.md, "Technical Approach").
    const marcadores = escanearMarcadores({ root: sourceRoot });
    const nucleo = await leerNucleoManual({ root: sourceRoot });
    return fusionarCatalogo(nucleo, marcadores);
}

function assertCatalog(catalog) {
    const semver = /^\d+\.\d+\.\d+$/;
    if (
        !catalog
        || catalog.schemaVersion !== 1
        || !semver.test(catalog.catalogVersion)
        || !catalog.roles
        || !Array.isArray(catalog.routes)
        || !Array.isArray(catalog.entries)
        || catalog.entries.length === 0
    ) {
        throw new Error('Catálogo inválido: se esperaban schemaVersion 1 y al menos una entrada.');
    }
    const ids = new Set();
    for (const entry of catalog.entries) {
        const requiredArrays = ['aliases', 'actions', 'roles', 'steps', 'sourceFiles'];
        const requiredStrings = ['id', 'inventoryId', 'module', 'label', 'intent', 'route', 'authorizationRef', 'owner'];
        if (
            requiredArrays.some(field => !Array.isArray(entry[field]) || entry[field].length === 0)
            || requiredStrings.some(field => typeof entry[field] !== 'string' || !entry[field].trim())
            || ids.has(entry.id)
            || !catalog.routes.includes(entry.route)
            || entry.roles.some(role => catalog.roles[role]?.status !== 'active')
        ) {
            throw new Error(`Catálogo inválido en la entrada ${entry.id || 'sin-id'}.`);
        }
        ids.add(entry.id);
    }
}

function expectedFiles(catalog) {
    const json = serialize(catalog);
    const hash = `${checksum(json)}\n`;
    return new Map([
        [path.join(outputRoot, 'public/generated/soporte/catalogo.v1.json'), json],
        [path.join(outputRoot, 'public/generated/soporte/catalogo.v1.sha256'), hash],
        [path.join(outputRoot, 'functions/generated/soporte/catalogo.v1.json'), json],
        [path.join(outputRoot, 'functions/generated/soporte/catalogo.v1.sha256'), hash],
    ]);
}

function checkFiles(files) {
    const drift = [];
    for (const [filePath, expected] of files) {
        if (!existsSync(filePath) || readFileSync(filePath, 'utf8') !== expected) {
            drift.push(path.relative(outputRoot, filePath));
        }
    }
    if (drift.length > 0) {
        console.error(`Catalog drift detected: ${drift.join(', ')}`);
        process.exitCode = 1;
    }
}

function writeFiles(files) {
    for (const [filePath, content] of files) {
        mkdirSync(path.dirname(filePath), { recursive: true });
        writeFileSync(filePath, content, 'utf8');
    }
}

const catalog = await loadCatalog();
assertCatalog(catalog);
const files = expectedFiles(catalog);
if (checkOnly) {
    checkFiles(files);
} else {
    writeFiles(files);
}
