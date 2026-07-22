import React from 'react';
import type { FichaAcademica, RecursoAcademico } from '../../models/academico/recurso';
import type { TipoRecurso } from '../../models/academico';
import type { AsignacionCentroEstudios } from '../../models/academico/asignacionService.types';
import { bibliotecaService as defaultBibliotecaService } from '../../servicios/academico/bibliotecaService';
import { driveService as defaultDriveService, type DriveFile } from '../../services/storage/driveService';
import { useNotificacion } from '../../context/NotificacionContext';
import { parsearYoutubeVideoId } from '../../utils/academico/youtubeUrl';
import QuizEditorModal from '../../components/academico/QuizEditorModal';
import MaterialPreviewModal from '../../components/academico/MaterialPreviewModal';
import ReporteVisualizacionVideo from '../../components/academico/ReporteVisualizacionVideo';
import {
  IconoAprobar,
  IconoContrato,
  IconoEditar,
  IconoEliminar,
  IconoFirma,
  IconoImagen,
  IconoQuiz,
  IconoOjoAbierto,
  IconoAnalisis,
} from '../../components/Iconos';

// Vista previa administrativa (pedido explícito del usuario, 2026-07-16): permite a
// Admin/Editor/Asistente/Maestro reproducir/ver el contenido real de un recurso desde la
// Biblioteca, para confirmar que el archivo correcto antes/después de asignarlo -- SIN
// depender de que exista una asignación publicada. Se arma en memoria, nunca se persiste;
// el visor la trata como cualquier asignación gracias a `modoVistaPrevia` en
// MaterialPreviewModal, que resuelve la URL de Drive contra el RECURSO en vez de una
// asignación real (ver getTemporaryFileUrlRecurso).
function construirAsignacionPreview(recurso: RecursoAcademico): AsignacionCentroEstudios {
  const ahora = new Date().toISOString();
  return {
    id: `preview-${recurso.id}`,
    tenantId: recurso.tenantId,
    recursoId: recurso.id,
    externalFileId: recurso.externalFileId,
    youtubeVideoId: recurso.youtubeVideoId ?? null,
    titulo: recurso.tituloVisible || recurso.nombre,
    destinatario: { tipo: 'grupo', grupo: 'Todos' },
    uso: recurso.ficha?.tipo === 'quiz' ? 'evaluacion' : 'estudio',
    momento: 'preparacion',
    obligatoria: false,
    fechaApertura: ahora,
    estado: 'publicada',
    creadoPorUid: 'preview',
    creadoEn: ahora,
    actualizadoEn: ahora,
    estadoProgreso: 'disponible',
    porcentajeProgreso: 0,
    urgencia: 'sin_fecha',
  };
}

const TIPOS_RECURSO: TipoRecurso[] = ['pdf', 'video', 'imagen', 'presentacion', 'enlace', 'quiz', 'actividad_practica'];


const TAGS_ACADEMICOS_ESTANDAR = [
  {
    grupo: 'Etapa',
    tags: ['infantil', 'precadetes', 'cadetes', 'adultos', 'todos'],
  },
  {
    grupo: 'Nivel',
    tags: ['iniciacion', 'fundamentos', 'intermedio', 'avanzado', 'competencia', 'alto rendimiento'],
  },
  {
    grupo: 'Tecnica',
    tags: ['patada frontal', 'patada lateral', 'patada circular', 'bloqueos', 'defensa', 'combate', 'poomsae', 'kyorugi', 'rompimiento'],
  },
  {
    grupo: 'Capacidad',
    tags: ['coordinacion', 'equilibrio', 'flexibilidad', 'fuerza', 'velocidad', 'resistencia', 'control postural'],
  },
  {
    grupo: 'Uso',
    tags: ['estudio', 'practica', 'repaso', 'refuerzo', 'evaluacion', 'quiz', 'tarea', 'planeacion', 'demostracion'],
  },
  {
    grupo: 'Formato',
    tags: ['pdf', 'imagen', 'video', 'documento', 'presentacion', 'hoja de calculo'],
  },
  {
    grupo: 'Momento',
    tags: ['antes de clase', 'durante clase', 'despues de clase'],
  },
  {
    grupo: 'Operacion',
    tags: ['asistencia', 'trazabilidad', 'programa', 'ciclo', 'sede', 'instructor'],
  },
] as const;

const alternarTagEnTexto = (textoActual: string, tag: string): string => {
  const tagsActuales = textoActual
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t, index, todos) => todos.findIndex((actual) => actual.toLowerCase() === t.toLowerCase()) === index);
  const yaExiste = tagsActuales.some((actual) => actual.toLowerCase() === tag.toLowerCase());
  const nuevosTags = yaExiste
    ? tagsActuales.filter((actual) => actual.toLowerCase() !== tag.toLowerCase())
    : [...tagsActuales, tag];
  return nuevosTags.join(', ');
};

interface ArchivoExploradorDrive {
  id: string;
  nombre: string;
  mimeType: string;
  ruta: string;
}

type EstadoFuenteDriveUI = 'verificada' | 'no_verificada' | 'fuera_carpeta_activa';

const MIME_CARPETA_DRIVE = 'application/vnd.google-apps.folder';

interface BibliotecaViewProps {
  driveService?: Pick<
    typeof defaultDriveService,
    'iniciarConexionOAuth'
    | 'procesarCallbackOAuth'
    | 'listarCarpetaDrive'
    | 'desconectarDrive'
    | 'obtenerConexionDrive'
    | 'guardarCarpetaActiva'
  >;
  bibliotecaService?: Pick<typeof defaultBibliotecaService, 'importFromDrive' | 'findRecursoIndexado' | 'updateFicha' | 'approveRecurso' | 'archiveRecurso' | 'listarRecursosAprobados'>;
  navegarOAuth?: (url: string) => void;
  tenantId?: string;
  usuarioId?: string;
  onRecursoAprobado?: () => void;
  onFlujoEstadoChange?: (estado: {
    driveConectado: boolean;
    carpetaSeleccionada: boolean;
    archivosDetectados: number;
    recursosAprobados: number;
  }) => void;
  embedded?: boolean;
}

const mapearArchivoDrive = (archivo: DriveFile): ArchivoExploradorDrive => ({
  id: archivo.id,
  nombre: archivo.name,
  mimeType: archivo.mimeType,
  ruta: 'Google Drive',
});

const esCarpetaDrive = (archivo: ArchivoExploradorDrive): boolean => archivo.mimeType === MIME_CARPETA_DRIVE;

