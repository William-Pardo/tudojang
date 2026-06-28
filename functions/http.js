const manejarRequest = async (req, res, handler) => {
  try {
    const data = req.body?.data ?? req.body ?? {};
    const result = await handler(data);
    return res.status(200).json({ data: result });
  } catch (error) {
    console.error("Error procesando solicitud HTTP:", error);
    return res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : "Error interno",
      },
    });
  }
};

module.exports = { manejarRequest };
