'use strict';

// Fix consistencia de plantillas (2026-07-15): conecta las plantillas HTML reales del
// proyecto (antes en --/asignación_de_contraseña_*.html, sin usar por ningún código) al envío
// real de invitaciones. Se inlinean como strings JS -- Cloud Functions solo empaqueta
// functions/, no puede leer archivos fuera de esa carpeta en runtime.

const ESTILOS_BASE = `
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,700;0,900;1,700;1,900&family=Roboto:wght@300;400;500;700&display=swap');
        body { font-family: 'Roboto', Helvetica, Arial, sans-serif; background-color: #f4f7f9; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        .title-font { font-family: 'Montserrat', Helvetica, Arial, sans-serif; }
        .email-container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 51, 102, 0.1); }
        .header-accent { height: 6px; background: linear-gradient(90deg, #003366 0%, #cc3333 100%); }
        .btn-primary { display: inline-block; padding: 16px 35px; background-color: #cc3333; color: #ffffff !important; text-decoration: none; font-family: 'Montserrat', sans-serif; font-weight: 900; font-style: italic; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px; }
        .footer { background-color: #001a33; color: #94a3b8; padding: 40px; text-align: center; font-size: 12px; }
        .info-box { background-color: #f0fdf4; border-radius: 6px; padding: 20px; border: 1px solid #bbf7d0; margin: 25px 0; }`;

const LOGO_URL = 'https://gist.githubusercontent.com/William-Pardo/87c1222a61e7e257cb576be90625d23a/raw/5b914bc5e82e1b24f373501d325e6284dbe5ba13/Logo%2520TuDoJang.svg';

function envolverPlantilla({ titulo, emoji, encabezado, saludo, cuerpo, notaLabel, textoBoton, enlace }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${titulo}</title>
    <style>${ESTILOS_BASE}</style>
</head>
<body>
    <div class="email-container">
        <div class="header-accent"></div>
        <div style="padding: 40px; text-align: center;">
            <div style="margin-bottom: 32px;">
                <img src="${LOGO_URL}" alt="Tudojang" style="max-width: 180px; margin: 0 auto; display: block;">
            </div>
            <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 24px;">
                <span style="font-size: 24px; margin-right: 8px;">${emoji}</span>
                <h1 class="title-font" style="font-size: 24px; font-weight: 900; font-style: italic; color: #003366; text-transform: uppercase; margin: 0; letter-spacing: -0.5px;">${encabezado}</h1>
            </div>
            <p style="color: #4b5563; font-size: 18px; line-height: 1.6; text-align: left; margin: 0;">${saludo}</p>
            ${cuerpo}
            <div class="info-box">
                <p style="color: #15803d; font-size: 14px; margin: 0; text-align: left;"><strong>${notaLabel}</strong></p>
            </div>
            <div style="margin-top: 30px;">
                <a href="${enlace}" class="btn-primary">${textoBoton}</a>
            </div>
            <p style="font-size: 11px; color: #9ca3af; margin-top: 40px; text-align: left; line-height: 1.4;">
                Si el botón no funciona, copia y pega esta dirección en tu navegador:<br>
                <span style="color: #003366; word-break: break-all;">${enlace}</span>
            </p>
        </div>
        <div class="footer">
            <div style="margin-bottom: 16px;">
                <span class="title-font" style="font-weight: 900; font-style: italic; font-size: 18px; color: #ffffff;">Tudo<span style="color: #cc3333;">jang</span></span>
            </div>
            <p style="text-transform: uppercase; letter-spacing: 0.1em; font-size: 10px; margin-bottom: 24px;">Gestión Técnica de Academias</p>
            <p style="color: #64748b; font-size: 10px; margin: 0;">© 2026 Tudojang.com. Todos los derechos reservados.<br>Protocolo Kicho • Disciplina • Control</p>
        </div>
    </div>
</body>
</html>`;
}

// Cada builder replica EXACTO el contenido de --/asignación_de_contraseña_{rol}.html
function plantillaAlumno({ nombreAlumno, enlace }) {
  return {
    asunto: '¡Te damos la bienvenida a Tudojang!',
    html: envolverPlantilla({
      titulo: '¡Te damos la bienvenida a Tudojang!',
      emoji: '🥋',
      encabezado: '¡Te damos la bienvenida!',
      saludo: `Hola <span style="font-weight: bold; color: #003366; font-style: italic;">${nombreAlumno}</span>,`,
      cuerpo: `
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: left; margin-top: 16px;">¡Tu registro en <strong>Tudojang.com</strong> se ha completado con éxito! A partir de ahora podrás acceder a tu perfil para hacer seguimiento de tus clases, entrenamientos, progresos y actividades de la academia.</p>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: left; margin-top: 12px;">Para ingresar por primera vez y comenzar tu camino en la plataforma, es necesario que configures tu contraseña de acceso de manera segura.</p>`,
      notaLabel: 'Nota importante: Por motivos de seguridad, este enlace es de único uso. Una vez establecida tu contraseña, podrás ingresar normalmente con tu correo y clave desde la web de Tudojang.',
      textoBoton: 'Asignar mi Contraseña',
      enlace,
    }),
  };
}

function plantillaTutor({ nombreTutor, nombreAlumno, enlace }) {
  return {
    asunto: 'Acceso para Tutores — Tudojang',
    html: envolverPlantilla({
      titulo: 'Acceso para Tutores',
      emoji: '👨‍👩‍👧‍👦',
      encabezado: 'Acceso para Tutores',
      saludo: `Estimado/a <span style="font-weight: bold; color: #003366; font-style: italic;">${nombreTutor}</span>,`,
      cuerpo: `
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: left; margin-top: 16px;">Le damos la bienvenida a <strong>Tudojang.com</strong>. Se ha creado su cuenta de tutor vinculada a su representado/a: <span style="font-weight: bold; color: #cc3333;">${nombreAlumno}</span>.</p>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: left; margin-top: 12px;">A través de su panel de tutor, podrá realizar el seguimiento de la asistencia, los avances, la facturación y las comunicaciones importantes de la academia de forma sencilla.</p>`,
      notaLabel: 'Nota de seguridad: Para ingresar por primera vez, debe configurar su contraseña de acceso usando el enlace de abajo. Este enlace es de un solo uso.',
      textoBoton: 'Configurar mi Contraseña',
      enlace,
    }),
  };
}

