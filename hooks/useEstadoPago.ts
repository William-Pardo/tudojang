import { EstadoPago } from '../tipos';

export interface EstadoPagoPresentation {
  label: string;
  color: string;
}

const presentations: Record<string, EstadoPagoPresentation> = {
  [EstadoPago.AlDia]: {
    label: EstadoPago.AlDia,
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  },
  paid: {
    label: 'Paid',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  },
  [EstadoPago.Pendiente]: {
    label: EstadoPago.Pendiente,
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  },
  pending: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  },
  [EstadoPago.Vencido]: {
    label: EstadoPago.Vencido,
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  },
  overdue: {
    label: 'Overdue',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  },
};

const fallbackColor = 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';

export const useEstadoPago = (status: string): EstadoPagoPresentation =>
  presentations[status] ?? {
    label: status || 'Sin estado',
    color: fallbackColor,
  };
