import { createHash } from 'node:crypto';
import type { CatalogoSoporte, EntradaCatalogoSoporte } from './tipos';

const SEMVER = /^\d+\.\d+\.\d+$/;
const REQUIRED_ARRAYS: Array<keyof EntradaCatalogoSoporte> = [
    'aliases',
    'actions',
    'roles',
    'steps',
    'sourceFiles',
];
const REQUIRED_STRINGS: Array<keyof EntradaCatalogoSoporte> = [
    'id',
    'inventoryId',
    'module',
    'label',
    'intent',
    'route',
    'escalationReason',
    'authorizationRef',
    'owner',
    'introducedIn',
    'lastVerifiedAt',
];

export function validarCatalogoSoporte(catalog: CatalogoSoporte): string[] {
    const issues: string[] = [];
    const ids = new Set<string>();
    const inventoryIds = new Set<string>();

    if (!SEMVER.test(catalog.catalogVersion)) {
        issues.push(`catalogVersion inválida: ${catalog.catalogVersion}`);
    }
    if (catalog.schemaVersion !== 1) {
        issues.push(`schemaVersion no soportada: ${catalog.schemaVersion}`);
    }

    catalog.entries.forEach((entry, index) => {
        const prefix = `entries[${index}] (${entry.id || 'sin-id'})`;
        REQUIRED_STRINGS.forEach(field => {
            if (typeof entry[field] !== 'string' || !(entry[field] as string).trim()) {
                issues.push(`${prefix}: falta ${field}`);
            }
        });
        REQUIRED_ARRAYS.forEach(field => {
            if (!Array.isArray(entry[field]) || (entry[field] as unknown[]).length === 0) {
                issues.push(`${prefix}: falta ${field}`);
            }
        });

        if (ids.has(entry.id)) issues.push(`${prefix}: id duplicado ${entry.id}`);
        if (inventoryIds.has(entry.inventoryId)) {
            issues.push(`${prefix}: inventoryId duplicado ${entry.inventoryId}`);
        }
        ids.add(entry.id);
        inventoryIds.add(entry.inventoryId);

        if (!catalog.routes.includes(entry.route)) {
            issues.push(`${prefix}: ruta desconocida ${entry.route}`);
        }
        entry.roles.forEach(role => {
            if (!(role in catalog.roles)) {
                issues.push(`${prefix}: rol desconocido ${role}`);
            } else if (catalog.roles[role].status !== 'active') {
                issues.push(`${prefix}: rol no activo ${role}`);
            }
        });
        if (!SEMVER.test(entry.introducedIn)) {
            issues.push(`${prefix}: introducedIn inválido ${entry.introducedIn}`);
        }
        if (entry.introducedIn !== catalog.catalogVersion) {
            issues.push(`${prefix}: introducedIn no coincide con catalogVersion`);
        }
    });

    return issues;
}

export function serializarCatalogoSoporte(catalog: CatalogoSoporte): string {
    return `${JSON.stringify(catalog)}\n`;
}

export function calcularChecksumCatalogo(catalog: CatalogoSoporte): string {
    return createHash('sha256').update(serializarCatalogoSoporte(catalog)).digest('hex');
}
