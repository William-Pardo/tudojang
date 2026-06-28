import React from 'react';

export interface ClientItemData {
  id?: string;
  nombre?: string;
  email?: string;
  fotoUrl?: string;
  activo?: boolean;
}

interface ClientItemProps {
  cliente?: ClientItemData | null;
  onVerDetalle?: (id: string) => void;
}

const ClientItem: React.FC<ClientItemProps> = ({ cliente, onVerDetalle }) => {
  const id = cliente?.id ?? '';
  const nombre = cliente?.nombre?.trim() || 'Cliente sin nombre';
  const email = cliente?.email?.trim() || 'Sin correo registrado';
  const fotoUrl = cliente?.fotoUrl?.trim();
  const activo = cliente?.activo === true;

  return (
    <article
      role="listitem"
      className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      {fotoUrl ? (
        <img
          src={fotoUrl}
          alt={`Foto de ${nombre}`}
          className="h-12 w-12 rounded-full object-cover"
        />
      ) : (
        <div
          aria-label={`Avatar de ${nombre}`}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-200"
        >
          {nombre.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <h3 className="truncate font-bold text-gray-900 dark:text-white">{nombre}</h3>
        <p className="truncate text-sm text-gray-500 dark:text-gray-400">{email}</p>
      </div>

      <span
        className={`rounded-full px-2 py-1 text-xs font-semibold ${
          activo
            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
        }`}
      >
        {activo ? 'Activo' : 'Inactivo'}
      </span>

      <button
        type="button"
        onClick={() => onVerDetalle?.(id)}
        className="rounded-lg bg-tkd-blue px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
      >
        Ver detalle
      </button>
    </article>
  );
};

export default ClientItem;
