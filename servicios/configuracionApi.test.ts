import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db } from '../firebase/config';
import {
  obtenerConfiguracionNotificaciones,
  guardarConfiguracionNotificaciones,
  buscarTenantPorSlug,
  registrarNuevaEscuela,
  obtenerConfiguracionClub,
  guardarConfiguracionClub,
  actualizarCapacidadClub,
  obtenerTodosLosTenants,
  cambiarEstadoSuscripcionTenant,
  alternarDemoComercialTenant,
} from './configuracionApi';
import { CONFIGURACION_POR_DEFECTO, CONFIGURACION_CLUB_POR_DEFECTO } from '../constantes';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, name) => ({ args: [db, name] })), addDoc: jest.fn(),
  query: jest.fn((...args) => ({ args })), where: jest.fn(),
  getDocs: jest.fn(() => ({ empty: true, docs: [] })), getDoc: jest.fn(), updateDoc: jest.fn(),
  deleteDoc: jest.fn(), setDoc: jest.fn(),
  doc: jest.fn((db, name, id) => ({ args: [db, name, id] })), Timestamp: {},
}));

// SDD pricing-cupo-real (D7, design.md): actualizarCapacidadClub ya no escribe Firestore
// directo -- ahora es un wrapper delgado sobre httpsCallable('actualizarExtrasContratados').
// Mismo patron de mock que sedesApi.test.ts (agregarSede/actualizarSede/eliminarSede).
const mockCallable = jest.fn();
jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(() => 'functions-mock'),
  httpsCallable: jest.fn(() => mockCallable),
}));

jest.mock('../firebase/config', () => ({ db: {}, isFirebaseConfigured: true }));

