
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

// Logo Oficial - TuDoJang SVG
export const IconoLogoOficial: React.FC<IconoProps> = (props) => (
  <svg {...props} viewBox="0 0 341.96 340.19" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <style>{`.a{fill:#211915;filter:url(#b);}.b{fill:#c2c3c9;}.c{fill:#00275f;}.d{mask:url(#a);}.e{fill:#001338;}.f{fill:#f2f2f2;}.g{fill:none;}.h{fill:#fff;}.i{fill:#145f9d;}.j{fill:#c23439;}.k{fill:#072f5e;}`}</style>
      <filter id="b" x="13.38" y="0" width="328.59" height="270.04" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodColor="#fff" result="bg" /><feBlend in="SourceGraphic" in2="bg" />
      </filter>
      <mask id="a" x="13.38" y="0" width="328.59" height="270.04" maskUnits="userSpaceOnUse">
        <path className="a" d="M133.54,270c-4.11-12.71-23.87-9.28-23.77-33.89a372.6,372.6,0,0,0,31.88,21c10.6-5.9,17.82-10.44,29.41-18.29-10.52,14.95-6.81,10.84-15.81,30.79C153.69,267.84,137.84,270.38,133.54,270Z" />
      </mask>
      <linearGradient id="c" x1="-11.43" y1="309.28" x2="166.17" y2="200.73" gradientUnits="userSpaceOnUse">
        <stop offset="0.61" stopColor="#c23439" /><stop offset="1" stopColor="#95181d" />
      </linearGradient>
      <linearGradient id="e" x1="326.69" y1="117.04" x2="240.26" y2="152.97" gradientUnits="userSpaceOnUse">
        <stop offset="0.51" stopColor="#c23439" /><stop offset="1" stopColor="#761a1d" />
      </linearGradient>
      <linearGradient id="f" x1="119.71" y1="122.43" x2="57.11" y2="111.28" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#fff" /><stop offset="0.02" stopColor="#fefefe" /><stop offset="1" stopColor="#c2c3c9" />
      </linearGradient>
      <linearGradient id="g" x1="96.95" y1="72.62" x2="205.64" y2="72.62" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#fff" /><stop offset="0.2" stopColor="#f4f5f6" /><stop offset="0.68" stopColor="#e0e0e4" /><stop offset="1" stopColor="#d8d9dd" />
      </linearGradient>
      <linearGradient id="j" x1="121.88" y1="97.61" x2="97.67" y2="49.93" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#aeadb3" />
      </linearGradient>
      <linearGradient id="aa" x1="65.33" y1="96.58" x2="139.87" y2="145.59" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#fff" /><stop offset="0.08" stopColor="#f8f8f9" /><stop offset="0.36" stopColor="#e6e7e9" /><stop offset="0.66" stopColor="#dbdce0" /><stop offset="1" stopColor="#d8d9dd" />
      </linearGradient>
      <linearGradient id="ab" x1="61.48" y1="13.9" x2="67.79" y2="60.26" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#145f9d" /><stop offset="1" stopColor="#072f5e" />
      </linearGradient>
      <linearGradient id="ac" x1="86.4" y1="84.52" x2="85.67" y2="63.69" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#072f5e" /><stop offset="1" stopColor="#00275f" />
      </linearGradient>
      <linearGradient id="ad" x1="-20.91" y1="85.83" x2="66.98" y2="114.59" gradientUnits="userSpaceOnUse">
        <stop offset="0.52" stopColor="#c23439" /><stop offset="1" stopColor="#95181d" />
      </linearGradient>
      <linearGradient id="af" x1="92.92" y1="135.07" x2="101.77" y2="118.78" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#072f5e" /><stop offset="1" stopColor="#145f9d" />
      </linearGradient>
      <linearGradient id="ag" x1="156.1" y1="84.7" x2="106.8" y2="53.4" gradientUnits="userSpaceOnUse">
        <stop offset="0.42" stopColor="#c23439" /><stop offset="1" stopColor="#95181d" />
      </linearGradient>
    </defs>
    <path className="b" d="M148.06,9.19A371.84,371.84,0,0,1,269.31,29.36c5.28,79.82-15.26,165.22-127.65,227.72C52.74,204.26,21.34,147.92,26.48,29.36A377.71,377.71,0,0,1,148.06,9.19m0-5.95A384.51,384.51,0,0,0,24.57,23.73L20.72,25l-.18,4.06C17.86,91,25,134.61,43.52,170.6c18.06,35,47.39,63.25,95.1,91.59l2.94,1.75,3-1.67C172,247,195.32,229.62,214,210.51a214.68,214.68,0,0,0,41-58.25c16.78-35.45,23.4-75.77,20.26-123.29L275,25l-3.71-1.29A378.07,378.07,0,0,0,148.06,3.24Z" />
    <path className="c" d="M148.06,14.47A367.38,367.38,0,0,1,264.25,33.21c2.47,44-3.89,81.44-19.41,114.24A203.89,203.89,0,0,1,206,202.66c-17.34,17.72-38.94,34-64.25,48.32-44.25-26.68-71.53-53.14-88.25-85.53C36.23,132,29.44,91.1,31.61,33.22A373,373,0,0,1,148.06,14.47m0-5.28A377.71,377.71,0,0,0,26.48,29.36c-5.14,118.56,26.26,174.9,115.18,227.72,112.39-62.5,132.93-147.9,127.65-227.72A371.84,371.84,0,0,0,148.06,9.19Z" />
    <g className="d">
      <path className="e" d="M337.62,9.2c-2.9-4.55-6.35-5.51-8.74-5.51-3.52,0-6.39,1.89-8.54,5.62h0c-11.65,17.37-13.16,18.5-17.17,21.52l-.43.32c-3.69,2.78-23.32,10.71-27,11.59l-.33.09-2.75.76-4.38,1.24-4.66,1.33c-5.81,1.67-11.46,3.33-16.26,4.75a8.64,8.64,0,0,0,3.74-6.47,7.92,7.92,0,0,0-4.55-7.67l-1-.59c-.57-.33-1.26-.75-2-1.23-1.57-1-4.63-2.88-7.4-4.83-3.35-2.35-6-3.4-8.71-3.4a9.18,9.18,0,0,0-4,.89c-.86.25-2.16.68-4.55,1.5a7.68,7.68,0,0,0-1.71-2.23,7.65,7.65,0,0,0-1.16.09l-6,.94c-9.19,1.48-14.82,2.44-16.75,2.85l-1.6.36c-4.24,1-14.17,3.23-37.44,6.39a6.81,6.81,0,0,0-1,.2c-.88.25-4.21,1.33-11.58,3.73-4.77,1.55-11.1,3.61-13.31,4.3a93.94,93.94,0,0,0-14.85,2.25,25.57,25.57,0,0,0-2-6.76c-.37-1-.78-2-1.14-3.06a14.46,14.46,0,0,0,.47-8.37c-.06-.25-.12-.56-.2-.92-.86-4.08-2.86-13.65-10.38-20.39l-.15-.13A30.6,30.6,0,0,0,76,0,32.4,32.4,0,0,0,65,1.92l-.52.21a27.72,27.72,0,0,0-4.58,2.61C55,8.15,47,16.22,48.13,31.94l0,.28c.64,5.92,1.48,12.17,4.08,18,0,.24.1.58.16,1-5,2.13-9.94,5.73-9.86,10.87,0,1-.32,4.49-.65,7.51-3.63,1.85-6.21,3.67-7.7,5.45-5.55,6.13-10.79,19.08-9.38,37.52-.62,2-1.65,5.3-2.84,9.3-2.18,7.24-5.16,17.53-7.06,25.4-.28,1.16-.54,2.27-.77,3.31-.88,3.41-2.14,11.29,3.63,15.15l.16.1c3.9,2.62,7.4,3.7,26.63,3.75h1.49c9.56,0,17.72-.23,23.68-.39,3.08-.09,5.58-.16,7.33-.17q7.77,1.93,10.82,2.57l.65.13a7,7,0,0,0,1.37.13,7.48,7.48,0,0,0,7.34-6l.07,0,1.62,29.61a7.49,7.49,0,0,0,7.48,7.08,7.81,7.81,0,0,0,1.28-.11c.06,1.68.14,3.42.24,5.21.67,12.46,1.91,23.69,2.55,28.93,1.55,1,4.72,3.39,8.31,5.89-.75-6.12-2.75-23.42-3.39-35.22-.3-5.57-.46-11.21-.35-16.37l-7.79,3.77-.85.41L104.59,162c-.2-.17-.43-.35-.68-.54l0,0c-1.3-1.11-3.39-2.31-6.64-4.73l-.29-.16-.11-.14c-.14-.11-.28-.2-.42-.32h0a12.71,12.71,0,0,0-3.62-.53l-1-.19-2.7-.53-1.38-.27a29.47,29.47,0,0,0,2.14,9.85l-.58-.11c-2.38-.5-7.3-1.71-11.34-2.72-5,0-17.3.6-33.41.56-19.41-.05-20.59-1.22-22.64-2.59s-.51-7.17-.51-7.17c.23-1,.49-2.14.77-3.3,1.81-7.52,4.68-17.46,7-25,1.54-5.14,2.8-9.17,3.25-10.61C30.7,95.64,35.84,84.33,39.86,80c1.62-2.16,8.92-5.31,8.92-5.31.51-3,1.25-10.93,1.25-12.62-.08-.88,3.87-4.16,10.22-5.49a38.1,38.1,0,0,0-.91-8.81c-2.49-5.29-3.22-11.6-3.74-16.36-.77-11,3.86-17.23,8.61-20.55A19.89,19.89,0,0,1,67.56,9c9.76-3.53,18.86-.08,22.74,3.22,6.39,5.73,7.63,14.68,8.29,17.46s-.51,4.92-.73,4.92-.29,1.17-.15,2.35c1.32,4.18,3.67,9.24,3.3,9.9a6.46,6.46,0,0,1-2.64,1.62,45.16,45.16,0,0,1-.72,11.18c4.92-6.35,22.73-8,26.63-8.31l.46,0c2.44-.68,23.77-7.73,25.53-8.21,26.7-3.62,36-6.07,39.61-6.85,2.28-.49,10.55-1.84,16.35-2.77l6-.95s-.11,3-.24,6.83c5-1.56,13.28-4.54,13.94-4.6s1.25-1.76,5.94,1.54c2.56,1.8,5.51,3.68,7.79,5.08l2.17,1.31c.79.46,1.35.78,1.56.87.81.37.15,1.47-2.2,2.2-.81.44-9.32-.66-10.57-1-.95-.29-5,4.11-5.57,4.41-.18.09-.62.37-1.27.66a9.5,9.5,0,0,1-7.54.07c-2.32-.85-3.2-1.65-4.52-2-.12,4-.21,7.53-.17,8.57-.49,0-3.42,0-6.59.11a74.28,74.28,0,0,1-7.89-.11c-2.9.36-34.64,11.29-42.66,13.53-.65.18-1.14.3-1.45.36-5.12,3.32-19.13,12.08-25.64,16.67A50.06,50.06,0,0,0,130,93.24c.45.23.88.47,1.29.71,1.76,1.45,3.5,2.39,4.08,3.5a2.14,2.14,0,0,0,.25,1,.87.87,0,0,0,.37.58,2.67,2.67,0,0,0,.54.52l.08,0,.21.1c.28.14.65.36,1.08.62,1.64,1,3.43,2.11,5.2,3.36l20.25-15.28s.21,4,.21,10.59l5.3-3.36c7.92-5,16.21-10.08,22-12.73,8-3.67,29.94-13.21,31.7-13.94s11.3-6.16,15.62-7.49c3.34-1,14.66-4.43,27.53-8.13L270.36,52l4.36-1.23,2.73-.76c3.52-.81,24.73-9.1,29.79-12.91s6.6-4.7,19.44-23.85c.66-1.1,2.05-4.1,4.62-.07s3.82,10.86,2.86,18.93c-.48,3.54-2.22,7.61-12.28,14.43l-1.8,1.2c-1.76,1.17-5,3.66-4.92,7.7.22,3.37.88,10.86-7.55,9.1-2.35-.59-6.31-1.62-14.31.8-5.72,1.69-9.46,2.79-11.08,8.07.08,1.25-.58,2.5-.07,4.4-.45.24-2.33,1.1-5.12,2.44-1.28.62-2.76,1.34-4.37,2.14-2.76,1.38-5.94,3-9.31,4.86l-.48.27c-3.49,1.91-7.14,4-10.73,6.29-13.72,8.65-51.06,30.74-75.41,61.55-2.79,5.14-21.28,40.64-25.83,91.26-.07.08-.19,5.14-.26,5.21l-.2.13c-1,.61-2,1.2-3.07,1.8,4.9-2.83,11-6.41,11-6.47,4.23-47.07,20.63-80.27,24.64-87.8,21.78-27.3,54.16-47.5,69.76-57.24l3.38-2.11c3.09-2,6.56-4,10.33-6.06l.47-.26c2.88-1.57,5.93-3.16,9.06-4.73,1.58-.78,3-1.49,4.27-2.09l3.44-1.63c1-.47,1.67-.79,1.93-.93a7.5,7.5,0,0,0,3.82-8.23c0-.09,0-.17,0-.25,0-.28.1-.63.14-1,.41-.69,1.42-1.12,5.83-2.42a24.14,24.14,0,0,1,6.85-1.21,12.62,12.62,0,0,1,3.47.5l.29.06a19,19,0,0,0,3.85.43h0a12.21,12.21,0,0,0,9.24-3.79c4-4.25,3.69-10.15,3.49-13.14a4.74,4.74,0,0,1,1.49-1.34l1.93-1.28c10-6.81,14.52-12.49,15.5-19.61,0-.05,0-.1,0-.14C342.71,23.61,341.26,14.93,337.62,9.2ZM236,54.33c-3.38,1-8.29,3.55-13.44,6.25-1.13.59-2.54,1.33-2.88,1.49-2,.85-23.93,10.37-31.94,14a177.77,177.77,0,0,0-17.35,9.75,7.49,7.49,0,0,0-11.55-3.42l-16,12.11-.75-.45A.54.54,0,0,1,142,94a14.33,14.33,0,0,0-4.62-4.8l-.06,0c4.38-2.89,9.6-6.21,13.79-8.88l4.76-3,.47-.13c3.79-1.06,12.09-3.79,20.88-6.68,7.35-2.42,17.17-5.65,20.3-6.5.95,0,2.12.08,3.61.08,1.24,0,2.59,0,3.9,0l3-.07c1.26,0,2.31-.06,2.92-.06h.08l.44,0A7.5,7.5,0,0,0,218.8,58c.39,0,.78,0,1.17,0a16.6,16.6,0,0,0,6.82-1.47c.77-.34,1.36-.68,1.72-.88a13.8,13.8,0,0,0,3.06-2.44c.18-.18.44-.43.72-.68,2.41.34,5.29.63,7.16.7Z" />
      <path className="f" d="M334.46,11.21c-1.59-2.5-3.47-3.77-5.58-3.77-3.14,0-4.71,2.72-5.3,3.74l-.07.12c-12.07,18-13.71,19.23-18.1,22.53l-.42.32c-4.41,3.32-24.91,11.46-28.37,12.25l-.17,0-2.74.77-4.37,1.23-4.64,1.33c-14.77,4.24-27.07,8-27.59,8.14-3.32,1-8.8,3.89-12.79,6-1.31.68-2.79,1.46-3.18,1.62-2,.85-23.84,10.33-31.82,14-5.95,2.74-14.11,7.72-22.07,12.74-.06-2.49-.13-3.92-.14-4a3.75,3.75,0,0,0-6-2.8L143,99.1c-1.1-.73-2.18-1.39-3.18-2l-.8-.47a4,4,0,0,0-.33-.94,10.74,10.74,0,0,0-3.52-3.51c-.47-.35-1-.73-1.5-1.15a5.48,5.48,0,0,0-.49-.35l-.42-.23c-.31-.65-.62-1.38-.93-2.16,4.86-3.3,11.91-7.79,17.28-11.21l5.25-3.36,1-.26c3.71-1,12-3.75,20.72-6.63,7.95-2.61,18.68-6.14,21.1-6.72.94.08,2.23.12,4,.12,1.22,0,2.54,0,3.83,0l3-.06c1.3,0,2.39-.06,3-.06h.52a3.74,3.74,0,0,0,3.74-3.87c0-.28,0-1,0-2.75a14.22,14.22,0,0,0,4.71.83,12.93,12.93,0,0,0,5.29-1.13c.63-.29,1.12-.56,1.38-.71l0,0A10,10,0,0,0,229,50.56c.48-.46,1.43-1.37,2.12-1.94a72.51,72.51,0,0,0,9.09,1,6.18,6.18,0,0,0,2.22-.33c4.14-1.35,4.9-3.72,5-5a4.21,4.21,0,0,0-2.47-4.09c-.21-.1-.66-.36-1.26-.71s-1.3-.78-2.1-1.27c-1.61-1-4.74-2.94-7.6-4.95-2.67-1.88-4.69-2.72-6.55-2.72a5.71,5.71,0,0,0-2.68.66c-.73.19-2.08.64-5.47,1.8l-3.4,1.15c0-.92,0-1.46,0-1.46a3.71,3.71,0,0,0-1.25-2.94,3.76,3.76,0,0,0-2.49-.94,3.86,3.86,0,0,0-.58,0l-6,.95c-6.27,1-14.23,2.31-16.55,2.81l-1.55.35c-4.29,1-14.35,3.27-37.78,6.45a3,3,0,0,0-.5.1c-.85.24-4.89,1.55-11.42,3.68-5.34,1.74-11.9,3.87-13.78,4.44H124c-4.87.37-14.56,1.47-21.85,4.57,0-.48,0-1,0-1.41a6.27,6.27,0,0,0,2.13-2.09c1.06-1.92.44-3.56-1.24-8-.55-1.44-1.17-3.06-1.65-4.54v-.07a10.46,10.46,0,0,0,.85-7.29c-.07-.27-.14-.61-.22-1-.78-3.73-2.61-12.45-9.22-18.37a.46.46,0,0,0-.07-.07A26.69,26.69,0,0,0,76,3.74a28.48,28.48,0,0,0-9.7,1.71l-.26.1a24.38,24.38,0,0,0-4,2.25c-4.22,3-11.17,10-10.19,23.88,0,0,0,.09,0,.14.49,4.52,1.22,11.33,3.94,17.26a30.08,30.08,0,0,1,.58,4.68c-4.95,1.62-10.15,4.71-10.12,8.35,0,1.25-.48,6.6-.91,10-2.77,1.31-6.68,3.39-8.36,5.44-5.11,5.59-9.93,17.78-8.41,35.48-.57,1.82-1.7,5.45-3.05,10-2.16,7.2-5.12,17.42-7,25.21-.28,1.16-.54,2.27-.77,3.3-.67,2.58-1.75,8.61,2.07,11.16l.17.11c2.9,2,5.48,3.06,24.54,3.11h1.49c9.51,0,17.64-.22,23.57-.39,3.4-.09,6.08-.16,7.89-.17,3.8.95,8.64,2.14,11.13,2.66l.57.11a4,4,0,0,0,.69.07,3.75,3.75,0,0,0,3.61-4.71,11.51,11.51,0,0,0-.4,1.17,18.89,18.89,0,0,1-.93-3,1.86,1.86,0,0,0,.33,0l.7.05c.6,0,1,.07,1.39.13a3.35,3.35,0,0,0,.59.39c1.57,1.17,2.88,2,3.93,2.77.73.49,1.35.91,1.83,1.27l1.72,31.43a3.76,3.76,0,0,0,3.74,3.54,3.84,3.84,0,0,0,1.62-.37l3.26-1.58c0,3.27.17,6.81.37,10.59.67,12.35,2.28,26.86,2.91,32.06,1.58,1.59,23.47,15.61,26.72,17.29-3.65-2.2-8.84-5.29-12.27-7.5-4.41-2.83-6.15-3.93-10.23-6.81-.74-6.1-2.75-23.43-3.39-35.24-.3-5.57-.46-11.21-.35-16.37l-7.79,3.77-.85.41L104.59,162c-.2-.17-.43-.35-.68-.54l0,0c-1.3-1.11-3.39-2.31-6.64-4.73l-.29-.16-.11-.14c-.14-.11-.28-.2-.42-.32h0a12.71,12.71,0,0,0-3.62-.53l-1-.19-2.7-.53-1.38-.27a29.47,29.47,0,0,0,2.14,9.85l-.58-.11c-2.38-.5-7.3-1.71-11.34-2.72-5,0-17.3.6-33.41.56-19.41-.05-20.59-1.22-22.64-2.59s-.51-7.17-.51-7.17c.23-1,.49-2.14.77-3.3,1.81-7.52,4.68-17.46,7-25,1.54-5.14,2.8-9.17,3.25-10.61C30.7,95.64,35.84,84.33,39.86,80c1.62-2.16,8.92-5.31,8.92-5.31.51-3,1.25-10.93,1.25-12.62-.08-.88,3.87-4.16,10.22-5.49a38.1,38.1,0,0,0-.91-8.81c-2.49-5.29-3.22-11.6-3.74-16.36-.77-11,3.86-17.23,8.61-20.55A19.89,19.89,0,0,1,67.56,9c9.76-3.53,18.86-.08,22.74,3.22,6.39,5.73,7.63,14.68,8.29,17.46s-.51,4.92-.73,4.92-.29,1.17-.15,2.35c1.32,4.18,3.67,9.24,3.3,9.9a6.46,6.46,0,0,1-2.64,1.62,45.16,45.16,0,0,1-.72,11.18c4.92-6.35,22.73-8,26.63-8.31l.46,0c2.44-.68,23.77-7.73,25.53-8.21,26.7-3.62,36-6.07,39.61-6.85,2.28-.49,10.55-1.84,16.35-2.77l6-.95s-.11,3-.24,6.83c5-1.56,13.28-4.54,13.94-4.6s1.25-1.76,5.94,1.54c2.56,1.8,5.51,3.68,7.79,5.08l2.17,1.31c.79.46,1.35.78,1.56.87.81.37.15,1.47-2.2,2.2-.81.44-9.32-.66-10.57-1-.95-.29-5,4.11-5.57,4.41-.18.09-.62.37-1.27.66a9.5,9.5,0,0,1-7.54.07c-2.32-.85-3.2-1.65-4.52-2-.12,4-.21,7.53-.17,8.57-.49,0-3.42,0-6.59.11a74.28,74.28,0,0,1-7.89-.11c-2.9.36-34.64,11.29-42.66,13.53-.65.18-1.14.3-1.45.36-5.12,3.32-19.13,12.08-25.64,16.67A50.06,50.06,0,0,0,130,93.24c.45.23.88.47,1.29.71,1.76,1.45,3.5,2.39,4.08,3.5a2.14,2.14,0,0,0,.25,1,.87.87,0,0,0,.37.58,2.67,2.67,0,0,0,.54.52l.08,0,.21.1c.28.14.65.36,1.08.62,1.64,1,3.43,2.11,5.2,3.36l20.25-15.28s.21,4,.21,10.59l5.3-3.36c7.92-5,16.21-10.08,22-12.73,8-3.67,29.94-13.21,31.7-13.94s11.3-6.16,15.62-7.49c3.34-1,14.66-4.43,27.53-8.13L270.36,52l4.36-1.23,2.73-.76c3.52-.81,24.73-9.1,29.79-12.91s6.6-4.7,19.44-23.85c.66-1.1,2.05-4.1,4.62-.07s3.82,10.86,2.86,18.93c-.48,3.54-2.22,7.61-12.28,14.43l-1.8,1.2c-1.76,1.17-5,3.66-4.92,7.7.22,3.37.88,10.86-7.55,9.1-2.35-.59-6.31-1.62-14.31.8-5.72,1.69-9.46,2.79-11.08,8.07.08,1.25-.58,2.5-.07,4.4-.45.24-2.33,1.1-5.12,2.44-1.28.62-2.76,1.34-4.37,2.14-2.76,1.38-5.94,3-9.31,4.86l-.48.27c-3.49,1.91-7.14,4-10.73,6.29-13.72,8.65-51.06,30.74-75.41,61.55-2.79,5.14-21.28,40.64-25.83,91.26-.07.08-.2,5.21-.27,5.28l-.2.11c-2.81,1.68-5.68,3.28-8.59,4.93,1.28-.46,8.1-4.65,12.66-7.37,0-.9.08-2,.1-2.4l0-.21c4.35-48.43,21.44-82.48,25.23-89.53C202.05,129.53,235,109,250.78,99.12L254.14,97c3.15-2,6.7-4.06,10.53-6.17l.47-.26c2.92-1.6,6-3.21,9.19-4.8,1.6-.79,3.06-1.51,4.32-2.11L282.11,82c.93-.43,1.54-.73,1.78-.85a3.74,3.74,0,0,0,1.87-4.29,3.27,3.27,0,0,1,0-1.45c.06-.39.13-.85.16-1.36,1-2.8,3-3.5,8.42-5.1a27.78,27.78,0,0,1,7.94-1.38,16.13,16.13,0,0,1,4.38.62l.14,0a15,15,0,0,0,3.09.34h0a8.55,8.55,0,0,0,6.51-2.6c3-3.16,2.64-8,2.47-10.55v-.09c0-1.54,1.07-3,3.21-4.42L324,49.68c10.57-7.18,13.2-12,13.9-17.09C338.89,24,337.65,16.22,334.46,11.21Z" />
    </g>
  </svg>
);

