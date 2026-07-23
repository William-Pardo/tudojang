// hooks/academico/useEliminacionJornadaSegura.ts
//
// Extension posterior al cierre del modulo 12 (matriz de roles + iconos de la parrilla
// de Agenda, ver CIERRE CENTRO DE ESTUDIOS.md): flujo de "eliminar clase" (confirmacion +
// eliminarJornadaSegura + auditoria, seccion 8 del documento de mejora, ya implementado
// dentro de `ModalEdicionJornada.tsx` en la subtarea 12.9) extraido a un hook compartido
// para que TANTO `ModalEdicionJornada` (mantiene su boton interno "Eliminar clase") COMO
// el nuevo icono de caneca de `AgendaView.tsx` (disparado directamente desde el bloque de
// la parrilla, sin abrir el modal completo) reutilicen la MISMA logica, en vez de
// duplicarla en dos componentes.
//
// El usuario pidio explicitamente que el icono de eliminar este disponible DIRECTAMENTE
// en la parrilla -- esto contradice la seccion 4 del documento original ("no mostrar
// boton de eliminar directamente en la parrilla"), decision consciente y explicita que
// anula esa restriccion puntual de UBICACION. La seccion 8 del mismo documento (matriz de
// PERMISOS de eliminar: "Tenant/admin puede eliminar... Maestro asignado puede editar su
// clase, pero no eliminarla salvo permiso explicito") NO fue anulada -- este hook no
// decide POR SI SOLO quien puede invocar `confirmar()`; esa guarda de visibilidad sigue
// viviendo en cada consumidor (mismo `esAdmin` que ya usaba `ModalEdicionJornada`).

import { useState, useCallback } from 'react';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import type { RolUsuario } from '../../tipos';
import { cancelarJornada } from '../../servicios/academico/jornadaService';
import {
  diffCambiosJornada,
  EliminacionNoPermitidaError,
  type FuenteAuditoriaJornada,
  type JornadaRepository,
} from '../../servicios/academico/jornadaRepository';

export interface ErrorEliminacionJornada {
  mensaje: string;
  ofrecerCancelar: boolean;
  // Archivar (ocultar de Agenda) es la salida UNIVERSAL: siempre funciona. Se mantiene en
  // `true` mientras el borrado siga bloqueado, incluso si el intento de cancelar tambien
  // falla -- asi el admin nunca se queda sin escape (el bug de UX que este flujo resuelve).
  ofrecerArchivar: boolean;
}

export interface UseEliminacionJornadaSeguraInput {
  repository: JornadaRepository;
  tenantId: string;
  usuarioId: string;
  rol: RolUsuario;
  fuente: FuenteAuditoriaJornada;
  // Se invoca cuando la jornada termino eliminada (borrado fisico) O cancelada (fallback
  // "cancelar en lugar de eliminar" cuando la clase ya se opero) -- mismo criterio que
  // `onEliminada` en `ModalEdicionJornada.tsx`: en ambos casos, la jornada deja de existir
  // en su forma original y el llamador debe refrescar su lista.
  onEliminada?: (jornadaId: string) => void;
}

export interface UseEliminacionJornadaSeguraResult {
  // Jornada objetivo actual del flujo (null = no hay ningun flujo de eliminacion en curso).
  jornada: JornadaInstruccion | null;
  confirmando: boolean;
  eliminando: boolean;
  error: ErrorEliminacionJornada | null;
  // Abre el flujo de confirmacion sobre una jornada puntual.
  iniciar: (jornada: JornadaInstruccion) => void;
  // Ejecuta el borrado fisico guardado (eliminarJornadaSegura + auditoria). Si la jornada
  // ya se opero, NO borra nada: deja `error.ofrecerCancelar = true` para que la UI ofrezca
  // `cancelarEnLugarDeEliminar` en su lugar (mismo patron que el modal). Devuelve `true`
  // si el borrado se completo (y el hook ya se cerro solo) o `false` si quedo bloqueado
  // por un error -- el llamador lo usa para decidir si TAMBIEN debe cerrar su propia UI
  // (p.ej. el modal), sin depender de leer el estado del hook justo despues de un await
  // (closure potencialmente desactualizado dentro del mismo handler).
  confirmar: () => Promise<boolean>;
  // Fallback cuando el borrado fisico esta bloqueado: cancela la clase (soft) en su lugar.
  // Mismo criterio de retorno booleano que `confirmar()`.
  cancelarEnLugarDeEliminar: (motivo?: string) => Promise<boolean>;
  // Salida UNIVERSAL cuando la clase no se puede ni eliminar ni cancelar (ya operada):
  // la oculta de la parrilla de Agenda (flag `archivada`) sin borrarla ni cambiar su estado.
  // Siempre funciona. Mismo criterio de retorno booleano que `confirmar()`.
  archivar: () => Promise<boolean>;
  // Cierra el flujo sin ejecutar ninguna accion (equivalente a "Volver"/cerrar el modal).
  cerrar: () => void;
}

