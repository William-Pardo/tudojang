// Fixture: gate-rol-inactivo/App.tsx
// Una ruta real cubierta NOMINALMENTE por una entrada manual cuyo unico rol esta 'reserved'
// (no 'active') -- debe fallar el gate aun con cobertura aparente (escenario 'c':
// "Cobertura sin ningun rol activo").
import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';

import VistaLegado from './vistas/VistaLegado';

const AppRoutes: React.FC = () => (
    <ReactRouterDOM.Routes>
        <ReactRouterDOM.Route path="/legado" element={<VistaLegado />} />
    </ReactRouterDOM.Routes>
);

export default AppRoutes;
