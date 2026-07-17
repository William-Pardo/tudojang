import React from 'react';
import type { AsignacionCentroEstudios } from '../../models/academico/asignacionService.types';
import type { PreguntaQuiz } from '../../models/academico/quiz';
import { IconoCerrar } from '../Iconos';
import QuizView, { type ResultadoQuiz } from './QuizView';
import PdfViewer from './PdfViewer';
import VideoPlayer from './VideoPlayer';
import type { ProgresoSyncPayload } from '../../hooks/academico/useProgressSync';
import { progresoRepository, type FirestoreProgressRepository, type ProgresoRepository } from '../../servicios/academico/progresoRepository';
import { driveService as defaultDriveService, type TemporaryFileUrlResult } from '../../services/storage/driveService';
import { quizService as defaultQuizService } from '../../servicios/academico/quizService';
import { useRegistrarActividad } from '../../hooks/academico/useRegistrarActividad';

interface MaterialPreviewModalProps {
  asignacion: AsignacionCentroEstudios | null;
  onCerrar: () => void;
  repository?: ProgresoRepository | FirestoreProgressRepository;
  driveService?: Pick<typeof defaultDriveService, 'obtenerUrlTemporal' | 'obtenerUrlTemporalRecurso' | 'obtenerBlobProtegido'>;
  quizService?: Pick<typeof defaultQuizService, 'obtenerQuiz'>;
  /** Datos del estudiante para registrar actividad académica en métricas */
  estudianteId?: string;
  estudianteNombre?: string;
  /**
   * Vista previa administrativa de un recurso de Biblioteca (Admin/Editor/Asistente/Maestro
   * confirmando el contenido antes/después de asignarlo) -- pedido explícito del usuario
   * (2026-07-16). `asignacion` en este modo es una construida en memoria, no persistida
   * (ver `construirAsignacionPreview` en BibliotecaView.tsx), así que la URL de Drive se
   * resuelve contra el RECURSO (`obtenerUrlTemporalRecurso`) y no contra una asignación real.
   */
  modoVistaPrevia?: boolean;
}

function obtenerTipoMaterial(asignacion: AsignacionCentroEstudios): string {
  if (asignacion.uso === 'evaluacion') return 'Quiz / Evaluación';
  if (asignacion.uso === 'refuerzo') return 'Refuerzo guiado';
  return 'Material de estudio';
}

type TipoMaterialDetectado = 'video' | 'pdf' | 'quiz' | 'generico';

function detectarTipoMaterial(asignacion: AsignacionCentroEstudios): TipoMaterialDetectado {
  if (asignacion.uso === 'evaluacion') return 'quiz';
  const titulo = (asignacion.titulo || '').toLowerCase();
  if (
    titulo.endsWith('.mp4') ||
    titulo.endsWith('.mov') ||
    titulo.endsWith('.avi') ||
    titulo.endsWith('.mkv') ||
    asignacion.duracionSegundos !== undefined
  ) {
    return 'video';
  }

  // Extensiones genéricas explícitas
  const ext = titulo.split('.').pop() || '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'txt', 'md', 'ppt', 'pptx', 'key'].includes(ext)) {
    return 'generico';
  }

  // Fallback por defecto a pdf para compatibilidad
  return 'pdf';
}

const obtenerMensajeAccesoDrive = (err: unknown): string => {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code) : '';
  const message = err instanceof Error ? err.message : '';
  const normalizado = `${code} ${message}`.toLowerCase();

  if (normalizado.includes('not-found') || normalizado.includes('archivo') || normalizado.includes('eliminado')) {
    return 'Archivo de Drive no disponible. La asignacion debe revisarse antes de continuar.';
  }

  // 401 de nuestro proxy (proxyDriveMedia): el ID token de Firebase del usuario venció o es
  // inválido -- distinto de que la conexión de Drive del tenant esté revocada (más abajo).
  if (code === 'unauthenticated') {
    return 'Tu sesion expiro. Volve a iniciar sesion e intenta de nuevo.';
  }

  if (normalizado.includes('invalid_grant') || normalizado.includes('revoked')) {
    return 'Conexion de Drive expirada. Solicita al administrador reconectar Google Drive.';
  }

  if (normalizado.includes('permission-denied') || normalizado.includes('403') || normalizado.includes('forbidden')) {
    return 'Permisos insuficientes para abrir este recurso de Drive.';
  }

  return message || 'No se pudo obtener acceso temporal al recurso.';
};

