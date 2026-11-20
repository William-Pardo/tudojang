import React from 'react';
import { createPortal } from 'react-dom';
import type { AsignacionCentroEstudios } from '../../models/academico/asignacionService.types';
import type { PreguntaQuiz } from '../../models/academico/quiz';
import { IconoCerrar, IconoPantallaCompleta, IconoSalirPantallaCompleta } from '../Iconos';
import QuizView, { type ResultadoQuiz } from './QuizView';
import PdfViewer from './PdfViewer';
import VideoPlayer from './VideoPlayer';
import YoutubePlayer from './YoutubePlayer';
import type { ProgresoSyncPayload } from '../../hooks/academico/useProgressSync';
import { progresoRepository, type FirestoreProgressRepository, type ProgresoRepository } from '../../servicios/academico/progresoRepository';
import { visualizacionRepository as defaultVisualizacionRepository, type VisualizacionRepository, type VisualizacionSyncInput } from '../../servicios/academico/visualizacionRepository';
import { driveService as defaultDriveService, type TemporaryFileUrlResult } from '../../services/storage/driveService';
import { quizService as defaultQuizService } from '../../servicios/academico/quizService';
import { useRegistrarActividad } from '../../hooks/academico/useRegistrarActividad';

interface MaterialPreviewModalProps {
  asignacion: AsignacionCentroEstudios | null;
  onCerrar: () => void;
  repository?: ProgresoRepository | FirestoreProgressRepository;
  /**
   * Repositorio de tracking de reproducción de YouTube (Paso 5). Independiente de
   * `repository` (progreso genérico PDF/quiz/video-Drive) porque el reporte de staff
   * necesita listar por RECURSO -- ver servicios/academico/visualizacionRepository.ts.
   */
  visualizacionRepository?: VisualizacionRepository;
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

import {
  resolverTipoMaterial,
  obtenerEtiquetaTipoMaterial,
  type TipoMaterialResuelto,
} from '../../utils/academico/resolverTipoMaterial';

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
  visualizacionRepository = defaultVisualizacionRepository,
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
  // Distingue "fallo la carga (red/permisos)" de "el quiz no tiene preguntas". Antes el catch
  // dejaba preguntasQuiz=null, el mismo valor que "sin preguntas", asi que un fallo de red se
  // mostraba como "este quiz no tiene preguntas configuradas". Ahora el error tiene su propio
  // estado y su boton de reintentar (que efectivamente recarga).
  const [errorPreguntasQuiz, setErrorPreguntasQuiz] = React.useState(false);
  const [reintentosQuiz, setReintentosQuiz] = React.useState(0);
  const [esFullscreen, setEsFullscreen] = React.useState(false);
  const [ratioPdf, setRatioPdf] = React.useState<number | null>(null);

  const alternarFullscreen = () => {
    setEsFullscreen((prev) => !prev);
  };

  const obtenerClasesTamanoModal = () => {
    if (esFullscreen) {
      return 'h-full max-h-none max-w-none rounded-none border-0';
    }
    if (tipoMaterial === 'presentacion') {
      return 'h-full sm:h-[88vh] sm:max-w-5xl rounded-none sm:rounded-[2rem] sm:border';
    }
    if (tipoMaterial === 'pdf') {
      if (ratioPdf && ratioPdf < 0.85) {
        return 'h-full sm:h-[92vh] sm:max-w-2xl rounded-none sm:rounded-[2rem] sm:border';
      }
      return 'h-full sm:h-[92vh] sm:max-w-5xl rounded-none sm:rounded-[2rem] sm:border';
    }
    return 'h-full sm:h-auto sm:max-h-[94dvh] sm:max-w-4xl rounded-none sm:rounded-[2rem] sm:border';
  };

