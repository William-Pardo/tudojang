
document.addEventListener("DOMContentLoaded", () => {
    const statusEl = document.getElementById("status");
    const sendBtn = document.getElementById("sendBtn");
    const phoneInput = document.getElementById("phone");
    const msgInput = document.getElementById("message");

    // Verificar si estamos activos
    statusEl.innerHTML = "✅ Conectado a Chrome";
    statusEl.style.color = "#2e7d32";

    sendBtn.addEventListener("click", async () => {
        const phone = phoneInput.value;
        const message = msgInput.value;

        if (!phone || !message) {
            statusEl.innerHTML = "⚠️ Faltan datos";
            statusEl.style.color = "#d32126";
            return;
        }

        statusEl.innerHTML = "🚀 Iniciando envío...";

        // Estrategia: Buscar pestaña de WhatsApp Web
        const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });

        let tabId;

        if (tabs.length === 0) {
            // Abrir nueva pestaña si no existe
            const newTab = await chrome.tabs.create({ url: "https://web.whatsapp.com/" }); // Sin parámetros, carga limpia
            tabId = newTab.id;

            // Esperar que cargue
            statusEl.innerHTML = "⏳ Abriendo WhatsApp Web...";
            // Aquí el content script debería tomar el control cuando cargue.
            // PERO vamos a inyectar el cambio de URL:

            // Inyección retardada para dar tiempo a cargar el core
            setTimeout(() => {
                const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
                chrome.tabs.update(tabId, { url });
            }, 5000); // 5 segs para login (o asume logueado)
        } else {
            // Reutilizar pestaña existente (Mejor experiencia)
            tabId = tabs[0].id;
            const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;

            // Activar la pestaña y navegar
            await chrome.tabs.update(tabId, { active: true, url });
        }

        window.close(); // Cerrar popup
    });
});
