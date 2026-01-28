// components/BotonVolverArriba.tsx
// Un botón flotante para volver al inicio de la página.

import React, { useState, useEffect, RefObject } from 'react';
import { IconoFlechaArriba } from './Iconos';

interface Props {
  scrollContainerRef: RefObject<HTMLDivElement>;
}

const BotonVolverArriba: React.FC<Props> = ({ scrollContainerRef }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const toggleVisibility = () => {
      if (container.scrollTop > 300) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    container.addEventListener('scroll', toggleVisibility);

    return () => container.removeEventListener('scroll', toggleVisibility);
  }, [scrollContainerRef]);

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <button
      onClick={scrollToTop}
      aria-label="Volver arriba"
      className={`fixed bottom-8 right-8 z-50 p-3 rounded-full bg-tkd-red text-white shadow-lg transition-all duration-300 ease-in-out hover:bg-red-700 hover:scale-110 active:scale-100
      ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
    >
      <IconoFlechaArriba className="w-6 h-6" />
    </button>
  );
};

export default BotonVolverArriba;
