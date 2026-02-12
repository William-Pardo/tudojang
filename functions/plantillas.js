
/**
 * Plantillas de Correo para Tudojang
 */

const LOGO_URL = "https://gist.githubusercontent.com/William-Pardo/87c1222a61e7e257cb576be90625d23a/raw/5b914bc5e82e1b24f373501d325e6284dbe5ba13/Logo%2520TuDoJang.svg";

const ESTILOS_BASE = `
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,700;0,900;1,700;1,900&family=Roboto:wght@300;400;500;700&display=swap');
    body { font-family: 'Roboto', sans-serif; background-color: #f4f7f9; margin: 0; padding: 0; }
    .title-font { font-family: 'Montserrat', sans-serif; }
    .email-container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 51, 102, 0.1); }
    .header-accent { height: 6px; background: linear-gradient(90deg, #003366 0%, #cc3333 100%); }
    .btn-primary { display: inline-block; padding: 16px 35px; background-color: #cc3333; color: #ffffff !important; text-decoration: none; font-family: 'Montserrat', sans-serif; font-weight: 900; font-style: italic; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px; }
    .btn-secondary { display: inline-block; padding: 14px 30px; border: 2px solid #003366; color: #003366 !important; text-decoration: none; font-family: 'Montserrat', sans-serif; font-weight: 700; font-style: italic; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px; font-size: 14px; }
    .btn-support { display: inline-block; padding: 16px 35px; background-color: #003366; color: #ffffff !important; text-decoration: none; font-family: 'Montserrat', sans-serif; font-weight: 900; font-style: italic; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px; font-size: 14px; }
    .credentials-box { background-color: #f1f5f9; border-radius: 6px; padding: 25px; border: 1px solid #e2e8f0; }
    .info-box { background-color: #fff5f5; border-radius: 6px; padding: 20px; border: 1px solid #fee2e2; margin: 25px 0; }
    .ticket-box { background-color: #f1f5f9; border-radius: 6px; padding: 20px; border-left: 4px solid #003366; margin: 25px 0; }
    .honor-box { background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 30px; margin: 25px 0; text-align: center; }
    .footer { background-color: #001a33; color: #94a3b8; padding: 40px; text-align: center; font-size: 12px; }
    .brush-stroke { border-left: 4px solid #cc3333; padding-left: 20px; margin: 25px 0; font-style: italic; color: #475569; }
`;

const FOOTER_HTML = `
    <div class="footer">
        <div style="margin-bottom: 16px;">
            <span class="title-font" style="font-weight: 900; font-style: italic; font-size: 18px; color: #ffffff;">Tudo<span style="color: #cc3333;">jang</span></span>
        </div>
        <p style="text-transform: uppercase; letter-spacing: 0.1em; font-size: 10px; margin-bottom: 24px;">Fortaleciendo la Autoridad Técnica</p>
        <div style="margin-bottom: 24px;">
            <a href="#" style="color: #94a3b8; text-decoration: none; margin: 0 8px;">Diferenciales</a>
            <span style="color: #334155;">|</span>
            <a href="#" style="color: #94a3b8; text-decoration: none; margin: 0 8px;">Protocolo Kicho</a>
            <span style="color: #334155;">|</span>
            <a href="#" style="color: #94a3b8; text-decoration: none; margin: 0 8px;">Soporte</a>
        </div>
        <p style="color: #64748b; font-size: 10px; margin: 0;">
            © 2026 Tudojang.com. Todos los derechos reservados.<br>
            Recupere su tiempo y asegure su recaudo.
        </p>
    </div>
`;

/**
 * BIENVENIDA
 */
