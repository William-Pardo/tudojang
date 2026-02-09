const { onRequest, onCall } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const { Resend } = require("resend");

setGlobalOptions({ maxInstances: 10 });

// Inicializar Resend con la API Key
const resend = new Resend("re_d2452b45-37a2-4294-93c0-e3a51c323d47");

/**
 * Cloud Function: Enviar email de bienvenida con credenciales temporales
 * Llamada desde el frontend después de un registro exitoso
 */
exports.enviarBienvenidaTudojang = onCall(async (request) => {
    const { email, nombreClub, passwordTemporal, slug } = request.data;

    // Validación de parámetros
    if (!email || !nombreClub || !passwordTemporal || !slug) {
        throw new Error("Faltan parámetros requeridos");
    }

    try {
        const { data, error } = await resend.emails.send({
            from: "Tudojang Academia <onboarding@tudojang.com>",
            to: [email],
            subject: `¡Bienvenido a Tudojang, ${nombreClub}!`,
            html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background-color: #f8f9fa;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background: white;
              border-radius: 16px;
              overflow: hidden;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #0047A0 0%, #003580 100%);
              padding: 40px 30px;
              text-align: center;
              color: white;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 2px;
            }
            .content {
              padding: 40px 30px;
            }
            .welcome-text {
              font-size: 18px;
              color: #333;
              margin-bottom: 30px;
              line-height: 1.6;
            }
            .credentials-box {
              background: #f8f9fa;
              border-left: 4px solid #0047A0;
              padding: 20px;
              margin: 30px 0;
              border-radius: 8px;
            }
            .credential-item {
              margin: 15px 0;
            }
            .credential-label {
              font-size: 12px;
              text-transform: uppercase;
              color: #666;
              font-weight: 700;
              letter-spacing: 1px;
            }
            .credential-value {
              font-size: 16px;
              color: #0047A0;
              font-weight: 700;
              font-family: 'Courier New', monospace;
              background: white;
              padding: 10px;
              border-radius: 4px;
              margin-top: 5px;
            }
            .warning-box {
              background: #fff3cd;
              border: 2px solid #ffc107;
              padding: 20px;
              border-radius: 8px;
              margin: 30px 0;
            }
            .warning-box strong {
              color: #856404;
              display: block;
              margin-bottom: 10px;
              font-size: 14px;
            }
            .cta-button {
              display: inline-block;
              background: #CD2E3A;
              color: white;
              padding: 16px 40px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 1px;
              font-size: 14px;
              margin: 20px 0;
              box-shadow: 0 4px 12px rgba(205,46,58,0.3);
            }
            .footer {
              background: #f8f9fa;
              padding: 30px;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
            .footer a {
              color: #0047A0;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🥋 TUDOJANG</h1>
              <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">ACADEMIA DIGITAL</p>
            </div>
            
            <div class="content">
              <p class="welcome-text">
                <strong>¡Bienvenido, Sabonim!</strong><br><br>
                Su academia <strong>${nombreClub}</strong> ha sido creada exitosamente en Tudojang. 
                Estamos emocionados de acompañarle en la transformación digital de su escuela de Taekwondo.
              </p>

              <div class="credentials-box">
                <h3 style="margin-top: 0; color: #0047A0;">🔐 Sus Credenciales de Acceso</h3>
                
                <div class="credential-item">
                  <div class="credential-label">URL de su Academia</div>
                  <div class="credential-value">https://${slug}.tudojang.com</div>
                </div>

                <div class="credential-item">
                  <div class="credential-label">Correo Electrónico</div>
                  <div class="credential-value">${email}</div>
                </div>

                <div class="credential-item">
                  <div class="credential-label">Contraseña Temporal</div>
                  <div class="credential-value">${passwordTemporal}</div>
                </div>
              </div>

              <div class="warning-box">
                <strong>⚠️ IMPORTANTE - SEGURIDAD</strong>
                Esta es una contraseña temporal. Al iniciar sesión por primera vez, 
                el sistema le solicitará cambiarla por una clave personal y segura.
              </div>

              <center>
                <a href="https://tudojang.web.app/#/login" class="cta-button">
                  Iniciar Sesión Ahora
                </a>
              </center>

              <p style="color: #666; font-size: 14px; margin-top: 40px;">
                Si tiene alguna duda o necesita asistencia técnica, nuestro equipo está disponible 
                en <a href="mailto:soporte@tudojang.com" style="color: #0047A0;">soporte@tudojang.com</a>
              </p>
            </div>

            <div class="footer">
              <p><strong>Tudojang SaaS Core 2026</strong></p>
              <p>Sistema de Gestión para Academias de Taekwondo</p>
              <p style="margin-top: 20px;">
                <a href="https://tudojang.com">tudojang.com</a> | 
                <a href="https://tudojang.com/terminos">Términos de Servicio</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
        });

        if (error) {
            logger.error("Error enviando email con Resend:", error);
            throw new Error(`Error al enviar email: ${error.message}`);
        }

        logger.info("Email de bienvenida enviado exitosamente", { email, emailId: data.id });
        return { success: true, emailId: data.id };
    } catch (error) {
        logger.error("Error en enviarBienvenidaTudojang:", error);
        throw new Error(`Error al enviar email de bienvenida: ${error.message}`);
    }
});
