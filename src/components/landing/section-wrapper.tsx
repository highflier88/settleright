import { cn } from '@/lib/utils';

interface SectionWrapperProps {
  id?: string;
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  background?: 'default' | 'muted';
}

export function SectionWrapper({
  id,
  children,
  className,
  containerClassName,
  background = 'default',
}: SectionWrapperProps) {
  return (
    <section
      id={id}
      className={cn(
        'scroll-mt-20 py-16 md:py-24',
        background === 'muted' && 'bg-muted/50',
        className
      )}
    >
      <div className={cn('container', containerClassName)}>{children}</div>
    </section>
  );
}