exports.bienvenida = (data) => `
<!DOCTYPE html>
<html>
<head>
    <style>${ESTILOS_BASE}</style>
</head>
<body>
    <div class="email-container">
        <div class="header-accent"></div>
        <div style="padding: 40px; text-align: center;">
            <div style="margin-bottom: 32px;">
                <img src="${LOGO_URL}" alt="Tudojang Logo" style="max-width: 180px; margin: 0 auto; display: block;">
            </div>
            <h1 class="title-font" style="color: #003366; font-size: 24px; font-weight: 900; font-style: italic; text-transform: uppercase; margin: 0;">
                🥋 ¡Acceso Activado!
            </h1>
            <p style="color: #4b5563; font-size: 18px; line-height: 1.625; text-align: left; margin-top: 24px;">
                Saludos <span style="font-weight: bold; color: #003366; font-style: italic;">${data.nombreUsuario}</span>,
            </p>
            <p style="color: #4b5563; font-size: 18px; line-height: 1.625; text-align: left; margin-top: 16px;">
                Es un honor informarte que la academia <span style="color: #cc3333; font-weight: 900; text-transform: uppercase;">${data.nombreAcademia}</span> te ha dado de alta como parte de su equipo técnico en **Tudojang.com**.
            </p>
            <div class="brush-stroke" style="text-align: left;">
                "La autoridad técnica se construye con disciplina, el control de la academia con Tudojang."
            </div>
            <div class="credentials-box" style="margin-top: 32px; text-align: left;">
                <p style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #003366; font-weight: bold; margin-bottom: 16px;">Tus Credenciales de Acceso:</p>
                <div style="margin-bottom: 8px;">
                    <span style="color: #6b7280;">Usuario:</span>
                    <span style="font-weight: bold; color: #003366; float: right;">${data.emailUsuario}</span>
                </div>
                <div style="clear: both; padding-top: 8px;">
                    <span style="color: #6b7280;">Clave temporal:</span>
                    <span style="font-family: monospace; font-weight: bold; background-color: #ffffff; padding: 4px 8px; border-radius: 4px; border: 1px solid #e2e8f0; color: #000000; float: right;">
                        ${data.passwordTemporal}
                    </span>
                </div>
                <div style="clear: both;"></div>
            </div>
            <div style="margin-top: 40px;">
                <a href="${data.loginUrl || 'https://tudojang.com'}" class="btn-primary">Iniciar sesión en mi Panel</a>
            </div>
            <p style="font-size: 11px; color: #9ca3af; margin-top: 32px; font-style: italic; text-align: left;">
                * Por seguridad, se le solicitará cambiar su contraseña al ingresar por primera vez.
            </p>
        </div>
        ${FOOTER_HTML}
    </div>
</body>
</html>
`;

/**
 * PAGO EXITOSO
 */
exports.pagoExitoso = (data) => `
<!DOCTYPE html>
<html>
<head>
    <style>${ESTILOS_BASE}</style>
</head>
<body>
    <div class="email-container">
        <div class="header-accent"></div>
        <div style="padding: 40px; text-align: center;">
            <div style="margin-bottom: 32px;">
                <img src="${LOGO_URL}" alt="Tudojang" style="max-width: 180px; margin: 0 auto; display: block;">
            </div>
            <h1 class="title-font" style="font-size: 24px; font-weight: 900; font-style: italic; color: #003366; text-transform: uppercase; margin: 0;">
                🙏 Honor a tu Compromiso
            </h1>
            <p style="color: #4b5563; font-size: 18px; line-height: 1.6; text-align: left; margin-top: 24px;">
                Estimado <span style="font-weight: bold; color: #003366; font-style: italic;">Sabonim ${data.nombreUsuario}</span>,
            </p>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: left; margin-top: 16px;">
                Recibimos con gratitud tu pago. Más allá de una transacción, este aporte es el soporte que nos permite seguir fortaleciendo la tecnología que respalda tu autoridad técnica y el legado de tu academia <span style="font-weight: bold; color: #cc3333;">${data.nombreAcademia}</span>.
            </p>
            <div class="honor-box">
                <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px;">Comprobante de Recaudo</p>
                <h2 style="color: #003366; font-size: 28px; font-weight: 900; margin: 0;">${data.montoPagado}</h2>
                <p style="color: #94a3b8; font-size: 12px; margin-top: 5px;">Fecha: ${data.fechaPago}</p>
            </div>
            <div class="brush-stroke" style="text-align: left;">
                "El respeto es el cimiento de nuestro arte; la gratitud es el camino hacia la excelencia."
            </div>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: left;">
                Gracias por permitirnos ser parte de tu camino. Tu enfoque en la enseñanza es lo más importante, de la gestión técnica nos encargamos nosotros.
            </p>
            <div style="margin-top: 40px;">
                <a href="https://tudojang.com" class="btn-secondary">Ir a mi Panel de Control</a>
            </div>
        </div>
        ${FOOTER_HTML}
    </div>
</body>
</html>
`;

