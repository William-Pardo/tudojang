// functions/academico/tenantPublico.js
// Callable publico (SIN auth) `resolverTenantPublico`: resuelve un tenant por slug para las
// paginas publicas (CensoPublico.tsx, EventoPublico.tsx via BrandingProvider.tsx, y el check
// de slug disponible en RegistroEscuela.tsx). Antes esas paginas consultaban `tenants` DIRECTO
// desde el cliente (servicios/configuracionApi.ts::buscarTenantPorSlug) -- pero firestore.rules
// exige `authenticated()` para leer esa coleccion, asi que un visitante SIN LOGIN nunca podia
// resolver el tenant y veia "Escuela No Encontrada" en vez del formulario/evento/landing. Nunca
// se detecto porque las pruebas siempre se hacian con sesion de Admin abierta en el mismo
// navegador (bug real, sesion 2026-08-06).
//
// Esta funcion usa Admin SDK (bypasea las reglas) y devuelve SOLO el subconjunto de campos que
// las paginas publicas realmente leen -- nunca el documento completo de `tenants` (que incluye
// estado interno de facturacion, representanteLegal, etc.), y nunca permite enumerar la
// coleccion completa: solo resuelve UN tenant a la vez, por slug exacto (no hay `list`).

'use strict';

const crearError = (code, message) => Object.assign(new Error(message), { code });

// Campos que consumen CensoPublico.tsx, EventoPublico.tsx y BrandingProvider.tsx (branding,
// pricing a mostrar, medios de pago publicos, y el chequeo de suscripcion vencida). Cualquier
// campo no listado aca (wompiPaymentSourceId vive aparte desde 2026-07-18, representanteLegal,
// notas internas, etc.) nunca sale de esta funcion.
const CAMPOS_PUBLICOS = [
  'nombreClub',
  'slug',
  'logoUrl',
  'colorPrimario',
  'colorSecundario',
  'colorAcento',
  'valorMatricula',
  'valorMensualidad',
  'activarMatriculaAnual',
  'pagoNequi',
  'pagoDaviplata',
  'estadoSuscripcion',
  'fechaVencimiento',
];

function proyectarCamposPublicos(tenantId, data) {
  const proyeccion = { tenantId };
  for (const campo of CAMPOS_PUBLICOS) {
    if (data[campo] !== undefined) {
      proyeccion[campo] = data[campo];
    }
  }
  return proyeccion;
}

/**
 * Resuelve un tenant por slug para consumo publico (sin autenticacion). Retorna `null` si no
 * existe -- mismo contrato que buscarTenantPorSlug (servicios/configuracionApi.ts) -- para que
 * el cliente no necesite distinguir "no encontrado" de un error real.
 */
function crearServicioResolverTenantPublico({ firestore }) {
  return async function resolverTenantPublico(data) {
    const slug = String(data?.slug || '').toLowerCase().trim();
    if (!slug) {
      throw crearError('invalid-argument', 'Falta el slug del club');
    }

    const snap = await firestore
      .collection('tenants')
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (snap.docs.length === 0) return null;

    const doc = snap.docs[0];
    return proyectarCamposPublicos(doc.id, doc.data());
  };
}

module.exports = { crearServicioResolverTenantPublico };