const describirTipoArchivo = (mimeType: string): string => {
  if (mimeType === MIME_CARPETA_DRIVE) return 'Carpeta';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.startsWith('video/')) return 'Video';
  if (mimeType.startsWith('image/')) return 'Imagen';
  if (mimeType.startsWith('text/') || mimeType.includes('document')) return 'Documento / texto';
  return 'Archivo';
};

const inferirTipoRecursoDesdeMime = (mimeType: string): TipoRecurso => {
  if (mimeType.startsWith('video/')) return 'video';
  return 'pdf';
};

const IconoRecursoBiblioteca: React.FC<{ mimeType: string; className?: string }> = ({ mimeType, className = 'h-5 w-5' }) => {
  if (mimeType.startsWith('image/')) return <IconoImagen className={className} />;
  if (mimeType.startsWith('video/') || mimeType.includes('presentation')) return <IconoFirma className={className} />;
  return <IconoContrato className={className} />;
};

const claseIconoDocumentoCentroEstudios = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-tkd-red';
const claseBotonIconoDocumentoCentroEstudios = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-tkd-red transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-100';
const claseBotonIconoDocumentoExito = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600 transition hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-100';

const normalizarNombreBiblioteca = (nombre: string): string => (
  nombre
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
);

const parsearTagsBiblioteca = (entrada: string): string[] => (
  entrada
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag, index, todos) => todos.findIndex((actual) => actual.toLowerCase() === tag.toLowerCase()) === index)
);

const describirEstadoFuenteDrive = (estado: EstadoFuenteDriveUI): { label: string; detalle: string; className: string } => {
  if (estado === 'verificada') {
    return {
      label: 'Fuente verificada',
      detalle: 'El archivo esta visible en la carpeta Drive activa.',
      className: 'border-green-100 bg-green-50 text-green-700',
    };
  }

  if (estado === 'fuera_carpeta_activa') {
    return {
      label: 'Indexado fuera de carpeta activa',
      detalle: 'El recurso se conserva en biblioteca, pero no esta visible en la carpeta actual.',
      className: 'border-amber-100 bg-amber-50 text-amber-700',
    };
  }

  return {
    label: 'Fuente no verificada',
    detalle: 'Drive esta desconectado. Biblioteca, tags y asignaciones se conservan.',
    className: 'border-gray-200 bg-gray-50 text-gray-600',
  };
};

const obtenerMensajeErrorDrive = (err: unknown): string => {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code) : '';
  const message = err instanceof Error ? err.message : '';
  const normalizado = `${code} ${message}`.toLowerCase();

  if (normalizado.includes('unauthenticated') || normalizado.includes('invalid_grant') || normalizado.includes('revoked')) {
    return 'Conexion de Drive expirada. Vuelve a conectar Google Drive para restablecer el acceso.';
  }

  if (normalizado.includes('permission-denied') || normalizado.includes('forbidden') || normalizado.includes('403')) {
    if (normalizado.includes('insufficientauthenticationscopes')) {
      return 'La conexión de Drive no tiene el alcance de lectura requerido. Desconecta y vuelve a conectar Google Drive para autorizar el permiso actualizado.';
    }

    if (normalizado.includes('insufficientfilepermissions') || normalizado.includes('sufficient permissions')) {
      return 'La cuenta Drive conectada no tiene permiso para leer esa carpeta. Selecciona una carpeta propia de esa cuenta o compártela explícitamente con la cuenta conectada.';
    }

    return 'Permisos insuficientes en Drive para listar esta carpeta. Si acabas de cambiar permisos, desconecta y vuelve a conectar Google Drive para autorizar el nuevo alcance de lectura.';
  }

  if (normalizado.includes('not-found') || normalizado.includes('404')) {
    return 'Carpeta inaccesible. Verifica que la cuenta conectada tenga acceso o selecciona otra carpeta visible desde Drive.';
  }

  return message || 'No se pudo listar la carpeta de Google Drive.';
};

