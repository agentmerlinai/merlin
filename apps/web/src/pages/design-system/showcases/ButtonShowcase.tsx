import { Button } from '@merlin/ui';

export const buttonShowcase = {
  id: 'button',
  title: 'Button',
  description: 'One action per button. Variants carry intent; sizes carry hierarchy.',
  render: () => (
    <div className="ds-stack">
      <div className="ds-row">
        <Button>Primary</Button>
        <Button variant="accent">Accent</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </div>
      <div className="ds-row ds-row--baseline">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
        <Button disabled>Disabled</Button>
      </div>
      <div className="ds-row">
        <Button asChild variant="outline">
          <a href="#components">Button as a link</a>
        </Button>
      </div>
    </div>
  ),
};
