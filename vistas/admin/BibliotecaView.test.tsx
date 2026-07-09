/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BibliotecaView from './BibliotecaView';
import { clearMockRecursos, getMockRecursos } from '../../servicios/academico/bibliotecaService';

import '@testing-library/jest-dom';
jest.setTimeout(15000);

declare global {
  namespace jest {
    interface Matchers<R, T = {}> {
      toBeInTheDocument(): R;
      toBeGreaterThan(expected: number): R;
    }
  }
}

jest.mock('../../context/NotificacionContext', () => ({
  useNotificacion: () => ({
    mostrarNotificacion: jest.fn(),
  }),
}));

describe('BibliotecaView', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.hash = '';
    clearMockRecursos();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('muestra el pipeline de Drive desconectado sin datos demo', () => {
    render(<BibliotecaView />);

    expect(screen.getByText(/paso 1/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /conectar drive/i })).toBeInTheDocument();
    expect(screen.getByText(/cuenta drive:/i)).toBeInTheDocument();
    expect(screen.getByText(/sin cuenta conectada/i)).toBeInTheDocument();
    expect(screen.getByText(/selecciona una carpeta/i)).toBeInTheDocument();
    expect(screen.queryByText(/modo demo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sin consumo de ia/i)).not.toBeInTheDocument();
  });

  it('renderiza explorador de Drive y permite importar, clasificar y aprobar un recurso en un paso', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('tudojang:driveConnection:tenant-real', 'conn-global-123');
    window.localStorage.setItem('tudojang:driveFolder:tenant-real', 'folder-root');
    const driveService = {
      iniciarConexionOAuth: jest.fn(),
      procesarCallbackOAuth: jest.fn(),
      listarCarpetaDrive: jest.fn().mockResolvedValue([
        {
          id: 'file-demo-1',
          name: 'Fundamentos tecnicos.pdf',
          mimeType: 'application/pdf',
        },
      ]),
    };

    render(<BibliotecaView driveService={driveService as any} tenantId="tenant-real" />);

    expect(screen.getByRole('heading', { name: /conectar drive/i })).toBeInTheDocument();
    expect(screen.getByText(/2\. archivos detectados/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/Fundamentos tecnicos.pdf/i)).length).toBeGreaterThan(0);

    // Click sobre el borrador abre el modal de clasificacion
    await user.click(screen.getByRole('button', { name: /clasificar fundamentos tecnicos.pdf/i }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /clasificar recurso/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retirar fundamentos tecnicos.pdf/i })).not.toBeInTheDocument();

    // Guardar la clasificacion con titulo visible lo aprueba directamente
    await user.type(screen.getByLabelText(/t[íi]tulo visible/i), 'Fundamentos nivel 1');
    await user.click(screen.getByRole('button', { name: /guardar clasificaci/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(await screen.findByRole('button', { name: /retirar fundamentos tecnicos.pdf/i })).toBeInTheDocument();
    expect(getMockRecursos()[0]?.estado).toBe('aprobado');
    expect(getMockRecursos()[0]?.tituloVisible).toBe('Fundamentos nivel 1');
  });

  it('inicia la conexion OAuth de Google Drive desde Biblioteca academica', async () => {
    const user = userEvent.setup();
    const navegarOAuth = jest.fn();
    const driveService = {
      iniciarConexionOAuth: jest.fn().mockResolvedValue('https://accounts.google.com/oauth-drive'),
    };

    render(<BibliotecaView driveService={driveService as any} navegarOAuth={navegarOAuth} tenantId="tenant-real" />);

    await user.click(screen.getByRole('button', { name: /conectar google drive/i }));

    expect(driveService.iniciarConexionOAuth).toHaveBeenCalledWith('tenant-real', expect.any(String));
    expect(window.localStorage.getItem('tudojang:driveOAuthReturnPath')).toBe('/centro-estudios');
    expect(navegarOAuth).toHaveBeenCalledWith('https://accounts.google.com/oauth-drive');
  });

  it('no procesa el callback OAuth localmente para evitar reutilizar el code', async () => {
    window.location.hash = '#/centro-estudios?code=oauth-code-123';
    const driveService = {
      iniciarConexionOAuth: jest.fn(),
      procesarCallbackOAuth: jest.fn().mockResolvedValue({ ok: true, connectionId: 'conn-123' }),
    };

    render(<BibliotecaView driveService={driveService as any} tenantId="tenant-real" />);

    expect(screen.getByText(/^Desconectada$/i)).toBeInTheDocument();
    expect(driveService.procesarCallbackOAuth).not.toHaveBeenCalled();

    window.location.hash = '';
  });

  it('muestra conectado cuando el callback OAuth fue procesado por el manejador global', async () => {
    window.localStorage.setItem('tudojang:driveConnection:tenant-real', 'conn-global-123');
    const driveService = {
      iniciarConexionOAuth: jest.fn(),
      procesarCallbackOAuth: jest.fn(),
      listarCarpetaDrive: jest.fn(),
    };

    render(<BibliotecaView driveService={driveService as any} tenantId="tenant-real" />);

    await screen.findByText(/^Conectada$/i);
    expect(screen.getByText(/falta seleccionar carpeta/i)).toBeInTheDocument();
    expect(screen.queryByText(/Fundamentos tecnicos.pdf/i)).not.toBeInTheDocument();
    expect(screen.getByText(/cuenta conectada .* falta carpeta/i)).toBeInTheDocument();
    expect(driveService.procesarCallbackOAuth).not.toHaveBeenCalled();
  });

  it('simplifica la UX Drive con accion principal unica y selector visual de carpeta', async () => {
    const { unmount } = render(<BibliotecaView tenantId="tenant-real" />);

    expect(screen.getByRole('button', { name: /conectar google drive/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /desconectar google drive/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/link o id de carpeta drive/i)).not.toBeInTheDocument();
    expect(screen.getByText(/conecta google drive para elegir la carpeta academica/i)).toBeInTheDocument();

    unmount();
    window.localStorage.setItem('tudojang:driveConnection:tenant-real', 'conn-global-123');
    const driveService = {
      iniciarConexionOAuth: jest.fn(),
      procesarCallbackOAuth: jest.fn(),
      listarCarpetaDrive: jest.fn().mockResolvedValue([
        {
          id: 'folder-real-123',
          name: 'Materiales institucionales',
          mimeType: 'application/vnd.google-apps.folder',
        },
      ]),
    };
    render(<BibliotecaView driveService={driveService as any} tenantId="tenant-real" />);

    expect(await screen.findByRole('button', { name: /desconectar google drive/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /seleccionar carpeta de drive/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reconectar google drive/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/link o id de carpeta drive/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /usar link o id de carpeta/i })).not.toBeInTheDocument();
    expect(await screen.findByText(/seleccionar carpeta drive/i)).toBeInTheDocument();
    expect(await screen.findByText(/materiales institucionales/i)).toBeInTheDocument();
  });

  it('desconecta Google Drive con confirmacion y limpia estado local', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('tudojang:driveConnection:tenant-real', 'conn-global-123');
    window.localStorage.setItem('tudojang:driveFolder:tenant-real', 'folder-real');
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const driveService = {
      iniciarConexionOAuth: jest.fn(),
      procesarCallbackOAuth: jest.fn(),
      listarCarpetaDrive: jest.fn().mockResolvedValue([]),
      desconectarDrive: jest.fn().mockResolvedValue({ ok: true, disconnectedCount: 1 }),
    };

    render(<BibliotecaView driveService={driveService as any} tenantId="tenant-real" />);

    await user.click(await screen.findByRole('button', { name: /desconectar google drive/i }));

    expect(window.confirm).toHaveBeenCalled();
    expect(driveService.desconectarDrive).toHaveBeenCalledWith('tenant-real');
    expect(window.localStorage.getItem('tudojang:driveConnection:tenant-real')).toBeNull();
    expect(window.localStorage.getItem('tudojang:driveFolder:tenant-real')).toBeNull();
    expect(await screen.findByText(/^Desconectada$/i)).toBeInTheDocument();
    expect(screen.queryByText(/demo sin drive real/i)).not.toBeInTheDocument();
  });

  it('lista automaticamente la carpeta institucional persistida cuando Drive ya esta conectado', async () => {
    window.localStorage.setItem('tudojang:driveConnection:tenant-real', 'conn-global-123');
    window.localStorage.setItem('tudojang:driveFolder:tenant-real', 'folder-persistida');
    const driveService = {
      iniciarConexionOAuth: jest.fn(),
      procesarCallbackOAuth: jest.fn(),
      listarCarpetaDrive: jest.fn().mockResolvedValue([
        {
          id: 'file-persistido-1',
          name: 'Plan real persistido.pdf',
          mimeType: 'application/pdf',
        },
      ]),
    };

    render(<BibliotecaView driveService={driveService as any} tenantId="tenant-real" />);

    expect((await screen.findAllByText(/plan real persistido.pdf/i)).length).toBeGreaterThan(0);
    expect(driveService.listarCarpetaDrive).toHaveBeenCalledWith('tenant-real', 'folder-persistida');
    expect(screen.getByText(/carpeta activa: folder-persistida/i)).toBeInTheDocument();
    expect(screen.queryByText(/demo sin drive real/i)).not.toBeInTheDocument();
  });

  it('sincroniza la carpeta activa desde Firestore cuando no existe cache local', async () => {
    const driveService = {
      iniciarConexionOAuth: jest.fn(),
      procesarCallbackOAuth: jest.fn(),
      obtenerConexionDrive: jest.fn().mockResolvedValue({
        connected: true,
        connectionId: 'conn-firestore-123',
        activeFolderId: 'folder-firestore-123',
        activeFolderName: 'Carpeta Firestore',
        googleAccountEmail: 'drive-admin@example.com',
        status: 'active',
      }),
      listarCarpetaDrive: jest.fn().mockResolvedValue([
        {
          id: 'file-firestore-1',
          name: 'Material desde Firestore.pdf',
          mimeType: 'application/pdf',
        },
      ]),
      desconectarDrive: jest.fn(),
      guardarCarpetaActiva: jest.fn(),
    };

    render(<BibliotecaView driveService={driveService as any} tenantId="tenant-real" />);

    await screen.findByText(/^Conectada$/i);
    expect(screen.queryByText(/conexion: conn-firestore-123/i)).not.toBeInTheDocument();
    expect(screen.getByText(/drive-admin@example.com/i)).toBeInTheDocument();
    expect(screen.getByText(/carpeta activa: carpeta firestore/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/material desde firestore.pdf/i)).length).toBeGreaterThan(0);
    expect(window.localStorage.getItem('tudojang:driveConnection:tenant-real')).toBe('conn-firestore-123');
    expect(window.localStorage.getItem('tudojang:driveFolder:tenant-real')).toBe('folder-firestore-123');
  });

  it('selecciona carpeta desde Drive y lista archivos reales de la carpeta', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('tudojang:driveConnection:tenant-real', 'conn-global-123');
    const driveService = {
      iniciarConexionOAuth: jest.fn(),
      procesarCallbackOAuth: jest.fn(),
      listarCarpetaDrive: jest.fn()
        .mockResolvedValueOnce([
          {
            id: 'folder-real-123',
            name: 'Materiales institucionales',
            mimeType: 'application/vnd.google-apps.folder',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'file-real-1',
            name: 'Guia real de poomsae.pdf',
            mimeType: 'application/pdf',
            webViewLink: 'https://drive.google.com/file/d/file-real-1/view',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'file-real-1',
            name: 'Guia real de poomsae.pdf',
            mimeType: 'application/pdf',
            webViewLink: 'https://drive.google.com/file/d/file-real-1/view',
          },
        ]),
      guardarCarpetaActiva: jest.fn().mockResolvedValue({
        ok: true,
        connectionId: 'conn-global-123',
        activeFolderId: 'folder-real-123',
      }),
    };

    render(<BibliotecaView driveService={driveService as any} tenantId="tenant-real" />);

    await user.click(await screen.findByRole('button', { name: /materiales institucionales/i }));
    await user.click(await screen.findByRole('button', { name: /usar esta carpeta/i }));

    expect(driveService.listarCarpetaDrive).toHaveBeenCalledWith('tenant-real', 'root');
    expect(driveService.listarCarpetaDrive).toHaveBeenCalledWith('tenant-real', 'folder-real-123');
    expect(driveService.guardarCarpetaActiva).toHaveBeenCalledWith('tenant-real', 'folder-real-123', 'Materiales institucionales');
    expect(window.localStorage.getItem('tudojang:driveFolder:tenant-real')).toBe('folder-real-123');
    expect((await screen.findAllByText(/guia real de poomsae.pdf/i)).length).toBeGreaterThan(0);
  });

  it('importa un archivo real listado usando tenantId real', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('tudojang:driveConnection:tenant-real', 'conn-global-123');
    const driveService = {
      iniciarConexionOAuth: jest.fn(),
      procesarCallbackOAuth: jest.fn(),
      listarCarpetaDrive: jest.fn()
        .mockResolvedValueOnce([
          {
            id: 'file-real-1',
            name: 'Guia real de poomsae.pdf',
            mimeType: 'application/pdf',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'file-real-1',
            name: 'Guia real de poomsae.pdf',
            mimeType: 'application/pdf',
          },
        ]),
      guardarCarpetaActiva: jest.fn().mockResolvedValue({
        ok: true,
        connectionId: 'conn-global-123',
        activeFolderId: 'root',
      }),
    };
    const bibliotecaService = {
      importFromDrive: jest.fn().mockResolvedValue({
        id: 'rec-real-1',
        tenantId: 'tenant-real',
        proveedor: 'google_drive',
        externalFileId: 'file-real-1',
        nombre: 'Guia real de poomsae.pdf',
        mimeType: 'application/pdf',
        ficha: null,
        estado: 'borrador',
        creadoPorUid: 'admin-real',
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      }),
      updateFicha: jest.fn(),
      approveRecurso: jest.fn(),
    };

    render(
      <BibliotecaView
        driveService={driveService as any}
        bibliotecaService={bibliotecaService as any}
        tenantId="tenant-real"
        usuarioId="admin-real"
      />,
    );

    await user.click(await screen.findByRole('button', { name: /usar esta carpeta/i }));
    await user.click(await screen.findByRole('button', { name: /clasificar guia real de poomsae.pdf/i }));

    expect(bibliotecaService.importFromDrive).toHaveBeenCalledWith(
      'tenant-real',
      'file-real-1',
      'Guia real de poomsae.pdf',
      'application/pdf',
      'admin-real',
    );

    // El click solo abre el modal: nada de ficha sintetica ni aprobacion automatica
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(bibliotecaService.updateFicha).not.toHaveBeenCalled();
    expect(bibliotecaService.approveRecurso).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/t[íi]tulo visible/i), 'Guia Poomsae Nivel 1');
    await user.click(screen.getByRole('button', { name: /guardar clasificaci/i }));

    await waitFor(() => {
      expect(bibliotecaService.updateFicha).toHaveBeenCalledWith(
        'tenant-real',
        'rec-real-1',
        expect.objectContaining({
          disciplina: 'Taekwondo',
          tipo: 'pdf',
          usos: ['estudio'],
        }),
        'Guia Poomsae Nivel 1',
      );
      expect(bibliotecaService.approveRecurso).toHaveBeenCalledWith('tenant-real', 'rec-real-1', 'admin-real');
    });

    expect(await screen.findByRole('button', { name: /retirar guia real de poomsae.pdf/i })).toBeInTheDocument();
  });

  it('un borrador sin ficha no puede aprobarse directamente: exige clasificarlo primero', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('tudojang:driveConnection:tenant-real', 'conn-global-123');
    window.localStorage.setItem('tudojang:driveFolder:tenant-real', 'folder-root');
    const driveService = {
      iniciarConexionOAuth: jest.fn(),
      procesarCallbackOAuth: jest.fn(),
      listarCarpetaDrive: jest.fn().mockResolvedValue([
        {
          id: 'file-borrador-1',
          name: 'Plan borrador.pdf',
          mimeType: 'application/pdf',
        },
      ]),
    };
    const bibliotecaService = {
      importFromDrive: jest.fn().mockResolvedValue({
        id: 'rec-borrador-1',
        tenantId: 'tenant-real',
        proveedor: 'google_drive',
        externalFileId: 'file-borrador-1',
        nombre: 'Plan borrador.pdf',
        mimeType: 'application/pdf',
        ficha: null,
        estado: 'borrador',
        creadoPorUid: 'admin-real',
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      }),
      findRecursoIndexado: jest.fn().mockResolvedValue(null),
      updateFicha: jest.fn(),
      approveRecurso: jest.fn(),
      archiveRecurso: jest.fn(),
      listarRecursosAprobados: jest.fn().mockResolvedValue([]),
    };

    render(
      <BibliotecaView
        driveService={driveService as any}
        bibliotecaService={bibliotecaService as any}
        tenantId="tenant-real"
        usuarioId="admin-real"
      />,
    );

    // Cerrar el modal sin guardar deja el recurso en borrador sin ficha
    await user.click(await screen.findByRole('button', { name: /clasificar plan borrador.pdf/i }));
    await user.click(await screen.findByRole('button', { name: /cancelar/i }));

    // Sin clasificar no existe accion de aprobar: solo se ofrece clasificar
    expect(screen.getByRole('button', { name: /clasificar plan borrador.pdf/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /aprobar plan borrador.pdf/i })).not.toBeInTheDocument();
    expect(bibliotecaService.updateFicha).not.toHaveBeenCalled();
    expect(bibliotecaService.approveRecurso).not.toHaveBeenCalled();
  });

  it('lee recursos ya aprobados al cargar y muestra accion de retirar', async () => {
    window.localStorage.setItem('tudojang:driveConnection:tenant-real', 'conn-global-123');
    window.localStorage.setItem('tudojang:driveFolder:tenant-real', 'folder-root');
    const recursoAprobado = {
      id: 'rec-aprobado-1',
      tenantId: 'tenant-real',
      proveedor: 'google_drive' as const,
      externalFileId: 'file-aprobado-1',
      nombre: 'Material aprobado.pdf',
      mimeType: 'application/pdf',
      ficha: { disciplina: 'Taekwondo', tipo: 'pdf' as const, usos: ['estudio' as const] },
      estado: 'aprobado' as const,
      creadoPorUid: 'admin-real',
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    };
    const driveService = {
      iniciarConexionOAuth: jest.fn(),
      procesarCallbackOAuth: jest.fn(),
      listarCarpetaDrive: jest.fn().mockResolvedValue([
        {
          id: 'file-aprobado-1',
          name: 'Material aprobado.pdf',
          mimeType: 'application/pdf',
        },
      ]),
    };
    const bibliotecaService = {
      importFromDrive: jest.fn(),
      findRecursoIndexado: jest.fn(),
      updateFicha: jest.fn(),
      approveRecurso: jest.fn(),
      archiveRecurso: jest.fn(),
      listarRecursosAprobados: jest.fn().mockResolvedValue([recursoAprobado]),
    };

    render(
      <BibliotecaView
        driveService={driveService as any}
        bibliotecaService={bibliotecaService as any}
        tenantId="tenant-real"
        usuarioId="admin-real"
      />,
    );

    expect(await screen.findByRole('button', { name: /retirar material aprobado.pdf/i })).toBeInTheDocument();
    expect(bibliotecaService.listarRecursosAprobados).toHaveBeenCalledWith('tenant-real');
    expect(bibliotecaService.importFromDrive).not.toHaveBeenCalled();
  });

  it('abre clasificacion de un recurso pendiente sin reimportar y lo aprueba directamente al guardar', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('tudojang:driveConnection:tenant-real', 'conn-global-123');
    window.localStorage.setItem('tudojang:driveFolder:tenant-real', 'folder-root');
    const recursoPendiente = {
      id: 'rec-pendiente-1',
      tenantId: 'tenant-real',
      proveedor: 'google_drive' as const,
      externalFileId: 'file-pendiente-1',
      nombre: 'Material pendiente.pdf',
      mimeType: 'application/pdf',
      ficha: null,
      estado: 'borrador' as const,
      creadoPorUid: 'admin-real',
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    };
    const driveService = {
      iniciarConexionOAuth: jest.fn(),
      procesarCallbackOAuth: jest.fn(),
      listarCarpetaDrive: jest.fn().mockResolvedValue([
        {
          id: 'file-pendiente-1',
          name: 'Material pendiente.pdf',
          mimeType: 'application/pdf',
        },
      ]),
    };
    const bibliotecaService = {
      importFromDrive: jest.fn(),
      findRecursoIndexado: jest.fn().mockResolvedValue(recursoPendiente),
      updateFicha: jest.fn(),
      approveRecurso: jest.fn(),
      archiveRecurso: jest.fn(),
      listarRecursosAprobados: jest.fn().mockResolvedValue([]),
    };

    render(
      <BibliotecaView
        driveService={driveService as any}
        bibliotecaService={bibliotecaService as any}
        tenantId="tenant-real"
        usuarioId="admin-real"
      />,
    );

    // El archivo aun no esta indexado localmente: el click resuelve el recurso remoto sin reimportar
    await user.click(await screen.findByRole('button', { name: /clasificar material pendiente.pdf/i }));

    expect(bibliotecaService.importFromDrive).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // Guardar la clasificación debe disparar updateFicha y approveRecurso
    await user.click(screen.getByRole('button', { name: /guardar clasificaci/i }));

    await waitFor(() => {
      expect(bibliotecaService.updateFicha).toHaveBeenCalled();
      expect(bibliotecaService.approveRecurso).toHaveBeenCalledWith('tenant-real', 'rec-pendiente-1', 'admin-real');
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /editar material pendiente.pdf/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /retirar material pendiente.pdf/i })).toBeInTheDocument();
  });

  it('permite abrir una subcarpeta real desde el explorador Drive', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('tudojang:driveConnection:tenant-real', 'conn-global-123');
    window.localStorage.setItem('tudojang:driveFolder:tenant-real', 'folder-root');
    const driveService = {
      iniciarConexionOAuth: jest.fn(),
      procesarCallbackOAuth: jest.fn(),
      listarCarpetaDrive: jest.fn()
        .mockResolvedValueOnce([
          {
            id: 'folder-teoria',
            name: 'Teoria',
            mimeType: 'application/vnd.google-apps.folder',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'file-teoria-1',
            name: 'Reglamento basico.pdf',
            mimeType: 'application/pdf',
          },
        ]),
    };

    render(<BibliotecaView driveService={driveService as any} tenantId="tenant-real" />);

    await user.click(await screen.findByRole('button', { name: /abrir carpeta teoria/i }));

    expect(driveService.listarCarpetaDrive).toHaveBeenNthCalledWith(1, 'tenant-real', 'folder-root');
    expect(driveService.listarCarpetaDrive).toHaveBeenNthCalledWith(2, 'tenant-real', 'folder-teoria');
    expect((await screen.findAllByText(/reglamento basico.pdf/i)).length).toBeGreaterThan(0);
  });

  it('muestra error operativo claro cuando el token de Drive fue revocado', async () => {
    window.localStorage.setItem('tudojang:driveConnection:tenant-real', 'conn-global-123');
    const driveService = {
      iniciarConexionOAuth: jest.fn(),
      procesarCallbackOAuth: jest.fn(),
      listarCarpetaDrive: jest.fn().mockRejectedValue(
        Object.assign(new Error('invalid_grant'), { code: 'unauthenticated' }),
      ),
    };

    render(<BibliotecaView driveService={driveService as any} tenantId="tenant-real" />);

    expect(await screen.findByText(/conexion de drive expirada/i)).toBeInTheDocument();
  });

  it('muestra botones de editar y retirar para recursos aprobados y llama a archivar al retirar', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('tudojang:driveConnection:tenant-real', 'conn-global-123');
    window.localStorage.setItem('tudojang:driveFolder:tenant-real', 'folder-root');
    const recursoAprobado = {
      id: 'rec-aprobado-uno',
      tenantId: 'tenant-real',
      proveedor: 'google_drive' as const,
      externalFileId: 'file-aprobado-uno',
      nombre: 'Material aprobado uno.pdf',
      mimeType: 'application/pdf',
      ficha: { disciplina: 'Taekwondo', tipo: 'pdf' as const, usos: ['estudio' as const] },
      estado: 'aprobado' as const,
      creadoPorUid: 'admin-real',
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    };
    const driveService = {
      iniciarConexionOAuth: jest.fn(),
      procesarCallbackOAuth: jest.fn(),
      listarCarpetaDrive: jest.fn().mockResolvedValue([
        {
          id: 'file-aprobado-uno',
          name: 'Material aprobado uno.pdf',
          mimeType: 'application/pdf',
        },
      ]),
    };
    const bibliotecaService = {
      importFromDrive: jest.fn(),
      findRecursoIndexado: jest.fn().mockResolvedValue(recursoAprobado),
      updateFicha: jest.fn(),
      approveRecurso: jest.fn(),
      archiveRecurso: jest.fn(),
      listarRecursosAprobados: jest.fn().mockResolvedValue([recursoAprobado]),
    };

    render(
      <BibliotecaView
        driveService={driveService as any}
        bibliotecaService={bibliotecaService as any}
        tenantId="tenant-real"
        usuarioId="admin-real"
      />,
    );

    // Debe mostrar los botones correspondientes
    expect(await screen.findByRole('button', { name: /editar material aprobado uno.pdf/i })).toBeInTheDocument();
    const botonRetirar = await screen.findByRole('button', { name: /retirar material aprobado uno.pdf/i });
    expect(botonRetirar).toBeInTheDocument();

    // Al retirar llama a archiveRecurso
    await user.click(botonRetirar);
    expect(bibliotecaService.archiveRecurso).toHaveBeenCalledWith('tenant-real', 'rec-aprobado-uno');
  });
});
