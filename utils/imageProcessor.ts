
/**
 * Procesa una imagen para reducir su tamaño y asegurar que pueda guardarse en Firestore.
 * @param base64Str Imagen original en Base64
 * @param maxWidth Ancho máximo deseado
 * @param quality Calidad de compresión (0.1 a 1.0)
 */
export const optimizarImagenBase64 = (base64Str: string, maxWidth: number = 800, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = (maxWidth * height) / width;
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("No se pudo obtener el contexto 2D"));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            // webp preserva transparencia; si el navegador no lo soporta, toDataURL cae a png (también con alfa)
            const compressed = canvas.toDataURL('image/webp', quality);
            resolve(compressed);
        };
        img.onerror = (err) => reject(err);
    });
};
