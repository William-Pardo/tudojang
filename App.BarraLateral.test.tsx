// App.BarraLateral.test.tsx
//
// Cobertura del acordeon mobile del drawer (BarraLateral en App.tsx). Hasta este commit,
// TODO este comportamiento se habia verificado a mano con Playwright contra el dev server
// real (ver sesion de trabajo "menu mobile acordeon") -- cero tests automatizados cubrian la
// logica de React en si. Cada test de abajo corresponde a un bug real encontrado y corregido
// durante esa verificacion manual; el comentario de cada `it` referencia el sintoma reportado.
//
// TDD red-green-refactor real (no retroactivo-de-nombre): antes de dejar cada test en verde
// se confirmo que fallaba revirtiendo a mano el fix correspondiente en App.tsx y corriendo
// `npx jest App.BarraLateral.test.tsx` -- ver el mensaje de commit para el detalle de que
// fallo cada uno en rojo.
import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import * as ReactRouterDOM from 'react-router-dom';
import { BarraLateral } from './App';
import { RolUsuario, type Usuario } from './tipos';

jest.mock('./components/LogoDinamico', () => () => <div data-testid="logo" />);

let mockConfigClub: any = { esDemoComercial: false };
let mockEventos: any[] = [];
let mockJornadaActiva: any = null;
let mockJornadasEnVentana: any[] = [];

jest.mock('./context/DataContext', () => ({
  useConfiguracion: () => ({ configClub: mockConfigClub }),
  useEventos: () => ({ eventos: mockEventos }),
}));

jest.mock('./hooks/useVentanaClaseEnVivo', () => ({
  useVentanaClaseEnVivo: () => ({ jornadaActiva: mockJornadaActiva, jornadasEnVentana: mockJornadasEnVentana }),
}));

const usuarioAdmin: Usuario = {
  id: 'admin-1', email: 'admin@test.com', rol: RolUsuario.Admin, tenantId: 'tenant-1',
} as Usuario;

// Boton oculto que navega con el mismo useNavigate() real que usaria un <Link> -- para poder
// simular, DENTRO del mismo arbol de react-router, el paso "el usuario toco un link y navego
// a otra ruta" sin depender de clickear el Link real (que ademas cierra el drawer).
function BotonDeNavegacionDePrueba({ ruta }: { ruta: string }) {
  const navigate = ReactRouterDOM.useNavigate();
  return <button data-testid={`navegar-a:${ruta}`} onClick={() => navigate(ruta)} />;
}

function Arnes({ rutaInicial, estaAbierta, usuario = usuarioAdmin, onCerrar = jest.fn() }: {
  rutaInicial: string; estaAbierta: boolean; usuario?: Usuario; onCerrar?: () => void;
}) {
  return (
    <ReactRouterDOM.MemoryRouter initialEntries={[rutaInicial]}>
      <BotonDeNavegacionDePrueba ruta="/notificaciones" />
      <BotonDeNavegacionDePrueba ruta="/tienda" />
      <BarraLateral estaAbierta={estaAbierta} onCerrar={onCerrar} onLogout={jest.fn()} usuario={usuario} />
    </ReactRouterDOM.MemoryRouter>
  );
}

// getButtonStyle decide desktop-vs-mobile leyendo `window.innerWidth` real, independiente de
// cual <nav> (hidden md:block / md:hidden) se este consultando -- en un navegador real ambos
// mecanismos coinciden porque miden el mismo ancho, pero JSDOM simula 1024px por defecto, asi
// que sin esto CUALQUIER boton (aunque este en la rama md:hidden) recibe las clases de
// escritorio. Se fuerza un ancho de celular para que el test refleje lo que ve un usuario real.
beforeAll(() => {
  Object.defineProperty(window, 'innerWidth', { value: 375, writable: true, configurable: true });
});

// El drawer renderiza DOS <nav> (desktop oculto por CSS + mobile) -- JSDOM no aplica media
// queries, asi que ambos existen en el arbol de accesibilidad. Los enlaces sin submenu (leaf)
// se repiten en los dos, asi que hay que acotar la busqueda al <nav> mobile especificamente.
function withinNavMobile() {
  const navs = screen.getAllByRole('navigation');
  const navMobile = navs.find((n) => n.className.includes('md:hidden'));
  if (!navMobile) throw new Error('No se encontro el <nav> mobile (md:hidden)');
  return within(navMobile);
}

