'use strict';

// Gemelo en CommonJS de servicios/academico/asignacionService.ts:aplicaAlEstudiante -- las
// Functions corren en Node plano (sin paso de compilacion TS), asi que se porta aca en vez
// de importarse del frontend. Si cambia la resolucion de destinatarios en un lado, replicar
// el cambio en el otro.

function aplicaAlEstudiante(asignacion, estudiante) {
  const { destinatario } = asignacion;

  if (destinatario.tipo === 'estudiante') {
    return (destinatario.estudianteIds || []).includes(estudiante.id);
  }

  if (destinatario.tipo === 'grupo') {
    return destinatario.grupo === estudiante.grupo || destinatario.grupo === 'Todos';
  }

  if (destinatario.tipo === 'grado') {
    const grupoCoincide = !destinatario.grupo || destinatario.grupo === estudiante.grupo || destinatario.grupo === 'Todos';
    const gradoCoincide = !destinatario.grados || destinatario.grados.length === 0
      || Boolean(estudiante.grado && destinatario.grados.includes(estudiante.grado));
    return grupoCoincide && gradoCoincide;
  }

  return false;
}

module.exports = { aplicaAlEstudiante };
