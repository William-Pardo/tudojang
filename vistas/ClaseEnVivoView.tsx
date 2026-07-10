// vistas/ClaseEnVivoView.tsx
//
// Reescritura Fase 3 (clase-en-vivo-checkin-trigger-agenda, Bloque A): antes
// montaba el Sistema B demo (`claseEnVivoApi.ts`/`asistenciaQrApi.ts`, nunca
// persistio en Firestore, bug de firma confirmado). Ahora carga la
// `JornadaInstruccion` real por `jornadaId` (via `jornadaRepository`, Fase 0/1),
// monta el escaner real de Clase en Vivo (`EscanerAsistenciaClase`, que a su
// vez usa el callable `registrarAsistenciaJornada` de la Fase 1) y lista los
// check-ins ya registrados en la subcoleccion `asistencias` (Fase 2,
// `asistenciaRepository`).
//
// El archivado formal del Sistema B (`git mv` de `claseEnVivoApi.ts`/
// `asistenciaQrApi.ts`, retiro de tipos en `tipos.ts`, reglas huerfanas) es
// tarea de la Fase 5 -- fuera de alcance de esta fase. Este archivo deja de
// importarlos, que es el cambio de comportamiento real que le compete a la
// Fase 3.
//
// La ventana horaria dinamica y el trigger real desde Agenda (`App.tsx`,
// `Horarios.tsx`) son Fase 4 -- fuera de alcance de esta fase. Por eso este
// componente acepta `jornadaId` tanto por prop como por parametro de ruta
// (`useParams`), y ademas conserva props opcionales `jornada`/`claseActiva`
// (Sistema B) solo para que el call site actual de `App.tsx:334`
// (`<ClaseEnVivoView jornada={{ id: 'jornada-demo', ... }} claseActiva={null} />`)
// siga compilando sin cambios hasta que la Fase 4 reemplace esa ruta por
// `/clase-en-vivo/:jornadaId` real.
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import EscanerAsistenciaClase from '../components/academico/EscanerAsistenciaClase';
import {
  jornadaRepository as jornadaRepositoryPorDefecto,
  type JornadaRepository,
} from '../servicios/academico/jornadaRepository';
import {
  asistenciaRepository as asistenciaRepositoryPorDefecto,
  type AsistenciaRepository,
} from '../servicios/academico/asistenciaRepository';
import type { JornadaInstruccion } from '../models/academico/jornada';
import type { RegistroAsistencia } from '../models/academico/asistencia';

export interface ClaseEnVivoViewProps {
  jornadaId?: string;
  /**
   * @deprecated Sistema B (Fase 4 retira este call site en App.tsx). Solo se
   * usa como fallback de `jornadaId`. Forma laxa a proposito: coincide con el
   * literal que hoy pasa `App.tsx:334` (`{ id, tenantId, estado }`), pero no
   * se lee ningun campo salvo `id`.
   */
  jornada?: { id: string; tenantId?: string; estado?: string } | null;
  /** @deprecated Sistema B, sin uso en el flujo real. */
  claseActiva?: unknown;
  repository?: JornadaRepository;
  asistenciaRepository?: AsistenciaRepository;
}

type EstadoCarga = 'cargando' | 'no-encontrada' | 'lista';

export const ClaseEnVivoView: React.FC<ClaseEnVivoViewProps> = ({
  jornadaId: jornadaIdProp,
  jornada,
  repository = jornadaRepositoryPorDefecto,
  asistenciaRepository: asistenciaRepositorio = asistenciaRepositoryPorDefecto,
}) => {
  const params = useParams<{ jornadaId?: string }>();
  const jornadaId = jornadaIdProp ?? params.jornadaId ?? jornada?.id;
  const { usuario } = useAuth();
  const tenantId = usuario?.tenantId ?? '';

  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>('cargando');
  const [jornadaActual, setJornadaActual] = useState<JornadaInstruccion | null>(null);
  const [asistencias, setAsistencias] = useState<RegistroAsistencia[]>([]);
  const [escanerAbierto, setEscanerAbierto] = useState(false);

  const cargarAsistencias = useCallback(
    async (jornadaCargada: JornadaInstruccion) => {
      const registros = await asistenciaRepositorio.listarPorJornada(
        jornadaCargada.tenantId,
        jornadaCargada.id
      );
      setAsistencias(registros);
    },
    [asistenciaRepositorio]
  );

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      if (!jornadaId || !tenantId) {
        if (!cancelado) {
          setJornadaActual(null);
          setEstadoCarga('no-encontrada');
        }
        return;
      }

      setEstadoCarga('cargando');
      const jornadas = await repository.listarJornadasPorTenant(tenantId);
      if (cancelado) return;

      const encontrada = jornadas.find((item) => item.id === jornadaId) ?? null;
      setJornadaActual(encontrada);
      setEstadoCarga(encontrada ? 'lista' : 'no-encontrada');

      if (encontrada) {
        await cargarAsistencias(encontrada);
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [jornadaId, tenantId, repository, cargarAsistencias]);

  if (estadoCarga === 'cargando') {
    return (
      <div className="p-8 text-center text-white/60">
        <p>Cargando clase…</p>
      </div>
    );
  }

  if (estadoCarga === 'no-encontrada' || !jornadaActual) {
    return (
      <div className="p-8 text-center space-y-2">
        <h1 className="text-xl font-black uppercase">Clase en Vivo</h1>
        <p className="text-white/60">No se encontró la jornada solicitada.</p>
      </div>
    );
  }

  if (jornadaActual.estado !== 'en_curso') {
    return (
      <div className="p-8 text-center space-y-2">
        <h1 className="text-xl font-black uppercase">Clase en Vivo</h1>
        <p className="text-white/60">
          La jornada no está en curso. Estado actual: {jornadaActual.estado}.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-black uppercase">Clase en Vivo</h1>
        <p className="text-white/60">
          {jornadaActual.fecha} · {jornadaActual.horaInicio} - {jornadaActual.horaFin}
        </p>
        {jornadaActual.tema && <p className="text-white/80 font-bold">{jornadaActual.tema}</p>}
      </header>

      <button
        onClick={() => setEscanerAbierto(true)}
        className="bg-tkd-blue text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest"
      >
        Escanear asistencia
      </button>

      <section className="space-y-2">
        <h2 className="text-sm font-black uppercase tracking-wide">
          Check-ins registrados ({asistencias.length})
        </h2>
        {asistencias.length === 0 ? (
          <p className="text-white/50 text-sm">Todavía no hay check-ins registrados.</p>
        ) : (
          <ul className="space-y-1">
            {asistencias.map((registro) => (
              <li key={registro.estudianteId} className="text-sm">
                {registro.estudianteId} — {registro.horaSalida ? 'Completo' : 'En curso'}
              </li>
            ))}
          </ul>
        )}
      </section>

      {escanerAbierto && (
        <EscanerAsistenciaClase
          tenantId={tenantId}
          jornadaId={jornadaActual.id}
          onClose={() => setEscanerAbierto(false)}
          onRegistrado={() => cargarAsistencias(jornadaActual)}
        />
      )}
    </div>
  );
};
