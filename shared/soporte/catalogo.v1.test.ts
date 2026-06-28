import { CATALOGO_SOPORTE_V1, ROLES_SOPORTE, RUTAS_SOPORTE_CONOCIDAS } from './catalogo.v1';

const INVENTARIO_ESPERADO = [
    'shell.session',
    'admin.summary',
    'admin.late-fees',
    'finance.ledger',
    'finance.delete',
    'finance.student-payments',
    'finance.student-payment-undo',
    'finance.payment-validation',
    'agenda.read',
    'agenda.manage',
    'students.directory',
    'students.manage',
    'students.kicho',
    'students.kicho-legalize',
    'students.live-class',
    'students.certificates',
    'students.cards',
    'store.catalog',
    'store.inventory',
    'events.catalog',
    'events.manage',
    'alerts.payment',
    'alerts.history',
    'config.identity-payments',
    'config.annual-enrollment-fee',
    'config.branches',
    'config.staff',
    'config.programs',
    'config.alerts',
    'config.license',
    'profile.self',
    'profile.attendance',
    'license.renew',
    'master.support',
    'master.tenants',
    'master.kicho',
    'master.analytics',
    'public.marketing',
    'public.auth',
    'public.enrollment',
    'public.census',
    'public.event',
    'public.contract-signature',
    'public.consent-signature',
    'public.image-signature',
    'public.payment-report',
    'public.pickup',
    'public.help',
] as const;

describe('CATALOGO_SOPORTE_V1', () => {
    it('cubre las 48 entradas resultantes de separar rutas y permisos incompatibles', () => {
        expect(CATALOGO_SOPORTE_V1.entries.map(entry => entry.inventoryId).sort()).toEqual(
            [...INVENTARIO_ESPERADO].sort(),
        );
        expect(CATALOGO_SOPORTE_V1.entries).toHaveLength(48);
    });

    it.each(INVENTARIO_ESPERADO)('declara metadatos verificables para %s', inventoryId => {
        const entry = CATALOGO_SOPORTE_V1.entries.find(item => item.inventoryId === inventoryId);

        expect(entry).toMatchObject({
            id: expect.stringMatching(/^[a-z0-9.-]+$/),
            inventoryId,
            module: expect.any(String),
            label: expect.any(String),
            intent: expect.any(String),
            authorizationRef: expect.any(String),
            owner: expect.any(String),
            introducedIn: expect.stringMatching(/^\d+\.\d+\.\d+$/),
            lastVerifiedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        });
        expect(entry!.aliases.length).toBeGreaterThan(0);
        expect(entry!.actions.length).toBeGreaterThan(0);
        expect(entry!.roles.length).toBeGreaterThan(0);
        expect(entry!.steps.length).toBeGreaterThan(0);
        expect(entry!.sourceFiles.length).toBeGreaterThan(0);
        expect(RUTAS_SOPORTE_CONOCIDAS).toContain(entry!.route);
        entry!.roles.forEach(role => expect(ROLES_SOPORTE[role].status).toBe('active'));
    });

    it('mantiene Tutor activo y Estudiante reservado sin publicar contenido futuro', () => {
        expect(ROLES_SOPORTE.Tutor.status).toBe('active');
        expect(ROLES_SOPORTE.Estudiante.status).toBe('reserved');
        expect(CATALOGO_SOPORTE_V1.entries.some(entry => entry.roles.includes('Estudiante'))).toBe(false);
    });

    it('modela por separado contrato, consentimiento e imagen con las rutas de App.tsx', () => {
        expect(CATALOGO_SOPORTE_V1.entries).toEqual(expect.arrayContaining([
            expect.objectContaining({
                inventoryId: 'public.contract-signature',
                route: '/contrato/:idEstudiante',
                sourceFiles: ['vistas/FirmaContrato.tsx'],
            }),
            expect.objectContaining({
                inventoryId: 'public.consent-signature',
                route: '/firma/:idEstudiante',
                sourceFiles: ['vistas/FirmaConsentimiento.tsx'],
            }),
            expect.objectContaining({
                inventoryId: 'public.image-signature',
                route: '/firma-imagen/:idEstudiante',
                sourceFiles: ['vistas/FirmaImagen.tsx'],
            }),
        ]));
        expect(CATALOGO_SOPORTE_V1.routes).toEqual(expect.arrayContaining([
            '/firma-imagen/:idEstudiante',
            '/imagen/:idEstudiante',
        ]));
        expect(CATALOGO_SOPORTE_V1.entries.some(
            entry => entry.inventoryId === 'public.legal-docs',
        )).toBe(false);
    });

    it('separa deshacer el ultimo pago como accion exclusiva de Admin', () => {
        const pagosVisibles = CATALOGO_SOPORTE_V1.entries.find(
            entry => entry.inventoryId === 'finance.student-payments',
        );
        const deshacerPago = CATALOGO_SOPORTE_V1.entries.find(
            entry => entry.inventoryId === 'finance.student-payment-undo',
        );

        expect(pagosVisibles?.roles).toEqual(['Admin', 'Editor', 'Asistente']);
        expect(pagosVisibles?.actions).not.toContain('deshacer');
        expect(pagosVisibles?.aliases).not.toContain('deshacer ultimo pago');
        expect(pagosVisibles?.negativeTerms).toEqual(expect.arrayContaining([
            'anular pago estudiante',
            'deshacer pago estudiante',
        ]));
        expect(deshacerPago).toMatchObject({
            roles: ['Admin'],
            actions: expect.arrayContaining(['deshacer', 'anular']),
            aliases: expect.arrayContaining([
                'anular pago estudiante',
                'deshacer pago estudiante',
            ]),
            sensitivity: 'privileged',
        });
    });

    it('modela el cobro anual de matricula sin mezclarlo con pagos de Tesoreria', () => {
        const cobroAnual = CATALOGO_SOPORTE_V1.entries.find(
            entry => entry.inventoryId === 'config.annual-enrollment-fee',
        );
        const pagosTesoreria = CATALOGO_SOPORTE_V1.entries.find(
            entry => entry.inventoryId === 'finance.student-payments',
        );

        expect(cobroAnual).toMatchObject({
            module: 'configuracion',
            roles: ['Admin'],
            route: '/configuracion',
            aliases: expect.arrayContaining([
                'activar pago anual de formulario',
                'activar cobro anual de matricula',
                'donde marco cobro anual',
            ]),
            actions: expect.arrayContaining(['activar', 'marcar', 'establecer', 'guardar']),
            steps: [
                'Abre Configuración > Identidad & Pagos.',
                'Ubica Valor Matrícula / Formulario.',
                'Marca ¿Cobro Anual?, establece el valor y pulsa Guardar Cambios.',
            ],
            sourceFiles: ['vistas/Configuracion.tsx'],
        });
        expect(pagosTesoreria?.aliases).not.toEqual(expect.arrayContaining([
            expect.stringMatching(/anual/i),
        ]));
    });

    it('expone una versión semántica única para todo el catálogo', () => {
        expect(CATALOGO_SOPORTE_V1.schemaVersion).toBe(1);
        expect(CATALOGO_SOPORTE_V1.catalogVersion).toMatch(/^\d+\.\d+\.\d+$/);
        expect(new Set(CATALOGO_SOPORTE_V1.entries.map(entry => entry.introducedIn))).toEqual(
            new Set([CATALOGO_SOPORTE_V1.catalogVersion]),
        );
    });
});