const MaterialPreviewModal: React.FC<MaterialPreviewModalProps> = ({
  asignacion,
  onCerrar,
  repository = progresoRepository,
  driveService = defaultDriveService,
  quizService = defaultQuizService,
  estudianteId,
  estudianteNombre,
  modoVistaPrevia = false,
}) => {
  const [resultadoQuiz, setResultadoQuiz] = React.useState<ResultadoQuiz | null>(null);
  const [accesoTemporal, setAccesoTemporal] = React.useState<TemporaryFileUrlResult | null>(null);
  const [errorAcceso, setErrorAcceso] = React.useState('');
  const [textoContenido, setTextoContenido] = React.useState<string | null>(null);
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [preguntasQuiz, setPreguntasQuiz] = React.useState<PreguntaQuiz[] | null>(null);
  const [cargandoPreguntasQuiz, setCargandoPreguntasQuiz] = React.useState(false);

  const tipoMaterial = React.useMemo(
    () => (asignacion ? detectarTipoMaterial(asignacion) : 'generico'),
    [asignacion]
  );

  // Hook de registro de actividad
  const { registrarApertura } = useRegistrarActividad({
    tenantId: asignacion?.tenantId ?? '',
    estudianteId: estudianteId ?? '',
    estudianteNombre,
    asignacionId: asignacion?.id ?? '',
    recursoId: asignacion?.recursoId ?? '',
    tituloRecurso: asignacion?.titulo ?? '',
  });

  // Auto-registrar aperturas de archivos genéricos (imágenes, textos, etc.)
  React.useEffect(() => {
    if (!asignacion || !estudianteId || tipoMaterial !== 'generico') return;

    const ext = asignacion.titulo.split('.').pop()?.toLowerCase() || '';
    let tipoAct: 'imagen' | 'texto' | 'presentacion' | 'apertura' = 'apertura';

    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
      tipoAct = 'imagen';
    } else if (['txt', 'md'].includes(ext)) {
      tipoAct = 'texto';
    } else if (['ppt', 'pptx', 'key'].includes(ext)) {
      tipoAct = 'presentacion';
    }

    registrarApertura(tipoAct);
  }, [asignacion?.id, tipoMaterial, estudianteId, registrarApertura, asignacion?.titulo]);

  React.useEffect(() => {
    setResultadoQuiz(null);
  }, [asignacion?.id]);

  // Carga el banco de preguntas real del recurso -- antes de este wire, QuizView siempre
  // caía a su pregunta demo hardcodeada sin importar el recurso.
  React.useEffect(() => {
    setPreguntasQuiz(null);
    if (!asignacion || tipoMaterial !== 'quiz') return;

    let activo = true;
    setCargandoPreguntasQuiz(true);
    quizService.obtenerQuiz(asignacion.tenantId, asignacion.recursoId)
      .then((preguntas) => {
        if (activo) setPreguntasQuiz(preguntas);
      })
      .catch((err) => {
        console.warn('[MaterialPreviewModal] No se pudo cargar el banco de preguntas', err);
        if (activo) setPreguntasQuiz(null);
      })
      .finally(() => {
        if (activo) setCargandoPreguntasQuiz(false);
      });

    return () => { activo = false; };
  }, [asignacion, tipoMaterial, quizService]);

  React.useEffect(() => {
    setAccesoTemporal(null);
    setErrorAcceso('');
    setTextoContenido(null);
    setBlobUrl(null);

    if (!asignacion || asignacion.uso === 'evaluacion' || !asignacion.externalFileId) return;

    let activo = true;
    let objectUrlCreada: string | null = null;
    const promesaUrl = modoVistaPrevia
      ? driveService.obtenerUrlTemporalRecurso(asignacion.tenantId, asignacion.recursoId)
      : driveService.obtenerUrlTemporal(asignacion.tenantId, asignacion.id, asignacion.externalFileId);
    promesaUrl
      .then((resultado) => {
        if (!activo) return undefined;
        setAccesoTemporal(resultado);

        // El proxy exige un ID token de Firebase en el header Authorization -- <video>/<img>/
        // react-pdf no pueden mandar headers, así que bajamos los bytes reales acá (autenticado)
        // y armamos un blob: URL local para pasarles a esos componentes sin tocarlos.
        return driveService.obtenerBlobProtegido(resultado.url).then((blob) => {
          if (!activo) return;
          objectUrlCreada = URL.createObjectURL(blob);
          setBlobUrl(objectUrlCreada);

          const ext = asignacion.titulo.split('.').pop()?.toLowerCase() || '';
          if (['txt', 'md'].includes(ext)) {
            blob.text()
              .then((texto) => {
                if (activo) setTextoContenido(texto);
              })
              .catch((err) => {
                console.warn('[MaterialPreviewModal] Falló lectura de texto', err);
              });
          }
        });
      })
      .catch((err) => {
        if (activo) setErrorAcceso(obtenerMensajeAccesoDrive(err));
      });

    return () => {
      activo = false;
      if (objectUrlCreada) URL.revokeObjectURL(objectUrlCreada);
    };
  }, [asignacion, driveService, modoVistaPrevia]);

  if (!asignacion) return null;

  const estadoVisible = resultadoQuiz?.estadoPostQuiz || asignacion.estadoProgreso;
  const progresoVisible = resultadoQuiz?.aprobado ? 100 : asignacion.porcentajeProgreso;
  const sincronizarProgreso = async (payload: ProgresoSyncPayload) => {
    await repository.guardarSync(payload.tenantId, payload.asignacionId, {
      paginasVistas: payload.paginasVistas,
      segundosUnicos: payload.segundosUnicos,
    });

    const win = typeof window !== 'undefined' ? (window as any) : undefined;
    if (win?.Cypress) {
      win.__CENTRO_ESTUDIOS_SYNC_PAYLOADS__ = [
        ...(win.__CENTRO_ESTUDIOS_SYNC_PAYLOADS__ ?? []),
        payload,
      ];
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-tkd-dark/70 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl overflow-hidden border border-white/10">
        <header className="p-6 border-b border-gray-100 dark:border-white/10 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Vista previa del recurso</p>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">{obtenerTipoMaterial(asignacion)}</p>
            <h2 className="mt-2 text-2xl font-black uppercase text-tkd-dark dark:text-white leading-tight">{asignacion.titulo}</h2>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="shrink-0 w-11 h-11 rounded-2xl bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300 hover:bg-tkd-red hover:text-white transition-all flex items-center justify-center"
            aria-label="Cerrar material"
          >
            <IconoCerrar className="w-5 h-5" />
          </button>
        </header>

        <main className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {accesoTemporal && (
            <div className="rounded-2xl bg-green-50 text-green-800 p-4 text-sm font-bold">
              Acceso seguro listo. URL temporal vence en {new Date(accesoTemporal.expiresAt).toLocaleTimeString()}.
            </div>
          )}

          {errorAcceso && (
            <div className="rounded-2xl bg-red-50 text-red-700 p-4 text-sm font-bold">
              {errorAcceso}
            </div>
          )}

          {tipoMaterial === 'quiz' ? (
            cargandoPreguntasQuiz ? (
              <div className="rounded-[1.5rem] bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 p-6 text-sm font-bold text-gray-400 text-center">
                Cargando preguntas...
              </div>
            ) : preguntasQuiz && preguntasQuiz.length > 0 ? (
              <QuizView
                asignacion={asignacion}
                preguntas={preguntasQuiz}
                onResultado={setResultadoQuiz}
                repository={repository}
                estudianteId={estudianteId}
                estudianteNombre={estudianteNombre}
                recursoId={asignacion.recursoId}
              />
            ) : (
              <div className="rounded-[1.5rem] bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900 p-6 text-center">
                <p className="text-sm font-black uppercase tracking-widest text-yellow-700 dark:text-yellow-300">
                  Este quiz todavía no tiene preguntas configuradas
                </p>
                <p className="mt-2 text-xs font-bold text-yellow-600 dark:text-yellow-400">
                  Un Admin o Maestro puede cargarlas desde la Biblioteca.
                </p>
              </div>
            )
          ) : tipoMaterial === 'video' ? (
            <VideoPlayer
              tenantId={asignacion.tenantId}
              asignacionId={asignacion.id}
              titulo={asignacion.titulo}
              url={blobUrl ?? asignacion.driveFileUrl ?? ''}
              totalSegundos={asignacion.duracionSegundos ?? 120}
              sincronizar={sincronizarProgreso}
              cargarProgreso={() => repository.leerSync(asignacion.tenantId, asignacion.id)}
              estudianteId={estudianteId}
              estudianteNombre={estudianteNombre}
              recursoId={asignacion.recursoId}
            />
          ) : tipoMaterial === 'pdf' ? (
            <PdfViewer
              tenantId={asignacion.tenantId}
              asignacionId={asignacion.id}
              titulo={asignacion.titulo}
              url={blobUrl ?? undefined}
              totalPaginas={asignacion.totalPaginas ?? 3}
              sincronizar={sincronizarProgreso}
              cargarProgreso={() => repository.leerSync(asignacion.tenantId, asignacion.id)}
              estudianteId={estudianteId}
              estudianteNombre={estudianteNombre}
              recursoId={asignacion.recursoId}
            />
          ) : (
            /* Tipo material: Generico (Imagen, texto, presentación) */
            <div className="rounded-[1.5rem] bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-tkd-blue/10 text-tkd-blue flex items-center justify-center text-3xl">
                {asignacion.titulo.endsWith('.png') || asignacion.titulo.endsWith('.jpg') || asignacion.titulo.endsWith('.jpeg') ? '🖼' : '📝'}
              </div>
              <div>
                <h3 className="text-lg font-black uppercase text-tkd-dark dark:text-white">{asignacion.titulo}</h3>
                <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">Apertura registrada y validada para métricas</p>
              </div>

              {/* Render de imágenes */}
              {blobUrl && (asignacion.titulo.endsWith('.png') || asignacion.titulo.endsWith('.jpg') || asignacion.titulo.endsWith('.jpeg') || asignacion.titulo.endsWith('.gif')) && (
                <img
                  src={blobUrl}
                  alt={asignacion.titulo}
                  className="max-h-[40vh] object-contain rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm mt-3"
                />
              )}

              {/* Render de texto */}
              {textoContenido !== null && (
                <pre className="w-full max-h-[30vh] overflow-auto text-left text-xs bg-gray-50 dark:bg-white/5 rounded-2xl p-4 border border-gray-100 dark:border-white/10 font-mono text-gray-600 dark:text-gray-300">
                  {textoContenido}
                </pre>
              )}

              {/* Si no se puede previsualizar */}
              {!blobUrl && !errorAcceso && (
                <div className="text-sm text-gray-500 font-bold mt-2">
                  Cargando recurso seguro desde Google Drive...
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] font-black uppercase tracking-widest">
            <div className="rounded-2xl bg-gray-50 dark:bg-white/5 p-4">
              <span className="block text-gray-400">Progreso</span>
              <span className="block mt-1 text-tkd-blue">{progresoVisible}%</span>
            </div>
            <div className="rounded-2xl bg-gray-50 dark:bg-white/5 p-4">
              <span className="block text-gray-400">Estado</span>
              <span className="block mt-1 text-tkd-dark dark:text-white">{estadoVisible.replace('_', ' ')}</span>
            </div>
            <div className="rounded-2xl bg-gray-50 dark:bg-white/5 p-4">
              <span className="block text-gray-400">Urgencia</span>
              <span className="block mt-1 text-tkd-dark dark:text-white">{asignacion.urgencia.replace('_', ' ')}</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default MaterialPreviewModal;
