import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { IconoProgresoEstudiante, IconoFlujoAcademico } from '../components/Iconos';
import { useAuth } from '../context/AuthContext';
import { useConfiguracion } from '../context/DataContext';
import { RolUsuario } from '../tipos';
import { centroEstudiosRepository, prepararAsignacionesCentroEstudios } from '../servicios/academico/centroEstudiosRepository';
import { resolveStudentsForConsultor } from '../servicios/academico/tutorStudentResolver';
import { crearProgresoRepository } from '../servicios/academico/progresoRepository';
import type { AsignacionCentroEstudios } from '../models/academico/asignacionService.types';
import AsignacionCard from '../components/academico/AsignacionCard';
import MaterialPreviewModal from '../components/academico/MaterialPreviewModal';
import ProgresoResumenCard, { type MetricasProgresoAcademico } from '../components/academico/ProgresoResumenCard';
import { calcularMetricasCentroEstudios } from '../utils/academico/centroEstudios.ts';
import AsignacionesView from './admin/AsignacionesView';
import BibliotecaView from './admin/BibliotecaView';
import PanelMetricasEstudiantes from '../components/academico/PanelMetricasEstudiantes';
import { db, isFirebaseConfigured } from '../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { resolverTabInicial } from '../utils/navegacion/resolverTabInicial';

type TabGestion = 'flujo' | 'metricas';

// Ids validos para el deep-link `?tab=` del acordeon mobile (ver
// components/navegacion/menuMobileHijos.tsx::hijosCentroEstudios).
const CENTRO_ESTUDIOS_TAB_IDS: readonly TabGestion[] = ['flujo', 'metricas'];

const pasosCentroEstudios = [
  {
    numero: '1',
    titulo: 'Conectar Drive',
    descripcion: 'Cuenta y carpeta',
  },
  {
    numero: '2',
    titulo: 'Centro de recursos',
    descripcion: 'Clasificar y aprobar',
  },
  {
    numero: '3',
    titulo: 'Programa y publicacion',
    descripcion: 'Asignar y publicar',
  },
];

