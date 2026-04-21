import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';
import styles from './Button.module.css';

const button = cva(styles.root, {
  variants: {
    variant: {
      primary: styles.primary,
      accent: styles.accent,
      outline: styles.outline,
      ghost: styles.ghost,
      danger: styles.danger,
    },
    size: {
      sm: styles.sm,
      md: styles.md,
      lg: styles.lg,
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & {
    asChild?: boolean;
  };

export function Button({ variant, size, asChild, className, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={button({ variant, size, className })} {...props} />;
}
