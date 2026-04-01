// @ts-nocheck
import { ReactNode } from 'react';

type Props = {
  title: string;
  description?: string;
  subnav?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
};

export function ModulePageShell({ title, description, subnav, children, actions }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          {description && <p className="page-subtitle">{description}</p>}
        </div>
        {actions && <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>{actions}</div>}
      </div>
      {subnav && <div className="view-tabs" style={{ marginBottom: 0 }}>{subnav}</div>}
      {children}
    </div>
  );
}
