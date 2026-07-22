import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/**
 * `tsconfig.json` es JSONC, no JSON: TypeScript admite comentarios y el proyecto los usa
 * para documentar por que ciertas opciones son carga estructural (ver
 * `allowImportingTsExtensions`). `JSON.parse` los rechaza, asi que se limpian antes.
 *
 * Se recorre caracter por caracter en vez de usar un regex porque un `//` dentro de una
 * cadena (una URL, por ejemplo) no es un comentario y no debe borrarse.
 */
const sinComentarios = (texto) => {
    let salida = '';
    let enCadena = false, escapado = false, enLinea = false, enBloque = false;
    for (let i = 0; i < texto.length; i++) {
        const actual = texto[i];
        const siguiente = texto[i + 1];
        if (enLinea) {
            if (actual === '\n') { enLinea = false; salida += actual; }
            continue;
        }
        if (enBloque) {
            if (actual === '*' && siguiente === '/') { enBloque = false; i++; }
            continue;
        }
        if (enCadena) {
            salida += actual;
            if (escapado) escapado = false;
            else if (actual === '\\') escapado = true;
            else if (actual === '"') enCadena = false;
            continue;
        }
        if (actual === '"') { enCadena = true; salida += actual; continue; }
        if (actual === '/' && siguiente === '/') { enLinea = true; i++; continue; }
        if (actual === '/' && siguiente === '*') { enBloque = true; i++; continue; }
        salida += actual;
    }
    return salida;
};

const jestConfig = read('jest.config.js');
const packageJson = JSON.parse(read('package.json'));
const tsconfig = JSON.parse(sinComentarios(read('tsconfig.json')));

test('Jest solo recoge pruebas de aplicación TS/TSX', () => {
    assert.match(jestConfig, /testMatch:\s*\[[\s\S]*\(test\|spec\)\.\(ts\|tsx\)/);
    assert.match(jestConfig, /testPathIgnorePatterns:[\s\S]*<rootDir>\/functions\//);
    assert.match(jestConfig, /testPathIgnorePatterns:[\s\S]*<rootDir>\/scripts\//);
});

test('cada runner tiene un comando independiente', () => {
    assert.equal(packageJson.scripts['test:app'], 'jest --runInBand');
    assert.equal(packageJson.scripts['test:functions'], 'npm --prefix functions test');
    assert.equal(
        packageJson.scripts['test:node'],
        'node --test scripts/*.test.js',
    );
    assert.match(packageJson.scripts['test:all'], /test:app/);
    assert.match(packageJson.scripts['test:all'], /test:functions/);
});

test('TypeScript de aplicación excluye Functions y pruebas Node', () => {
    assert.ok(tsconfig.exclude.includes('functions'));
    assert.ok(tsconfig.exclude.includes('scripts/**/*.test.js'));
    assert.deepEqual(tsconfig.compilerOptions.types, [
        'jest',
        'node',
        '@testing-library/jest-dom',
    ]);
});
