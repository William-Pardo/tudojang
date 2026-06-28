import React from 'react';
import { useCentroEstudios } from '../hooks/useCentroEstudios';
import { useAuth } from '../context/AuthContext';
import { RolUsuario } from '../tipos';
import { centroEstudiosRepository, prepararAsignacionesCentroEstudios } from '../servicios/academico/centroEstudiosRepository';
import type { AsignacionCentroEstudios } from '../models/academico/asignacionService.types';
import { IconoInformacion } from '../components/Iconos';
import AsignacionCard from '../components/academico/AsignacionCard';
import MaterialPreviewModal from '../components/academico/MaterialPreviewModal';
import ProgresoResumenCard, { type MetricasProgresoAcademico } from '../components/academico/ProgresoResumenCard';
import { calcularMetricasCentroEstudios } from '../utils/academico/centroEstudios';
import JornadasView from './admin/JornadasView';

const CentroEstudios: React.FC = () => {
  const { centroEstudiosActivo } = useCentroEstudios();
  const { usuario } = useAuth();
  const [asignaciones, setAsignaciones] = React.useState<AsignacionCentroEstudios[]>([]);
  const [asignacionAbierta, setAsignacionAbierta] = React.useState<AsignacionCentroEstudios | null>(null);
  const [cargando, setCargando] = React.useState(true);

  React.useEffect(() => {
    let activo = true;

    centroEstudiosRepository.obtenerAsignaciones({
      tenantId: usuario?.tenantId || 'demo',
      estudianteId: usuario?.id || 'demo-estudiante',
    }).then((respuesta) => {
      if (!activo) return;
      setAsignaciones(respuesta.asignaciones);
      setCargando(false);
    });

    return () => {
      activo = false;
    };
  }, [usuario?.id, usuario?.tenantId]);

  const cerrarMaterial = () => {
    setAsignacionAbierta(null);
    setAsignaciones((actuales) => prepararAsignacionesCentroEstudios(actuales));
  };

  const metricas: MetricasProgresoAcademico = React.useMemo(
    () => calcularMetricasCentroEstudios(asignaciones),
    [asignaciones]
  );
  const puedeGestionarJornadas = usuario?.rol === RolUsuario.Admin || usuario?.rol === RolUsuario.Editor;

  return (
    <div className="p-4 sm:p-10 space-y-10 animate-fade-in">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">
            Centro de Estudios
          </h1>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-2">
            Gestión de materiales y progreso académico
          </p>
        </div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
          Materiales, tareas y progreso · sin consumo de IA
        </p>
      </header>

      {!centroEstudiosActivo && (
        <div className="rounded-3xl border border-yellow-200 bg-yellow-50 text-yellow-800 p-5 flex gap-3">
          <IconoInformacion className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-black uppercase text-xs tracking-widest">Modo piloto visible</p>
            <p className="text-sm mt-1">
              El feature flag del tenant aún no está activo. La vista carga datos demo para validar UX y grabar el flujo.
            </p>
          </div>
        </div>
      )}

      <ProgresoResumenCard metricas={metricas} />

      {puedeGestionarJornadas && (
        <section className="rounded-[2.5rem] border border-gray-100 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.03] p-2 sm:p-4">
          <div className="px-4 pt-4 pb-2">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">Gestion academica del maestro</p>
            <h2 className="text-2xl font-black uppercase text-tkd-dark dark:text-white">Plan y cierre de clase</h2>
            <p className="mt-2 text-sm font-bold text-gray-400">
              Crea trazabilidad de la clase sin intervenir la practica: confirma, inicia y cierra la jornada para alimentar progreso, programa y refuerzos.
            </p>
          </div>
          <JornadasView embedded />
        </section>
      )}

      <section>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">Mi ruta académica</p>
            <h2 className="text-2xl font-black uppercase text-tkd-dark dark:text-white">Asignaciones activas</h2>
          </div>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Demo UX · sin consumo de IA</p>
        </div>

        {cargando ? (
          <div className="rounded-[2rem] border border-gray-100 p-8 text-sm text-gray-400">Cargando Centro de Estudios...</div>
        ) : asignaciones.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 p-10 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">
              Centro de Estudios vacio
            </p>
            <h3 className="mt-3 text-2xl font-black uppercase text-tkd-dark dark:text-white">
              Aun no tienes materiales asignados
            </h3>
            <p className="mt-3 text-sm font-bold text-gray-400">
              Cuando tu maestro publique una asignacion academica, aparecera en esta seccion.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {asignaciones.map((asignacion) => (
              <AsignacionCard
                key={asignacion.id}
                asignacion={asignacion}
                onAbrirMaterial={setAsignacionAbierta}
              />
            ))}
          </div>
        )}
      </section>

      <MaterialPreviewModal
        asignacion={asignacionAbierta}
        onCerrar={cerrarMaterial}
      />
    </div>
  );
};

export default CentroEstudios;
