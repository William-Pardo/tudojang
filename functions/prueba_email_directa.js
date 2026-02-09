const { Resend } = require("resend");

const resend = new Resend("re_ZACtuoS1_FBeD6e6ZCu84HK8zfZHQV4MW");

async function sendTest() {
  console.log("Iniciando envío de prueba REAL a gengepardo@gmail.com...");
  try {
    const { data, error } = await resend.emails.send({
      from: "Tudojang Academia <info@tudojang.com>",
      to: ["gengepardo@gmail.com"],
      subject: "✅ ¡SÍ FUNCIONA! - Sistema de Correos Tudojang",
      html: `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #0047A0; border-radius: 16px; overflow: hidden;">
          <div style="background: #0047A0; color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">🥋 Tudojang SaaS</h1>
          </div>
          <div style="padding: 40px; color: #333; line-height: 1.6;">
            <h2 style="color: #0047A0; margin-top: 0;">¡Confirmado, Sabonim!</h2>
            <p>Este correo es la prueba definitiva de que tu sistema de notificaciones está activo y verificado.</p>
            <div style="background: #f0f7ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><b>Estado del Dominio:</b> Verificado ✅</p>
              <p style="margin: 5px 0 0 0;"><b>Remitente Oficial:</b> info@tudojang.com</p>
            </div>
            <p>Ya no tienes que preocuparte por el hosting de correos. Resend se encargará de que cada alumno y academia reciba su bienvenida y sus recibos de pago.</p>
          </div>
          <div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666;">
            Enviado automáticamente por el servidor de Tudojang.
          </div>
        </div>
      `,
    });

    if (error) {
      console.error("Error oficial de Resend:", error);
    } else {
      console.log("¡EXCELENTE! Correo enviado con éxito. ID:", data.id);
    }
  } catch (err) {
    console.error("Error crítico ejecutando el script:", err);
  }
}

sendTest();
