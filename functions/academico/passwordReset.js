'use strict';

// Fix UX de restablecimiento de clave (2026-07-15): sendPasswordResetEmail() del SDK cliente
// usa el correo y las paginas GENERICAS de Firebase (firebaseapp.com, en ingles, sin marca, y
// sin volver a la app). Esta Cloud Function genera el link REAL de Firebase server-side
// (admin.auth().generatePasswordResetLink) pero lo entrega con la plantilla HTML propia del
// proyecto (--/password_recovery.html, antes sin usar) via Resend, y apunta a una pagina
// propia en el dominio de la app (/#/restablecer-clave) en vez de la de Firebase.

// Plantilla inline (copia de --/password_recovery.html) -- Cloud Functions solo empaqueta
// functions/, no el resto del repo, asi que se embebe aca en vez de leerla por path relativo.
const PLANTILLA_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tudojang - Recuperar Contraseña</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,700;0,900;1,700;1,900&family=Roboto:wght@300;400;500;700&display=swap');
        body { font-family: 'Roboto', Helvetica, Arial, sans-serif; background-color: #f4f7f9; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        .title-font { font-family: 'Montserrat', Helvetica, Arial, sans-serif; }
        .email-container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 51, 102, 0.1); }
        .header-accent { height: 6px; background: linear-gradient(90deg, #003366 0%, #cc3333 100%); }
        .btn-primary { display: inline-block; padding: 16px 35px; background-color: #cc3333; color: #ffffff !important; text-decoration: none; font-family: 'Montserrat', sans-serif; font-weight: 900; font-style: italic; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px; }
        .footer { background-color: #001a33; color: #94a3b8; padding: 40px; text-align: center; font-size: 12px; }
        .info-box { background-color: #fff5f5; border-radius: 6px; padding: 20px; border: 1px solid #fee2e2; margin: 25px 0; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header-accent"></div>
        <div style="padding: 40px; text-align: center;">
            <div style="margin-bottom: 32px;">
                <img src="https://gist.githubusercontent.com/William-Pardo/87c1222a61e7e257cb576be90625d23a/raw/5b914bc5e82e1b24f373501d325e6284dbe5ba13/Logo%2520TuDoJang.svg" alt="Tudojang" style="max-width: 180px; margin: 0 auto; display: block;">
            </div>
            <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 24px;">
                <span style="font-size: 24px; margin-right: 8px;">🔐</span>
                <h1 class="title-font" style="font-size: 24px; font-weight: 900; font-style: italic; color: #003366; text-transform: uppercase; margin: 0; letter-spacing: -0.5px;">Restablecer Clave</h1>
            </div>
            <p style="color: #4b5563; font-size: 18px; line-height: 1.6; text-align: left; margin: 0;">
                Estimado <span style="font-weight: bold; color: #003366; font-style: italic;">{{nombre_usuario}}</span>,
            </p>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: left; margin-top: 16px;">
                Hemos recibido una solicitud para restablecer la contraseña de acceso a tu panel en <strong>Tudojang.com</strong>. Si no has sido tú, puedes ignorar este mensaje con total seguridad.
            </p>
            <div class="info-box">
                <p style="color: #b91c1c; font-size: 14px; margin: 0; text-align: left;">
                    <strong>Nota de seguridad:</strong> Este enlace expirará pronto y solo puede utilizarse una vez.
                </p>
            </div>
            <div style="margin-top: 30px;">
                <a href="{{enlace_recuperacion}}" class="btn-primary">Cambiar mi Contraseña</a>
            </div>
            <p style="font-size: 11px; color: #9ca3af; margin-top: 40px; text-align: left; line-height: 1.4;">
                Si tienes problemas con el botón, copia y pega este enlace en tu navegador:<br>
                <span style="color: #003366; word-break: break-all;">{{enlace_recuperacion}}</span>
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

function construirHtml({ nombreUsuario, enlaceRecuperacion }) {
  return PLANTILLA_HTML
    .replace(/\{\{nombre_usuario\}\}/g, nombreUsuario)
    .replace(/\{\{enlace_recuperacion\}\}/g, enlaceRecuperacion);
}

/**
 * Extrae el oobCode de un link generado por generatePasswordResetLink y arma un link
 * PROPIO apuntando directo a nuestra página (`${base}/#/restablecer-clave?oobCode=...`).
 *
 * Fix 2026-07-15: Firebase, para mode=resetPassword, SIEMPRE genera el link apuntando
 * primero a `{authDomain}/__/auth/action` (su página genérica) — `continueUrl` es solo el
 * "volver a la app" que Firebase ofrece DESPUÉS de que el usuario cambia la clave EN ESA
 * página, no una redirección directa. `handleCodeInApp: true` no cambia esto para este modo
 * (a diferencia del modo signIn con email link). Como nuestra página `/restablecer-clave` ya
 * usa `verifyPasswordResetCode`/`confirmPasswordReset` del SDK cliente directamente con el
 * oobCode, no necesita pasar por la página de Firebase — solo hace falta el oobCode.
 */
function construirEnlacePropio(linkFirebase, base) {
  const match = String(linkFirebase || '').match(/[?&]oobCode=([^&]+)/);
  if (!match) return linkFirebase; // fallback defensivo, no debería pasar
  return `${base}/#/restablecer-clave?oobCode=${match[1]}`;
}

/**
 * @param {Object} deps
 * @param {{ generatePasswordResetLink: (email:string, settings:Object) => Promise<string>, getUserByEmail: (email:string) => Promise<Object> }} deps.auth
 * @param {Function} deps.enviarCorreo
 * @param {Function|Object} deps.resend
 * @param {string} deps.appUrl
 * @param {(email:string, uid:string) => Promise<string|null>} [deps.resolverNombreReal]
 *        Busca el nombre real (Estudiante/Tutor en Firestore, o usuarios/{uid} para staff).
 *        Si no está inyectada, o retorna null, cae a displayName de Auth o al prefijo del email.
 */
function crearServicioSendPasswordReset({ auth, enviarCorreo, resend, appUrl, resolverNombreReal }) {
  return async function sendPasswordReset(data) {
    const email = String(data && data.email || '').toLowerCase().trim();
    if (!email || !email.includes('@')) {
      const error = new Error('Email invalido');
      error.code = 'invalid-argument';
      throw error;
    }

    // No revelar si el email existe o no (mismo criterio que el modal de login ya usaba:
    // "si tu correo esta registrado, recibiras un enlace"). Si no existe, salir en silencio.
    let nombreUsuario = email.split('@')[0];
    let uid;
    try {
      const user = await auth.getUserByEmail(email);
      uid = user.uid;
      if (user.displayName) nombreUsuario = user.displayName;
    } catch (err) {
      if (err && err.code === 'auth/user-not-found') {
        return { ok: true, enviado: false };
      }
      throw err;
    }

    // Fix 2026-07-15: displayName de Auth casi nunca está seteado (el correo salía con
    // "carlos.pardo.ia" -- el prefijo del email -- en vez del nombre real). El nombre real
    // vive en Firestore (estudiante.nombres/apellidos o tutor.nombres/apellidos, o
    // usuarios/{uid} para staff), no en Auth.
    if (resolverNombreReal) {
      try {
        const nombreReal = await resolverNombreReal(email, uid);
        if (nombreReal) nombreUsuario = nombreReal;
      } catch (err) {
        console.error('[sendPasswordReset] no se pudo resolver el nombre real:', err && err.message);
      }
    }

    const base = String(appUrl || '').replace(/\/$/, '');
    let enlaceRecuperacion;
    try {
      const linkFirebase = await auth.generatePasswordResetLink(email, {
        url: `${base}/#/restablecer-clave`,
        handleCodeInApp: true,
      });
      enlaceRecuperacion = construirEnlacePropio(linkFirebase, base);
    } catch (err) {
      // "Domain not allowlisted by project" (2026-07-15): Firebase Auth exige que el dominio
      // de `url` esté en Authentication → Settings → Authorized domains. Es un ajuste de
      // consola (no de código/deploy) -- se traduce a un mensaje operable en vez del genérico
      // "no fue posible procesar la consulta" que da crearHandlerCallable para errores sin
      // .code reconocido.
      if (err && /not allowlisted/i.test(err.message || '')) {
        const error = new Error(`El dominio de la app no está autorizado en Firebase Authentication. Agregá "${base.replace(/^https?:\/\//, '')}" en Authentication → Settings → Authorized domains (consola de Firebase).`);
        error.code = 'failed-precondition';
        throw error;
      }
      throw err;
    }

    const html = construirHtml({ nombreUsuario, enlaceRecuperacion });

    let enviado = false;
    try {
      const resendClient = typeof resend === 'function' ? resend() : resend;
      await enviarCorreo(resendClient, {
        from: 'Tudojang <notificaciones@tudojang.com>',
        to: [email],
        subject: 'Restablece tu contraseña de Tudojang',
        html,
      });
      enviado = true;
    } catch (err) {
      console.error('[sendPasswordReset] el correo no pudo enviarse:', { email, message: err && err.message });
    }

    return { ok: true, enviado };
  };
}

module.exports = {
  crearServicioSendPasswordReset,
  construirHtml,
  construirEnlacePropio,
};
