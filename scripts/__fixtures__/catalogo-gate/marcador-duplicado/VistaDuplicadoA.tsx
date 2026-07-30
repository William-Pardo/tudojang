// Fixture: marcador-duplicado (archivo A)
// Junto con VistaDuplicadoB.tsx en este mismo directorio, declara el MISMO id
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
        label: 'Vista duplicada A de fixture',
        intent: 'Orientar sobre la vista duplicada A de fixture.',
        aliases: ['vista duplicada a'],
        actions: ['consultar'],
        negativeTerms: [],
        roles: ['Admin'],
        steps: ['Abre la vista duplicada A de fixture.'],
        route: '/fixture-duplicado-a',
        sensitivity: 'internal',
        escalationReason: 'Escalar si la pantalla no coincide con estos pasos.',
        sourceFiles: ['VistaDuplicadoA.tsx'],
        authorizationRef: 'Visibilidad de UI inventariada; autorizacion backend/reglas no verificada.',
        owner: 'Fixture catalogo-gate',
        lastVerifiedAt: '2026-07-30',
        status: 'active',
    },
];

const VistaDuplicadoA: React.FC = () => <div>Vista duplicada A de fixture</div>;

export default VistaDuplicadoA;
