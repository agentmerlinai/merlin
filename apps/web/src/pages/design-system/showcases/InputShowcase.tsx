import { Input } from '@merlin/ui';

export const inputShowcase = {
  id: 'input',
  title: 'Input',
  description: 'A labelled field with a visible focus ring. The label is part of the component.',
  render: () => (
    <div className="ds-form">
      <Input label="Workspace name" placeholder="Acme research" />
      <Input label="Repository" defaultValue="acme/merlin-ops" />
      <Input label="Disabled" defaultValue="read only" disabled />
    </div>
  ),
};
