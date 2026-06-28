const enviarCorreo = async (resend, message) => {
  const { data, error } = await resend.emails.send(message);

  if (error) {
    throw new Error(`Resend rechazó el correo: ${error.message || error.name}`);
  }

  if (!data?.id) {
    throw new Error("Resend no confirmó el envío del correo");
  }

  return data.id;
};

module.exports = { enviarCorreo };
