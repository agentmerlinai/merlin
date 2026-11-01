import { AgentCard, Badge } from '@merlin/ui';

export const agentCardShowcase = {
  id: 'agent-card',
  title: 'AgentCard',
  description: 'A compact trace of an agent run: role, steps, and the result that follows.',
  render: () => (
    <AgentCard>
      <AgentCard.Header
        title="Merlin"
        status={<Badge variant="success" dot>live</Badge>}
      />
      <AgentCard.Body>
        <AgentCard.Note>Reading the launch plan and checking access.</AgentCard.Note>
        <AgentCard.Steps>
          <AgentCard.Step status="done" meta="0.8s">read · launch-plan.docx</AgentCard.Step>
          <AgentCard.Step status="active" meta="now">check · team access</AgentCard.Step>
          <AgentCard.Step status="pending">draft · rollout</AgentCard.Step>
        </AgentCard.Steps>
      </AgentCard.Body>
      <AgentCard.Footer>
        <Badge variant="primary">rev 4</Badge>
      </AgentCard.Footer>
    </AgentCard>
  ),
};
