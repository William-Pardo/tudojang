import React from 'react';
import type { RecursoAcademico } from '../../models/academico/recurso';
import AsignarMaterialWizard, { type AsignacionDraft } from './AsignarMaterialWizard';

// Subtarea 12.7 (Parte 2): wrapper que adapta `AsignarMaterialWizard` a UNA jornada concreta,
// sin depender del estado del carrusel de "programa activo" de `AsignacionesView.tsx` (donde
// `materialesDisponiblesWizard` se computa contra el estado global de esa vista). Recibe la
// jornada (por `jornadaId`) mas los datos ya cargados que necesita — recursos del tenant, tags
// del programa de esa jornada y grupos objetivo — y arma internamente las props que el wizard
// espera.
//
// ESTADO: listo pero SIN consumidor real en produccion todavia (mismo criterio que 12.6 uso
// con la guarda de eliminacion). El modal que lo va a montar es la subtarea 12.9 (pestana
// "Materiales" del modal de edicion singular de Agenda), que aun no existe. Por eso se testea
// aislado con props mock, sin montar `AsignacionesView.tsx`. Cuando 12.9 lo consuma, debe
// pasarle `recursoIdsAsignados` = ids ya asignados a ESA jornada (excluyendo, en modo editar,
// el propio recurso que se edita, para que el wizard muestre su titulo real y no el chip
// generico) y un `onConfirmar` que persista la asignacion contra `jornadaId`.

export interface PestanaMaterialesJornadaProps {
  /** Jornada a la que se asigna material. Se usa como `key` del wizard para resetear su estado
   *  interno al cambiar de jornada (util para 12.9, donde el modal salta entre clases). */
  jornadaId: string;
  modo: 'crear' | 'editar';
  /** Recursos del tenant ya cargados por el contenedor (no los lee este componente). */
  recursosDisponibles: RecursoAcademico[];
  /** Tags del programa de esta jornada; priorizan (no filtran) la lista del Paso 1. */
  tagsPrograma: string[];
  gruposObjetivo: string[];
  /** Ids de recursos ya asignados a esta jornada, para excluir duplicados del Paso 1. */
  recursoIdsAsignados?: string[];
  draftInicial?: AsignacionDraft | null;
  onCancelar: () => void;
  onConfirmar: (draft: AsignacionDraft) => Promise<void>;
}

const normalizarTag = (tag: string) => tag.trim().toLowerCase();

// Se reimplementa el conteo de tags coincidentes (en vez de importarlo de AsignacionesView.tsx
// o AsignarMaterialWizard.tsx, donde no esta exportado) para que este wrapper sea autonomo —
// misma decision y misma logica que ya tomo el propio AsignarMaterialWizard con su
// `contarTagsCoincidentes`.
function coincideAlgunTag(recurso: RecursoAcademico, tagsPrograma: string[]): boolean {
  if (tagsPrograma.length === 0) return false;
  const normalizados = tagsPrograma.map(normalizarTag);
  return (recurso.ficha?.tags ?? []).some((tag) => normalizados.includes(normalizarTag(tag)));
}

/**
 * Prepara la lista `materialesDisponibles` que el wizard espera "ya excluida (duplicados) y
 * priorizada por tags". Replica el contrato que `AsignacionesView.tsx` arma para el mismo
 * wizard (`materialesDisponiblesWizard` + `recursosPriorizadosPorTag`): excluye los recursos
 * ya asignados a la jornada y ordena los que matchean tags del programa primero (sin filtrar
 * al resto, que sigue seleccionable). Helper puro y exportado para poder testear la
 * priorizacion/exclusion sin montar el wizard.
 */
export function prepararMaterialesJornada(
  recursos: RecursoAcademico[],
  tagsPrograma: string[],
  recursoIdsAsignados: string[] = [],
): RecursoAcademico[] {
  const excluidos = new Set(recursoIdsAsignados);
  const disponibles = recursos.filter((recurso) => !excluidos.has(recurso.id));
  if (tagsPrograma.length === 0) return disponibles;
  return [...disponibles].sort((a, b) => {
    const aCoincide = coincideAlgunTag(a, tagsPrograma);
    const bCoincide = coincideAlgunTag(b, tagsPrograma);
    if (aCoincide === bCoincide) return 0;
    return aCoincide ? -1 : 1;
  });
}

const PestanaMaterialesJornada: React.FC<PestanaMaterialesJornadaProps> = ({
  jornadaId,
  modo,
  recursosDisponibles,
  tagsPrograma,
  gruposObjetivo,
  recursoIdsAsignados,
  draftInicial = null,
  onCancelar,
  onConfirmar,
}) => {
  const materialesDisponibles = React.useMemo(
    () => prepararMaterialesJornada(recursosDisponibles, tagsPrograma, recursoIdsAsignados ?? []),
    [recursosDisponibles, tagsPrograma, recursoIdsAsignados],
  );

  return (
    <AsignarMaterialWizard
      key={jornadaId}
      modo={modo}
      materialesDisponibles={materialesDisponibles}
      tagsPrograma={tagsPrograma}
      gruposObjetivo={gruposObjetivo}
      draftInicial={draftInicial}
      onCancelar={onCancelar}
      onConfirmar={onConfirmar}
    />
  );
};

export default PestanaMaterialesJornada;
