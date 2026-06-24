import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const outputRootIndex = args.indexOf('--output-root');
const outputRoot = outputRootIndex >= 0 ? path.resolve(args[outputRootIndex + 1]) : process.cwd();
const sourcePath = path.resolve('shared/soporte/catalogo.v1.ts');
const tempPath = path.join(tmpdir(), `catalogo-v1-${process.pid}-${Date.now()}.mjs`);

function serialize(catalog) {
    return `${JSON.stringify(catalog)}\n`;
}

function checksum(serialized) {
    return createHash('sha256').update(serialized).digest('hex');
}

async function loadCatalog() {
    const source = readFileSync(sourcePath, 'utf8');
    const transpiled = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
        },
        fileName: sourcePath,
    });
    writeFileSync(tempPath, transpiled.outputText, 'utf8');
    try {
        const module = await import(`${pathToFileURL(tempPath).href}?v=${Date.now()}`);
        return module.CATALOGO_SOPORTE_V1;
    } finally {
        rmSync(tempPath, { force: true });
    }
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
        || catalog.entries.length !== 48
    ) {
        throw new Error('Catálogo inválido: se esperaban schemaVersion 1 y 48 entradas.');
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
