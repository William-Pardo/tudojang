import React from 'react';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import type { OpcionJornada } from '../../servicios/academico/jornadaContextService';

// Subtarea 12.7 (Parte 1): formulario "Programa" de una jornada (programa, grupo, sede,
// espacio, instructor), extraido de `JornadasView.tsx` para que el modal de edicion singular
// de 12.9 lo reutilice como pestana "Programa" sin duplicar el markup ni las opciones.
//
// Es un componente 100% presentacional/controlado: no tiene estado propio ni valida nada por
// su cuenta. Recibe los valores actuales de la jornada (draft) y las opciones ya cargadas
// (via `obtenerContextoJornada`), y emite el cambio de cada campo por callback. Las reglas de
// negocio (conflicto de horario, concurrencia optimista, auditoria) viven en el contenedor
// que lo consume (hoy `JornadasView`, mañana el modal de 12.9), NO aca — el objetivo del
// extract era mover el markup sin cambiar comportamiento, no reimplementar validaciones.

export interface OpcionesProgramaJornada {
  programas: OpcionJornada[];
  grupos: OpcionJornada[];
  sedes: OpcionJornada[];
  espacios: OpcionJornada[];
  instructores: OpcionJornada[];
}

export interface PestanaProgramaJornadaProps {
  // Solo los campos que este formulario edita; se acepta un subset para que un draft parcial
  // (p.ej. el del modal de 12.9) tambien encaje sin exigir una JornadaInstruccion completa.
  jornada: Pick<JornadaInstruccion, 'programaId' | 'grupoId' | 'sedeId' | 'espacioId' | 'instructorId'>;
  opciones: OpcionesProgramaJornada;
  onProgramaChange: (programaId: string) => void;
  onGrupoChange: (grupoId: string) => void;
  onSedeChange: (sedeId: string) => void;
  onEspacioChange: (espacioId: string) => void;
  onInstructorChange: (instructorId: string) => void;
}

const CLASE_LABEL = 'text-[10px] font-black uppercase tracking-widest text-gray-400';
const CLASE_SELECT = 'rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold';

const PestanaProgramaJornada: React.FC<PestanaProgramaJornadaProps> = ({
  jornada,
  opciones,
  onProgramaChange,
  onGrupoChange,
  onSedeChange,
  onEspacioChange,
  onInstructorChange,
}) => (
  <div className="grid gap-4 md:grid-cols-5">
    <div className="grid gap-2">
      <label htmlFor="jornada-programa" className={CLASE_LABEL}>
        Programa
      </label>
      <select
        id="jornada-programa"
        value={jornada.programaId}
        onChange={(event) => onProgramaChange(event.target.value)}
        className={CLASE_SELECT}
      >
        {opciones.programas.map((programaOpcion) => (
          <option key={programaOpcion.id} value={programaOpcion.id}>{programaOpcion.nombre}</option>
        ))}
      </select>
    </div>

    <div className="grid gap-2">
      <label htmlFor="jornada-grupo" className={CLASE_LABEL}>
        Grupo
      </label>
      <select
        id="jornada-grupo"
        value={jornada.grupoId}
        onChange={(event) => onGrupoChange(event.target.value)}
        className={CLASE_SELECT}
      >
        {opciones.grupos.map((grupo) => (
          <option key={grupo.id} value={grupo.id}>{grupo.nombre}</option>
        ))}
      </select>
    </div>

    <div className="grid gap-2">
      <label htmlFor="jornada-sede" className={CLASE_LABEL}>
        Sede
      </label>
      <select
        id="jornada-sede"
        value={jornada.sedeId}
        onChange={(event) => onSedeChange(event.target.value)}
        className={CLASE_SELECT}
      >
        {opciones.sedes.map((sede) => (
          <option key={sede.id} value={sede.id}>{sede.nombre}</option>
        ))}
      </select>
    </div>

    <div className="grid gap-2">
      <label htmlFor="jornada-espacio" className={CLASE_LABEL}>
        Espacio
      </label>
      <select
        id="jornada-espacio"
        value={jornada.espacioId}
        onChange={(event) => onEspacioChange(event.target.value)}
        className={CLASE_SELECT}
      >
        {opciones.espacios.map((espacio) => (
          <option key={espacio.id} value={espacio.id}>{espacio.nombre}</option>
        ))}
      </select>
    </div>

    <div className="grid gap-2">
      <label htmlFor="jornada-instructor" className={CLASE_LABEL}>
        Instructor
      </label>
      <select
        id="jornada-instructor"
        value={jornada.instructorId}
        onChange={(event) => onInstructorChange(event.target.value)}
        className={CLASE_SELECT}
      >
        {opciones.instructores.map((instructor) => (
          <option key={instructor.id} value={instructor.id}>{instructor.nombre}</option>
        ))}
      </select>
    </div>
  </div>
);

export default PestanaProgramaJornada;