/**
 * RECUPERAR CONTRASEÑA
 */
exports.recuperarPassword = (data) => `
<!DOCTYPE html>
<html>
<head>
    <style>${ESTILOS_BASE}</style>
</head>
<body>
    <div class="email-container">
        <div class="header-accent"></div>
        <div style="padding: 40px; text-align: center;">
            <div style="margin-bottom: 32px;">
                <img src="${LOGO_URL}" alt="Tudojang" style="max-width: 180px; margin: 0 auto; display: block;">
            </div>
            <h1 class="title-font" style="font-size: 24px; font-weight: 900; font-style: italic; color: #003366; text-transform: uppercase; margin: 0;">
                🔐 Restablecer Clave
            </h1>
            <p style="color: #4b5563; font-size: 18px; line-height: 1.6; text-align: left; margin-top: 24px;">
                Estimado <span style="font-weight: bold; color: #003366; font-style: italic;">Sabonim ${data.nombreUsuario}</span>,
            </p>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: left; margin-top: 16px;">
                Hemos recibido una solicitud para restablecer la contraseña de acceso a tu panel en **Tudojang.com**. Si no has sido tú, puedes ignorar este mensaje con total seguridad.
            </p>
            <div class="info-box">
                <p style="color: #b91c1c; font-size: 14px; margin: 0; text-align: left;">
                    <strong>Nota de seguridad:</strong> Este enlace expirará en 2 horas y solo puede utilizarse una vez.
                </p>
            </div>
            <div style="margin-top: 30px;">
                <a href="${data.enlaceRecuperacion}" class="btn-primary">Cambiar mi Contraseña</a>
            </div>
            <p style="font-size: 11px; color: #9ca3af; margin-top: 40px; text-align: left; line-height: 1.4;">
                Si tienes problemas con el botón, copia y pega este enlace en tu navegador:<br>
                <span style="color: #003366; word-break: break-all;">${data.enlaceRecuperacion}</span>
            </p>
        </div>
        ${FOOTER_HTML}
    </div>
</body>
</html>
`;

/**
 * SOPORTE TÉCNICO
 */
exports.soporteTecnico = (data) => `
<!DOCTYPE html>
<html>
<head>
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
                <h1 class="title-font" style="font-size: 24px; font-weight: 900; font-style: italic; color: #003366; text-transform: uppercase; margin: 0;">
                    🛠️ Soporte Técnico
                </h1>
            </div>
            <p style="color: #4b5563; font-size: 18px; line-height: 1.6; text-align: left;">
                Saludos <span style="font-weight: bold; color: #003366; font-style: italic;">Sabonim ${data.nombreUsuario}</span>,
            </p>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: left; margin-top: 16px;">
                Hemos recibido tu solicitud de asistencia técnica relacionada con tu academia <span style="font-weight: bold; color: #cc3333;">${data.nombreAcademia}</span>. Nuestro equipo de soporte ya está analizando el caso para brindarte una solución con la precisión que tu gestión requiere.
            </p>
            <div class="ticket-box">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="color: #64748b; font-size: 12px; text-transform: uppercase; padding-bottom: 5px;">Ticket de Seguimiento:</td>
                        <td style="color: #003366; font-weight: 900; text-align: right; padding-bottom: 5px;">#${data.idTicket}</td>
                    </tr>
                    <tr>
                        <td style="color: #64748b; font-size: 12px; text-transform: uppercase;">Estado:</td>
                        <td style="color: #cc3333; font-weight: 900; text-align: right; font-style: italic;">En Revisión</td>
                    </tr>
                </table>
            </div>
            <div class="brush-stroke" style="text-align: left;">
                "La maestría no solo está en el arte, sino en la capacidad de resolver cada obstáculo con serenidad y técnica."
            </div>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: left;">
                ${data.mensajeRespuestaSoporte}
            </p>
            <div style="margin-top: 40px;">
                <a href="https://tudojang.com/soporte" class="btn-support">Ver Estado del Ticket</a>
            </div>
            <p style="font-size: 11px; color: #9ca3af; margin-top: 32px; text-align: center;">
                Si tienes información adicional que aportar, puedes responder directamente a este correo manteniendo el asunto original.
            </p>
        </div>
        ${FOOTER_HTML}
    </div>
</body>
</html>
`;
