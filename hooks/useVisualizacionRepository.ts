import React from 'react';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  crearVisualizacionRepository,
  type VisualizacionRepositoryModo,
} from '../servicios/academico/visualizacionRepository';

interface UseVisualizacionRepositoryOptions {
  modo?: VisualizacionRepositoryModo;
}

export function useVisualizacionRepository(options: UseVisualizacionRepositoryOptions = {}) {
  const modo = options.modo ?? 'local';

  return React.useMemo(
    () => crearVisualizacionRepository({
      modo,
      firestoreDeps: {
        db,
        doc,
        getDoc,
        setDoc,
        collection,
        getDocs,
      },
    }),
    [modo]
  );
}
