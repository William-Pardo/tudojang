const crearEscalamientoWhatsapp = ({
  available,
  consent,
  hasSensitiveData,
  phone,
  ticketId,
  category,
}) => {
  if (!available) return { allowed: false, reason: "unavailable" };
  if (!consent) return { allowed: false, reason: "consent_required" };
  if (hasSensitiveData) return { allowed: false, reason: "sensitive_data" };

  const message = `Ticket ${ticketId} - Categoría: ${category}`;
  return {
    allowed: true,
    url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
  };
};

module.exports = { crearEscalamientoWhatsapp };
