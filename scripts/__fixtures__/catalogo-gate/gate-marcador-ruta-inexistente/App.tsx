// Fixture: gate-marcador-ruta-inexistente/App.tsx
// Una unica ruta REAL (/real). vistas/VistaConRutaFalsa.tsx NO esta montada por ningun
// <Route> pero SI declara un `soporteMeta` cuyo `route` no corresponde a ninguna ruta real --
// debe hacer fallar al gate (escenario 'b': "Marcador con ruta no enrutada").
import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';

import VistaReal from './vistas/VistaReal';

const AppRoutes: React.FC = () => (
    <ReactRouterDOM.Routes>
        <ReactRouterDOM.Route path="/real" element={<VistaReal />} />
    </ReactRouterDOM.Routes>
);

export default AppRoutes;