beforeEach(() => {
  mockConfigClub = { esDemoComercial: false };
  mockEventos = [];
  mockJornadaActiva = null;
  mockJornadasEnVentana = [];
});

describe('BarraLateral -- auto-expandir/colapsar al abrir el drawer', () => {
  it('auto-expande el panel cuyo enlace coincide con la ruta actual al abrir', () => {
    render(<Arnes rutaInicial="/configuracion?tab=licencia" estaAbierta={true} />);
    expect(screen.getByRole('button', { name: /Configuraci[oó]n/i })).toHaveAttribute('aria-expanded', 'true');
  });

  it('NO expande ningun panel si la ruta actual es un leaf sin submenu', () => {
    render(<Arnes rutaInicial="/tienda" estaAbierta={true} />);
    // "Tienda" es un leaf (sin hijos) -- no debe existir ningun boton con aria-expanded=true.
    const botonesExpandidos = screen.queryAllByRole('button', { expanded: true });
    expect(botonesExpandidos).toHaveLength(0);
  });

  it('BUG REAL (reportado en vivo): colapsa un panel que quedo expandido de una apertura anterior al navegar a un leaf y reabrir', () => {
    const { rerender } = render(<Arnes rutaInicial="/configuracion?tab=licencia" estaAbierta={true} />);
    expect(screen.getByRole('button', { name: /Configuraci[oó]n/i })).toHaveAttribute('aria-expanded', 'true');

    // Navega a una ruta SIN submenu (mismo useNavigate real que dispararia un <Link>).
    fireEvent.click(screen.getByTestId('navegar-a:/notificaciones'));
    // Cerrar y reabrir el drawer (asi es como el usuario real dispara esto: onCerrar tras
    // tocar el link, despues vuelve a tocar el hamburguesa).
    rerender(<Arnes rutaInicial="/configuracion?tab=licencia" estaAbierta={false} />);
    rerender(<Arnes rutaInicial="/configuracion?tab=licencia" estaAbierta={true} />);

    expect(screen.getByRole('button', { name: /Configuraci[oó]n/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('BUG REAL (reportado en vivo): el boton ya no queda resaltado tras navegar a un leaf con un panel viejo expandido', () => {
    const { rerender } = render(<Arnes rutaInicial="/configuracion?tab=licencia" estaAbierta={true} />);
    fireEvent.click(screen.getByTestId('navegar-a:/notificaciones'));
    rerender(<Arnes rutaInicial="/configuracion?tab=licencia" estaAbierta={false} />);
    rerender(<Arnes rutaInicial="/configuracion?tab=licencia" estaAbierta={true} />);

    const botonConfig = screen.getByRole('button', { name: /Configuraci[oó]n/i });
    expect(botonConfig.className).not.toMatch(/bg-white\/20/);
  });
});

describe('BarraLateral -- resaltado por expansion (no solo por ruta activa)', () => {
  it('un boton con hijos se resalta apenas se expande, sin haber navegado a ninguno de sus subitems', () => {
    render(<Arnes rutaInicial="/tienda" estaAbierta={true} />);
    const botonEstudiantes = screen.getByRole('button', { name: /Estudiantes/i });
    expect(botonEstudiantes.className).not.toMatch(/bg-white\/20/);

    fireEvent.click(botonEstudiantes);

    expect(botonEstudiantes).toHaveAttribute('aria-expanded', 'true');
    expect(botonEstudiantes.className).toMatch(/bg-white\/20/);
  });
});

describe('BarraLateral -- un solo panel expandido a la vez', () => {
  it('expandir un segundo panel colapsa el primero', () => {
    render(<Arnes rutaInicial="/tienda" estaAbierta={true} />);
    const botonAdmin = screen.getByRole('button', { name: /Administraci[oó]n/i });
    const botonEstudiantes = screen.getByRole('button', { name: /Estudiantes/i });

    fireEvent.click(botonAdmin);
    expect(botonAdmin).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(botonEstudiantes);
    expect(botonEstudiantes).toHaveAttribute('aria-expanded', 'true');
    expect(botonAdmin).toHaveAttribute('aria-expanded', 'false');
  });

  it('tocar el mismo boton expandido lo colapsa (toggle manual)', () => {
    render(<Arnes rutaInicial="/tienda" estaAbierta={true} />);
    const botonAdmin = screen.getByRole('button', { name: /Administraci[oó]n/i });

    fireEvent.click(botonAdmin);
    expect(botonAdmin).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(botonAdmin);
    expect(botonAdmin).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('BarraLateral -- scroll al subitem activo (no al inicio del panel)', () => {
  const llamadas: string[] = [];

  beforeAll(() => {
    // jsdom no implementa scrollIntoView -- se stubea para capturar SOBRE QUE elemento se
    // invoco (el texto de cada link/boton alcanza para identificarlo sin exponer refs).
    (Element.prototype as any).scrollIntoView = function (this: HTMLElement) {
      llamadas.push(this.textContent?.trim() ?? '');
    };
  });

  beforeEach(() => {
    llamadas.length = 0;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('BUG REAL (reportado en vivo, "Alertas"/"Licencia" quedaban tapadas): prioriza el subitem activo sobre el inicio del panel', () => {
    render(<Arnes rutaInicial="/configuracion?tab=licencia" estaAbierta={true} />);

    // El setTimeout interno del efecto de scroll usa 210ms de delay.
    act(() => { jest.advanceTimersByTime(220); });

    expect(llamadas.length).toBeGreaterThan(0);
    const ultimoScroll = llamadas[llamadas.length - 1];
    expect(ultimoScroll).toMatch(/Licencia/i);
    // Si el bug reapareciera, esto scrollearia al boton "Configuración" (inicio del panel)
    // en vez del subitem -- falla explicita para que el mensaje de error sea legible.
    expect(ultimoScroll).not.toMatch(/^Configuraci[oó]n/i);
  });

  it('sin subitem activo (solo expansion manual), scrollea el panel -- no rompe con un fallback razonable', () => {
    render(<Arnes rutaInicial="/tienda" estaAbierta={true} />);
    fireEvent.click(screen.getByRole('button', { name: /Estudiantes/i }));
    act(() => { jest.advanceTimersByTime(220); });

    expect(llamadas.length).toBeGreaterThan(0);
    expect(llamadas[llamadas.length - 1]).toMatch(/Estudiantes/i);
  });

  it('BUG REAL (reportado en vivo): reabrir el drawer con el MISMO panel ya expandido de antes vuelve a scrollear al subitem activo', () => {
    // Este es el caso puntual que goto el bug: panelExpandido no cambia de valor entre el
    // cierre y la reapertura (sigue siendo 'configuracion' las dos veces), asi que un efecto
    // atado solo a [panelExpandido] no se vuelve a disparar. Se fuerza pasando por una
    // apertura previa antes de la que se mide.
    const { rerender } = render(<Arnes rutaInicial="/configuracion?tab=licencia" estaAbierta={true} />);
    act(() => { jest.advanceTimersByTime(220); });
    llamadas.length = 0; // limpiar el scroll de la primera apertura, solo importa el de la segunda

    rerender(<Arnes rutaInicial="/configuracion?tab=licencia" estaAbierta={false} />);
    rerender(<Arnes rutaInicial="/configuracion?tab=licencia" estaAbierta={true} />);
    act(() => { jest.advanceTimersByTime(220); });

    expect(llamadas.length).toBeGreaterThan(0);
    expect(llamadas[llamadas.length - 1]).toMatch(/Licencia/i);
  });
});

describe('BarraLateral -- leaves sin submenu', () => {
  it('un enlace sin hijos se renderiza como link plano, sin chevron ni aria-expanded', () => {
    render(<Arnes rutaInicial="/tienda" estaAbierta={true} />);
    // Acotado al nav mobile: "Tienda" tambien existe en el nav desktop (oculto por CSS, pero
    // presente en el DOM que ve JSDOM), y ahi seria ambiguo.
    const linkTienda = withinNavMobile().getByRole('link', { name: /Tienda/i });
    expect(linkTienda).not.toHaveAttribute('aria-expanded');
  });
});