const CentroEstudios: React.FC = () => {
  const { usuario } = useAuth();
  const { configClub } = useConfiguracion();
  const [searchParams] = useSearchParams();
  // Movido antes del useState de `tabGestion` (originalmente vivia mas abajo, junto a
  // `actualizarEstadoBiblioteca`) porque el nuevo inicializador de `tabGestion` lo necesita
  // para forzar 'flujo' cuando el rol no puede gestionar jornadas, sin importar `?tab=`
  // (regla del plan "menu mobile acordeon unificado"). Solo depende de `usuario`, ya
  // disponible arriba -- no altera el orden de los hooks.
  const puedeGestionarJornadas =
    usuario?.rol === RolUsuario.Admin ||
    usuario?.rol === RolUsuario.SuperAdmin ||
    usuario?.rol === RolUsuario.Editor;
  const [asignaciones, setAsignaciones] = React.useState<AsignacionCentroEstudios[]>([]);
  const [asignacionAbierta, setAsignacionAbierta] = React.useState<AsignacionCentroEstudios | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [triggerRecursos, setTriggerRecursos] = React.useState(0);
  // Si el rol no puede gestionar jornadas, se fuerza 'flujo' sin importar el query param --
  // 'metricas' no existe para ese rol (mismo criterio que ya usaba esta vista para no
  // mostrarle el tab switcher). Si puede, se valida `?tab=` contra los 2 ids conocidos.
  const [tabGestion, setTabGestion] = React.useState<TabGestion>(() =>
    !puedeGestionarJornadas ? 'flujo' : resolverTabInicial(CENTRO_ESTUDIOS_TAB_IDS, searchParams.get('tab'), 'flujo')
  );
  const [estudianteResueltoId, setEstudianteResueltoId] = React.useState<string | null>(null);
  const [estudianteResueltoNombre, setEstudianteResueltoNombre] = React.useState<string | null>(null);
  const [estadoBiblioteca, setEstadoBiblioteca] = React.useState({
    driveConectado: false,
    carpetaSeleccionada: false,
    archivosDetectados: 0,
    recursosAprobados: 0,
  });
  const [estadoAsignaciones, setEstadoAsignaciones] = React.useState({
    recursosAprobados: 0,
    recursoSeleccionado: false,
    pasoPublicacion: 1,
    jornadaConfirmada: false,
    materialPublicado: false,
  });
  const [recursosParaLote, setRecursosParaLote] = React.useState<string[]>([]);

  // Phase 5: Resolver linked student for Tutores
  React.useEffect(() => {
    let activo = true;

    if (!usuario?.tenantId) return;

    const cargarAsignaciones = async () => {
      let estudianteIdParaQuery = usuario.id || 'demo-estudiante';
      let estudianteNombreDisplay = usuario.nombreUsuario || 'Estudiante';

      // Fix tutor-role-end-to-end (2026-07-14): consultores (Tutor y Estudiante) resuelven
      // su estudiante por EMAIL de login — Tutor por `tutor.correo`, Estudiante por `correo`
      // (ver resolveStudentsForConsultor). Antes el Estudiante usaba usuario.id (Auth UID),
      // que no es el docId del estudiante -> consultaba materiales con id incorrecto.
      const esConsultor = usuario.rol === RolUsuario.Tutor || usuario.rol === RolUsuario.Estudiante;
      if (esConsultor) {
        try {
          const esTutor = usuario.rol === RolUsuario.Tutor;
          const estudiantesResueltos = await resolveStudentsForConsultor(usuario.tenantId, usuario.email, esTutor);
          if (estudiantesResueltos.length > 0) {
            estudianteIdParaQuery = estudiantesResueltos[0].id;
            estudianteNombreDisplay = `${estudiantesResueltos[0].nombres} ${estudiantesResueltos[0].apellidos}`;
            setEstudianteResueltoId(estudianteIdParaQuery);
            setEstudianteResueltoNombre(estudianteNombreDisplay);
          } else {
            console.warn('Consultor sin estudiante resuelto');
            setCargando(false);
            return;
          }
        } catch (err) {
          console.error('Error resolviendo estudiante del consultor:', err);
          setCargando(false);
          return;
        }
      }

      try {
        const respuesta = await centroEstudiosRepository.obtenerAsignaciones({
          tenantId: usuario.tenantId,
          estudianteId: estudianteIdParaQuery,
        });
        if (!activo) return;
        setAsignaciones(respuesta.asignaciones);
      } catch (err) {
        console.error('Error cargando asignaciones:', err);
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    };

    cargarAsignaciones();

    return () => {
      activo = false;
    };
  }, [usuario?.id, usuario?.tenantId, usuario?.rol]);

  const cerrarMaterial = () => {
    setAsignacionAbierta(null);
    setAsignaciones((actuales) => prepararAsignacionesCentroEstudios(actuales));
  };

  const metricas: MetricasProgresoAcademico = React.useMemo(
    () => calcularMetricasCentroEstudios(asignaciones),
    [asignaciones]
  );
  const actualizarEstadoBiblioteca = React.useCallback((estado: typeof estadoBiblioteca) => {
    setEstadoBiblioteca(estado);
  }, []);
  const actualizarEstadoAsignaciones = React.useCallback((estado: typeof estadoAsignaciones) => {
    setEstadoAsignaciones(estado);
  }, []);
  const agregarRecursoParaLote = React.useCallback((recursoId: string) => {
    setRecursosParaLote((actual) => (actual.includes(recursoId) ? actual : [...actual, recursoId]));
  }, []);
  // Paso 2 ("Centro de recursos") combina la clasificacion+aprobacion (antes paso 2 y 3
  // por separado): refleja archivos detectados, recursos aprobados en Biblioteca o
  // seleccion/aprobados ya vistos por Asignaciones, sin volver a dividirse en un paso propio.
  const pasosConEstado = React.useMemo(() => pasosCentroEstudios.map((paso) => {
    if (paso.numero === '1') {
      return { ...paso, activo: estadoBiblioteca.driveConectado || estadoBiblioteca.carpetaSeleccionada };
    }
    if (paso.numero === '2') {
      return {
        ...paso,
        activo: estadoBiblioteca.carpetaSeleccionada
          || estadoBiblioteca.archivosDetectados > 0
          || estadoBiblioteca.recursosAprobados > 0
          || estadoAsignaciones.recursosAprobados > 0
          || estadoAsignaciones.recursoSeleccionado,
      };
    }
    return {
      ...paso,
      activo: estadoAsignaciones.pasoPublicacion >= 2 || estadoAsignaciones.jornadaConfirmada || estadoAsignaciones.materialPublicado,
    };
  }), [estadoAsignaciones, estadoBiblioteca]);
  const progresoAcademicoRepository = React.useMemo(() => crearProgresoRepository({
    modo: isFirebaseConfigured ? 'firestore' : 'local',
    estudianteId: usuario?.id ?? null,
    firestoreDeps: {
      db,
      doc,
      getDoc,
      setDoc,
    },
  }), [usuario?.id]);

  return (
    <div className="p-4 sm:p-8 space-y-6 animate-fade-in">
      <header className="space-y-5">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none">
            {usuario?.rol === RolUsuario.Tutor && estudianteResueltoNombre
              ? `Materiales de ${estudianteResueltoNombre}`
              : usuario?.rol === RolUsuario.Estudiante
              ? 'Mis materiales'
              : 'Centro de Estudios'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-bold text-gray-500 dark:text-gray-300">
            {usuario?.rol === RolUsuario.Tutor
              ? 'Recursos académicos asignados a tu hijo'
              : usuario?.rol === RolUsuario.Estudiante
              ? 'Tus recursos académicos asignados'
              : 'Convierte archivos de Drive en recursos aprobados y publicalos a una clase, grupo o estudiante.'}
          </p>
        </div>
      </header>

      {/* Tab switcher: se ubica antes del stepper para que, al entrar a "Progreso
          estudiantes", no quede debajo un stepper de un flujo distinto (bug reportado:
          el stepper de Flujo académico seguía visible en la pestaña de Métricas). */}
      {puedeGestionarJornadas && (
        <div className="bg-white dark:bg-gray-800/50 p-1.5 rounded-[2rem] shadow-soft border border-gray-100 dark:border-white/5 w-fit" role="tablist" aria-label="Secciones de gestión">
          <div className="flex flex-row gap-1">
            <button
              role="tab"
              aria-selected={tabGestion === 'flujo'}
              id="tab-flujo"
              aria-controls="panel-flujo"
              onClick={() => setTabGestion('flujo')}
              className={`flex-shrink-0 flex items-center justify-center gap-3 px-6 py-4 md:py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                tabGestion === 'flujo'
                  ? 'bg-tkd-dark text-white shadow-xl scale-[1.01] md:scale-[1.03] z-10'
                  : 'text-gray-400 hover:text-tkd-blue hover:bg-gray-50 dark:hover:bg-white/5'
              }`}
            >
              <IconoFlujoAcademico className={`w-[30px] h-[30px] scale-[1.39] ${tabGestion === 'flujo' ? 'text-tkd-red' : ''}`} />
              <span>Flujo académico</span>
            </button>
            <button
              role="tab"
              aria-selected={tabGestion === 'metricas'}
              id="tab-metricas"
              aria-controls="panel-metricas"
              onClick={() => setTabGestion('metricas')}
              className={`flex-shrink-0 flex items-center justify-center gap-3 px-6 py-4 md:py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                tabGestion === 'metricas'
                  ? 'bg-tkd-dark text-white shadow-xl scale-[1.01] md:scale-[1.03] z-10'
                  : 'text-gray-400 hover:text-tkd-blue hover:bg-gray-50 dark:hover:bg-white/5'
              }`}
            >
              <IconoProgresoEstudiante className={`w-[30px] h-[30px] scale-[1.11] ${tabGestion === 'metricas' ? 'text-tkd-red' : ''}`} />
              <span>Progreso estudiantes</span>
            </button>
          </div>
        </div>
      )}

      {/* El stepper de 3 pasos (Conectar Drive / Centro de recursos / Programa y
          publicacion) solo describe el pipeline de "Flujo académico": no tiene sentido
          en la pestaña de Métricas, así que solo se renderiza cuando esa es la pestaña
          activa. Para estudiantes (sin `puedeGestionarJornadas`, sin tab switcher)
          `tabGestion` nunca cambia de 'flujo', por lo que el stepper sigue visible
          para ellos igual que antes. */}
      {/* Fix tutor-role-end-to-end (2026-07-14): el stepper de 3 pasos (Conectar Drive /
          Centro de recursos / Programa y publicación) describe el pipeline de GESTIÓN de
          contenido — solo aplica a staff. Un consultor (Tutor/Estudiante) no debe verlo:
          su vista es exclusivamente sus materiales/progreso. Se gatea a puedeGestionarJornadas. */}
      {puedeGestionarJornadas && tabGestion === 'flujo' && (
        <ol className="rounded-[2rem] border border-gray-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900 grid gap-3 lg:grid-cols-[18fr_34fr_48fr] lg:items-center" aria-label="Flujo principal de Centro de Estudios">
          {pasosConEstado.map((paso) => (
              <li
                key={paso.numero}
                className={`flex items-center gap-4 rounded-[1.5rem] p-3 transition ${
                  paso.activo ? 'bg-blue-50/80 dark:bg-blue-400/10' : 'bg-gray-50 dark:bg-white/5'
                }`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                  paso.activo ? 'bg-tkd-blue text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {paso.numero}
                </span>
                <span>
                  <span className={`block text-sm font-black ${paso.activo ? 'text-tkd-blue dark:text-white' : 'text-gray-400'}`}>{paso.titulo}</span>
                  <span className="block text-xs font-bold text-gray-400">{paso.descripcion}</span>
                </span>
              </li>
          ))}
        </ol>
      )}

      {metricas.total > 0 && <ProgresoResumenCard metricas={metricas} />}


      {puedeGestionarJornadas && (
        <section className="space-y-5">
          {/* Panel: Flujo académico (Biblioteca + Asignaciones) */}
          {tabGestion === 'flujo' && (
            <div
              id="panel-flujo"
              role="tabpanel"
              aria-labelledby="tab-flujo"
              className="grid gap-5 xl:grid-cols-[18fr_34fr_48fr]"
            >
              {/* Modo demo comercial (marketing, ver tipos.ts ConfiguracionClub.esDemoComercial):
                  la configuración de Biblioteca/Drive se reserva como valor agregado -- no se
                  muestra en la demo. Asignaciones sigue visible (gestiona material ya publicado,
                  no la conexión con Drive). */}
              {!configClub?.esDemoComercial && (
                <BibliotecaView
                  embedded
                  tenantId={usuario?.tenantId ?? 'tenant-local'}
                  usuarioId={usuario?.id ?? 'usuario-local'}
                  onRecursoAprobado={() => setTriggerRecursos(prev => prev + 1)}
                  onFlujoEstadoChange={actualizarEstadoBiblioteca}
                />
              )}

              <AsignacionesView
                embedded
                refreshTrigger={triggerRecursos}
                onFlujoEstadoChange={actualizarEstadoAsignaciones}
                recursoIdsParaLote={recursosParaLote}
              />
            </div>
          )}

          {/* Panel: Métricas por estudiante */}
          {tabGestion === 'metricas' && (
            <div
              id="panel-metricas"
              role="tabpanel"
              aria-labelledby="tab-metricas"
            >
              <PanelMetricasEstudiantes
                tenantId={usuario?.tenantId ?? 'tenant-local'}
              />
            </div>
          )}
        </section>
      )}


      {!puedeGestionarJornadas && (
      <section>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">Mi ruta académica</p>
            <h2 className="text-2xl font-black uppercase text-tkd-dark dark:text-white">Asignaciones activas</h2>
          </div>
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
      )}

      <MaterialPreviewModal
        asignacion={asignacionAbierta}
        onCerrar={cerrarMaterial}
        repository={progresoAcademicoRepository}
        // Fix 2026-07-16 (bug reportado: un Tutor viendo el material de su hijo para
        // confirmar la asignación inflaba las métricas de consumo del estudiante): antes se
        // pasaba usuario?.id (el Auth UID de QUIEN ESTÁ LOGUEADO) sin importar el rol -- para
        // Tutor eso es su propia cuenta, no el estudiante, y de todas formas activaba el
        // registro de actividad (useRegistrarActividad solo revisa "¿hay estudianteId?").
        // Ahora solo se pasa cuando el propio Estudiante es quien mira (con su id REAL de
        // `estudiantes/{id}`, resuelto por email -- no su Auth UID, que tampoco coincidía).
        // Tutor sigue pudiendo reproducir/ver el contenido real (ver fix de rolPermitido en
        // getTemporaryFileUrl), simplemente sin que cuente como consumo de nadie.
        estudianteId={usuario?.rol === RolUsuario.Estudiante ? (estudianteResueltoId ?? undefined) : undefined}
        estudianteNombre={usuario?.rol === RolUsuario.Estudiante ? (estudianteResueltoNombre ?? undefined) : undefined}
      />
    </div>
  );
};

export default CentroEstudios;
