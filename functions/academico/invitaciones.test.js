// functions/academico/invitaciones.test.js
// Tests para los servicios de invitaciones académicas.
// Usan el patrón de inyección de dependencias sin firebase-functions-test.

'use strict';

const {
  crearServicioInviteUser,
  crearServicioAcceptInvitation,
} = require('./invitaciones');

// ---------------------------------------------------------------------------
// Helpers de mocks
// ---------------------------------------------------------------------------

const makeAuth = (overrides = {}) => ({
  getUserByEmail: jest.fn().mockRejectedValue({ code: 'auth/user-not-found' }),
  generateSignInWithEmailLink: jest.fn().mockResolvedValue('https://link.example.com/invite'),
  createUser: jest.fn().mockResolvedValue({ uid: 'uid-nuevo' }),
  setCustomUserClaims: jest.fn().mockResolvedValue(),
  ...overrides,
});

const makeDocRef = (data, exists = true) => {
  const ref = {
    id: 'inv-123',
    set: jest.fn().mockResolvedValue(),
    get: jest.fn().mockResolvedValue({ exists, data: () => data }),
    update: jest.fn().mockResolvedValue(),
  };
  return ref;
};

const makeFirestore = (invitacionData, exists = true) => {
  const docRef = makeDocRef(invitacionData, exists);
  return {
    collection: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue({
          doc: jest.fn().mockReturnValue(docRef),
        }),
        set: jest.fn().mockResolvedValue(),
      }),
    }),
    _docRef: docRef,
  };
};

const makeResend = () => ({});
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

// ---------------------------------------------------------------------------
// crearServicioInviteUser
// ---------------------------------------------------------------------------

describe('crearServicioInviteUser', () => {
  const buildService = (authOverrides = {}) => {
    const auth = makeAuth(authOverrides);
    const firestore = makeFirestore();
    const enviarCorreo = makeEnviarCorreo();
    const resend = makeResend();
    const service = crearServicioInviteUser({
      auth,
      firestore,
      enviarCorreo,
      resend,
      appUrl: 'https://app.tudojang.com',
    });
    return { service, auth, firestore, enviarCorreo };
  };

  it('lanza error si no hay autenticación', async () => {
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

  it('lanza error si el tenantId no coincide con el del usuario', async () => {
    const { service } = buildService();
    const ctx = makeContext();
    await expect(
      service({ email: 'a@b.com', rol: 'Estudiante', tenantId: 'otro-tenant' }, ctx)
    ).rejects.toThrow('No autorizado para este tenant');
  });

  it('lanza error si el rol es inválido', async () => {
    const { service } = buildService();
    const ctx = makeContext();
    await expect(
      service({ email: 'a@b.com', rol: 'SuperAdmin', tenantId: 'tenant-abc' }, ctx)
    ).rejects.toThrow('Rol inválido');
  });

  it('lanza error si el email ya existe en Firebase Auth', async () => {
    const { service } = buildService({
      getUserByEmail: jest.fn().mockResolvedValue({ uid: 'ya-existe' }),
    });
    const ctx = makeContext();
    await expect(
      service({ email: 'existente@b.com', rol: 'Estudiante', tenantId: 'tenant-abc' }, ctx)
    ).rejects.toThrow('Ya existe un usuario');
  });

  it('crea la invitación y envía el email correctamente para Estudiante', async () => {
    const { service, enviarCorreo } = buildService();
    const ctx = makeContext();
    const result = await service(
      { email: 'nuevo@b.com', rol: 'Estudiante', tenantId: 'tenant-abc' },
      ctx
    );
    expect(result.ok).toBe(true);
    expect(result.invitacionId).toBeDefined();
    expect(enviarCorreo).toHaveBeenCalledTimes(1);
  });

  it('crea la invitación y envía el email correctamente para Tutor', async () => {
    const { service, enviarCorreo } = buildService();
    const ctx = makeContext();
    const result = await service(
      { email: 'padre@familia.com', rol: 'Tutor', tenantId: 'tenant-abc' },
      ctx
    );
    expect(result.ok).toBe(true);
    expect(enviarCorreo).toHaveBeenCalledTimes(1);
    // Verifica que el asunto mencione el portal de seguimiento para Tutor
    const emailArgs = enviarCorreo.mock.calls[0][1];
    expect(emailArgs.subject).toContain('portal de seguimiento');
  });
});

// ---------------------------------------------------------------------------
// crearServicioAcceptInvitation
// ---------------------------------------------------------------------------

describe('crearServicioAcceptInvitation', () => {
  const futureDate = new Date(Date.now() + 86400000 * 3).toISOString(); // +3 días

  const defaultInvitacion = {
    email: 'nuevo@b.com',
    rol: 'Estudiante',
    tenantId: 'tenant-abc',
    estado: 'pendiente',
    expiraEn: futureDate,
  };

  const buildService = (invitacionData = defaultInvitacion, exists = true, authOverrides = {}) => {
    const auth = makeAuth(authOverrides);
    const fs = makeFirestore(invitacionData, exists);
    const service = crearServicioAcceptInvitation({ auth, firestore: fs });
    return { service, auth, firestore: fs };
  };

  it('lanza error si la invitación no existe', async () => {
    const { service } = buildService(null, false);
    await expect(
      service({ invitacionId: 'inv-123', tenantId: 'tenant-abc', password: 'clave1234' }, {})
    ).rejects.toThrow('Invitación no encontrada');
  });

  it('lanza error si la invitación ya fue aceptada', async () => {
    const { service } = buildService({ ...defaultInvitacion, estado: 'aceptada' });
    await expect(
      service({ invitacionId: 'inv-123', tenantId: 'tenant-abc', password: 'clave1234' }, {})
    ).rejects.toThrow('ya fue aceptada');
  });

  it('lanza error y marca como vencida si la invitación expiró', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const { service, firestore } = buildService({ ...defaultInvitacion, expiraEn: pastDate });
    await expect(
      service({ invitacionId: 'inv-123', tenantId: 'tenant-abc', password: 'clave1234' }, {})
    ).rejects.toThrow('venció');
    expect(firestore._docRef.update).toHaveBeenCalledWith({ estado: 'vencida' });
  });

  it('lanza error si la contraseña tiene menos de 8 caracteres', async () => {
    const { service } = buildService();
    await expect(
      service({ invitacionId: 'inv-123', tenantId: 'tenant-abc', password: 'corta' }, {})
    ).rejects.toThrow('8 caracteres');
  });

  it('acepta la invitación, crea el usuario y asigna custom claims', async () => {
    const { service, auth } = buildService();
    const result = await service(
      { invitacionId: 'inv-123', tenantId: 'tenant-abc', password: 'clave1234segura' },
      {}
    );
    expect(result.ok).toBe(true);
    expect(result.uid).toBe('uid-nuevo');
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith('uid-nuevo', {
      rol: 'Estudiante',
      tenantId: 'tenant-abc',
    });
  });
});
