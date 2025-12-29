import { Shield } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const Logo = ({ size = 'md', showText = true, className = '' }: LogoProps) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`${sizeClasses[size]} rounded-xl teal-gradient-bg flex items-center justify-center shadow-teal`}>
        <Shield className="text-primary-foreground" size={size === 'sm' ? 18 : size === 'md' ? 22 : 28} />
      </div>
      {showText && (
        <span className={`font-bold ${textSizeClasses[size]} text-foreground tracking-tight`}>
          Nova<span className="text-primary">Insurance</span>
        </span>
      )}
    </div>
  );
};

export default Logo;
