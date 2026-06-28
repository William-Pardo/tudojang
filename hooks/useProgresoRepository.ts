import React from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import {
  crearProgresoRepository,
  type ProgresoRepositoryModo,
} from '../servicios/academico/progresoRepository';

interface UseProgresoRepositoryOptions {
  modo?: ProgresoRepositoryModo;
}

export function useProgresoRepository(options: UseProgresoRepositoryOptions = {}) {
  const { usuario } = useAuth();
  const modo = options.modo ?? 'local';

  return React.useMemo(
    () => crearProgresoRepository({
      modo,
      estudianteId: usuario?.id ?? null,
      firestoreDeps: {
        db,
        doc,
        getDoc,
        setDoc,
      },
    }),
    [modo, usuario?.id]
  );
}
