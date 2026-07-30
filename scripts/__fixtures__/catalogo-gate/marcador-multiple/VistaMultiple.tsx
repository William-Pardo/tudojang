// Fixture: marcador-multiple
// Escenario "vista compleja": tres entradas, dos rutas (analogo a
// vistas/admin/AgendaView.tsx: agenda.read + agenda.manage en "/", agenda.standalone en
// "/agenda"). Usado por scripts/catalogo-marcadores.test.js para validar que
// escanearMarcadores() no colapsa a una unica entrada por archivo (D1: siempre array).
import React from 'react';
import type { MarcadorSoporte } from '../../../../shared/soporte/tipos';

export const soporteMeta: MarcadorSoporte[] = [
    {
        id: 'fixture.multiple.read',
        inventoryId: 'fixture.multiple.read',
        module: 'fixture',
        label: 'Consulta de la vista multiple de fixture',
        intent: 'Orientar sobre la consulta de la vista multiple de fixture.',
        aliases: ['consultar vista multiple'],
        actions: ['consultar'],
        negativeTerms: [],
        roles: ['Admin', 'Editor'],
        steps: ['Abre la vista multiple de fixture.', 'Revisa el listado.'],
        route: '/fixture-multiple',
        sensitivity: 'internal',
        escalationReason: 'Escalar si la pantalla no coincide con estos pasos.',
        sourceFiles: ['VistaMultiple.tsx'],
        authorizationRef: 'Visibilidad de UI inventariada; autorizacion backend/reglas no verificada.',
        owner: 'Fixture catalogo-gate',
        lastVerifiedAt: '2026-07-30',
        status: 'active',
    },
    {
        id: 'fixture.multiple.manage',
        inventoryId: 'fixture.multiple.manage',
        module: 'fixture',
        label: 'Gestion de la vista multiple de fixture',
        intent: 'Orientar sobre la gestion de la vista multiple de fixture.',
        aliases: ['editar vista multiple'],
        actions: ['crear', 'editar', 'eliminar'],
        negativeTerms: [],
        roles: ['Admin'],
        steps: ['Abre la vista multiple de fixture.', 'Edita el elemento seleccionado.'],
        route: '/fixture-multiple',
        sensitivity: 'privileged',
        escalationReason: 'Escalar si la pantalla no coincide con estos pasos.',
        sourceFiles: ['VistaMultiple.tsx'],
        authorizationRef: 'Visibilidad de UI inventariada; autorizacion backend/reglas no verificada.',
        owner: 'Fixture catalogo-gate',
        lastVerifiedAt: '2026-07-30',
        status: 'active',
    },
    {
        id: 'fixture.multiple.standalone',
        inventoryId: 'fixture.multiple.standalone',
        module: 'fixture',
        label: 'Vista multiple de fixture en ruta propia',
        intent: 'Orientar sobre la vista multiple de fixture en su ruta propia.',
        aliases: ['mi vista multiple'],
        actions: ['consultar'],
        negativeTerms: [],
        roles: ['Maestro', 'Estudiante'],
        steps: ['Abre el enlace de la vista multiple de fixture.'],
        route: '/fixture-multiple-standalone',
        sensitivity: 'internal',
        escalationReason: 'Escalar si la pantalla no coincide con estos pasos.',
        sourceFiles: ['VistaMultiple.tsx'],
        authorizationRef: 'Visibilidad de UI inventariada; autorizacion backend/reglas no verificada.',
        owner: 'Fixture catalogo-gate',
        lastVerifiedAt: '2026-07-30',
        status: 'active',
    },
];

const VistaMultiple: React.FC = () => <div>Vista multiple de fixture</div>;

export default VistaMultiple;
