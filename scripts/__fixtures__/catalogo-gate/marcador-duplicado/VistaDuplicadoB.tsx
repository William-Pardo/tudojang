// Fixture: marcador-duplicado (archivo B)
// Junto con VistaDuplicadoA.tsx en este mismo directorio, declara el MISMO id
// ("fixture.duplicado") en dos archivos distintos. Usado por
// scripts/catalogo-marcadores.test.js para verificar que la colision de id entre
// marcadores es una falla dura (ver design.md, seccion "Fusion").
import React from 'react';
import type { MarcadorSoporte } from '../../../../shared/soporte/tipos';

export const soporteMeta: MarcadorSoporte[] = [
    {
        id: 'fixture.duplicado',
        inventoryId: 'fixture.duplicado',
        module: 'fixture',
        label: 'Vista duplicada B de fixture',
        intent: 'Orientar sobre la vista duplicada B de fixture.',
        aliases: ['vista duplicada b'],
        actions: ['consultar'],
        negativeTerms: [],
        roles: ['Admin'],
        steps: ['Abre la vista duplicada B de fixture.'],
        route: '/fixture-duplicado-b',
        sensitivity: 'internal',
        escalationReason: 'Escalar si la pantalla no coincide con estos pasos.',
        sourceFiles: ['VistaDuplicadoB.tsx'],
        authorizationRef: 'Visibilidad de UI inventariada; autorizacion backend/reglas no verificada.',
        owner: 'Fixture catalogo-gate',
        lastVerifiedAt: '2026-07-30',
        status: 'active',
    },
];

const VistaDuplicadoB: React.FC = () => <div>Vista duplicada B de fixture</div>;

export default VistaDuplicadoB;
