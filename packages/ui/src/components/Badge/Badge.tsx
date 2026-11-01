import styles from './Badge.module.css';

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'primary' | 'accent' | 'error' | 'warning' | 'success';
  dot?: boolean;
};

export function Badge({ variant = 'primary', dot, className, children, ...props }: BadgeProps) {
  const variantClass = styles[variant];
  const rootClass = [styles.root, variantClass, className].filter(Boolean).join(' ');

  return (
    <span className={rootClass} {...props}>
      {dot && <span className={styles.dot} aria-hidden />}
      {children}
    </span>
  );
}
