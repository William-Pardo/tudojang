// hooks/useDebounce.ts
import { useState, useEffect } from 'react';

/**
 * Hook para "retrasar" la actualización de un valor, útil para inputs de búsqueda.
 * @param value El valor a debounced (ej. el texto de un input).
 * @param delay El tiempo de espera en milisegundos.
 * @returns El valor después del tiempo de espera.
 */
export const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Establecer un temporizador para actualizar el valor debounced después del delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Limpiar el temporizador si el valor cambia (o al desmontar)
    // Esto evita que el valor se actualice si el usuario sigue escribiendo
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]); // Solo se vuelve a ejecutar si el valor o el delay cambian

  return debouncedValue;
}
