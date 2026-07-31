import React from 'react';
import type { MarcadorSoporte } from '../../../../../shared/soporte/tipos';

export const soporteMeta: MarcadorSoporte[] = [
    {
        id: 'fixture.con-marcador',
        inventoryId: 'fixture.con-marcador',
        module: 'fixture',
        label: 'Vista con marcador de fixture',
        intent: 'Orientar sobre la vista con marcador de fixture.',
        aliases: ['vista con marcador'],
        actions: ['consultar'],
        negativeTerms: [],
        roles: ['Admin'],
        steps: ['Abre la vista con marcador.'],
        route: '/con-marcador',
        sensitivity: 'internal',
        escalationReason: 'Escalar si la pantalla no coincide con estos pasos.',
        sourceFiles: ['vistas/VistaConMarcador.tsx'],
        authorizationRef: 'Visibilidad de UI inventariada; autorizacion backend/reglas no verificada.',
        owner: 'Fixture catalogo-gate',
        lastVerifiedAt: '2026-07-30',
        status: 'active',
    },
];

const VistaConMarcador: React.FC = () => <div>Vista con marcador de fixture</div>;

export default VistaConMarcador;
