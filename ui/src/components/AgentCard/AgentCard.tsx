import styles from './AgentCard.module.css';

export type AgentCardProps = React.HTMLAttributes<HTMLDivElement>;

export type AgentCardHeaderProps = {
  icon?: React.ReactNode;
  title: string;
  status?: React.ReactNode;
};

export type AgentCardStepProps = React.LiHTMLAttributes<HTMLLIElement> & {
  status: 'done' | 'active' | 'pending';
  meta?: string;
  children: React.ReactNode;
};

function AgentCardRoot({ children, className, ...props }: AgentCardProps) {
  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </div>
  );
}

function Header({ icon, title, status }: AgentCardHeaderProps) {
  return (
    <div className={styles.header}>
      {icon && <div className={styles.icon}>{icon}</div>}
      <span className={styles.title}>{title}</span>
      {status && <div className={styles.status}>{status}</div>}
    </div>
  );
}

function Body({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={[styles.body, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </div>
  );
}

function Note({ children, className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={[styles.note, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </p>
  );
}

function Steps({ children, className, ...props }: React.OlHTMLAttributes<HTMLOListElement>) {
  return (
    <ol className={[styles.steps, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </ol>
  );
}

const stepDotClass: Record<AgentCardStepProps['status'], string> = {
  done: styles.stepDone,
  active: styles.stepActive,
  pending: styles.stepPending,
};

function Step({ status, meta, children, ...props }: AgentCardStepProps) {
  return (
    <li {...props}>
      <span className={[styles.stepDot, stepDotClass[status]].join(' ')} aria-hidden />
      {children}
      {meta && <span className={styles.stepMeta}>{meta}</span>}
    </li>
  );
}

function Footer({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={[styles.footer, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </div>
  );
}

export const AgentCard = Object.assign(AgentCardRoot, {
  Header,
  Body,
  Note,
  Steps,
  Step,
  Footer,
});
