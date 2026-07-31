// Fixture: reproduce la clase de bug real de `Estudiante` (ver comentario historico en
// shared/soporte/catalogo.v1.ts) -- una entrada cuyo(s) unico(s) rol(es) tienen
// status !== 'active' en ROLES_SOPORTE. matcher.ts descarta el catalogo local para esos roles,
// asi que una cobertura "nominal" asi es, en la practica, cero cobertura real.
export const CATALOGO_SOPORTE_V1 = {
    schemaVersion: 1,
    catalogVersion: '9.9.9',
    lastVerifiedAt: '2026-07-30',
    roles: {
        Reservado: { status: 'reserved', description: 'Rol reservado, aun sin publicar entradas.' },
    },
    routes: ['/legado'],
    entries: [
        {
            id: 'fixture.legado',
            inventoryId: 'fixture.legado',
            module: 'fixture',
            label: 'Vista legado de fixture',
            intent: 'Orientar sobre la vista legado de fixture.',
            aliases: ['vista legado'],
            actions: ['consultar'],
            negativeTerms: [],
            roles: ['Reservado'],
            steps: ['Abre la vista legado.'],
            route: '/legado',
            sensitivity: 'internal',
            escalationReason: 'Escalar si la pantalla no coincide con estos pasos.',
            sourceFiles: ['vistas/VistaLegado.tsx'],
            authorizationRef: 'Visibilidad de UI inventariada; autorizacion backend/reglas no verificada.',
            owner: 'Fixture catalogo-gate',
            introducedIn: '9.9.9',
            lastVerifiedAt: '2026-07-30',
            status: 'active',
        },
    ],
};
