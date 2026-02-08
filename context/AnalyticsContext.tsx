
// context/AnalyticsContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
// Added comment above fix: Import centralized PuntoCalor from tipos.ts to resolve type mismatch.
import { PuntoCalor } from '../tipos';

interface AnalyticsContextType {
    puntos: PuntoCalor[];
    heatmapActivo: boolean;
    setHeatmapActivo: (activo: boolean) => void;
    limpiarDatos: () => void;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export const AnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [puntos, setPuntos] = useState<PuntoCalor[]>([]);
    const [heatmapActivo, setHeatmapActivo] = useState(false);
    const { usuario } = useAuth();
    const location = useLocation();

    const registrarEvento = useCallback((x: number, y: number, tipo: 'click' | 'move', elemento?: string) => {
        const xPct = (x / window.innerWidth) * 100;
        const yPct = (y / window.innerHeight) * 100;
        const ahora = new Date();

        // Added comment above fix: Ensure required 'intensidad' property is provided to solve PuntoCalor type error.
        const nuevoPunto: PuntoCalor = {
            x: xPct,
            y: yPct,
            tipo,
            rol: usuario?.rol || 'Invitado',
            ruta: location.pathname,
            hora: ahora.getHours(),
            dia: ahora.toLocaleDateString('es-CO', { weekday: 'long' }),
            elemento: elemento?.substring(0, 30), // Limitar texto del botón
            intensidad: 1
        };

        setPuntos(prev => {
            const nuevaLista = [...prev, nuevoPunto];
            return nuevaLista.slice(-5000); // Aumentamos el buffer a 5000 puntos
        });
    }, [usuario, location]);

    useEffect(() => {
        let lastMove = 0;
        const handleMouseMove = (e: MouseEvent) => {
            const now = Date.now();
            if (now - lastMove > 150) { // Throttle más relajado para movimiento
                registrarEvento(e.clientX, e.clientY, 'move');
                lastMove = now;
            }
        };

        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Intentar capturar el nombre de la función (texto del botón o aria-label)
            const label = target.innerText || target.getAttribute('aria-label') || target.title || 'elemento_anonimo';
            registrarEvento(e.clientX, e.clientY, 'click', label.trim());
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('click', handleClick);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('click', handleClick);
        };
    }, [registrarEvento]);

    const limpiarDatos = () => setPuntos([]);

    return (
        <AnalyticsContext.Provider value={{ puntos, heatmapActivo, setHeatmapActivo, limpiarDatos }}>
            {children}
        </AnalyticsContext.Provider>
    );
};

export const useAnalytics = () => {
    const context = useContext(AnalyticsContext);
    if (!context) throw new Error('useAnalytics debe usarse dentro de AnalyticsProvider');
    return context;
};