const MOTIVO_CANCELACION_POR_DEFECTO =
  'Cancelada desde Agenda: no se pudo eliminar (clase ya operada).';

export function useEliminacionJornadaSegura(
  input: UseEliminacionJornadaSeguraInput,
): UseEliminacionJornadaSeguraResult {
  const { repository, tenantId, usuarioId, rol, fuente, onEliminada } = input;

  const [jornada, setJornada] = useState<JornadaInstruccion | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<ErrorEliminacionJornada | null>(null);

  const cerrar = useCallback(() => {
    setJornada(null);
    setConfirmando(false);
    setEliminando(false);
    setError(null);
  }, []);

  const iniciar = useCallback((objetivo: JornadaInstruccion) => {
    setJornada(objetivo);
    setConfirmando(true);
    setError(null);
  }, []);

  const registrarAuditoriaSilenciosa = useCallback(
    async (jornadaId: string, accion: 'eliminar' | 'cancelar' | 'archivar', cambios: ReturnType<typeof diffCambiosJornada>) => {
      try {
        await repository.registrarAuditoria({ tenantId, jornadaId, usuarioId, rol, fuente, accion, cambios });
      } catch (auditError) {
        // Mismo criterio que ModalEdicionJornada.tsx (Subtarea 12.5/12.9): el borrado/
        // cancelacion principal ya se aplico, no se revierte por un fallo de auditoria --
        // se deja constancia en consola en vez de fallar silenciosamente.
        console.warn('[useEliminacionJornadaSegura] No se pudo registrar auditoria', auditError);
      }
    },
    [repository, tenantId, usuarioId, rol, fuente],
  );

  const confirmar = useCallback(async (): Promise<boolean> => {
    if (!jornada || eliminando) return false;
    setEliminando(true);
    setError(null);
    try {
      await repository.eliminarJornadaSegura(jornada);
      await registrarAuditoriaSilenciosa(jornada.id, 'eliminar', []);
      onEliminada?.(jornada.id);
      cerrar();
      return true;
    } catch (err) {
      if (err instanceof EliminacionNoPermitidaError) {
        // Borrado bloqueado por historial: ofrecer cancelar (si aplica) y SIEMPRE archivar.
        setError({ mensaje: err.message, ofrecerCancelar: true, ofrecerArchivar: true });
        setConfirmando(false);
        setEliminando(false);
        return false;
      }
      setError({
        mensaje: err instanceof Error ? err.message : 'No se pudo eliminar la clase.',
        ofrecerCancelar: false,
        ofrecerArchivar: false,
      });
      setConfirmando(false);
      setEliminando(false);
      return false;
    }
  }, [jornada, eliminando, repository, registrarAuditoriaSilenciosa, onEliminada, cerrar]);

  const cancelarEnLugarDeEliminar = useCallback(async (motivoPersonalizado?: string): Promise<boolean> => {
    if (!jornada) return false;
    const motivo = motivoPersonalizado?.trim() || MOTIVO_CANCELACION_POR_DEFECTO;
    setEliminando(true);
    try {
      const cancelada = cancelarJornada(jornada, motivo);
      await repository.guardarJornada(cancelada, { actualizadoEnEsperado: jornada.actualizadoEn });
      await registrarAuditoriaSilenciosa(cancelada.id, 'cancelar', diffCambiosJornada(jornada, cancelada));
      onEliminada?.(jornada.id);
      cerrar();
      return true;
    } catch (err) {
      // Cancelar fallo (p.ej. la maquina de estados no admite `cancelada` desde este estado):
      // el borrado sigue bloqueado, asi que archivar sigue siendo la salida. No se pierde.
      setError({
        mensaje: err instanceof Error ? err.message : 'No se pudo cancelar la clase.',
        ofrecerCancelar: false,
        ofrecerArchivar: true,
      });
      setEliminando(false);
      return false;
    }
  }, [jornada, repository, registrarAuditoriaSilenciosa, onEliminada, cerrar]);

  const archivar = useCallback(async (): Promise<boolean> => {
    if (!jornada) return false;
    if (!repository.archivarJornada) {
      setError({ mensaje: 'Esta vista no permite archivar clases.', ofrecerCancelar: false, ofrecerArchivar: false });
      return false;
    }
    setEliminando(true);
    try {
      await repository.archivarJornada(jornada);
      await registrarAuditoriaSilenciosa(jornada.id, 'archivar', []);
      onEliminada?.(jornada.id);
      cerrar();
      return true;
    } catch (err) {
      setError({
        mensaje: err instanceof Error ? err.message : 'No se pudo quitar la clase de la agenda.',
        ofrecerCancelar: false,
        ofrecerArchivar: false,
      });
      setEliminando(false);
      return false;
    }
  }, [jornada, repository, registrarAuditoriaSilenciosa, onEliminada, cerrar]);

  return { jornada, confirmando, eliminando, error, iniciar, confirmar, cancelarEnLugarDeEliminar, archivar, cerrar };
}
