import React from 'react';
import type { MarcadorSoporte } from '../../../../../shared/soporte/tipos';

// Fixture: declara una ruta que NO existe en App.tsx -- debe fallar el gate (escenario 'b'),
// sin importar que este archivo en si no este montado directamente por un <Route>.
export const soporteMeta: MarcadorSoporte[] = [
    {
        id: 'fixture.ruta-falsa',
        inventoryId: 'fixture.ruta-falsa',
        module: 'fixture',
        label: 'Vista con ruta inexistente',
        intent: 'Orientar sobre la vista con ruta inexistente.',
        aliases: ['vista con ruta inexistente'],
        actions: ['consultar'],
        negativeTerms: [],
        roles: ['Admin'],
        steps: ['Abre la vista con ruta inexistente.'],
        route: '/no-existe',
        sensitivity: 'internal',
        escalationReason: 'Escalar si la pantalla no coincide con estos pasos.',
        sourceFiles: ['vistas/VistaConRutaFalsa.tsx'],
        authorizationRef: 'Visibilidad de UI inventariada; autorizacion backend/reglas no verificada.',
        owner: 'Fixture catalogo-gate',
        lastVerifiedAt: '2026-07-30',
        status: 'active',
    },
];

const VistaConRutaFalsa: React.FC = () => <div>Vista con ruta inexistente</div>;

export default VistaConRutaFalsa;
