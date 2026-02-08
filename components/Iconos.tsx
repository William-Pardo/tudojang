
// componentes/Iconos.tsx
// Este archivo define componentes de React para cada icono SVG utilizado en la aplicación.
// Centralizar los iconos de esta manera facilita su mantenimiento y consistencia.

import React from 'react';
import { motion } from 'framer-motion';

// Props para los iconos, permitiendo atributos estándar de SVG y un título para accesibilidad.
type IconoProps = React.SVGProps<SVGSVGElement> & { title?: string };

// Componente base para iconos estándar de 24x24 con trazos (stroke).
// Incluye atributos comunes y efectos de transición.
const BaseIcon: React.FC<IconoProps & { children: React.ReactNode }> = ({ className = '', ...props }) => {
  const combinedClassName = `transition-transform duration-200 ${className}`;
  return (
    <svg
      {...props}
      className={combinedClassName}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {props.children}
    </svg>
  );
};

// Logo Oficial - un SVG complejo y multicolor. No utiliza BaseIcon.
export const IconoLogoOficial: React.FC<IconoProps> = (props) => (
  <svg {...props} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="50" fill="#1f3e90"/>
    <path d="M50,0 a50,50 0 0,0 0,100" fill="#d32126"/>
    <circle cx="50" cy="25" r="25" fill="#1f3e90"/>
    <circle cx="50" cy="75" r="25" fill="#d32126"/>
    <g transform="translate(7 5) scale(0.9)">
        <path d="M48.7,69.5l-5.3-2.1l-4.5,5.8l-3.3-8l-9.1-3.6l4-7.5l-6.9-5.4l7.1-5.1l-2.6-9.3l9.3,2.6l5.1-7.1l5.4,6.9l7.5-4l3.6,9.1l8,3.3l-5.8,4.5l2.1,5.3c-2.3,4-5.3,7.6-9,10.6C56.2,64.2,52.6,67.2,48.7,69.5z" fill="#fff"/>
        <circle cx="62" cy="23" r="5" fill="#fff"/>
    </g>
  </svg>
);

// Logo Oficial con texto. Refactorizado para no anidar SVGs.
export const IconoLogoOficialConTexto: React.FC<IconoProps> = (props) => (
  <svg {...props} viewBox="0 0 180 50" xmlns="http://www.w3.org/2000/svg">
    <g transform="scale(0.5)">
      {/* Contenido del logo in-line */}
      <circle cx="50" cy="50" r="50" fill="#1f3e90"/>
      <path d="M50,0 a50,50 0 0,0 0,100" fill="#d32126"/>
      <circle cx="50" cy="25" r="25" fill="#1f3e90"/>
      <circle cx="50" cy="75" r="25" fill="#d32126"/>
      <g transform="translate(7 5) scale(0.9)">
          <path d="M48.7,69.5l-5.3-2.1l-4.5,5.8l-3.3-8l-9.1-3.6l4-7.5l-6.9-5.4l7.1-5.1l-2.6-9.3l9.3,2.6l5.1-7.1l5.4,6.9l7.5-4l3.6,9.1l8,3.3l-5.8,4.5l2.1,5.3c-2.3,4-5.3,7.6-9,10.6C56.2,64.2,52.6,67.2,48.7,69.5z" fill="#fff"/>
          <circle cx="62" cy="23" r="5" fill="#fff"/>
      </g>
    </g>
    <text x="60" y="20" fontFamily="Poppins, sans-serif" fontSize="22" fill="currentColor" fontWeight="normal">Taekwondo</text>
    <text x="60" y="45" fontFamily="Poppins, sans-serif" fontSize="24" fill="currentColor" fontWeight="bold">Ga Jog</text>
  </svg>
);


// --- Iconos de Navegación y UI ---
export const IconoDashboard: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20V16"/></BaseIcon>);
export const IconoEstudiantes: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></BaseIcon>);
export const IconoTienda: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M6 2l1.5 4.5h9L18 2" /><path d="M3 6h18v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6z" /><path d="M16 11v6a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-6" /></BaseIcon>);
export const IconoEventos: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></BaseIcon>);
export const IconoCampana: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></BaseIcon>);
export const IconoConfiguracion: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></BaseIcon>);
export const IconoCerrar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></BaseIcon>);
export const IconoMenu: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></BaseIcon>);
export const IconoLogout: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></BaseIcon>);
export const IconoLuna: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></BaseIcon>);
export const IconoSol: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></BaseIcon>);
export const IconoFlechaArriba: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M12 19V5"/><polyline points="5 12 12 5 19 12"/></BaseIcon>);
export const IconoCasa: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></BaseIcon>);
export const IconoBuscar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></BaseIcon>);


// --- Iconos Adicionales ---
export const IconoAgregar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></BaseIcon>);
export const IconoAprobar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><polyline points="20 6 9 17 4 12"/></BaseIcon>);
export const IconoCandado: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></BaseIcon>);
export const IconoCarritoAgregar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/><line x1="12" y1="5" x2="12" y2="13"/><line x1="8" y1="9" x2="16" y2="9"/></BaseIcon>);
// Added comment above fix: Export IconoCertificado as it is being imported in several views.
export const IconoCertificado: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></BaseIcon>);
export const IconoCompartir: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></BaseIcon>);
export const IconoContrato: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></BaseIcon>);
export const IconoCopiar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></BaseIcon>);
export const IconoEditar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></BaseIcon>);
export const IconoEliminar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></BaseIcon>);
export const IconoEmail: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></BaseIcon>);
export const IconoEnlace: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.71"/></BaseIcon>);
export const IconoEnviar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></BaseIcon>);
export const IconoExportar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></BaseIcon>);
export const IconoFacebook: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></BaseIcon>);
export const IconoFirma: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></BaseIcon>);
export const IconoGuardar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></BaseIcon>);
export const IconoHistorial: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></BaseIcon>);
export const IconoImagen: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></BaseIcon>);
export const IconoInformacion: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></BaseIcon>);
export const IconoAlertaTriangulo: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></BaseIcon>);
export const IconoLinkedIn: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></BaseIcon>);
export const IconoLogin: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></BaseIcon>);
export const IconoOjoAbierto: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></BaseIcon>);
export const IconoOjoCerrado: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></BaseIcon>);
export const IconoRechazar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></BaseIcon>);
export const IconoUsuario: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></BaseIcon>);
export const IconoWhatsApp: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></BaseIcon>);
export const IconoXTwitter: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></BaseIcon>);

// --- Iconos Animados ---
export const IconoExitoAnimado: React.FC<IconoProps> = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="80"
    height="80"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <motion.path
      d="M22 11.08V12a10 10 0 1 1-5.93-9.14"
      fill="none"
      strokeWidth="1.5"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    />
    <motion.path
      d="M22 4 12 14.01 9 11.01"
      fill="none"
      strokeWidth="1.5"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.4, ease: "easeOut" }}
    />
  </svg>
);
