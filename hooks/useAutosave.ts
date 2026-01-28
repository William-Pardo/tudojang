// hooks/useAutosave.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import type { UseFormWatch, UseFormReset } from 'react-hook-form';

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Hook para guardar y restaurar automáticamente el estado de un formulario en localStorage.
 * @param formKey - Una clave única para identificar este formulario en localStorage.
 * @param watch - La función `watch` de react-hook-form para observar los cambios.
 * @param reset - La función `reset` de react-hook-form para restaurar datos.
 * @param debounceMs - El tiempo de espera en milisegundos después de que el usuario deja de escribir para guardar.
 */
export function useAutosave<T extends object>({
  formKey,
  watch,
  reset,
  debounceMs = 500,
}: {
  formKey: string;
  watch: UseFormWatch<T>;
  reset: UseFormReset<T>;
  debounceMs?: number;
}) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [hasDraft, setHasDraft] = useState(false);
  const timerRef = useRef<number | null>(null);
  
  // Función para guardar los datos en localStorage
  const saveData = useCallback((data: T) => {
    try {
      const dataToSave = JSON.stringify(data);
      localStorage.setItem(formKey, dataToSave);
      setStatus('saved');
    } catch (e) {
      console.error('Error al guardar borrador en localStorage:', e);
      setStatus('error');
    }
  }, [formKey]);
  
  // Al montar, comprueba si existe un borrador guardado.
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(formKey);
      if (savedData) {
        setHasDraft(true);
      }
    } catch (e) {
      console.error('Error al acceder a localStorage:', e);
    }
  }, [formKey]);

  // Efecto que observa los cambios en el formulario y los guarda con debounce.
  useEffect(() => {
    const subscription = watch((value) => {
      setStatus('saving');
      
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      
      timerRef.current = window.setTimeout(() => {
        saveData(value as T);
      }, debounceMs);
    });

    return () => {
      subscription.unsubscribe();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [watch, saveData, debounceMs]);

  // Función para restaurar el borrador en el formulario
  const restoreDraft = useCallback(() => {
    try {
      const savedData = localStorage.getItem(formKey);
      if (savedData) {
        const parsedData = JSON.parse(savedData) as T;
        reset(parsedData);
        setHasDraft(false); // Ocultar el prompt después de restaurar
        setStatus('idle');
      }
    } catch (e) {
      console.error('Error al restaurar borrador de localStorage:', e);
    }
  }, [formKey, reset]);

  // Función para limpiar el borrador
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(formKey);
      setHasDraft(false);
      setStatus('idle');
    } catch (e) {
      console.error('Error al limpiar borrador de localStorage:', e);
    }
  }, [formKey]);

  return { status, hasDraft, restoreDraft, clearDraft };
}