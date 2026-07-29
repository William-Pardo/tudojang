// functions/academico/repararSedes.js
// Callable `repararSedesEjecucionPrograma`: repara EjecucionPrograma.sedeId legados que
// quedaron guardados como un SLUG del nombre de la sede en vez del id real del documento
// `sedes/{id}` -- causa raiz confirmada del bug real "William Roa no puede hacer check-in
// en Clase en Vivo" (Precadetes/Cocodrilos, sesion 2026-07-28).
//
// Contexto: antes del 2026-07-16, EjecucionPrograma.sedeId se escribia SIEMPRE como
// `slugificar(nombreDeSede)` (ver DT-0023 en bitacora.json: "riesgo aceptado"). Ese fix
// (AsignacionesView.tsx::resolverSedeIdPorNombre) empezo a resolver el id REAL buscando la
// sede por nombre en el catalogo activo, pero SOLO afecta escrituras nuevas -- cualquier
// EjecucionPrograma creada/guardada antes de esa fecha, y nunca re-guardada desde
// entonces, sigue con el sedeId roto en Firestore. Como Estudiante.sedeId SIEMPRE es el id
// real (FormularioEstudiante.tsx), la comparacion en
// functions/academico/asistencia.js::perteneceAEjecucion nunca puede coincidir para esas
// ejecuciones -- ningun estudiante de esa sede puede hacer check-in, sin ningun error
// visible que apunte a la causa real.
//
// Esta funcion escanea las EjecucionPrograma de un tenant y, para cada una cuyo sedeId NO
// corresponde a ninguna sede real activa, intenta reconocer el patron "es justo el slug
// del nombre de una sede real conocida" y lo corrige al id verdadero. Si no puede
// reconocer ningun candidato (la sede fue borrada por completo, sin rastro de su nombre
// en el catalogo actual), lo deja sin tocar y lo reporta en `sinResolver` para revision
// manual -- nunca escribe una adivinanza.

'use strict';

const crearError = (code, message) => Object.assign(new Error(message), { code });

function requireAuth(context) {
  if (!context?.auth?.uid) {
    throw crearError('unauthenticated', 'Usuario no autenticado');
  }
  return context.auth;
}

function assertEsAdmin(auth) {
  const rol = auth.token?.rol;
  if (rol !== 'Admin' && rol !== 'SuperAdmin') {
    throw crearError('permission-denied', 'Solo un administrador puede reparar datos de sedes');
  }
}

// SuperAdmin opera cross-tenant por diseno (mismo criterio que academico/sedes.js y
// academico/usuarios.js); Admin queda acotado a su propio tenant.
function assertTenantAutorizado(tenantId, auth) {
  if (auth.token?.rol === 'SuperAdmin') return;
  if (!tenantId || tenantId !== auth.token?.tenantId) {
    throw crearError('permission-denied', 'Tenant no autorizado');
  }
}

// Misma slugificacion que AsignacionesView.tsx::slugificar (frontend) -- necesaria aca
// para RECONOCER el patron de dato roto (un slug guardado como si fuera un id real) y
// poder revertirlo a la sede real correspondiente.
const slugificar = (valor) => String(valor || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');

// Misma sede sintetica "Sede Principal" que arma getSedesVisibles() (utils/dataIntegrity.ts)
// del lado del cliente: id fijo 'principal', nombre = nombreClub del tenant. Un
// EjecucionPrograma pudo haberse creado apuntando a esta sede sintetica igual que a
// cualquier sede real de la coleccion `sedes`.
async function construirCatalogoSedes(firestore, tenantId) {
  const tenantSnap = await firestore.collection('tenants').doc(tenantId).get();
  const tenantData = tenantSnap.exists ? tenantSnap.data() : {};

  const sedesSnap = await firestore.collection('sedes').where('tenantId', '==', tenantId).get();
  const sedesReales = sedesSnap.docs
    .filter((doc) => !doc.data().deletedAt)
    .map((doc) => ({ id: doc.id, nombre: doc.data().nombre }));

  const sedePrincipal = { id: 'principal', nombre: tenantData.nombreClub || 'Sede Principal' };

  return [sedePrincipal, ...sedesReales];
}

function crearServicioRepararSedesEjecucionPrograma({ firestore }) {
  return async function repararSedesEjecucionPrograma(data, context) {
    const auth = requireAuth(context);
    assertEsAdmin(auth);

    const tenantId = String(data?.tenantId || '').trim();
    if (!tenantId) {
      throw crearError('invalid-argument', 'El tenant es obligatorio');
    }
    assertTenantAutorizado(tenantId, auth);

    const catalogoSedes = await construirCatalogoSedes(firestore, tenantId);
    const idsReales = new Set(catalogoSedes.map((sede) => sede.id));
    const porSlug = new Map(catalogoSedes.map((sede) => [slugificar(sede.nombre), sede]));

    const ejecucionesSnap = await firestore
      .collection('tenants')
      .doc(tenantId)
      .collection('ejecucionesPrograma')
      .get();

    const reparadas = [];
    const sinResolver = [];

    for (const doc of ejecucionesSnap.docs) {
      const ejecucion = doc.data();
      const sedeIdActual = ejecucion.sedeId;

      // Ya es un id real (o coincide con una sede activa) -- no requiere reparacion.
      if (idsReales.has(sedeIdActual)) continue;

      const sedeCorrecta = porSlug.get(sedeIdActual);
      if (sedeCorrecta) {
        await doc.ref.set({ sedeId: sedeCorrecta.id }, { merge: true });
        reparadas.push({
          ejecucionId: doc.id,
          sedeIdAnterior: sedeIdActual,
          sedeIdNuevo: sedeCorrecta.id,
          sedeNombre: sedeCorrecta.nombre,
        });
      } else {
        sinResolver.push({ ejecucionId: doc.id, sedeIdActual });
      }
    }

    return {
      tenantId,
      revisadas: ejecucionesSnap.docs.length,
      reparadas,
      sinResolver,
    };
  };
}

module.exports = {
  crearServicioRepararSedesEjecucionPrograma,
};
