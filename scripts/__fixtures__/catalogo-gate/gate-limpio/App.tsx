// Fixture: gate-limpio/App.tsx
// Arbol minimo con dos rutas reales, usado por scripts/verificar-rutas-soporte.test.js para
// probar el "camino feliz" del gate (escenarios (d)/(e)/(g) de specs/catalogo-soporte-antideriva):
//   - /cubierta -> VistaCubierta.tsx, cubierta por una entrada MANUAL del nucleo (en la linea
//     base de deuda congelada, ver shared/soporte/deuda-catalogo.json de este mismo fixture).
//   - /con-marcador -> VistaConMarcador.tsx, cubierta por su propio marcador `soporteMeta`
//     (fuera de la linea base: representa una vista ya migrada).
import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';

import VistaCubierta from './vistas/VistaCubierta';
import VistaConMarcador from './vistas/VistaConMarcador';

const AppRoutes: React.FC = () => (
    <ReactRouterDOM.Routes>
        <ReactRouterDOM.Route path="/cubierta" element={<VistaCubierta />} />
        <ReactRouterDOM.Route path="/con-marcador" element={<VistaConMarcador />} />
    </ReactRouterDOM.Routes>
);

export default AppRoutes;
