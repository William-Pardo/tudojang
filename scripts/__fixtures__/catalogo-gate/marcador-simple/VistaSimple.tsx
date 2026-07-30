// Fixture: marcador-simple
// Escenario "camino feliz" mas basico: una vista con una unica entrada de soporteMeta
// (analogo 1:1 a vistas/BuzonNotificaciones.tsx). Usado por
// scripts/catalogo-marcadores.test.js para validar la forma que devuelve
// escanearMarcadores() cuando todo esta bien.
import React from 'react';
import type { MarcadorSoporte } from '../../../../shared/soporte/tipos';

export const soporteMeta: MarcadorSoporte[] = [
    {
        id: 'fixture.simple',
        inventoryId: 'fixture.simple',
        module: 'fixture',
        label: 'Vista simple de fixture',
        intent: 'Orientar sobre la vista simple de fixture.',
        aliases: ['vista simple de fixture'],
        actions: ['consultar'],
        negativeTerms: [],
        roles: ['Admin'],
        steps: ['Abre la vista simple de fixture.'],
        route: '/fixture-simple',
        sensitivity: 'internal',
        escalationReason: 'Escalar si la pantalla no coincide con estos pasos.',
        sourceFiles: ['VistaSimple.tsx'],
        authorizationRef: 'Visibilidad de UI inventariada; autorizacion backend/reglas no verificada.',
        owner: 'Fixture catalogo-gate',
        lastVerifiedAt: '2026-07-30',
        status: 'active',
    },
];

const VistaSimple: React.FC = () => <div>Vista simple de fixture</div>;

export default VistaSimple;
