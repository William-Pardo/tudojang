// Fixture: nucleo manual minimo para scripts/verificar-rutas-soporte.test.js (escenario
// "camino feliz": gate-limpio). No reutiliza el helper `entry(...)` real -- se mantiene
// autocontenido a proposito.
export const CATALOGO_SOPORTE_V1 = {
    schemaVersion: 1,
    catalogVersion: '9.9.9',
    lastVerifiedAt: '2026-07-30',
    roles: {
        Admin: { status: 'active', description: 'Rol de fixture.' },
    },
    routes: ['/cubierta', '/con-marcador'],
    entries: [
        {
            id: 'fixture.cubierta',
            inventoryId: 'fixture.cubierta',
            module: 'fixture',
            label: 'Vista cubierta de fixture',
            intent: 'Orientar sobre la vista cubierta de fixture.',
            aliases: ['vista cubierta'],
            actions: ['consultar'],
            negativeTerms: [],
            roles: ['Admin'],
            steps: ['Abre la vista cubierta.'],
            route: '/cubierta',
            sensitivity: 'internal',
            escalationReason: 'Escalar si la pantalla no coincide con estos pasos.',
            sourceFiles: ['vistas/VistaCubierta.tsx'],
            authorizationRef: 'Visibilidad de UI inventariada; autorizacion backend/reglas no verificada.',
            owner: 'Fixture catalogo-gate',
            introducedIn: '9.9.9',
            lastVerifiedAt: '2026-07-30',
            status: 'active',
        },
    ],
};
