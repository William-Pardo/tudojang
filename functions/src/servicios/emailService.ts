import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailBienvenidaParams {
    emailDestino: string;
    nombreDirector: string;
    nombreAcademia: string;
    slug: string;
    passwordTemporal: string;
}

export async function enviarEmailBienvenida(params: EmailBienvenidaParams) {
    const { emailDestino, nombreDirector, nombreAcademia, slug, passwordTemporal } = params;

    const htmlEmail = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 0; }
            .container { max-width: 650px; margin: 40px auto; background: white; border-radius: 30px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
            .header { background: #1e40af; padding: 50px 40px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 38px; font-weight: 900; letter-spacing: -1px; text-transform: uppercase; }
            .content { padding: 50px 40px; }
            .welcome { font-size: 28px; font-weight: 900; color: #1e40af; margin-bottom: 25px; }
            
            .url-display { background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 20px; padding: 30px; margin: 30px 0; text-align: center; }
            .url-display p { margin: 0 0 10px 0; font-size: 11px; font-weight: 900; color: #3b82f6; text-transform: uppercase; letter-spacing: 2px; }
            .url-display strong { font-size: 26px; color: #1e40af; display: block; word-break: break-all; }

            .credentials-box { background: #fffbeb; border: 2px solid #fbbf24; border-radius: 20px; padding: 35px; margin: 30px 0; text-align: center; }
            .credentials-box h2 { color: #92400e; margin: 0 0 20px 0; font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
            .credential-item { margin: 15px 0; }
            .credential-label { font-size: 10px; font-weight: 900; color: #b45309; text-transform: uppercase; display: block; margin-bottom: 5px; }
            .credential-value { font-size: 22px; font-weight: 800; color: #1e40af; font-family: monospace; letter-spacing: 1px; }
            
            .button-container { text-align: center; margin: 40px 0; }
            .button { display: inline-block; background: #dc2626; color: white !important; padding: 25px 60px; text-decoration: none; border-radius: 20px; font-weight: 900; text-transform: uppercase; font-size: 18px; box-shadow: 0 10px 30px rgba(220, 38, 38, 0.3); letter-spacing: 1px; }
            
            .info-text { color: #475569; font-size: 16px; line-height: 1.7; }
            .footer { background: #f8fafc; padding: 40px; text-align: center; color: #94a3b8; font-size: 13px; border-top: 1px solid #e2e8f0; }
            .highlight { color: #1e40af; font-weight: 900; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🥋 TUDOJANG</h1>
                <p style="color: #bfdbfe; margin: 10px 0 0 0; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 3px;">Sistema de Gestión para Artes Marciales</p>
            </div>
            
            <div class="content">
                <p class="welcome">¡Hola, ${nombreDirector}!</p>
                
                <p class="info-text">
                    Tu academia <span class="highlight">${nombreAcademia}</span> ya está conectada a nuestra red global. 
                    A partir de este momento, este será el <span class="highlight">único enlace</span> para gestionar tu dojang:
                </p>

                <div class="url-display">
                    <p>📍 TU URL DE ACCESO EXCLUSIVA:</p>
                    <strong>https://${slug}.tudojang.com</strong>
                </div>

                <div class="credentials-box">
                    <h2>🔓 Credenciales Temporales</h2>
                    <div class="credential-item">
                        <span class="credential-label">Usuario / Email:</span>
                        <span class="credential-value">${emailDestino}</span>
                    </div>
                    <div class="credential-item">
                        <span class="credential-label">Contraseña Temporal:</span>
                        <span style="background: white; padding: 10px 20px; border-radius: 10px; border: 1px dashed #fbbf24; font-size: 32px; font-weight: 900; color: #1e40af; display: inline-block; margin-top: 10px;">${passwordTemporal}</span>
                    </div>
                    <p style="color: #dc2626; font-size: 11px; font-weight: 900; margin-top: 20px; text-transform: uppercase;">⚠️ Debes cambiar esta clave al ingresar por primera vez</p>
                </div>

                <div class="button-container">
                    <a href="https://${slug}.tudojang.com/login" class="button">
                        ENTRAR A MI DOJANG AHORA 🥋
                    </a>
                </div>

                <p style="text-align: center; color: #64748b; font-size: 12px; font-weight: bold;">
                    * Recomendamos guardar este correo en tus favoritos o marcar la URL en tu navegador.
                </p>
            </div>

            <div class="footer">
                <p style="margin-bottom: 15px; font-weight: 900; color: #64748b; text-transform: uppercase;">¿Necesitas soporte técnico?</p>
                <p>Escríbenos directamente a <a href="mailto:aliantlab@gmail.com" style="color: #1e40af; font-weight: bold;">aliantlab@gmail.com</a></p>
                <p style="margin-top: 30px; font-size: 11px;">
                    © 2026 Tudojang - Aliant Labs. <br>
                    Este es un correo automático, por favor no respondas a esta dirección.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        console.log(`📤 Intentando enviar email a: ${emailDestino} para la academia: ${nombreAcademia}`);

        const payload = {
            // USANDO TU DOMINIO VERIFICADO tudojang.com
            from: 'Tudojang <bienvenida@tudojang.com>',
            to: [emailDestino],
            subject: `🥋 ¡Bienvenido a Tudojang, ${nombreDirector}!`,
            html: htmlEmail,
        };

        console.log('📦 Payload preparado con dominio VERIFICADO:', JSON.stringify({ ...payload, html: 'HTML_HIDDEN' }));

        const { data, error } = await resend.emails.send(payload);

        if (error) {
            console.error('❌ Error de Resend API DETALLADO:', JSON.stringify(error, null, 2));
            throw new Error(`Resend Error: ${error.name} - ${error.message}`);
        }

        console.log('✅ Email enviado exitosamente a Resend:', data);
        return data;
    } catch (error: any) {
        console.error('❌ Excepción CRÍTICA en enviarEmailBienvenida:', error.message);
        if (error.stack) console.error(error.stack);
        throw error;
    }
}