// Logo Oficial con texto. Refactorizado para no anidar SVGs.
// Logo Oficial con texto - Estilo TuDoJang
export const IconoLogoOficialConTexto: React.FC<IconoProps> = (props) => (
  <svg {...props} viewBox="0 0 180 50" xmlns="http://www.w3.org/2000/svg">
    <g transform="scale(0.12) translate(0, 0)">
      <IconoLogoOficial width="400" height="400" />
    </g>
    <text x="65" y="22" fontFamily="Inter, sans-serif" fontSize="20" fill="currentColor" fontWeight="900" style={{ letterSpacing: '-0.02em' }}>TuDoJang</text>
    <text x="65" y="40" fontFamily="Inter, sans-serif" fontSize="10" fill="currentColor" fontWeight="700" className="opacity-50 uppercase tracking-[0.2em]">Gestión Maestro</text>
  </svg>
);


// --- Iconos de Navegación y UI ---
export const IconoDashboard: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20V16" /></BaseIcon>);
export const IconoEstudiantes: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></BaseIcon>);
export const IconoTienda: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M6 2l1.5 4.5h9L18 2" /><path d="M3 6h18v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6z" /><path d="M16 11v6a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-6" /></BaseIcon>);
export const IconoEventos: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></BaseIcon>);
export const IconoCampana: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></BaseIcon>);
export const IconoConfiguracion: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></BaseIcon>);
export const IconoCerrar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></BaseIcon>);
export const IconoMenu: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></BaseIcon>);
export const IconoLogout: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></BaseIcon>);
export const IconoLuna: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></BaseIcon>);
export const IconoSol: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></BaseIcon>);
export const IconoFlechaArriba: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M12 19V5" /><polyline points="5 12 12 5 19 12" /></BaseIcon>);
export const IconoCasa: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></BaseIcon>);
export const IconoBuscar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></BaseIcon>);


