// functions/academico/invitaciones.test.js

'use strict';

const {
  crearServicioInviteUser,
  crearServicioAcceptInvitation,
  hashearTokenInvitacion,
} = require('./invitaciones');

const makeAuth = (overrides = {}) => ({
  getUserByEmail: jest.fn().mockRejectedValue({ code: 'auth/user-not-found' }),
  createUser: jest.fn().mockResolvedValue({ uid: 'uid-nuevo' }),
  setCustomUserClaims: jest.fn().mockResolvedValue(),
  ...overrides,
});

const makeDocRef = (data, exists = true) => ({
  id: 'inv-123',
  set: jest.fn().mockResolvedValue(),
  get: jest.fn().mockResolvedValue({ exists, data: () => data }),
  update: jest.fn().mockResolvedValue(),
});

const makeFirestore = (invitacionData, exists = true) => {
  const invitacionRef = makeDocRef(invitacionData, exists);
  const usuarioSet = jest.fn().mockResolvedValue();

  return {
    collection: jest.fn((name) => {
      if (name === 'usuarios') {
        return {
          doc: jest.fn(() => ({ set: usuarioSet })),
        };
      }

      return {
        doc: jest.fn(() => ({
          collection: jest.fn(() => ({
            doc: jest.fn(() => invitacionRef),
          })),
        })),
      };
    }),
    _docRef: invitacionRef,
    _usuarioSet: usuarioSet,
  };
};

const makeEnviarCorreo = () => jest.fn().mockResolvedValue('email-id-123');

const makeContext = (overrides = {}) => ({
  auth: {
    uid: 'admin-uid',
    token: {
      rol: 'Admin',
      tenantId: 'tenant-abc',
    },
    ...overrides,
  },
});

describe('crearServicioInviteUser', () => {
  const buildService = (authOverrides = {}) => {
    const auth = makeAuth(authOverrides);
    const firestore = makeFirestore();
    const enviarCorreo = makeEnviarCorreo();
    const service = crearServicioInviteUser({
      auth,
      firestore,
      enviarCorreo,
      resend: {},
      appUrl: 'https://app.tudojang.com',
    });
    return { service, auth, firestore, enviarCorreo };
  };

  it('lanza error si no hay autenticacion', async () => {
    const { service } = buildService();
    await expect(
      service({ email: 'a@b.com', rol: 'Estudiante', tenantId: 'tenant-abc' }, { auth: null })
    ).rejects.toThrow('No autenticado');
  });

  it('lanza error si el invocador no es Admin', async () => {
    const { service } = buildService();
    const ctx = makeContext({ token: { rol: 'Editor', tenantId: 'tenant-abc' } });
    await expect(
      service({ email: 'a@b.com', rol: 'Estudiante', tenantId: 'tenant-abc' }, ctx)
    ).rejects.toThrow('Solo el Admin del tenant');
  });

  it('lanza error si el tenantId no coincide con el usuario', async () => {
    const { service } = buildService();
    await expect(
      service({ email: 'a@b.com', rol: 'Estudiante', tenantId: 'otro-tenant' }, makeContext())
    ).rejects.toThrow('No autorizado');
  });

  it('lanza error si el rol es invalido', async () => {
    const { service } = buildService();
    await expect(
      service({ email: 'a@b.com', rol: 'SuperAdmin', tenantId: 'tenant-abc' }, makeContext())
    ).rejects.toThrow('Rol invalido');
  });

  it('lanza error si el email ya existe en Firebase Auth', async () => {
    const { service } = buildService({
      getUserByEmail: jest.fn().mockResolvedValue({ uid: 'ya-existe' }),
    });
    await expect(
      service({ email: 'existente@b.com', rol: 'Estudiante', tenantId: 'tenant-abc' }, makeContext())
    ).rejects.toThrow('Ya existe un usuario');
  });

  it('crea invitacion con token hasheado y envia correo formal para Estudiante', async () => {
    const { service, firestore, enviarCorreo } = buildService();

    const result = await service(
      { email: 'nuevo@b.com', rol: 'Estudiante', tenantId: 'tenant-abc' },
      makeContext()
    );

    expect(result.ok).toBe(true);
    expect(result.invitacionId).toBe('inv-123');
    expect(firestore._docRef.set).toHaveBeenCalledWith(expect.objectContaining({
      email: 'nuevo@b.com',
      rol: 'Estudiante',
      tokenHash: expect.any(String),
      activationLink: expect.stringContaining('https://app.tudojang.com/#/activar-cuenta?'),
    }));
    expect(firestore._docRef.set.mock.calls[0][0].activationLink).toContain('invitacionId=inv-123');
    expect(firestore._docRef.set.mock.calls[0][0]).not.toHaveProperty('token');
    expect(enviarCorreo).toHaveBeenCalledTimes(1);
    expect(enviarCorreo.mock.calls[0][1].subject).toContain('estudiante');
    expect(enviarCorreo.mock.calls[0][1].html).toContain('Crear mi acceso');
  });

  it('crea invitacion con asunto de portal de seguimiento para Tutor', async () => {
    const { service, enviarCorreo } = buildService();

    await service(
      { email: 'padre@familia.com', rol: 'Tutor', tenantId: 'tenant-abc' },
      makeContext()
    );

    expect(enviarCorreo.mock.calls[0][1].subject).toContain('portal de seguimiento');
  });
});

