/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./*.tsx",
        "./vistas/**/*.tsx",
        "./components/**/*.tsx",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                'tkd-blue': 'var(--color-secundario, #0047A0)',
                'tkd-red': 'var(--color-acento, #CD2E3A)',
                'tkd-dark': 'var(--color-primario, #111111)',
                'tkd-gray': '#F8F9FA',
            },
            animation: {
                'fade-in': 'fadeIn 0.4s ease-out',
                'slide-in-right': 'slideInRight 0.4s ease-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideInRight: {
                    '0%': { transform: 'translateX(20px)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
            }
        },
    },
    plugins: [],
}
