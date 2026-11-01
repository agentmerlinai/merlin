import { Badge } from '@merlin/ui';

export const badgeShowcase = {
  id: 'badge',
  title: 'Badge',
  description: 'Small status labels. The dot adds a live marker without another icon.',
  render: () => (
    <div className="ds-row">
      <Badge>Primary</Badge>
      <Badge variant="accent" dot>Accent</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="error">Error</Badge>
    </div>
  ),
};
