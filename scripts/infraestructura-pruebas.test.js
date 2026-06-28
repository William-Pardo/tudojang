import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const jestConfig = read('jest.config.js');
const packageJson = JSON.parse(read('package.json'));
const tsconfig = JSON.parse(read('tsconfig.json'));

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