describe('configuracionApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (require('../firebase/config') as jest.Mocked<typeof import('../firebase/config')>).isFirebaseConfigured = true;
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });
  });

  describe('obtenerConfiguracionNotificaciones', () => {
    // Bug real (2026-08-31, tenant Cocodrilos): este test afirmaba `toEqual(CONFIGURACION_POR_DEFECTO)`
    // tal cual -- o sea, fijaba el bug como si fuera el contrato. CONFIGURACION_POR_DEFECTO tiene
    // `tenantId: 'escuela-gajog-001'` HARDCODEADO (constantes.ts), así que cualquier tenant SIN
    // documento en `notificaciones_config` recibía la config de OTRO tenant. Ese tenantId ajeno
    // viajaba hasta guardarConfiguracionNotificaciones, que escribe en
    // `notificaciones_config/{config.tenantId}` -- y firestore.rules exige `currentTenantId() ==`
    // el tenantId del path, así que TODO intento de guardar configuración fallaba con
    // "Missing or insufficient permissions" (ver functions/test/firestore-rules.notificaciones-config.test.js).
    it('debería retornar la configuración por defecto CON el tenantId solicitado si el documento no existe', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => false,
      });

      const config = await obtenerConfiguracionNotificaciones('tenant123');
      expect(getDoc).toHaveBeenCalledWith(doc(db, 'notificaciones_config', 'tenant123'));
      expect(config).toEqual({ ...CONFIGURACION_POR_DEFECTO, tenantId: 'tenant123' });
    });

    it('NUNCA devuelve el tenantId hardcodeado del default cuando se pide otro tenant', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => false,
      });

      const config = await obtenerConfiguracionNotificaciones('tnt-1770762462159');
      expect(config.tenantId).toBe('tnt-1770762462159');
      expect(config.tenantId).not.toBe(CONFIGURACION_POR_DEFECTO.tenantId);
    });

    it('debería retornar la configuración existente si el documento existe', async () => {
      const mockConfig = {
        tenantId: 'tenant123',
        whatsapp: {
          solicitudInscripcion: {
            habilitado: true,
            mensaje: 'Mensaje de prueba',
          },
        },
      };
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => mockConfig,
      });

      const config = await obtenerConfiguracionNotificaciones('tenant123');
      expect(getDoc).toHaveBeenCalledWith(doc(db, 'notificaciones_config', 'tenant123'));
      expect(config).toEqual(mockConfig);
    });

    it('debería usar localStorage si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as jest.Mocked<typeof import('../firebase/config')>).isFirebaseConfigured = false;
      (localStorage.getItem as jest.Mock).mockReturnValueOnce(JSON.stringify({ tenantId: 'local', whatsapp: { solicitudInscripcion: { habilitado: true } } }));

      const config = await obtenerConfiguracionNotificaciones('tenant123');
      expect(localStorage.getItem).toHaveBeenCalledWith('tkd_mock_conf_notif');
      expect(config).toEqual({ tenantId: 'local', whatsapp: { solicitudInscripcion: { habilitado: true } } });
    });

    it('debería usar CONFIGURACION_POR_DEFECTO si localStorage está vacío y isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as jest.Mocked<typeof import('../firebase/config')>).isFirebaseConfigured = false;
      (localStorage.getItem as jest.Mock).mockReturnValueOnce(null);

      const config = await obtenerConfiguracionNotificaciones('tenant123');
      expect(localStorage.getItem).toHaveBeenCalledWith('tkd_mock_conf_notif');
      expect(config).toEqual(CONFIGURACION_POR_DEFECTO);
    });
  });

  describe('guardarConfiguracionNotificaciones', () => {
    it('debería guardar la configuración en Firestore', async () => {
      // Fix 2026-07-21 (`npm run typecheck`): el fixture inventaba `whatsapp.solicitudInscripcion`,
      // estructura que NO EXISTE en ConfiguracionNotificaciones (el `whatsapp` de tipos.ts:395
      // pertenece a `Usuario`), y omitia los 5 campos numericos obligatorios. Este test verifica
      // el paso a Firestore tal cual, asi que se usa una configuracion valida del tipo real.
      const mockConfig = {
        tenantId: 'tenant123',
        diaCobroMensual: 5,
        diasAnticipoRecordatorio: 3,
        diasGraciaSuspension: 10,
        frecuenciaSyncHoras: 12,
        frecuenciaQueryApiDias: 1,
      };
      await guardarConfiguracionNotificaciones(mockConfig);
      expect(setDoc).toHaveBeenCalledWith(doc(db, 'notificaciones_config', 'tenant123'), mockConfig, { merge: true });
    });

    it('debería lanzar un error si no hay tenantId', async () => {
      const mockConfig = { whatsapp: { solicitudInscripcion: { habilitado: false } } };
      await expect(guardarConfiguracionNotificaciones(mockConfig as any)).rejects.toThrow('Falta tenantId en configuración de notificaciones');
    });

    it('debería guardar en localStorage si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as jest.Mocked<typeof import('../firebase/config')>).isFirebaseConfigured = false;
      // Fix 2026-07-21 (`npm run typecheck`): mismo caso que el test de arriba -- el fixture
      // usaba una forma inexistente en ConfiguracionNotificaciones. Este test verifica el
      // fallback a localStorage, que serializa la config tal cual reciba.
      const mockConfig = {
        tenantId: 'local',
        diaCobroMensual: 5,
        diasAnticipoRecordatorio: 3,
        diasGraciaSuspension: 10,
        frecuenciaSyncHoras: 12,
        frecuenciaQueryApiDias: 1,
      };
      await guardarConfiguracionNotificaciones(mockConfig);
      expect(localStorage.setItem).toHaveBeenCalledWith('tkd_mock_conf_notif', JSON.stringify(mockConfig));
    });
  });

  describe('buscarTenantPorSlug', () => {
    // Bug real (sesion 2026-08-06): esto consultaba `tenants` DIRECTO desde el cliente, pero
    // firestore.rules exige authenticated() -- un visitante SIN LOGIN (el caso real de esta
    // funcion: censo/evento publico) nunca podia resolver el tenant. Ahora es un wrapper
    // delgado sobre httpsCallable('resolverTenantPublico'), mismo patron que
    // actualizarCapacidadClub arriba.
    it('debería retornar null si no se encuentra el slug', async () => {
      mockCallable.mockResolvedValueOnce({ data: null });

      const tenant = await buscarTenantPorSlug('nonexistent');
      expect(httpsCallable).toHaveBeenCalledWith('functions-mock', 'resolverTenantPublico');
      expect(mockCallable).toHaveBeenCalledWith({ slug: 'nonexistent' });
      expect(tenant).toBeNull();
    });

    it('debería retornar el tenant si se encuentra el slug', async () => {
      const mockTenant = { tenantId: 'tenant123', slug: 'tudojang', nombreClub: 'Tudojang SaaS' };
      mockCallable.mockResolvedValueOnce({ data: mockTenant });

      const tenant = await buscarTenantPorSlug('tudojang');
      expect(tenant).toEqual(mockTenant);
    });

    it('debería usar el modo mock si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as jest.Mocked<typeof import('../firebase/config')>).isFirebaseConfigured = false;
      const tenant = await buscarTenantPorSlug('tudojang');
      expect(localStorage.getItem).not.toHaveBeenCalled();
      expect(tenant).toEqual(expect.objectContaining({ slug: 'tudojang', tenantId: 'id-tudojang' }));
    });

    it('debería retornar null en modo mock si el slug no es tudojang ni dragones', async () => {
      (require('../firebase/config') as jest.Mocked<typeof import('../firebase/config')>).isFirebaseConfigured = false;
      const tenant = await buscarTenantPorSlug('otro');
      expect(tenant).toBeNull();
    });
  });

  describe('registrarNuevaEscuela', () => {
    // SDD pricing-cupo-real (Bloque 4): ya no hay planes que seleccionar al registrar una
    // escuela nueva -- el trial de 7 días (`estadoSuscripcion:'demo'`) se activa igual, sin
    // derivar límites de `datos.plan`/PLANES_SAAS (que ya no se importa en este archivo).
    // Nota de secuenciación: `plan`/`limite*` como CAMPOS todavía viajan en el payload en
    // esta etapa -- vienen del spread de CONFIGURACION_CLUB_POR_DEFECTO, que sigue siendo
    // obligatorio satisfacer el tipo `ConfiguracionClub` completo hasta el corte final
    // (tasks.md 4.13, que borra esos campos de tipos.ts). Migration/Rollout de design.md:
    // "Legacy tenant fields... left in the documents, unread by new code" -- esa es
    // exactamente esta ventana.
    it('debería registrar una nueva escuela sin derivar límites de un plan', async () => {
      const datos = {
        nombreClub: 'Nueva Academia',
        slug: 'nueva-academia',
      };
      (setDoc as jest.Mock).mockResolvedValueOnce(undefined);

      const tenantId = await registrarNuevaEscuela(datos);

      expect(setDoc).toHaveBeenCalledWith(
        doc(db, 'tenants', expect.any(String)),
        expect.objectContaining({
          nombreClub: 'Nueva Academia',
          slug: 'nueva-academia',
          estadoSuscripcion: 'demo',
        })
      );
      expect(tenantId).toEqual(expect.any(String));
    });

    // SDD pricing-cupo-real (Bloque 4b, corte final tasks.md 4.13): plan/limiteEstudiantes/
    // limiteUsuarios/limiteSedes ya NO existen en ConfiguracionClub -- este caso reemplaza
    // al anterior (que solo probaba que no se derivaban de datos.plan mientras el campo
    // seguía vivo como legado); ahora prueba que ni siquiera viajan en el payload.
    it('el payload nunca incluye plan/limiteEstudiantes/limiteUsuarios/limiteSedes -- retirados de ConfiguracionClub', async () => {
      (setDoc as jest.Mock).mockResolvedValueOnce(undefined);

      await registrarNuevaEscuela({ nombreClub: 'A', slug: 'a' });
      const [, payload] = (setDoc as jest.Mock).mock.calls[0];

      expect(payload).not.toHaveProperty('plan');
      expect(payload).not.toHaveProperty('limiteEstudiantes');
      expect(payload).not.toHaveProperty('limiteUsuarios');
      expect(payload).not.toHaveProperty('limiteSedes');
    });

    it('debería generar un tenantId si no se proporciona uno', async () => {
      await registrarNuevaEscuela({ nombreClub: 'Test', slug: 'test' });
      const calls = (setDoc as jest.Mock).mock.calls[0];
      const tenantId = calls[0].args[2]; // doc(db, 'tenants', tenantId)
      expect(tenantId).toMatch(/^tnt-\d+$/);
    });

    it('debería retornar string vacío si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as jest.Mocked<typeof import('../firebase/config')>).isFirebaseConfigured = false;
      const tenantId = await registrarNuevaEscuela({ nombreClub: 'Local Academy', slug: 'local' });
      expect(tenantId).toBe('');
    });
  });

