// components/skeletons/TablaEstudiantesSkeleton.tsx
import React from 'react';

const SkeletonRow: React.FC = () => (
    <tr className="animate-pulse">
        <td className="px-6 py-4 whitespace-nowrap">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mt-2"></div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20"></div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
            <div className="flex space-x-3">
                <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right space-x-1">
            <div className="flex justify-end space-x-2">
                <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            </div>
        </td>
    </tr>
);

export const TablaEstudiantesSkeleton: React.FC = () => {
    const headers = ["Nombre", "Grupo", "Estado de Pago", "Documentos", "Acciones"];
    
    return (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                        {headers.map((header, index) => (
                             <th key={header} className={`px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${index === headers.length - 1 ? 'text-right' : 'text-left'}`}>
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
                </tbody>
            </table>
        </div>
    );
};