const BibliotecaView: React.FC<BibliotecaViewProps> = ({
  driveService = defaultDriveService,
  bibliotecaService = defaultBibliotecaService,
  navegarOAuth = (url: string) => window.location.assign(url),
  tenantId = 'tenant-demo',
  usuarioId = 'admin-demo',
  onRecursoAprobado,
  onFlujoEstadoChange,
  embedded = false,
}) => {
  const { mostrarNotificacion } = useNotificacion();
  const [recursos, setRecursos] = React.useState<RecursoAcademico[]>([]);

  const [recursoSeleccionadoId, setRecursoSeleccionadoId] = React.useState('');
  const [disciplina, setDisciplina] = React.useState('Taekwondo');
  const [tipo, setTipo] = React.useState<TipoRecurso>('pdf');
  const [error, setError] = React.useState('');
  const [conectandoDrive, setConectandoDrive] = React.useState(false);
  const [estadoDrive, setEstadoDrive] = React.useState<'desconectado' | 'conectando' | 'conectado' | 'error'>('desconectado');
  const [connectionId, setConnectionId] = React.useState('');
  const [folderId, setFolderId] = React.useState('');
  const [folderName, setFolderName] = React.useState('');
  const [googleAccountEmail, setGoogleAccountEmail] = React.useState('');
  const [archivosDrive, setArchivosDrive] = React.useState<ArchivoExploradorDrive[]>([]);
  const [validandoCarpeta, setValidandoCarpeta] = React.useState(false);
  const [desconectandoDrive, setDesconectandoDrive] = React.useState(false);
  const [selectorCarpetasAbierto, setSelectorCarpetasAbierto] = React.useState(false);
  const [selectorFolderId, setSelectorFolderId] = React.useState('root');
  const [selectorFolderName, setSelectorFolderName] = React.useState('Mi unidad');
  const [selectorCarpetas, setSelectorCarpetas] = React.useState<ArchivoExploradorDrive[]>([]);
  const [selectorCargando, setSelectorCargando] = React.useState(false);
  const [tagsTexto, setTagsTexto] = React.useState('');
  const [tituloVisible, setTituloVisible] = React.useState('');
  // Paso 3 (reemplazo Drive -> YouTube SOLO para video, decisión de producto 2026-07): URL
  // que pega el staff y su ID de 11 caracteres ya parseado -- ver utils/academico/youtubeUrl.ts.
  const [youtubeUrlTexto, setYoutubeUrlTexto] = React.useState('');
  const [errorYoutubeUrl, setErrorYoutubeUrl] = React.useState('');
  const [modalClasificacionAbierto, setModalClasificacionAbierto] = React.useState(false);
  const [recursoQuizEnEdicion, setRecursoQuizEnEdicion] = React.useState<RecursoAcademico | null>(null);
  const [recursoEnVistaPrevia, setRecursoEnVistaPrevia] = React.useState<RecursoAcademico | null>(null);
  // Paso 7: reporte de visualización de video para staff -- solo aplica a recursos de
  // video con youtubeVideoId (los que usan el proxy de Drive no tienen tracking real).
  const [recursoReporteVisualizacion, setRecursoReporteVisualizacion] = React.useState<RecursoAcademico | null>(null);
  const carpetaListadaRef = React.useRef('');
  const selectorAutoAbiertoRef = React.useRef('');

  const recursoSeleccionado = recursos.find((recurso) => recurso.id === recursoSeleccionadoId) ?? recursos[0];
  const driveConectado = estadoDrive === 'conectado';
  const carpetaSeleccionada = Boolean(folderId);
  const archivosVisibles = driveConectado ? archivosDrive : [];
  const carpetaPendiente = driveConectado && !folderId;
  const recursosIndexadosCount = recursos.length;
  const recursosAprobadosLista = React.useMemo(
    () => recursos.filter((recurso) => recurso.estado === 'aprobado'),
    [recursos],
  );
  const recursosAprobadosCount = recursosAprobadosLista.length;
  const archivosDriveIds = React.useMemo(() => new Set(archivosDrive.map((archivo) => archivo.id)), [archivosDrive]);
  const redirectUri = React.useMemo(
    () => `${window.location.origin}${window.location.pathname}`,
    [],
  );

  React.useEffect(() => {
    onFlujoEstadoChange?.({
      driveConectado,
      carpetaSeleccionada,
      archivosDetectados: archivosDrive.length,
      recursosAprobados: recursosAprobadosCount,
    });
  }, [archivosDrive.length, carpetaSeleccionada, driveConectado, onFlujoEstadoChange, recursosAprobadosCount]);

  const fusionarRecursosLocales = React.useCallback((nuevosRecursos: RecursoAcademico[]) => {
    if (nuevosRecursos.length === 0) return;
    setRecursos((actuales) => {
      const fusionados = [...actuales];
      nuevosRecursos.forEach((nuevo) => {
        const indiceExistente = fusionados.findIndex((actual) => (
          actual.id === nuevo.id
          || actual.externalFileId === nuevo.externalFileId
          || normalizarNombreBiblioteca(actual.nombre) === normalizarNombreBiblioteca(nuevo.nombre)
        ));
        if (indiceExistente >= 0) {
          fusionados[indiceExistente] = { ...fusionados[indiceExistente], ...nuevo };
        } else {
          fusionados.push(nuevo);
        }
      });
      return fusionados;
    });
  }, []);

  React.useEffect(() => {
    let activo = true;
    if (!bibliotecaService?.listarRecursosAprobados) return undefined;

    bibliotecaService.listarRecursosAprobados(tenantId)
      .then((recursosAprobadosTenant) => {
        if (!activo) return;
        fusionarRecursosLocales(recursosAprobadosTenant);
      })
      .catch(() => {
        // La biblioteca aprobada se sincroniza de forma progresiva; no bloquea Drive.
      });

    return () => {
      activo = false;
    };
  }, [bibliotecaService, fusionarRecursosLocales, tenantId]);

  React.useEffect(() => {
    if (!recursoSeleccionado) {
      setTagsTexto('');
      setTituloVisible('');
      setYoutubeUrlTexto('');
      setErrorYoutubeUrl('');
      return;
    }

    setDisciplina(recursoSeleccionado.ficha?.disciplina ?? 'Taekwondo');
    setTipo(recursoSeleccionado.ficha?.tipo ?? inferirTipoRecursoDesdeMime(recursoSeleccionado.mimeType));
    setTagsTexto(recursoSeleccionado.ficha?.tags?.join(', ') ?? '');
    setTituloVisible(recursoSeleccionado.tituloVisible ?? '');
    setYoutubeUrlTexto(recursoSeleccionado.youtubeVideoId ?? '');
    setErrorYoutubeUrl('');
  }, [recursoSeleccionado?.id]);

  React.useEffect(() => {
    const storedConnectionId = window.localStorage.getItem(`tudojang:driveConnection:${tenantId}`);
    const storedError = window.localStorage.getItem(`tudojang:driveConnectionError:${tenantId}`);
    const storedFolderId = window.localStorage.getItem(`tudojang:driveFolder:${tenantId}`);
    const storedFolderName = window.localStorage.getItem(`tudojang:driveFolderName:${tenantId}`);

    if (storedConnectionId) {
      setConnectionId(storedConnectionId);
      setEstadoDrive('conectado');
      if (storedFolderId) {
        setFolderId(storedFolderId);
      }
      if (storedFolderName) {
        setFolderName(storedFolderName);
      }
      setError('');
      return;
    }

    setFolderId('');
    setFolderName('');
    setArchivosDrive([]);
    if (storedError) {
      setEstadoDrive('error');
      setError(storedError);
      window.localStorage.removeItem(`tudojang:driveConnectionError:${tenantId}`);
    }
  }, [tenantId]);

  React.useEffect(() => {
    let activo = true;

    if (!driveService.obtenerConexionDrive) return undefined;

    driveService.obtenerConexionDrive(tenantId)
      .then((conexion) => {
        if (!activo) return;

        if (!conexion.connected || !conexion.connectionId) {
          return;
        }

        setConnectionId(conexion.connectionId);
        setEstadoDrive('conectado');
        window.localStorage.setItem(`tudojang:driveConnection:${tenantId}`, conexion.connectionId);

        if (conexion.googleAccountEmail) {
          setGoogleAccountEmail(conexion.googleAccountEmail);
        }

        if (conexion.activeFolderId) {
          setFolderId(conexion.activeFolderId);
          window.localStorage.setItem(`tudojang:driveFolder:${tenantId}`, conexion.activeFolderId);
        }
        if (conexion.activeFolderName) {
          setFolderName(conexion.activeFolderName);
          window.localStorage.setItem(`tudojang:driveFolderName:${tenantId}`, conexion.activeFolderName);
        }
      })
      .catch(() => {
        // La consulta remota es sincronizacion progresiva. No debe bloquear el modo local/cache.
      });

    return () => {
      activo = false;
    };
  }, [driveService, tenantId]);

  const persistirCarpetaActiva = async (id: string, name = '') => {
    if (driveService.guardarCarpetaActiva) {
      await driveService.guardarCarpetaActiva(tenantId, id, name);
    }
    window.localStorage.setItem(`tudojang:driveFolder:${tenantId}`, id);
    if (name) window.localStorage.setItem(`tudojang:driveFolderName:${tenantId}`, name);
  };

  React.useEffect(() => {
    if (!driveConectado || !folderId) return;
    if (carpetaListadaRef.current === folderId) return;

    let activo = true;
    setValidandoCarpeta(true);
    driveService.listarCarpetaDrive(tenantId, folderId)
      .then((archivos) => {
        if (activo) {
          const archivosMapeados = archivos.map(mapearArchivoDrive);
          carpetaListadaRef.current = folderId;
          setArchivosDrive(archivosMapeados);
          sincronizarEstadosFuenteConArchivos(archivosMapeados);
        }
      })
      .catch((err) => {
        if (activo) setError(obtenerMensajeErrorDrive(err));
      })
      .finally(() => {
        if (activo) setValidandoCarpeta(false);
      });

    return () => {
      activo = false;
    };
  }, [driveConectado, driveService, folderId, tenantId]);

  const cargarCarpetasDrive = async (id = 'root', name = 'Mi unidad') => {
    if (!driveConectado) {
      setError('Primero conecta Google Drive para seleccionar una carpeta.');
      return;
    }

    setError('');
    setSelectorCarpetasAbierto(true);
    setSelectorCargando(true);
    try {
      const archivos = await driveService.listarCarpetaDrive(tenantId, id);
      setSelectorFolderId(id);
      setSelectorFolderName(name || id);
      setSelectorCarpetas(
        archivos
          .map(mapearArchivoDrive)
          .filter((archivo) => esCarpetaDrive(archivo)),
      );
    } catch (err) {
      setError(obtenerMensajeErrorDrive(err));
    } finally {
      setSelectorCargando(false);
    }
  };

  const abrirSelectorCarpetasDrive = () => {
    void cargarCarpetasDrive('root', 'Mi unidad');
  };

  const abrirSubcarpetaSelector = (id: string, name: string) => {
    void cargarCarpetasDrive(id, name);
  };

  const usarCarpetaActualDelSelector = async () => {
    await validarCarpetaDrivePorId(selectorFolderId, selectorFolderName);
    setSelectorCarpetasAbierto(false);
  };

  React.useEffect(() => {
    if (!driveConectado || folderId || selectorCarpetasAbierto || selectorCargando) return;

    const autoKey = `${tenantId}:${connectionId || 'local'}`;
    if (selectorAutoAbiertoRef.current === autoKey) return;
    selectorAutoAbiertoRef.current = autoKey;

    void cargarCarpetasDrive('root', 'Mi unidad');
  }, [connectionId, driveConectado, folderId, selectorCarpetasAbierto, selectorCargando, tenantId]);

  const obtenerRecursoLocalPorArchivo = (archivo: ArchivoExploradorDrive): RecursoAcademico | undefined => (
    recursos.find((recurso) => (
      recurso.externalFileId === archivo.id
      || normalizarNombreBiblioteca(recurso.nombre) === normalizarNombreBiblioteca(archivo.nombre)
    ))
  );

  const upsertRecursoLocal = (recurso: RecursoAcademico) => {
    fusionarRecursosLocales([recurso]);
  };

  const prepararRecursoDesdeArchivo = (
    recurso: RecursoAcademico,
    archivo: ArchivoExploradorDrive,
  ): RecursoAcademico => ({
    ...recurso,
    fuenteDriveEstado: 'verificada' as const,
    carpetaOrigenDriveId: folderId || recurso.carpetaOrigenDriveId,
    ultimaVerificacionDrive: new Date().toISOString(),
    mimeType: recurso.mimeType || archivo.mimeType,
  });

  /**
   * Prepara la clasificación manual de un archivo detectado en Drive:
   * lo indexa como `borrador` si es nuevo y abre el modal de clasificación.
   * NUNCA genera ficha sintética ni aprueba automáticamente.
   */
  const abrirClasificacion = async (archivo: ArchivoExploradorDrive) => {
    setError('');
    try {
      const existente = obtenerRecursoLocalPorArchivo(archivo)
        || await bibliotecaService.findRecursoIndexado?.(
          tenantId,
          archivo.id,
          archivo.nombre,
        );

      const recurso = existente ?? await bibliotecaService.importFromDrive(
        tenantId,
        archivo.id,
        archivo.nombre,
        archivo.mimeType,
        usuarioId,
      );

      const recursoPreparado = prepararRecursoDesdeArchivo(recurso, archivo);
      upsertRecursoLocal(recursoPreparado);
      setRecursoSeleccionadoId(recursoPreparado.id);
      setModalClasificacionAbierto(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo preparar el archivo de Drive para clasificar.');
    }
  };

  const retirarRecursoAprobado = async (archivo: ArchivoExploradorDrive) => {
    setError('');
    try {
      const recurso = obtenerRecursoLocalPorArchivo(archivo) || await bibliotecaService.findRecursoIndexado?.(
        tenantId,
        archivo.id,
        archivo.nombre,
      );
      if (!recurso) return;
      await bibliotecaService.archiveRecurso?.(tenantId, recurso.id);
      setRecursos((actuales) => actuales.filter((item) => item.id !== recurso.id));
      if (recursoSeleccionadoId === recurso.id) setRecursoSeleccionadoId('');
      mostrarNotificacion('Recurso retirado de aprobados.', 'success');
      if (onRecursoAprobado) onRecursoAprobado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo retirar el recurso aprobado.');
    }
  };

  const obtenerEstadoFuenteDrive = (recurso: RecursoAcademico): EstadoFuenteDriveUI => {
    if (!driveConectado) return 'no_verificada';
    if (!folderId || archivosDriveIds.has(recurso.externalFileId)) return 'verificada';
    return 'fuera_carpeta_activa';
  };

  const confirmarCambioCarpetaDrive = (nuevoFolderId: string): boolean => {
    if (!folderId || folderId === nuevoFolderId || recursosIndexadosCount === 0) return true;

    return window.confirm(
      `Vas a cambiar la carpeta activa de Drive. Se conservaran ${recursosIndexadosCount} recursos indexados, sus tags y sus asignaciones. Solo cambiara el explorador de archivos visibles. Deseas continuar?`,
    );
  };

  const sincronizarEstadosFuenteConArchivos = (archivos: ArchivoExploradorDrive[]) => {
    const idsVisibles = new Set(archivos.map((archivo) => archivo.id));
    setRecursos((actuales) => actuales.map((recurso) => ({
      ...recurso,
      fuenteDriveEstado: idsVisibles.has(recurso.externalFileId) ? 'verificada' : 'fuera_carpeta_activa',
      ultimaVerificacionDrive: idsVisibles.has(recurso.externalFileId)
        ? new Date().toISOString()
        : recurso.ultimaVerificacionDrive,
    })));
  };

  const conectarDrive = async () => {
    setError('');
    setConectandoDrive(true);
    setEstadoDrive('conectando');
    try {
      const url = await driveService.iniciarConexionOAuth(tenantId, redirectUri);
      window.localStorage.setItem('tudojang:driveOAuthReturnPath', '/centro-estudios');
      navegarOAuth(url);
    } catch (err) {
      setEstadoDrive('desconectado');
      setError(err instanceof Error ? err.message : 'No se pudo iniciar la conexion con Google Drive.');
    } finally {
      setConectandoDrive(false);
    }
  };

  const ejecutarAccionPrincipalDrive = () => {
    if (driveConectado) {
      void desconectarDrive();
      return;
    }

    void conectarDrive();
  };

  const abrirCarpetaDrive = async (id: string, name = '') => {
    if (!driveConectado) {
      setError('Primero conecta Google Drive para abrir carpetas reales.');
      return;
    }

    setError('');
    setValidandoCarpeta(true);
    try {
      const archivos = await driveService.listarCarpetaDrive(tenantId, id);
      const archivosMapeados = archivos.map(mapearArchivoDrive);
      await persistirCarpetaActiva(id, name);
      carpetaListadaRef.current = id;
      setFolderId(id);
      setArchivosDrive(archivosMapeados);
      sincronizarEstadosFuenteConArchivos(archivosMapeados);
    } catch (err) {
      setError(obtenerMensajeErrorDrive(err));
    } finally {
      setValidandoCarpeta(false);
    }
  };

  const validarCarpetaDrivePorId = async (id: string, name = '') => {
    if (!id) return;
    if (!driveConectado) {
      setError('Primero conecta Google Drive para seleccionar una carpeta real.');
      return;
    }

    if (!confirmarCambioCarpetaDrive(id)) return;

    setError('');
    setValidandoCarpeta(true);
    try {
      const archivos = await driveService.listarCarpetaDrive(tenantId, id);
      const archivosMapeados = archivos.map(mapearArchivoDrive);
      await persistirCarpetaActiva(id, name);
      carpetaListadaRef.current = id;
      setFolderId(id);
      if (name) setFolderName(name);
      setArchivosDrive(archivosMapeados);
      sincronizarEstadosFuenteConArchivos(archivosMapeados);
    } catch (err) {
      setError(obtenerMensajeErrorDrive(err));
    } finally {
      setValidandoCarpeta(false);
    }
  };

  const desconectarDrive = async () => {
    if (!driveConectado) return;

    const confirmado = window.confirm(
      `Vas a desconectar Google Drive. No se eliminaran recursos, tags, historial ni asignaciones (${recursosIndexadosCount} recursos indexados se conservaran). Solo se pausara la importacion y verificacion de archivos hasta reconectar. Deseas continuar?`,
    );
    if (!confirmado) return;

    setError('');
    setDesconectandoDrive(true);
    try {
      await driveService.desconectarDrive(tenantId);
      window.localStorage.removeItem(`tudojang:driveConnection:${tenantId}`);
      window.localStorage.removeItem(`tudojang:driveConnectionError:${tenantId}`);
      window.localStorage.removeItem(`tudojang:driveFolder:${tenantId}`);
      window.localStorage.removeItem(`tudojang:driveFolderName:${tenantId}`);
      carpetaListadaRef.current = '';
      setConnectionId('');
      setGoogleAccountEmail('');
      setFolderId('');
      setFolderName('');
      setSelectorCarpetasAbierto(false);
      setSelectorCarpetas([]);
      setArchivosDrive([]);
      setEstadoDrive('desconectado');
      setRecursos((actuales) => actuales.map((recurso) => ({
        ...recurso,
        fuenteDriveEstado: 'no_verificada',
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo desconectar Google Drive.');
    } finally {
      setDesconectandoDrive(false);
    }
  };

  const guardarClasificacion = async () => {
    if (!recursoSeleccionado) return;
    setError('');
    setErrorYoutubeUrl('');

    // Paso 3 (reemplazo Drive -> YouTube SOLO para video): parsear+validar la URL pegada.
    // Campo opcional -- vacío = seguir usando Drive (compatibilidad con videos ya cargados).
    const youtubeUrlLimpia = youtubeUrlTexto.trim();
    let youtubeVideoId: string | null | undefined;
    if (tipo === 'video' && youtubeUrlLimpia) {
      const idParseado = parsearYoutubeVideoId(youtubeUrlLimpia);
      if (!idParseado) {
        setErrorYoutubeUrl('La URL de YouTube no es válida. Pegá el link completo (youtube.com/watch?v=... o youtu.be/...) o el ID de 11 caracteres.');
        return;
      }
      youtubeVideoId = idParseado;
    } else if (tipo === 'video' && !youtubeUrlLimpia && recursoSeleccionado.youtubeVideoId) {
      // El staff borró el texto: interpretamos que quiere volver a usar Drive.
      youtubeVideoId = null;
    }

    const ficha: FichaAcademica = {
      disciplina,
      tipo,
      usos: ['estudio'],
      tags: parsearTagsBiblioteca(tagsTexto),
    };
    const tituloVisibleLimpio = tituloVisible.trim();

    try {
      // Solo se pasa el 5to argumento cuando realmente hay algo que tocar -- si no,
      // se preserva la firma de 4 argumentos para no persistir un `youtubeVideoId: undefined`
      // innecesario en recursos que nunca fueron video (PDF, imagen, etc.).
      if (youtubeVideoId !== undefined) {
        await bibliotecaService.updateFicha(
          tenantId,
          recursoSeleccionado.id,
          ficha,
          tituloVisibleLimpio || undefined,
          youtubeVideoId,
        );
      } else {
        await bibliotecaService.updateFicha(
          tenantId,
          recursoSeleccionado.id,
          ficha,
          tituloVisibleLimpio || undefined,
        );
      }
      await bibliotecaService.approveRecurso(tenantId, recursoSeleccionado.id, usuarioId);
      setRecursos((actuales) => actuales.map((recurso) => (
        recurso.id === recursoSeleccionado.id
          ? {
            ...recurso,
            ficha,
            ...(tituloVisibleLimpio ? { tituloVisible: tituloVisibleLimpio } : {}),
            ...(youtubeVideoId !== undefined ? { youtubeVideoId } : {}),
            estado: 'aprobado' as const,
            aprobadoPorUid: usuarioId,
            aprobadoEn: new Date().toISOString(),
            actualizadoEn: new Date().toISOString(),
          }
          : recurso
      )));
      setModalClasificacionAbierto(false);
      mostrarNotificacion('¡Recurso clasificado y aprobado!', 'success');
      if (onRecursoAprobado) onRecursoAprobado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la clasificación del recurso.');
    }
  };

  const aprobar = async (recursoObjetivo: RecursoAcademico) => {
    setError('');

    try {
      await bibliotecaService.approveRecurso(tenantId, recursoObjetivo.id, usuarioId);
      setRecursos((actuales) => actuales.map((recurso) => (
        recurso.id === recursoObjetivo.id
          ? {
            ...recurso,
            estado: 'aprobado' as const,
            aprobadoPorUid: usuarioId,
            aprobadoEn: new Date().toISOString(),
            actualizadoEn: new Date().toISOString(),
          }
          : recurso
      )));
      mostrarNotificacion('¡Recurso aprobado y listo para asignar!', 'success');
      if (onRecursoAprobado) {
        onRecursoAprobado();
      }
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : '';
      if (
        mensaje.includes('ya se encuentra aprobado')
        || mensaje.includes('estado aprobado')
        || mensaje.includes('aprobado en estado aprobado')
        || mensaje.includes('no se puede aprobar un recurso en estado aprobado')
      ) {
        setRecursos((actuales) => actuales.map((recurso) => (
          recurso.id === recursoObjetivo.id
            ? {
              ...recurso,
              estado: 'aprobado' as const,
              aprobadoPorUid: usuarioId,
              aprobadoEn: recurso.aprobadoEn || new Date().toISOString(),
              actualizadoEn: new Date().toISOString(),
            }
            : recurso
        )));
        mostrarNotificacion('¡Recurso ya estaba aprobado y listo para asignar!', 'success');
        if (onRecursoAprobado) {
          onRecursoAprobado();
        }
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo aprobar el recurso.');
      }
    }
  };



  return (
    <section className={embedded ? 'grid gap-5 xl:contents' : 'p-6 sm:p-10 space-y-8'}>
      {!embedded && (
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">
          Paso 1
        </p>
        <h1 className="text-3xl font-black uppercase text-tkd-dark dark:text-white">
          Conectar Drive
        </h1>
        <p className="mt-2 text-sm font-bold text-gray-400">
          Autoriza la cuenta, elige la carpeta y deja visible el origen del material.
        </p>
      </header>
      )}

      <article className="rounded-[2rem] border border-gray-100 dark:border-white/10 bg-white dark:bg-gray-900 p-5">
        <div className={embedded ? 'grid gap-5' : 'grid gap-5 xl:grid-cols-[0.9fr_1.1fr_auto] xl:items-center'}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-tkd-red">
              1. Conectar Drive
            </p>
            <h2 className="mt-2 text-2xl font-black uppercase text-tkd-dark dark:text-white">
              Drive institucional
            </h2>
            <p className="mt-3 text-sm font-bold text-gray-500">
              Cuenta Drive: <span className="text-tkd-blue">{driveConectado ? 'Conectada' : estadoDrive === 'conectando' ? 'Conectando' : 'Desconectada'}</span>
            </p>
            <p className="mt-1 text-sm font-bold text-gray-500">
              Correo: <span className="text-tkd-dark dark:text-white break-all">{googleAccountEmail || 'Sin cuenta conectada'}</span>
            </p>
            <p className="mt-1 text-sm font-bold text-gray-500">
              Carpeta: <span className={carpetaSeleccionada ? 'text-tkd-blue' : 'text-amber-600'}>
                {carpetaSeleccionada ? 'Seleccionada' : driveConectado ? 'Pendiente de seleccionar' : 'Sin seleccionar'}
              </span>
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-dashed border-blue-100 bg-blue-50/60 p-5 dark:border-blue-400/20 dark:bg-blue-400/10">
            <p className="text-[10px] font-black uppercase tracking-widest text-tkd-blue">
              Carpeta activa
            </p>
            <p className="mt-2 text-base font-black text-tkd-dark dark:text-white break-all">
              {folderName || (folderId ? folderId : driveConectado ? 'Falta seleccionar carpeta' : 'Selecciona una carpeta')}
            </p>
            <p className="mt-2 text-xs font-bold text-gray-500">
              {folderId ? `${archivosDrive.length} archivos visibles para clasificar.` : driveConectado ? 'La cuenta ya esta conectada. Selecciona la carpeta que contiene los materiales.' : 'Aqui se mostrara la carpeta institucional conectada.'}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
            <button
              type="button"
              onClick={ejecutarAccionPrincipalDrive}
              disabled={conectandoDrive || desconectandoDrive}
              className={`rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-widest disabled:opacity-50 ${
                driveConectado
                  ? 'border border-tkd-red text-tkd-red bg-white dark:bg-transparent'
                  : 'bg-tkd-blue text-white'
              }`}
            >
              {conectandoDrive && 'Conectando Google Drive...'}
              {desconectandoDrive && 'Desconectando Google Drive...'}
              {!conectandoDrive && !desconectandoDrive && (driveConectado ? 'Desconectar Google Drive' : 'Conectar Google Drive')}
            </button>
            {driveConectado && (
              <button
                type="button"
                onClick={abrirSelectorCarpetasDrive}
                disabled={selectorCargando}
                aria-label={folderId ? 'Cambiar carpeta de Drive' : 'Seleccionar carpeta de Drive'}
                title={folderId ? 'Cambiar carpeta de Drive' : 'Seleccionar carpeta de Drive'}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-tkd-blue disabled:opacity-50"
              >
                <span className={claseIconoDocumentoCentroEstudios}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  </svg>
                </span>
                {folderId ? 'Cambiar carpeta' : 'Elegir carpeta'}
              </button>
            )}
          </div>
        </div>
        {driveConectado && selectorCarpetasAbierto && (
          <div className="mt-5 rounded-[1.5rem] border border-blue-100 bg-white p-4 shadow-sm dark:border-blue-400/20 dark:bg-gray-950/40">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-tkd-blue">Seleccionar carpeta Drive</p>
                <h3 className="mt-1 text-base font-black text-tkd-dark dark:text-white">{selectorFolderName}</h3>
                <p className="mt-1 text-xs font-normal text-gray-500">
                  Elige la carpeta institucional que contiene los materiales. La biblioteca ya indexada se conserva.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectorFolderId !== 'root' && (
                  <button
                    type="button"
                    onClick={() => abrirSubcarpetaSelector('root', 'Mi unidad')}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500"
                  >
                    Mi unidad
                  </button>
                )}
                <button
                  type="button"
                  onClick={usarCarpetaActualDelSelector}
                  disabled={validandoCarpeta || selectorCargando}
                  className="rounded-xl bg-tkd-blue px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
                >
                  {validandoCarpeta ? 'Guardando...' : 'Usar esta carpeta'}
                </button>
                {folderId && (
                  <button
                    type="button"
                    onClick={() => setSelectorCarpetasAbierto(false)}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500"
                  >
                    Cerrar
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {selectorCargando && (
                <div className="rounded-2xl border border-dashed border-blue-100 bg-blue-50 p-4 text-sm font-bold text-tkd-blue">
                  Cargando carpetas de Drive...
                </div>
              )}
              {!selectorCargando && selectorCarpetas.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm font-bold text-gray-400">
                  No hay subcarpetas visibles aquí. Puedes usar esta carpeta como carpeta institucional.
                </div>
              )}
              {!selectorCargando && selectorCarpetas.map((carpeta) => (
                <button
                  key={carpeta.id}
                  type="button"
                  onClick={() => abrirSubcarpetaSelector(carpeta.id, carpeta.nombre)}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-left hover:border-blue-100 hover:bg-blue-50 dark:border-white/10 dark:bg-white/5"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={claseIconoDocumentoCentroEstudios}>
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      </svg>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-tkd-dark dark:text-white">{carpeta.nombre}</span>
                      <span className="block text-[11px] font-normal text-gray-400">Carpeta Drive</span>
                    </span>
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-tkd-blue">Abrir</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </article>

      <div className="flex flex-col gap-5">
        <article className="rounded-[2rem] border border-gray-100 dark:border-white/10 bg-white dark:bg-gray-900 p-5 space-y-5">
          {error && (
            <div className="rounded-2xl bg-red-50 text-red-700 p-4 text-sm font-bold">
              {error}
            </div>
          )}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-tkd-red">
              2. Archivos detectados
            </p>
          <h2 className="mt-2 text-2xl font-black uppercase text-tkd-dark dark:text-white">
              Recursos detectados
            </h2>
            {driveConectado && (
              <span className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-tkd-blue">
                {folderId ? `${archivosDrive.length} recursos detectados` : 'Cuenta conectada · falta carpeta'}
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4 space-y-3">
            {!driveConectado && (
              <p className="text-xs font-bold text-gray-400">
                Conecta Google Drive para elegir la carpeta academica y cargar recursos.
              </p>
            )}
            {driveConectado && embedded && (
              <p className="text-xs font-bold text-gray-400">
                La cuenta Drive esta conectada. La carpeta se selecciona en el bloque 1.
              </p>
            )}
            {driveConectado && !embedded && (
              <p className="text-xs font-bold text-gray-400">
                La cuenta Drive esta conectada. La carpeta institucional se elige o cambia desde el bloque 1.
              </p>
            )}
            {folderId && (
              <p className="text-xs font-black uppercase tracking-widest text-tkd-blue break-all">
                Carpeta activa: {folderName || folderId}
              </p>
            )}
          </div>

          <div className="overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white divide-y-2 divide-black/20 dark:border-white/10 dark:bg-gray-950/30">
            {carpetaPendiente && (
              <div className="p-6 text-sm font-bold text-tkd-blue">
                Cuenta Drive conectada. Falta seleccionar la carpeta institucional para poder listar e importar archivos.
              </div>
            )}
            {driveConectado && folderId && archivosDrive.length === 0 && !validandoCarpeta && (
              <div className="p-6 text-sm font-bold text-gray-400">
                La carpeta activa no tiene archivos visibles para Tudojang o la cuenta conectada no tiene permisos de lectura.
              </div>
            )}
            {archivosVisibles.map((archivo) => {
              const recursoLocal = esCarpetaDrive(archivo) ? undefined : obtenerRecursoLocalPorArchivo(archivo);
              const tieneFicha = Boolean(recursoLocal?.ficha);

              return (
                <div
                  key={archivo.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 ${
                    recursoLocal?.estado === 'aprobado'
                      ? 'bg-green-50/50 dark:bg-green-400/5'
                      : recursoSeleccionado?.externalFileId === archivo.id
                        ? 'bg-blue-50 dark:bg-blue-400/10'
                        : ''
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={claseIconoDocumentoCentroEstudios}>
                      {esCarpetaDrive(archivo) ? (
                        <span className="text-[10px] font-black uppercase">DIR</span>
                      ) : (
                        <IconoRecursoBiblioteca mimeType={archivo.mimeType} className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-tkd-dark dark:text-white">
                        {recursoLocal?.tituloVisible || archivo.nombre}
                      </p>
                      <p className="truncate text-[11px] font-normal text-gray-400">
                        {describirTipoArchivo(archivo.mimeType)} · {archivo.ruta}
                        {recursoLocal?.estado === 'aprobado' && ' · ✓ aprobado'}
                      </p>
                      {recursoLocal?.ficha?.tags && recursoLocal.ficha.tags.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {recursoLocal.ficha.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-block rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-tkd-blue dark:border-blue-400/20 dark:bg-blue-400/10"
                            >
                              {tag}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {esCarpetaDrive(archivo) ? (
                      <button
                        type="button"
                        onClick={() => void abrirCarpetaDrive(archivo.id, archivo.nombre)}
                        aria-label={`Abrir carpeta ${archivo.nombre}`}
                        title="Abrir carpeta"
                        className={claseBotonIconoDocumentoCentroEstudios}
                      >
                        <span className="text-[9px] font-black uppercase">DIR</span>
                      </button>
                    ) : tieneFicha ? (
                      <>
                        {recursoLocal && (
                          <button
                            type="button"
                            onClick={() => setRecursoEnVistaPrevia(recursoLocal)}
                            aria-label={`Vista previa de ${archivo.nombre}`}
                            title="Vista previa del contenido real"
                            className={claseBotonIconoDocumentoCentroEstudios}
                          >
                            <IconoOjoAbierto className="h-4 w-4" />
                          </button>
                        )}
                        {recursoLocal?.ficha?.tipo === 'quiz' && (
                          <button
                            type="button"
                            onClick={() => setRecursoQuizEnEdicion(recursoLocal)}
                            aria-label={`Editar preguntas de ${archivo.nombre}`}
                            title="Editar preguntas del quiz"
                            className={claseBotonIconoDocumentoCentroEstudios}
                          >
                            <IconoQuiz className="h-4 w-4" />
                          </button>
                        )}
                        {recursoLocal?.ficha?.tipo === 'video' && recursoLocal?.youtubeVideoId && (
                          <button
                            type="button"
                            onClick={() => setRecursoReporteVisualizacion(recursoLocal)}
                            aria-label={`Ver reporte de visualización de ${archivo.nombre}`}
                            title="Ver reporte de visualización"
                            className={claseBotonIconoDocumentoCentroEstudios}
                          >
                            <IconoAnalisis className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void abrirClasificacion(archivo)}
                          aria-label={`Editar ${archivo.nombre}`}
                          title="Editar atributos"
                          className={claseBotonIconoDocumentoCentroEstudios}
                        >
                          <IconoEditar className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void retirarRecursoAprobado(archivo)}
                          aria-label={`Retirar ${archivo.nombre}`}
                          title="Retirar de la biblioteca"
                          className={claseBotonIconoDocumentoCentroEstudios}
                        >
                          <IconoEliminar className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void abrirClasificacion(archivo)}
                        aria-label={`Clasificar ${archivo.nombre}`}
                        title="Asignar atributos"
                        className={claseBotonIconoDocumentoExito}
                      >
                        <IconoAprobar className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </article>

      </div>

      {modalClasificacionAbierto && recursoSeleccionado && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-12 sm:py-16"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-clasificar-recurso"
        >
          <div className="max-h-[calc(100dvh-8rem)] w-full max-w-xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl dark:bg-gray-900">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">Recurso detectado</p>
            <h3 id="modal-clasificar-recurso" className="mt-2 text-2xl font-black uppercase text-tkd-dark dark:text-white">
              Clasificar recurso
            </h3>
            <p className="mt-1 text-xs font-normal text-gray-400">
              Completa la ficha académica. Al guardar, el recurso quedará aprobado y listo para asignar.
            </p>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nombre original</p>
                <p className="mt-1 text-sm font-black text-tkd-dark dark:text-white break-all">{recursoSeleccionado.nombre}</p>
              </div>

              <div>
                <label htmlFor="clasificacion-titulo-visible" className="block text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Título visible
                </label>
                <input
                  id="clasificacion-titulo-visible"
                  value={tituloVisible}
                  onChange={(event) => setTituloVisible(event.target.value)}
                  placeholder="Opcional: nombre claro para estudiantes"
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal dark:border-white/10 dark:bg-gray-950/40 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="clasificacion-disciplina" className="block text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Disciplina
                </label>
                <input
                  id="clasificacion-disciplina"
                  value={disciplina}
                  onChange={(event) => setDisciplina(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal dark:border-white/10 dark:bg-gray-950/40 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="clasificacion-tipo" className="block text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Tipo de recurso
                </label>
                <select
                  id="clasificacion-tipo"
                  value={tipo}
                  onChange={(event) => setTipo(event.target.value as TipoRecurso)}
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal dark:border-white/10 dark:bg-gray-950/40 dark:text-white"
                >
                  {TIPOS_RECURSO.map((tipoRecurso) => (
                    <option key={tipoRecurso} value={tipoRecurso}>{tipoRecurso}</option>
                  ))}
                </select>
              </div>

              {tipo === 'video' && (
                <div>
                  <label htmlFor="clasificacion-youtube-url" className="block text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Video de YouTube (opcional)
                  </label>
                  <input
                    id="clasificacion-youtube-url"
                    value={youtubeUrlTexto}
                    onChange={(event) => {
                      setYoutubeUrlTexto(event.target.value);
                      if (errorYoutubeUrl) setErrorYoutubeUrl('');
                    }}
                    placeholder="Pegá la URL del video de YouTube (youtube.com/watch?v=... o youtu.be/...)"
                    aria-invalid={errorYoutubeUrl ? 'true' : undefined}
                    aria-describedby={errorYoutubeUrl ? 'clasificacion-youtube-url-error' : undefined}
                    className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal dark:border-white/10 dark:bg-gray-950/40 dark:text-white"
                  />
                  <p className="mt-2 text-xs font-normal text-gray-400">
                    Si pegás un video de YouTube, los alumnos lo ven directo (sin costo de Drive) y
                    queda registrado si realmente lo miraron. Dejá vacío para seguir sirviendo el
                    archivo desde Google Drive.
                  </p>
                  {errorYoutubeUrl && (
                    <p id="clasificacion-youtube-url-error" role="alert" className="mt-2 text-xs font-bold text-red-600">
                      {errorYoutubeUrl}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="clasificacion-tags" className="block text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Tags (separados por coma)
                </label>
                <input
                  id="clasificacion-tags"
                  value={tagsTexto}
                  onChange={(event) => setTagsTexto(event.target.value)}
                  placeholder="poomsae, fundamentos, nivel 1"
                  className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal dark:border-white/10 dark:bg-gray-950/40 dark:text-white"
                />
                <div className="mt-3 max-h-40 overflow-y-auto rounded-2xl border border-gray-100 bg-gray-50/50 p-3 dark:border-white/10 dark:bg-white/5">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Tags sugeridos</p>
                  <div className="space-y-3">
                    {TAGS_ACADEMICOS_ESTANDAR.map((grupo) => (
                      <div key={grupo.grupo}>
                        <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-tkd-blue">{grupo.grupo}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {grupo.tags.map((tag) => {
                            const seleccionado = parsearTagsBiblioteca(tagsTexto).some((actual) => actual.toLowerCase() === tag.toLowerCase());
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => setTagsTexto(alternarTagEnTexto(tagsTexto, tag))}
                                className={`rounded-full border px-2.5 py-1 text-[9px] font-bold transition ${
                                  seleccionado
                                    ? 'border-tkd-blue bg-blue-50 text-tkd-blue'
                                    : 'border-gray-200 bg-white text-gray-500 hover:border-tkd-blue hover:text-tkd-blue'
                                }`}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalClasificacionAbierto(false)}
                className="rounded-2xl border border-gray-200 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void guardarClasificacion()}
                className="rounded-2xl bg-tkd-blue px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white"
              >
                Guardar clasificación
              </button>
            </div>
          </div>
        </div>
      )}

      {recursoQuizEnEdicion && (
        <QuizEditorModal
          tenantId={tenantId}
          recursoId={recursoQuizEnEdicion.id}
          tituloRecurso={recursoQuizEnEdicion.tituloVisible || recursoQuizEnEdicion.nombre}
          usuarioId={usuarioId}
          onCerrar={() => setRecursoQuizEnEdicion(null)}
        />
      )}

      {recursoEnVistaPrevia && (
        <MaterialPreviewModal
          asignacion={construirAsignacionPreview(recursoEnVistaPrevia)}
          onCerrar={() => setRecursoEnVistaPrevia(null)}
          modoVistaPrevia
        />
      )}

      {recursoReporteVisualizacion && (
        <ReporteVisualizacionVideo
          tenantId={tenantId}
          recursoId={recursoReporteVisualizacion.id}
          tituloRecurso={recursoReporteVisualizacion.tituloVisible || recursoReporteVisualizacion.nombre}
          onCerrar={() => setRecursoReporteVisualizacion(null)}
        />
      )}
    </section>
  );
};

export default BibliotecaView;
