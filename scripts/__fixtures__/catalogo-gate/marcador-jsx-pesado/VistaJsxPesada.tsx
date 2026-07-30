// Fixture: marcador-jsx-pesado
// Vista con JSX "pesado" y un global de navegador (window.matchMedia) evaluado en el
// top level del modulo. Si el escaneo alguna vez ejecutara este archivo (p.ej. via
// ts.transpileModule + import, en vez de leerlo por AST puro), la linea de
// window.matchMedia explota porque `window` no existe en Node -- sirve de canario del
// requisito de diseno "nunca transpileModule + import para vistas" (ver design.md,
// "Escaneo de marcadores"). Usado por scripts/catalogo-marcadores.test.js para probar
// que soporteMeta se lee sin ejecutar el modulo.
import React from 'react';
import type { MarcadorSoporte } from '../../../../shared/soporte/tipos';

// Canario: explota si este archivo se ejecuta en vez de parsearse por AST.
const ES_PANTALLA_ANCHA = window.matchMedia('(min-width: 768px)').matches;

export const soporteMeta: MarcadorSoporte[] = [
    {
        id: 'fixture.jsxPesado',
        inventoryId: 'fixture.jsxPesado',
        module: 'fixture',
        label: 'Vista con JSX pesado de fixture',
        intent: 'Orientar sobre la vista con JSX pesado de fixture.',
        aliases: ['vista jsx pesado'],
        actions: ['consultar'],
        negativeTerms: [],
        roles: ['Admin'],
        steps: ['Abre la vista con JSX pesado de fixture.'],
        route: '/fixture-jsx-pesado',
        sensitivity: 'internal',
        escalationReason: 'Escalar si la pantalla no coincide con estos pasos.',
        sourceFiles: ['VistaJsxPesada.tsx'],
        authorizationRef: 'Visibilidad de UI inventariada; autorizacion backend/reglas no verificada.',
        owner: 'Fixture catalogo-gate',
        lastVerifiedAt: '2026-07-30',
        status: 'active',
    },
];

const VistaJsxPesada: React.FC = () => {
    const clase = ES_PANTALLA_ANCHA ? 'fixture-ancho' : 'fixture-angosto';
    return (
        <div className={clase}>
            <header>
                <h1>Vista JSX pesada de fixture</h1>
            </header>
            <main>
                <section>
                    <p>Contenido JSX anidado para simular una vista real.</p>
                    <ul>
                        <li>Item uno</li>
                        <li>Item dos</li>
                    </ul>
                </section>
            </main>
        </div>
    );
};

export default VistaJsxPesada;