describe('obtenerConfiguracionClub', () => {
    it('debería retornar CONFIGURACION_CLUB_POR_DEFECTO si no se encuentra el tenantId', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => false,
      });
      Object.defineProperty(window, 'location', {
        value: { ...window.location, hostname: 'localhost' },
        writable: true,
        configurable: true,
      });
      mockCallable.mockResolvedValueOnce({ data: null }); // buscarTenantPorSlug

      const config = await obtenerConfiguracionClub('nonexistent');
      expect(config).toEqual(CONFIGURACION_CLUB_POR_DEFECTO);
    });

    it('debería retornar la configuración del club por tenantId', async () => {
      const mockClubConfig = { tenantId: 'tenant123', nombreClub: 'Mi Club' };
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true, id: 'tenant123', data: () => mockClubConfig,
      });

      const config = await obtenerConfiguracionClub('tenant123');
      expect(config).toEqual({ id: 'tenant123', ...mockClubConfig });
    });

    it('debería buscar por slug si no se proporciona tenantId', async () => {
      const mockClubConfig = { tenantId: 'slugTenant', nombreClub: 'Club por Slug' };
      Object.defineProperty(window, 'location', {
        value: { ...window.location, hostname: 'test-club.com' },
        writable: true,
        configurable: true,
      });
      mockCallable.mockResolvedValueOnce({ data: mockClubConfig }); // buscarTenantPorSlug

      const config = await obtenerConfiguracionClub();
      expect(config).toEqual(mockClubConfig);
    });

    it('debería usar el modo mock si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as jest.Mocked<typeof import('../firebase/config')>).isFirebaseConfigured = false;
      const config = await obtenerConfiguracionClub();
      expect(config).toEqual(CONFIGURACION_CLUB_POR_DEFECTO);
    });
  });

  describe('guardarConfiguracionClub', () => {
    it('debería guardar la configuración del club en Firestore', async () => {
      const mockConfig = { tenantId: 'tenant123', nombreClub: 'Club Actualizado' };
      await guardarConfiguracionClub(mockConfig as any);
      expect(setDoc).toHaveBeenCalledWith(doc(db, 'tenants', 'tenant123'), mockConfig, { merge: true });
    });

    it('debería lanzar un error si no hay tenantId', async () => {
      const mockConfig = { nombreClub: 'Club Actualizado' };
      await expect(guardarConfiguracionClub(mockConfig as any)).rejects.toThrow('Falta tenantId en configuración de club');
    });

    it('no debería hacer nada si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as jest.Mocked<typeof import('../firebase/config')>).isFirebaseConfigured = false;
      const mockConfig = { tenantId: 'local', nombreClub: 'Club Local' };
      await guardarConfiguracionClub(mockConfig as any);
      expect(setDoc).not.toHaveBeenCalled();
    });
  });

  describe('actualizarCapacidadClub', () => {
    it('invoca la Cloud Function actualizarExtrasContratados con tenantId/campo/cantidad, en vez de updateDoc directo', async () => {
      mockCallable.mockResolvedValueOnce({ data: { tenantId: 'tenant123', campo: 'sedesExtraContratadas', valor: 5 } });

      await actualizarCapacidadClub('tenant123', 'sedesExtraContratadas', 5);

      expect(httpsCallable).toHaveBeenCalledWith('functions-mock', 'actualizarExtrasContratados');
      expect(mockCallable).toHaveBeenCalledWith({ tenantId: 'tenant123', campo: 'sedesExtraContratadas', cantidad: 5 });
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('propaga el error si la Cloud Function rechaza (ej. resultado negativo)', async () => {
      mockCallable.mockRejectedValueOnce(new Error('La operación dejaría "equipoTecnicoExtraContratado" en un valor negativo (-1)'));

      await expect(
        actualizarCapacidadClub('tenant123', 'equipoTecnicoExtraContratado', -1)
      ).rejects.toThrow(/valor negativo/i);
    });

    it('no debería hacer nada si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as jest.Mocked<typeof import('../firebase/config')>).isFirebaseConfigured = false;
      await actualizarCapacidadClub('tenant123', 'sedesExtraContratadas', 5);
      expect(mockCallable).not.toHaveBeenCalled();
    });
  });

  describe('obtenerTodosLosTenants', () => {
    it('debería retornar todos los tenants de Firestore', async () => {
      const mockTenants = [
        { id: 't1', nombreClub: 'Club 1' },
        { id: 't2', nombreClub: 'Club 2' },
      ];
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: mockTenants.map(t => ({ id: t.id, data: () => t })),
      });

      const tenants = await obtenerTodosLosTenants();
      expect(tenants).toEqual([{ id: 't1', nombreClub: 'Club 1' }, { id: 't2', nombreClub: 'Club 2' }]);
    });

    it('debería retornar datos mock si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as jest.Mocked<typeof import('../firebase/config')>).isFirebaseConfigured = false;
      const tenants = await obtenerTodosLosTenants();
      expect(tenants.length).toBe(3);
      expect(tenants[0]).toEqual(CONFIGURACION_CLUB_POR_DEFECTO);
      expect(tenants[1]).toEqual(expect.objectContaining({ tenantId: 't2', nombreClub: 'Dragones TKD' }));
    });
  });

  describe('cambiarEstadoSuscripcionTenant', () => {
    it('debería actualizar el estado de suscripción del tenant en Firestore', async () => {
      await cambiarEstadoSuscripcionTenant('tenant123', 'suspendido');
      expect(updateDoc).toHaveBeenCalledWith(
        doc(db, 'tenants', 'tenant123'),
        { estadoSuscripcion: 'suspendido' }
      );
    });

    it('no debería hacer nada si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as jest.Mocked<typeof import('../firebase/config')>).isFirebaseConfigured = false;
      await cambiarEstadoSuscripcionTenant('tenant123', 'suspendido');
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });

  describe('alternarDemoComercialTenant', () => {
    it('debería activar el modo demo comercial del tenant en Firestore', async () => {
      await alternarDemoComercialTenant('tenant123', true);
      expect(updateDoc).toHaveBeenCalledWith(
        doc(db, 'tenants', 'tenant123'),
        { esDemoComercial: true }
      );
    });

    it('debería desactivar el modo demo comercial del tenant en Firestore (triangulación)', async () => {
      await alternarDemoComercialTenant('tenant456', false);
      expect(updateDoc).toHaveBeenCalledWith(
        doc(db, 'tenants', 'tenant456'),
        { esDemoComercial: false }
      );
    });

    it('no debería hacer nada si isFirebaseConfigured es falso', async () => {
      (require('../firebase/config') as jest.Mocked<typeof import('../firebase/config')>).isFirebaseConfigured = false;
      await alternarDemoComercialTenant('tenant123', true);
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });
});