// --- Iconos Adicionales ---
export const IconoAgregar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></BaseIcon>);
export const IconoAprobar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><polyline points="20 6 9 17 4 12" /></BaseIcon>);
export const IconoCandado: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></BaseIcon>);
export const IconoCarritoAgregar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /><line x1="12" y1="5" x2="12" y2="13" /><line x1="8" y1="9" x2="16" y2="9" /></BaseIcon>);
// Added comment above fix: Export IconoCertificado as it is being imported in several views.
export const IconoCertificado: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" /></BaseIcon>);
export const IconoCompartir: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></BaseIcon>);
export const IconoContrato: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></BaseIcon>);
export const IconoCopiar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></BaseIcon>);
export const IconoEditar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></BaseIcon>);
export const IconoEliminar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></BaseIcon>);
export const IconoEmail: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></BaseIcon>);
export const IconoEnlace: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.71" /></BaseIcon>);
export const IconoEnviar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></BaseIcon>);
export const IconoExportar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></BaseIcon>);
export const IconoFacebook: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></BaseIcon>);
export const IconoFirma: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></BaseIcon>);
export const IconoGuardar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></BaseIcon>);
export const IconoHistorial: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></BaseIcon>);
export const IconoImagen: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></BaseIcon>);
export const IconoInformacion: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></BaseIcon>);
export const IconoAlertaTriangulo: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></BaseIcon>);
export const IconoLinkedIn: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></BaseIcon>);
export const IconoLogin: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></BaseIcon>);
export const IconoOjoAbierto: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></BaseIcon>);
export const IconoOjoCerrado: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></BaseIcon>);
export const IconoRechazar: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></BaseIcon>);
export const IconoUsuario: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></BaseIcon>);
export const IconoWhatsApp: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></BaseIcon>);
export const IconoXTwitter: React.FC<IconoProps> = (props) => (<BaseIcon {...props}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></BaseIcon>);

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