  const tipoMaterial = React.useMemo<TipoMaterialResuelto>(
    () => resolverTipoMaterial(asignacion),
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

  // Auto-registrar aperturas de archivos no evaluativos ni video (imágenes, textos, etc.)
  React.useEffect(() => {
    if (!asignacion || !estudianteId) return;

    if (tipoMaterial === 'imagen') {
      registrarApertura('imagen');
    } else if (tipoMaterial === 'presentacion') {
      registrarApertura('presentacion');
    } else if (tipoMaterial === 'generico') {
      const ext = asignacion.titulo.split('.').pop()?.toLowerCase() || '';
      const tipoAct = ['txt', 'md'].includes(ext) ? 'texto' : 'apertura';
      registrarApertura(tipoAct);
    }
  }, [asignacion?.id, tipoMaterial, estudianteId, registrarApertura, asignacion?.titulo]);

  React.useEffect(() => {
    setResultadoQuiz(null);
    setRatioPdf(null);
  }, [asignacion?.id]);

  // Carga el banco de preguntas real del recurso -- antes de este wire, QuizView siempre
  // caía a su pregunta demo hardcodeada sin importar el recurso.
  React.useEffect(() => {
    setPreguntasQuiz(null);
    setErrorPreguntasQuiz(false);
    if (!asignacion || tipoMaterial !== 'quiz') return;

    let activo = true;
    setCargandoPreguntasQuiz(true);
    // `recursoId` es opcional en el modelo (asignaciones "solo-grado" sin material real, ver
    // AsignarMaterialWizard), pero este modal solo se abre para materiales reales -- el
    // Centro de Estudios ya filtra esas asignaciones antes de llegar aca.
    quizService.obtenerQuiz(asignacion.tenantId, asignacion.recursoId ?? '')
      .then((preguntas) => {
        // Exito: `preguntas` puede ser null/[] (el quiz realmente no tiene preguntas) o una
        // lista. En ambos casos NO es un error -- se limpia el flag de error.
        if (activo) { setPreguntasQuiz(preguntas); setErrorPreguntasQuiz(false); }
      })
      .catch((err) => {
        // Fallo real (red/permisos): NO es lo mismo que "sin preguntas". Se marca como error
        // para ofrecer reintentar, en vez de mentir con "no hay preguntas configuradas".
        console.warn('[MaterialPreviewModal] No se pudo cargar el banco de preguntas', err);
        if (activo) { setPreguntasQuiz(null); setErrorPreguntasQuiz(true); }
      })
      .finally(() => {
        if (activo) setCargandoPreguntasQuiz(false);
      });

    return () => { activo = false; };
    // `reintentosQuiz` en las deps: al reintentar, el effect vuelve a correr y recarga de verdad.
  }, [asignacion, tipoMaterial, quizService, reintentosQuiz]);

  React.useEffect(() => {
    setAccesoTemporal(null);
    setErrorAcceso('');
    setTextoContenido(null);
    setBlobUrl(null);

    // Si el material tiene youtubeVideoId, el reproductor de YouTube lo maneja directo --
    // NO pedimos acceso temporal de Drive (ese es justamente el costo que se elimina).
    if (!asignacion || asignacion.uso === 'evaluacion' || !asignacion.externalFileId || asignacion.youtubeVideoId) return;

    let activo = true;
    let objectUrlCreada: string | null = null;
    const promesaUrl = modoVistaPrevia
      ? driveService.obtenerUrlTemporalRecurso(asignacion.tenantId, asignacion.recursoId ?? '')
      : driveService.obtenerUrlTemporal(asignacion.tenantId, asignacion.id, asignacion.externalFileId);
    promesaUrl
      .then((resultado) => {
        if (!activo) return undefined;
        setAccesoTemporal(resultado);

        // Si es presentación, usamos el visor interactivo de Drive / Docs Viewer
        // y NO bajamos el blob binario porque el navegador fuerza la descarga automática de .pptx
        if (tipoMaterial === 'presentacion') {
          return undefined;
        }

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

  // Paso 5: tracking real de visualización de YouTube -- un doc por (tenant, recurso,
  // alumno) en vez del progreso genérico (paginasVistas/segundosUnicos) que usa Drive.
  const sincronizarVisualizacionYoutube = async (
    asignacionActual: AsignacionCentroEstudios,
    input: { estudianteNombre?: string; posicionSegundos: number; duracionSegundos: number; nuevoInicio: boolean }
  ) => {
    if (!estudianteId) return;

    const payload: VisualizacionSyncInput = {
      estudianteNombre: input.estudianteNombre,
      posicionSegundos: input.posicionSegundos,
      duracionSegundos: input.duracionSegundos,
      nuevoInicio: input.nuevoInicio,
    };

    await visualizacionRepository.registrarSync(
      asignacionActual.tenantId,
      asignacionActual.recursoId ?? '',
      estudianteId,
      payload,
    );
  };

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className={`fixed inset-0 z-[9999] bg-tkd-dark/80 backdrop-blur-sm flex items-center justify-center overflow-hidden ${esFullscreen ? 'p-0' : 'p-0 sm:p-4'}`} role="dialog" aria-modal="true">
      <div className={`w-full flex flex-col bg-white dark:bg-gray-900 shadow-2xl overflow-hidden border-white/10 ${obtenerClasesTamanoModal()}`}>
        <header className="px-3.5 py-2.5 sm:px-5 sm:py-3 border-b border-gray-100 dark:border-white/10 flex items-center justify-between gap-3 shrink-0 bg-white dark:bg-gray-900 sticky top-0 z-50 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="sr-only">Vista previa del recurso</span>
            <span className="shrink-0 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-tkd-red/10 text-tkd-red">
              {obtenerEtiquetaTipoMaterial(tipoMaterial, asignacion.uso)}
            </span>
            <h2 className="text-xs sm:text-sm font-black uppercase text-tkd-dark dark:text-white truncate">
              {asignacion.titulo}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={alternarFullscreen}
              className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20 transition-all flex items-center justify-center shrink-0"
              aria-label={esFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              title={esFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            >
              {esFullscreen ? <IconoSalirPantallaCompleta className="w-4 h-4" /> : <IconoPantallaCompleta className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onCerrar}
              className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-950/40 text-tkd-red dark:text-red-400 hover:bg-tkd-red hover:text-white dark:hover:bg-tkd-red dark:hover:text-white border border-red-100 dark:border-red-900/40 transition-all shadow-sm flex items-center justify-center shrink-0"
              aria-label="Cerrar material"
              title="Cerrar material"
            >
              <IconoCerrar className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className={`flex-1 min-h-0 flex flex-col ${tipoMaterial === 'pdf' || tipoMaterial === 'presentacion' || tipoMaterial === 'imagen' ? 'overflow-hidden p-1 sm:p-3' : 'overflow-y-auto p-3 sm:p-5 space-y-3'}`}>
          {accesoTemporal && (
            <div className="sr-only">
              Acceso seguro listo. URL temporal vence en {new Date(accesoTemporal.expiresAt).toLocaleTimeString()}.
            </div>
          )}

          {errorAcceso && (
            <div className="rounded-2xl bg-red-50 text-red-700 p-4 text-sm font-bold shrink-0">
              {errorAcceso}
            </div>
          )}

          {tipoMaterial === 'quiz' ? (
            cargandoPreguntasQuiz ? (
              <div className="rounded-[1.5rem] bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 p-6 text-sm font-bold text-gray-400 text-center">
                Cargando preguntas...
              </div>
            ) : errorPreguntasQuiz ? (
              // FALLO DE CARGA (red/permisos), distinto de "sin preguntas": se ofrece reintentar.
              <div className="rounded-[1.5rem] bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900 p-6 text-center">
                <p className="text-sm font-black uppercase tracking-widest text-red-700 dark:text-red-300">
                  No se pudo cargar el material
                </p>
                <p className="mt-2 text-xs font-bold text-red-600 dark:text-red-400">
                  Revisá tu conexión e intentá de nuevo.
                </p>
                <button
                  type="button"
                  onClick={() => setReintentosQuiz((n) => n + 1)}
                  className="mt-4 rounded-xl bg-tkd-red px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-red-700"
                >
                  Reintentar
                </button>
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
            ) : modoVistaPrevia ? (
              // VACIO en vista previa de admin: la carga fue OK pero no hay preguntas.
              <div className="rounded-[1.5rem] bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900 p-6 text-center">
                <p className="text-sm font-black uppercase tracking-widest text-yellow-700 dark:text-yellow-300">
                  Este quiz todavía no tiene preguntas configuradas
                </p>
                <p className="mt-2 text-xs font-bold text-yellow-600 dark:text-yellow-400">
                  Un Admin o Maestro puede cargarlas desde la Biblioteca.
                </p>
              </div>
            ) : (
              // VACIO para el estudiante: la carga fue OK pero el quiz no tiene preguntas.
              // Mensaje orientado al alumno, no al staff.
              <div className="rounded-[1.5rem] bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 p-6 text-center">
                <p className="text-sm font-black uppercase tracking-widest text-tkd-dark dark:text-white">
                  Este material ya no está disponible
                </p>
                <p className="mt-2 text-xs font-bold text-gray-500 dark:text-gray-400">
                  Es posible que tu maestro lo haya quitado. Consultá con él si creés que es un error.
                </p>
              </div>
            )
          ) : tipoMaterial === 'video' && asignacion.youtubeVideoId ? (
            <YoutubePlayer
              videoId={asignacion.youtubeVideoId}
              titulo={asignacion.titulo}
              estudianteId={estudianteId}
              estudianteNombre={estudianteNombre}
              registrarSync={(input) => sincronizarVisualizacionYoutube(asignacion, input)}
            />
          ) : tipoMaterial === 'video' ? (
            // Fix 2026-07-21 (`npm run typecheck`): en `url` se quito
            // `asignacion.driveFileUrl`. Esa propiedad NO existe en AsignacionAcademica ni
            // en AsignacionCentroEstudios, y aparecia UNA sola vez en todo el repo: aca, en
            // el punto de lectura. Nadie la escribia nunca, asi que siempre valia undefined
            // y el `??` caia directo a ''. Los campos reales son `externalFileId` (Drive,
            // del que sale `blobUrl` via getTemporaryFileUrl) y `youtubeVideoId`. El
            // <PdfViewer> de mas abajo, para el mismo material, ya usaba solo `blobUrl`.
            <VideoPlayer
              tenantId={asignacion.tenantId}
              asignacionId={asignacion.id}
              titulo={asignacion.titulo}
              url={blobUrl ?? ''}
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
              onRatioCalculado={setRatioPdf}
            />
          ) : tipoMaterial === 'imagen' ? (
            /* Tipo material: Imagen */
            <div className="flex-1 min-h-0 w-full flex items-center justify-center p-1 sm:p-2 overflow-hidden bg-gray-50/50 dark:bg-white/5 rounded-2xl">
              {blobUrl ? (
                <img
                  src={blobUrl}
                  alt={asignacion.titulo}
                  loading="eager"
                  className="max-h-full max-w-full object-contain rounded-xl shadow-sm transition-opacity duration-300"
                />
              ) : !errorAcceso ? (
                <div className="flex flex-col items-center justify-center p-6 space-y-3">
                  <div className="w-8 h-8 border-3 border-tkd-blue border-t-transparent rounded-full animate-spin" />
                  <div className="text-xs text-gray-400 font-bold tracking-wider uppercase">
                    Cargando imagen...
                  </div>
                </div>
              ) : null}
            </div>
          ) : tipoMaterial === 'presentacion' ? (
            /* Tipo material: Presentación / Diapositivas */
            <div className="relative w-full flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden border border-gray-100 dark:border-white/10 bg-black">
              {asignacion.externalFileId ? (
                <iframe
                  src={`https://drive.google.com/file/d/${asignacion.externalFileId}/preview`}
                  title={asignacion.titulo}
                  className="w-full flex-1 border-0"
                  allow="autoplay"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              ) : accesoTemporal?.url ? (
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(accesoTemporal.url)}&embedded=true`}
                  title={asignacion.titulo}
                  className="w-full flex-1 border-0"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              ) : !errorAcceso ? (
                <div className="flex-1 flex items-center justify-center text-sm text-gray-400 font-bold">
                  Cargando presentación interactiva...
                </div>
              ) : null}
              {/* Bloqueador de apertura externa / compartir de Drive */}
              <div
                className="absolute top-0 right-0 w-16 h-14 z-20 cursor-default bg-transparent pointer-events-auto"
                title="Vista académica protegida"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
              />
            </div>
          ) : (
            /* Tipo material: Generico (Texto, archivos descargables) */
            <div className="flex-1 min-h-0 w-full flex flex-col rounded-2xl p-4 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 overflow-hidden">
              {textoContenido !== null && (
                <pre className="w-full flex-1 overflow-auto text-left text-xs bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-white/10 font-mono text-gray-600 dark:text-gray-300">
                  {textoContenido}
                </pre>
              )}
              {!blobUrl && !errorAcceso && (
                <div className="flex-1 flex items-center justify-center text-sm text-gray-400 font-bold">
                  Cargando recurso seguro desde Google Drive...
                </div>
              )}
            </div>
          )}

          {tipoMaterial !== 'pdf' && tipoMaterial !== 'presentacion' && tipoMaterial !== 'imagen' && (
            <div className="grid grid-cols-3 gap-2 p-2 sm:p-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 text-[9px] sm:text-[10px] font-black uppercase tracking-wider shrink-0 text-center">
              <div>
                <span className="block text-gray-400">Progreso</span>
                <span className="block mt-0.5 text-tkd-blue font-extrabold">{progresoVisible}%</span>
              </div>
              <div className="border-x border-gray-200 dark:border-white/10">
                <span className="block text-gray-400">Estado</span>
                <span className="block mt-0.5 text-tkd-dark dark:text-white truncate">{estadoVisible.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="block text-gray-400">Urgencia</span>
                <span className="block mt-0.5 text-tkd-dark dark:text-white truncate">{asignacion.urgencia.replace('_', ' ')}</span>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>,
    document.body
  );
};

export default MaterialPreviewModal;
