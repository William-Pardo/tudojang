const { onRequest, onCall } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const { Resend } = require("resend");
const admin = require("firebase-admin");

admin.initializeApp();

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
      from: "Tudojang Academia <info@tudojang.com>",
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

/**
 * Cloud Function: Enviar email de confirmación de pago exitoso
 */
exports.enviarConfirmacionPago = onCall(async (request) => {
  const { email, nombreClub, montoPagado, referenciaPago } = request.data;

  if (!email || !nombreClub || !montoPagado) {
    throw new Error("Faltan parámetros requeridos");
  }

  try {
    const { data, error } = await resend.emails.send({
      from: "Tudojang Academia <info@tudojang.com>",
      to: [email],
      subject: "✅ Pago Confirmado - Tudojang",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', sans-serif; background-color: #f8f9fa; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 40px 30px; text-align: center; color: white; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 900; }
            .content { padding: 40px 30px; }
            .success-icon { font-size: 64px; text-align: center; margin-bottom: 20px; }
            .amount-box { background: #f0fdf4; border-left: 4px solid #10B981; padding: 20px; margin: 30px 0; border-radius: 8px; }
            .amount { font-size: 32px; font-weight: 900; color: #059669; }
            .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🥋 PAGO CONFIRMADO</h1>
            </div>
            <div class="content">
              <div class="success-icon">✅</div>
              <h2 style="text-align: center; color: #0047A0;">¡Pago Procesado Exitosamente!</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                Hola <strong>${nombreClub}</strong>,<br><br>
                Hemos recibido y confirmado tu pago. Tu suscripción a Tudojang está ahora completamente activa.
              </p>
              <div class="amount-box">
                <p style="margin: 0; font-size: 12px; color: #666; text-transform: uppercase; font-weight: 700;">Monto Pagado</p>
                <div class="amount">$${(montoPagado / 100).toLocaleString('es-CO')}</div>
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">Referencia: ${referenciaPago || 'N/A'}</p>
              </div>
              <p style="color: #666; font-size: 14px;">
                Puedes iniciar sesión en tu academia digital en cualquier momento desde 
                <a href="https://tudojang.web.app/#/login" style="color: #0047A0; font-weight: 700;">tudojang.web.app</a>
              </p>
            </div>
            <div class="footer">
              <p><strong>Tudojang SaaS Core 2026</strong></p>
              <p>Sistema de Gestión para Academias de Taekwondo</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      logger.error("Error enviando confirmación de pago:", error);
      throw new Error(`Error al enviar email: ${error.message}`);
    }

    logger.info("Email de confirmación de pago enviado", { email, emailId: data.id });
    return { success: true, emailId: data.id };
  } catch (error) {
    logger.error("Error en enviarConfirmacionPago:", error);
    throw new Error(`Error al enviar confirmación de pago: ${error.message}`);
  }
});

/**
 * Cloud Function: Enviar email de restauración de contraseña
 */
exports.enviarRecuperacionPassword = onCall(async (request) => {
  const { email, nombreClub, resetLink } = request.data;

  if (!email || !resetLink) {
    throw new Error("Faltan parámetros requeridos");
  }

  try {
    const { data, error } = await resend.emails.send({
      from: "Tudojang Academia <info@tudojang.com>",
      to: [email],
      subject: "🔐 Recuperación de Contraseña - Tudojang",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', sans-serif; background-color: #f8f9fa; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #CD2E3A 0%, #A02329 100%); padding: 40px 30px; text-align: center; color: white; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 900; }
            .content { padding: 40px 30px; }
            .warning-box { background: #fff3cd; border: 2px solid #ffc107; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .cta-button { display: inline-block; background: #CD2E3A; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 900; text-transform: uppercase; margin: 20px 0; }
            .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 RECUPERACIÓN DE CONTRASEÑA</h1>
            </div>
            <div class="content">
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                Hola${nombreClub ? ` <strong>${nombreClub}</strong>` : ""},<br><br>
                Recibimos una solicitud para restablecer la contraseña de tu cuenta en Tudojang.
              </p>
              <div class="warning-box">
                <p style="margin: 0; font-size: 14px; color: #856404; font-weight: 700;">⚠️ Importante</p>
                <p style="margin: 10px 0 0 0; font-size: 13px; color: #856404;">
                  Este enlace es válido por <strong>1 hora</strong>. Si no solicitaste este cambio, ignora este mensaje.
                </p>
              </div>
              <center>
                <a href="${resetLink}" class="cta-button">Restablecer Contraseña</a>
              </center>
              <p style="color: #999; font-size: 12px; margin-top: 30px;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                <span style="color: #0047A0; word-break: break-all;">${resetLink}</span>
              </p>
            </div>
            <div class="footer">
              <p><strong>Tudojang SaaS Core 2026</strong></p>
              <p>Si no solicitaste este cambio, contacta a soporte@tudojang.com</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      logger.error("Error enviando recuperación de password:", error);
      throw new Error(`Error al enviar email: ${error.message}`);
    }

    logger.info("Email de recuperación enviado", { email, emailId: data.id });
    return { success: true, emailId: data.id };
  } catch (error) {
    logger.error("Error en enviarRecuperacionPassword:", error);
    throw new Error(`Error al enviar recuperación: ${error.message}`);
  }
});

/**
 * Cloud Function: Notificar cambio de contraseña exitoso
 */
exports.notificarCambioPassword = onCall(async (request) => {
  const { email, nombreClub } = request.data;

  if (!email) {
    throw new Error("Email es requerido");
  }

  try {
    const { data, error } = await resend.emails.send({
      from: "Tudojang Academia <info@tudojang.com>",
      to: [email],
      subject: "✅ Contraseña Actualizada - Tudojang",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', sans-serif; background-color: #f8f9fa; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #0047A0 0%, #003580 100%); padding: 40px 30px; text-align: center; color: white; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 900; }
            .content { padding: 40px 30px; }
            .success-icon { font-size: 64px; text-align: center; margin-bottom: 20px; }
            .info-box { background: #e0f2fe; border-left: 4px solid #0047A0; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔒 CONTRASEÑA ACTUALIZADA</h1>
            </div>
            <div class="content">
              <div class="success-icon">✅</div>
              <p style="color: #666; font-size: 16px; line-height: 1.6; text-align: center;">
                Hola${nombreClub ? ` <strong>${nombreClub}</strong>` : ""},<br><br>
                Tu contraseña ha sido actualizada exitosamente.
              </p>
              <div class="info-box">
                <p style="margin: 0; font-size: 14px; color: #0369a1; font-weight: 700;">🛡️ Seguridad</p>
                <p style="margin: 10px 0 0 0; font-size: 13px; color: #0369a1;">
                  Si no realizaste este cambio, contacta inmediatamente a nuestro equipo de soporte.
                </p>
              </div>
              <p style="color: #666; font-size: 14px; text-align: center;">
                Puedes iniciar sesión con tu nueva contraseña en:<br>
                <a href="https://tudojang.web.app/#/login" style="color: #0047A0; font-weight: 700;">tudojang.web.app</a>
              </p>
            </div>
            <div class="footer">
              <p><strong>Tudojang SaaS Core 2026</strong></p>
              <p>Soporte: soporte@tudojang.com</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      logger.error("Error enviando notificación de cambio:", error);
      throw new Error(`Error al enviar email: ${error.message}`);
    }

    logger.info("Notificación de cambio de password enviada", { email, emailId: data.id });
    return { success: true, emailId: data.id };
  } catch (error) {
    logger.error("Error en notificarCambioPassword:", error);
    throw new Error(`Error al enviar notificación: ${error.message}`);
  }
});

/**
 * Cloud Function: Webhook para recibir notificaciones de Wompi
 */
exports.webhookWompi = onRequest(async (req, res) => {
  const evento = req.body;

  // TODO: Validar firma de Wompi usando 'x-wompi-signature' y events events secret

  if (evento.event === 'transaction.updated') {
    const { data } = evento;
    const transaction = data.transaction;

    // Solo procesar si el pago es APROBADO
    if (transaction.status === 'APPROVED') {
      const referencia = transaction.reference; // Ej: "SUSC_gajog_id123"
      if (referencia) {
        const parts = referencia.split('_');
        if (parts.length >= 3) {
          const tipo = parts[0];
          const slug = parts[1];
          const id = parts[2];

          if (tipo === 'SUSC') {
            try {
              // 1. Obtener datos del tenant
              const tenantRef = admin.firestore().collection('tenants').doc(id);
              const tenantSnap = await tenantRef.get();

              if (!tenantSnap.exists) {
                logger.error(`Tenant no encontrado: ${id}`);
                return;
              }
              const tenantData = tenantSnap.data();

              // 2. Activar suscripción
              await tenantRef.update({
                estadoSuscripcion: 'activo',
                fechaVencimiento: admin.firestore.Timestamp.fromDate(
                  new Date(Date.now() + 31 * 24 * 60 * 60 * 1000)
                )
              });
              logger.info(`Suscripción activada para: ${slug}`);

              // 3. Crear usuario Auth
              try {
                await admin.auth().createUser({
                  uid: id,
                  email: tenantData.emailClub,
                  password: tenantData.passwordTemporal,
                  displayName: tenantData.nombreClub,
                });
                logger.info(`Usuario Auth creado para: ${tenantData.emailClub}`);
              } catch (authError) {
                // Si ya existe, solo logueamos warning
                if (authError.code === 'auth/uid-already-exists' || authError.code === 'auth/email-already-exists') {
                  logger.warn(`El usuario ${tenantData.emailClub} ya existe.`);
                } else {
                  throw authError;
                }
              }

              // 4. Enviar Email (Inline para asegurar que el server tiene acceso a credenciales)
              try {
                await resend.emails.send({
                  from: "Tudojang Academia <info@tudojang.com>",
                  to: [tenantData.emailClub],
                  subject: `¡Bienvenido a Tudojang, ${tenantData.nombreClub}!`,
                  html: `
                      <!DOCTYPE html>
                      <html>
                      <body style="font-family: 'Segoe UI', sans-serif; background-color: #f8f9fa;">
                        <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                          <div style="background: linear-gradient(135deg, #0047A0 0%, #003580 100%); padding: 40px 30px; text-align: center; color: white;">
                            <h1 style="margin: 0; font-size: 28px; text-transform: uppercase;">🥋 TUDOJANG</h1>
                          </div>
                          <div style="padding: 40px 30px;">
                            <p style="font-size: 18px; color: #333;"><strong>¡Bienvenido, Sabonim!</strong><br>Su academia <strong>${tenantData.nombreClub}</strong> está activa.</p>
                            <div style="background: #f8f9fa; border-left: 4px solid #0047A0; padding: 20px; margin: 30px 0;">
                              <div style="margin: 15px 0;">
                                <div style="font-size: 12px; font-weight: 700; color: #666;">CORREO</div>
                                <div style="font-size: 16px; color: #0047A0;">${tenantData.emailClub}</div>
                              </div>
                              <div style="margin: 15px 0;">
                                <div style="font-size: 12px; font-weight: 700; color: #666;">CONTRASEÑA TEMPORAL</div>
                                <div style="font-size: 16px; color: #0047A0; font-family: monospace;">${tenantData.passwordTemporal}</div>
                              </div>
                            </div>
                            <center><a href="https://tudojang.web.app/#/login" style="background: #CD2E3A; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 900;">INICIAR SESIÓN</a></center>
                          </div>
                        </div>
                      </body>
                      </html>
                    `,
                });
              } catch (emailError) {
                logger.error("Error enviando email en Webhook:", emailError);
              }

            } catch (error) {
              logger.error(`Error procesando suscripción para ${slug}:`, error);
            }
          }
        }
      }
    }
  }

  // Responder a Wompi que recibiste el mensaje correctamente
  res.status(200).send('OK');
});
