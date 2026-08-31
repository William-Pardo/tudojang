// functions/academico/verificacionDuplicados.js
// Callable publico (SIN auth, PERO con App Check -- ver comentario de wiring en index.js)
// `verificarDuplicadoAspirante`: le permite a CensoPublico.tsx avisarle al aspirante, en
// vivo (on-blur), que el correo/telefono que acaba de escribir ya tiene un registro en el
// sistema -- mismo patron "preguntar y confirmar" que el resto del proyecto, nunca bloquea el
// envio del formulario, solo lo advierte antes de enviar.
//
// Mismo patron de factory que academico/tenantPublico.js: usa Admin SDK (bypasea las reglas,
// necesario porque el visitante no tiene sesion) y devuelve el MINIMO indispensable -- en este
// caso, ni siquiera un subconjunto de campos: SOLO 2 booleanos. Nunca nombre, id, ni ningun
// otro dato del match, porque a diferencia de resolverTenantPublico (un slug no es informacion
// sensible por si sola) este endpoint permite -- si devolviera mas -- que cualquiera enumere
// que familias especificas ya estan inscritas en un club puntual.

'use strict';

const crearError = (code, message) => Object.assign(new Error(message), { code });

// Mismo criterio que soloDigitos en utils/censoInconsistencias.ts (cliente) -- normaliza
// telefono a solo digitos antes de comparar, para que "300-123-4567" y "3001234567" cuenten
// como el mismo numero.
const soloDigitos = (valor) => String(valor || '').replace(/\D/g, '');

function crearServicioVerificarDuplicadoAspirante({ firestore }) {
  return async function verificarDuplicadoAspirante(data) {
    const tenantId = String(data?.tenantId || '').trim();
    if (!tenantId) {
      throw crearError('invalid-argument', 'Falta el tenantId');
    }

    const correo = data?.correo ? String(data.correo).toLowerCase().trim() : '';
    const telefono = data?.telefono ? soloDigitos(data.telefono) : '';

    if (!correo && !telefono) {
      throw crearError('invalid-argument', 'Falta correo o telefono para verificar');
    }

    // Solo necesitamos saber SI existe -- limit(1) evita traer el documento completo (ni
    // siquiera se lee `data()` mas alla de construir el resultado booleano).
    const existeEnColeccion = async (coleccion, campo, valor) => {
      const snap = await firestore
        .collection(coleccion)
        .where('tenantId', '==', tenantId)
        .where(campo, '==', valor)
        .limit(1)
        .get();
      return !snap.empty;
    };

    // registros_temporales guarda los datos del aspirante bajo el mapa anidado `datos`
    // (dot-notation sobre el campo anidado, igual que cualquier query de Firestore sobre un
    // mapa). Se filtra ademas por estado=='pendiente': una solicitud ya rechazada o ya
    // procesada/inyectada no cuenta como duplicado activo.
    const existeEnRegistrosPendientes = async (campoDatos, valor) => {
      const snap = await firestore
        .collection('registros_temporales')
        .where('tenantId', '==', tenantId)
        .where('estado', '==', 'pendiente')
        .where(campoDatos, '==', valor)
        .limit(1)
        .get();
      return !snap.empty;
    };

    let correoExiste = false;
    let telefonoExiste = false;

    if (correo) {
      correoExiste = (await existeEnColeccion('estudiantes', 'correo', correo))
        || (await existeEnRegistrosPendientes('datos.email', correo));
    }

    if (telefono) {
      telefonoExiste = (await existeEnColeccion('estudiantes', 'telefono', telefono))
        || (await existeEnRegistrosPendientes('datos.telefono', telefono));
    }

    return { correoExiste, telefonoExiste };
  };
}

module.exports = { crearServicioVerificarDuplicadoAspirante };
