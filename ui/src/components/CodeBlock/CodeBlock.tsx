import styles from './CodeBlock.module.css';

export type CodeBlockProps = {
  children: React.ReactNode;
  className?: string;
};

export type CodeTokenProps = {
  token: 'kw' | 'str' | 'fn' | 'cm';
  children: React.ReactNode;
};

export function CodeBlock({ children, className }: CodeBlockProps) {
  return <pre className={`${styles.root}${className ? ` ${className}` : ''}`}>{children}</pre>;
}

export function CodeToken({ token, children }: CodeTokenProps) {
  return <span className={styles[token]}>{children}</span>;
}
