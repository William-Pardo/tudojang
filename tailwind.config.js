/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./{vistas,components,context,hooks,servicios}/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                'tkd-blue': '#1f3e90',
                'tkd-red': '#d32126',
                'tkd-gray': '#f3f4f6',
                'tkd-dark': '#111827',
            },
            fontFamily: {
                'poppins': ['Poppins', 'sans-serif'],
            },
            boxShadow: {
                'premium': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                'soft': '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
            }
        },
    },
    plugins: [],
}
