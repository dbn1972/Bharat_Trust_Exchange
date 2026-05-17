import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  loading?: boolean;
}

const variantClasses: Record<string, string> = {
  primary:   'bg-blue-700 text-white hover:bg-blue-800 focus-visible:ring-4 focus-visible:ring-blue-300',
  secondary: 'bg-green-600 text-white hover:bg-green-700 focus-visible:ring-4 focus-visible:ring-green-300',
  ghost:     'bg-transparent text-gray-700 border border-gray-200 hover:bg-gray-50 focus-visible:ring-4 focus-visible:ring-blue-300',
  danger:    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-4 focus-visible:ring-red-300',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}) => {
  const sizeClasses = size === 'md' ? 'h-10 px-4 text-sm' : 'h-8 px-3 text-xs';
  return (
    <button
      className={`inline-flex items-center justify-center font-semibold rounded-md transition-colors
        ${sizeClasses} ${variantClasses[variant]} disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        <span className="mr-2 inline-block animate-spin" aria-hidden="true">⟳</span>
      )}
      {children}
    </button>
  );
};
