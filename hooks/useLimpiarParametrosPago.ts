
// hooks/useLimpiarParametrosPago.ts
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Hook para limpiar los parámetros de pago de la URL después de procesarlos
 * Evita que los parámetros ?pago=exito&id=...&env=undefined permanezcan en la URL
 */
export const useLimpiarParametrosPago = (retrasoMs: number = 3000) => {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        // Verificar si hay parámetros de pago en la URL
        const tieneParametrosPago =
            location.search.includes('pago=') ||
            location.search.includes('id=') ||
            location.search.includes('env=') ||
            location.hash.includes('pago=');

        if (tieneParametrosPago) {
            console.log('[useLimpiarParametrosPago] Parámetros de pago detectados, limpiando en', retrasoMs, 'ms');

            // Esperar un tiempo para que la aplicación procese el resultado del pago
            const timer = setTimeout(() => {
                // Construir la URL limpia sin parámetros de pago
                const nuevaUrl = location.pathname + location.hash.split('?')[0];

                console.log('[useLimpiarParametrosPago] Limpiando URL:', {
                    anterior: window.location.href,
                    nueva: nuevaUrl
                });

                // Reemplazar la URL actual sin agregar una nueva entrada al historial
                navigate(nuevaUrl, { replace: true });
            }, retrasoMs);

            return () => clearTimeout(timer);
        }
    }, [location.search, location.hash, location.pathname, navigate, retrasoMs]);
};