function plantillaMaestro({ nombreMaestro, enlace }) {
  return {
    asunto: 'Acceso para Instructores — Tudojang',
    html: envolverPlantilla({
      titulo: 'Acceso para Instructores',
      emoji: '✊',
      encabezado: 'Acceso para Instructores',
      saludo: `Estimado/a <span style="font-weight: bold; color: #003366; font-style: italic;">Sabonim ${nombreMaestro}</span>,`,
      cuerpo: `
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: left; margin-top: 16px;">Le damos una cordial bienvenida al equipo de <strong>Tudojang.com</strong>. Se ha habilitado su perfil profesional dentro de la plataforma para la gestión técnica y pedagógica de la academia.</p>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: left; margin-top: 12px;">A partir de ahora, podrá administrar sus grupos de clase, registrar la asistencia diaria, calificar los avances de sus alumnos y gestionar la programación de los entrenamientos asignados.</p>`,
      notaLabel: 'Asignación de credenciales: Por favor, haga clic en el botón inferior para configurar su contraseña de acceso personal. Este enlace es de uso único por seguridad.',
      textoBoton: 'Asignar mi Contraseña',
      enlace,
    }),
  };
}

function plantillaAsistente({ nombreAsistente, enlace }) {
  return {
    asunto: 'Acceso Administrativo — Tudojang',
    html: envolverPlantilla({
      titulo: 'Acceso Administrativo',
      emoji: '📋',
      encabezado: 'Acceso Administrativo',
      saludo: `Hola <span style="font-weight: bold; color: #003366; font-style: italic;">${nombreAsistente}</span>,`,
      cuerpo: `
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: left; margin-top: 16px;">Te damos una cálida bienvenida al equipo administrativo en <strong>Tudojang.com</strong>. Se ha configurado tu perfil de gestión para que puedas apoyar en la organización y el correcto funcionamiento diario de la academia.</p>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: left; margin-top: 12px;">A través de tu panel administrativo, tendrás acceso a la gestión de matrículas de alumnos, control de pagos y mensualidades, emisión de recibos y el canal de atención interna para los miembros del dojang.</p>`,
      notaLabel: 'Asignación de credenciales: Para ingresar a tus funciones por primera vez, haz clic en el botón de abajo para establecer tu contraseña. Por seguridad, este enlace es de uso único.',
      textoBoton: 'Establecer mi Contraseña',
      enlace,
    }),
  };
}

/**
 * Selecciona y arma el correo (asunto+html) de invitación según el rol.
 * @param {'Estudiante'|'Tutor'|'Maestro'|'Asistente'} rol
 * @param {{nombreDestinatario?:string, nombreAlumno?:string, enlace:string}} datos
 */
function construirCorreoInvitacion(rol, { nombreDestinatario, nombreAlumno, enlace }) {
  const nombre = nombreDestinatario || 'estudiante';
  switch (rol) {
    case 'Estudiante':
      return plantillaAlumno({ nombreAlumno: nombre, enlace });
    case 'Tutor':
      return plantillaTutor({ nombreTutor: nombre, nombreAlumno: nombreAlumno || 'su representado/a', enlace });
    case 'Maestro':
      return plantillaMaestro({ nombreMaestro: nombre, enlace });
    case 'Asistente':
      return plantillaAsistente({ nombreAsistente: nombre, enlace });
    default:
      return plantillaAlumno({ nombreAlumno: nombre, enlace });
  }
}

module.exports = {
  construirCorreoInvitacion,
};
