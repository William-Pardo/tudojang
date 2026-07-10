// hooks/useVentanaClaseEnVivo.ts
//
// Fase 4 (clase-en-vivo-checkin-trigger-agenda, Bloque A): hook que envuelve
// `calcularVentanaClaseEnVivo` (servicio puro) con las jornadas reales del tenant del
// usuario actual, filtradas por permiso basico (Editor/"maestro" solo ve las suyas;
// Admin/SuperAdmin/Asistente ven todas del tenant -- mismo criterio que ya aplica el
// callable `registrarAsistenciaJornada` de la Fase 1, ver `design.md` "Roles y permisos").
// El filtro completo por permisos (`filtrarJornadasPorPermiso`) se centraliza en Bloque B
// / Fase 9 -- este hook aplica la misma regla de negocio de forma minima para no mostrar
// el link de Agenda a un maestro para clases que no puede operar.
//
// Recalcula la ventana cada 60s reutilizando el mismo intervalo que ya usaba el
// placeholder de `App.tsx` (`design.md`, Decision 7).
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { RolUsuario } from '../tipos';
import {
  jornadaRepository as jornadaRepositoryPorDefecto,
  type JornadaRepository,
} from '../servicios/academico/jornadaRepository';
import { calcularVentanaClaseEnVivo } from '../servicios/academico/ventanaClaseEnVivoService';
import type { JornadaInstruccion } from '../models/academico/jornada';

const INTERVALO_RECALCULO_MS = 60_000;

export interface UseVentanaClaseEnVivoResultado {
  jornadaActiva: JornadaInstruccion | null;
  cargando: boolean;
}

export function useVentanaClaseEnVivo(
  repository: JornadaRepository = jornadaRepositoryPorDefecto
): UseVentanaClaseEnVivoResultado {
  const { usuario } = useAuth();
  const [jornadas, setJornadas] = useState<JornadaInstruccion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ahoraIso, setAhoraIso] = useState(() => new Date().toISOString());

  useEffect(() => {
    let cancelado = false;

    if (!usuario?.tenantId) {
      setJornadas([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    repository.listarJornadasPorTenant(usuario.tenantId).then((lista) => {
      if (!cancelado) {
        setJornadas(lista);
        setCargando(false);
      }
    });

    return () => {
      cancelado = true;
    };
  }, [usuario?.tenantId, repository]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setAhoraIso(new Date().toISOString());
    }, INTERVALO_RECALCULO_MS);
    return () => clearInterval(intervalId);
  }, []);

  const jornadasVisibles = useMemo(() => {
    if (!usuario) return [];
    if (usuario.rol === RolUsuario.Editor) {
      return jornadas.filter((jornada) => jornada.instructorId === usuario.id);
    }
    return jornadas;
  }, [jornadas, usuario]);

  const jornadaActiva = useMemo(
    () => calcularVentanaClaseEnVivo(jornadasVisibles, ahoraIso),
    [jornadasVisibles, ahoraIso]
  );

  return { jornadaActiva, cargando };
}
