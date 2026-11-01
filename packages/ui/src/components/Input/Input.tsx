import { useId } from 'react';
import styles from './Input.module.css';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> &
  React.RefAttributes<HTMLInputElement> & {
    label?: string;
  };

export function Input({ label, id, ref, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  if (label) {
    return (
      <div>
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
        <input id={inputId} ref={ref} className={styles.input} {...props} />
      </div>
    );
  }

  return <input id={inputId} ref={ref} className={styles.input} {...props} />;
}
