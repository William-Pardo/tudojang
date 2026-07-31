import React from 'react';
import type { MarcadorSoporte } from '../../../../../shared/soporte/tipos';

export const soporteMeta: MarcadorSoporte[] = [
    {
        id: 'fixture.real',
        inventoryId: 'fixture.real',
        module: 'fixture',
        label: 'Vista real de fixture',
        intent: 'Orientar sobre la vista real de fixture.',
        aliases: ['vista real'],
        actions: ['consultar'],
        negativeTerms: [],
        roles: ['Admin'],
        steps: ['Abre la vista real.'],
        route: '/real',
        sensitivity: 'internal',
        escalationReason: 'Escalar si la pantalla no coincide con estos pasos.',
        sourceFiles: ['vistas/VistaReal.tsx'],
        authorizationRef: 'Visibilidad de UI inventariada; autorizacion backend/reglas no verificada.',
        owner: 'Fixture catalogo-gate',
        lastVerifiedAt: '2026-07-30',
        status: 'active',
    },
];

const VistaReal: React.FC = () => <div>Vista real de fixture</div>;

export default VistaReal;