describe('crearServicioAcceptInvitation', () => {
  const futureDate = new Date(Date.now() + 86400000 * 3).toISOString();

  const defaultInvitacion = {
    email: 'nuevo@b.com',
    rol: 'Estudiante',
    tenantId: 'tenant-abc',
    estado: 'pendiente',
    expiraEn: futureDate,
    tokenHash: hashearTokenInvitacion('token-valido'),
  };

  const buildService = (invitacionData = defaultInvitacion, exists = true, authOverrides = {}) => {
    const auth = makeAuth(authOverrides);
    const firestore = makeFirestore(invitacionData, exists);
    const service = crearServicioAcceptInvitation({ auth, firestore });
    return { service, auth, firestore };
  };

  it('lanza error si faltan parametros', async () => {
    const { service } = buildService();
    await expect(
      service({ invitacionId: 'inv-123', tenantId: 'tenant-abc', password: 'clave1234' })
    ).rejects.toThrow('token');
  });

  it('lanza error si la invitacion no existe', async () => {
    const { service } = buildService(null, false);
    await expect(
      service({ invitacionId: 'inv-123', tenantId: 'tenant-abc', token: 'token-valido', password: 'clave1234' })
    ).rejects.toThrow('Invitacion no encontrada');
  });

  it('lanza error si la invitacion ya fue aceptada', async () => {
    const { service } = buildService({ ...defaultInvitacion, estado: 'aceptada' });
    await expect(
      service({ invitacionId: 'inv-123', tenantId: 'tenant-abc', token: 'token-valido', password: 'clave1234' })
    ).rejects.toThrow('ya fue aceptada');
  });

  it('lanza error si el token no coincide', async () => {
    const { service } = buildService();
    await expect(
      service({ invitacionId: 'inv-123', tenantId: 'tenant-abc', token: 'token-malo', password: 'clave1234' })
    ).rejects.toThrow('enlace de activacion');
  });

  it('lanza error y marca como vencida si la invitacion expiro', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const { service, firestore } = buildService({ ...defaultInvitacion, expiraEn: pastDate });
    await expect(
      service({ invitacionId: 'inv-123', tenantId: 'tenant-abc', token: 'token-valido', password: 'clave1234' })
    ).rejects.toThrow('vencio');
    expect(firestore._docRef.update).toHaveBeenCalledWith({ estado: 'vencida' });
  });

  it('lanza error si la contrasena tiene menos de 8 caracteres', async () => {
    const { service } = buildService();
    await expect(
      service({ invitacionId: 'inv-123', tenantId: 'tenant-abc', token: 'token-valido', password: 'corta' })
    ).rejects.toThrow('8 caracteres');
  });

  it('acepta invitacion, crea usuario, asigna claims y consume token', async () => {
    const { service, auth, firestore } = buildService();

    const result = await service({
      invitacionId: 'inv-123',
      tenantId: 'tenant-abc',
      token: 'token-valido',
      password: 'clave1234segura',
    });

    expect(result.ok).toBe(true);
    expect(result.uid).toBe('uid-nuevo');
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith('uid-nuevo', {
      rol: 'Estudiante',
      tenantId: 'tenant-abc',
    });
    expect(firestore._usuarioSet).toHaveBeenCalledWith(expect.objectContaining({
      email: 'nuevo@b.com',
      rol: 'Estudiante',
      tenantId: 'tenant-abc',
    }));
    expect(firestore._docRef.update).toHaveBeenCalledWith(expect.objectContaining({
      estado: 'aceptada',
      uid: 'uid-nuevo',
      tokenHash: null,
    }));
  });
});
