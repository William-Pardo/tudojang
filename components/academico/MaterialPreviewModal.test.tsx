import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MaterialPreviewModal from './MaterialPreviewModal';
import type { AsignacionCentroEstudios } from '../../models/academico/asignacionService.types';
import { progresoRepository } from '../../servicios/academico/progresoRepository';

const asignacion: AsignacionCentroEstudios = {
  id: 'a1',
  tenantId: 'tenant-1',
  recursoId: 'r1',
  titulo: 'Quiz: seguridad y conducta',
  descripcion: 'Evaluación',
  destinatario: { tipo: 'grupo', grupo: 'Todos' },
  uso: 'evaluacion',
  momento: 'durante',
  obligatoria: true,
  fechaApertura: '2026-06-26T00:00:00.000Z',
  estado: 'publicada',
  creadoPorUid: 'admin',
  creadoEn: '2026-06-26T00:00:00.000Z',
  actualizadoEn: '2026-06-26T00:00:00.000Z',
  estadoProgreso: 'en_progreso',
  porcentajeProgreso: 45,
  urgencia: 'alta',
};

describe('MaterialPreviewModal', () => {
  beforeEach(() => {
    localStorage.clear();
    // jsdom no implementa URL.createObjectURL/revokeObjectURL -- el flujo de blob
    // autenticado del proxy los necesita para armar la URL local del <video>/<img>.
    URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
    URL.revokeObjectURL = jest.fn();
  });

  const crearRepositoryMock = () => ({
    leerQuiz: jest.fn().mockResolvedValue(null),
    guardarQuiz: jest.fn().mockResolvedValue(undefined),
    leerSync: jest.fn().mockResolvedValue(null),
    guardarSync: jest.fn().mockResolvedValue(undefined),
    aplicarAAsignaciones: jest.fn((asignaciones) => asignaciones),
  });

  const preguntasQuizMock = [
    {
      id: 'seguridad-1',
      enunciado: '¿Qué debe hacer un estudiante antes de iniciar una práctica técnica?',
      opciones: [
        'Entrar al área sin autorización',
        'Saludar, escuchar instrucciones y revisar el espacio',
        'Practicar técnicas sin supervisión',
      ],
      respuestaCorrecta: 'Saludar, escuchar instrucciones y revisar el espacio',
    },
  ];

  const crearQuizServiceMock = () => ({
    obtenerQuiz: jest.fn().mockResolvedValue(preguntasQuizMock),
  });

  it('renderiza quiz cuando el recurso es evaluación', async () => {
    render(<MaterialPreviewModal asignacion={asignacion} onCerrar={jest.fn()} quizService={crearQuizServiceMock()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(await screen.findByText(/quiz interactivo/i)).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: /quiz: seguridad y conducta/i })).toHaveLength(2);
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('muestra un aviso claro cuando el quiz todavía no tiene preguntas configuradas', async () => {
    const quizService = { obtenerQuiz: jest.fn().mockResolvedValue(null) };
    render(<MaterialPreviewModal asignacion={asignacion} onCerrar={jest.fn()} quizService={quizService} />);

    expect(await screen.findByText(/todavía no tiene preguntas configuradas/i)).toBeInTheDocument();
    expect(screen.queryByText(/quiz interactivo/i)).not.toBeInTheDocument();
  });

  it('renderiza visor PDF para material no evaluativo', () => {
    render(<MaterialPreviewModal asignacion={{ ...asignacion, uso: 'estudio', titulo: 'Material base' }} onCerrar={jest.fn()} />);

    expect(screen.getByText(/visor pdf/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /marcar pagina actual como vista/i })).toBeInTheDocument();
  });

  it('carga progreso guardado al abrir material no evaluativo', async () => {
    const leerSync = jest.spyOn(progresoRepository, 'leerSync').mockReturnValue({
      paginasVistas: [1, 2],
      segundosUnicos: [],
    });

    render(<MaterialPreviewModal asignacion={{ ...asignacion, uso: 'estudio', titulo: 'Material base' }} onCerrar={jest.fn()} />);

    expect(await screen.findByText(/paginas registradas: 2\/3/i)).toBeInTheDocument();
    expect(leerSync).toHaveBeenCalledWith('tenant-1', 'a1');

    leerSync.mockRestore();
  });

  it('solo cierra con el botón de cerrar', async () => {
    const user = userEvent.setup();
    const onCerrar = jest.fn();
    render(<MaterialPreviewModal asignacion={asignacion} onCerrar={onCerrar} />);

    await user.click(screen.getByLabelText(/cerrar material/i));

    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('actualiza estado local del modal cuando el quiz se aprueba', async () => {
    const user = userEvent.setup();
    render(<MaterialPreviewModal asignacion={asignacion} onCerrar={jest.fn()} quizService={crearQuizServiceMock()} />);

    await user.click(await screen.findByLabelText(/saludar, escuchar instrucciones/i));
    await user.click(screen.getByRole('button', { name: /enviar respuestas/i }));

    expect(screen.getByText(/quiz aprobado/i)).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('aprobado')).toBeInTheDocument();
  });

  it('guarda progreso de quiz en el repositorio inyectado', async () => {
    const user = userEvent.setup();
    const repository = crearRepositoryMock();
    render(<MaterialPreviewModal asignacion={asignacion} onCerrar={jest.fn()} repository={repository} quizService={crearQuizServiceMock()} />);

    await user.click(await screen.findByLabelText(/saludar, escuchar instrucciones/i));
    await user.click(screen.getByRole('button', { name: /enviar respuestas/i }));

    expect(repository.guardarQuiz).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      asignacionId: 'a1',
      aprobado: true,
      estadoPostQuiz: 'aprobado',
    }));
  });

  it('guarda avance PDF en el repositorio inyectado al sincronizar', async () => {
    const user = userEvent.setup();
    const repository = crearRepositoryMock();
    render(
      <MaterialPreviewModal
        asignacion={{ ...asignacion, uso: 'estudio', titulo: 'Material base' }}
        onCerrar={jest.fn()}
        repository={repository}
      />
    );

    await user.click(screen.getByRole('button', { name: /marcar pagina actual como vista/i }));
    await user.click(screen.getByRole('button', { name: /sincronizar avance/i }));

    expect(repository.guardarSync).toHaveBeenCalledWith('tenant-1', 'a1', expect.objectContaining({
      paginasVistas: [1],
      segundosUnicos: [],
    }));
  });

  it('solicita URL temporal segura para material Drive no evaluativo', async () => {
    const driveService = {
      obtenerUrlTemporal: jest.fn().mockResolvedValue({
        ok: true,
        url: 'https://drive-temporal.test/file',
        fileName: 'Material base.pdf',
        mimeType: 'application/pdf',
        expiresAt: '2026-06-28T12:15:00.000Z',
      }),
      obtenerBlobProtegido: jest.fn().mockResolvedValue(new Blob(['contenido'], { type: 'application/pdf' })),
    };

    render(
      <MaterialPreviewModal
        asignacion={{
          ...asignacion,
          uso: 'estudio',
          titulo: 'Material base',
          externalFileId: 'drive-file-real',
        }}
        onCerrar={jest.fn()}
        driveService={driveService as any}
      />
    );

    expect(await screen.findByText(/acceso seguro listo/i)).toBeInTheDocument();
    expect(driveService.obtenerUrlTemporal).toHaveBeenCalledWith('tenant-1', 'a1', 'drive-file-real');
    expect(driveService.obtenerBlobProtegido).toHaveBeenCalledWith('https://drive-temporal.test/file');
  });

  it('en modoVistaPrevia usa obtenerUrlTemporalRecurso (recursoId) en vez de obtenerUrlTemporal (asignacion real)', async () => {
    const driveService = {
      obtenerUrlTemporal: jest.fn(),
      obtenerUrlTemporalRecurso: jest.fn().mockResolvedValue({
        ok: true,
        url: 'https://drive-temporal.test/preview-file',
        fileName: 'Material base.pdf',
        mimeType: 'application/pdf',
        expiresAt: '2026-06-28T12:15:00.000Z',
      }),
      obtenerBlobProtegido: jest.fn().mockResolvedValue(new Blob(['contenido'], { type: 'application/pdf' })),
    };

    render(
      <MaterialPreviewModal
        asignacion={{
          ...asignacion,
          uso: 'estudio',
          titulo: 'Material base',
          recursoId: 'recurso-preview-1',
          externalFileId: 'drive-file-real',
        }}
        onCerrar={jest.fn()}
        driveService={driveService as any}
        modoVistaPrevia
      />
    );

    expect(await screen.findByText(/acceso seguro listo/i)).toBeInTheDocument();
    expect(driveService.obtenerUrlTemporalRecurso).toHaveBeenCalledWith('tenant-1', 'recurso-preview-1');
    expect(driveService.obtenerUrlTemporal).not.toHaveBeenCalled();
  });

  it('reproduce una imagen usando el blob autenticado del proxy, no la URL cruda (bloqueada por CORS)', async () => {
    const blobImagen = new Blob(['fake-image-bytes'], { type: 'image/png' });
    const driveService = {
      obtenerUrlTemporal: jest.fn().mockResolvedValue({
        ok: true,
        url: 'https://us-central1-tudojang.cloudfunctions.net/proxyDriveMedia?tenantId=tenant-1&fileId=f1&asignacionId=a1',
        fileName: 'foto.png',
        mimeType: 'image/png',
        expiresAt: '2026-06-28T12:15:00.000Z',
      }),
      obtenerBlobProtegido: jest.fn().mockResolvedValue(blobImagen),
    };

    render(
      <MaterialPreviewModal
        asignacion={{
          ...asignacion,
          uso: 'estudio',
          titulo: 'foto.png',
          externalFileId: 'drive-file-real',
        }}
        onCerrar={jest.fn()}
        driveService={driveService as any}
      />
    );

    const img = await screen.findByAltText('foto.png');
    expect(img).toHaveAttribute('src', 'blob:mock-url');
    expect(driveService.obtenerBlobProtegido).toHaveBeenCalledWith(
      'https://us-central1-tudojang.cloudfunctions.net/proxyDriveMedia?tenantId=tenant-1&fileId=f1&asignacionId=a1'
    );
  });

  it('reproduce video usando el blob autenticado del proxy, no la URL cruda (bloqueada por CORS)', async () => {
    const blobVideo = new Blob(['fake-video-bytes'], { type: 'video/mp4' });
    const driveService = {
      obtenerUrlTemporal: jest.fn().mockResolvedValue({
        ok: true,
        url: 'https://us-central1-tudojang.cloudfunctions.net/proxyDriveMedia?tenantId=tenant-1&fileId=f1&asignacionId=a1',
        fileName: 'clase.mp4',
        mimeType: 'video/mp4',
        expiresAt: '2026-06-28T12:15:00.000Z',
      }),
      obtenerBlobProtegido: jest.fn().mockResolvedValue(blobVideo),
    };

    render(
      <MaterialPreviewModal
        asignacion={{
          ...asignacion,
          uso: 'estudio',
          titulo: 'clase.mp4',
          externalFileId: 'drive-file-real',
        }}
        onCerrar={jest.fn()}
        driveService={driveService as any}
      />
    );

    const video = await screen.findByLabelText(/video clase\.mp4/i);
    expect(video).toHaveAttribute('src', 'blob:mock-url');
  });

  it('muestra error controlado si el archivo Drive fue eliminado', async () => {
    const driveService = {
      obtenerUrlTemporal: jest.fn().mockRejectedValue(
        Object.assign(new Error('El archivo ya no existe en Google Drive'), { code: 'not-found' }),
      ),
    };

    render(
      <MaterialPreviewModal
        asignacion={{
          ...asignacion,
          uso: 'estudio',
          titulo: 'Material base',
          externalFileId: 'drive-file-eliminado',
        }}
        onCerrar={jest.fn()}
        driveService={driveService as any}
      />
    );

    expect(await screen.findByText(/archivo de drive no disponible/i)).toBeInTheDocument();
  });
});
