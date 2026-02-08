/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./vistas/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./App.tsx",
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
            borderRadius: {
                '3xl': '1.5rem',
                '4xl': '2rem',
                '5xl': '2.5rem',
                '6xl': '3rem',
            },
            boxShadow: {
                'premium': '0 20px 50px rgba(0, 0, 0, 0.1)',
                'soft': '0 10px 30px rgba(0, 0, 0, 0.05)',
                'hardware': 'inset 0 2px 4px rgba(255, 255, 255, 0.1), 0 10px 20px rgba(0, 0, 0, 0.2)',
            },
            animation: {
                'bounce-slow': 'bounce 3s infinite',
                'fade-in': 'fadeIn 0.5s ease-out forwards',
                'slide-in-right': 'slideInRight 0.4s ease-out forwards',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideInRight: {
                    '0%': { transform: 'translateX(30px)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                }
            }
        }
    },
    plugins: [],
}
