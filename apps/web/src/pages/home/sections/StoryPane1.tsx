import { vars } from '../../../components/vars';
import { Icon } from '../../../components/Icon';

export function StoryPane1() {
  return (
    <div className="story-pane" data-pane={1}>
      <div className="collab-chrome">
        <Icon name="icon-chat-circle" className="icon" />
        <span className="collab-name">Merlin</span>
      </div>
      <div className="pane-body surface-well chat">
        <div className="chat-turn chat-turn--human">
          <span className="chat-who presence presence--human"><Icon name="icon-user" className="icon" />Maya</span>
          <p className="chat-text">Plan the Tuesday launch.</p>
        </div>
        <div className="chat-turn chat-turn--agent">
          <span className="chat-who chat-who--agent presence presence--merlin"><Icon name="icon-robot" className="icon" />Merlin</span>
          {/* The trace names what the agent did; the plan below is the
         result. `read` is the chip this ledger replaced, so the tool
         is stated once. */}
          <div className="chat-steps collab-line--merlin">
            <ol className="chat-flow">
              <li className="chat-step chat-step--read">
                <Icon name="icon-check-circle" className="icon" />
                <span className="chat-step-name">read · launch-plan.docx</span>
              </li>
              <li className="chat-step chat-step--check">
                <Icon name="icon-check-circle" className="icon" />
                <span className="chat-step-name">check · team access</span>
                <Icon name="icon-arrow-clockwise" className="icon chat-step-retry" />
              </li>
              <li className="chat-step chat-step--draft">
                <Icon name="icon-check-circle" className="icon" />
                <span className="chat-step-name">draft · rollout</span>
              </li>
            </ol>
            <div className="chat-working">
              <Icon name="icon-arrow-clockwise" className="icon" />
              <span>working…</span>
            </div>
          </div>
          {/* The answer is the artifact the agent produced, and the
         artifact is the document the next surface becomes: a page at
         chat scale, not a summary of it. This copy is the hidden
         slot — it reserves the card's height and gives the carrier
         an exact station; the carrier's face draws the same card. */}
          {/* The head says what the card is and what its reader can do
         with it: a generated document, editable and downloadable. The
         marks are decorative — this stage only flies, it takes no
         input. */}
          <div className="chat-artifact surface-plate" data-anchor="1">
            <div className="artifact-head">
              <Icon name="icon-file-text" className="icon artifact-mark" />
              <p className="artifact-title">Tuesday launch</p>
              <span className="artifact-actions">
                <Icon name="icon-pencil-simple" className="icon" />
                <Icon name="icon-download-simple" className="icon" />
              </span>
            </div>
            <span className="artifact-line"><span className="artifact-num">1</span>Provision the VM</span>
            <span className="artifact-line"><span className="artifact-num">2</span>Verify access</span>
            <span className="artifact-line"><span className="artifact-num">3</span>Dry run at 09:00</span>
          </div>
        </div>
        <div className="chat-composer">
          <span className="chat-composer-hint chat-composer-hint--rest"><span className="chat-caret" />Ask for a change…</span>
          <span className="chat-composer-hint chat-composer-hint--empty"><span className="chat-caret" />Ask anything…</span>
          <span className="chat-prompt" style={vars({'--n': 24})}><span className="chat-prompt-clip">Plan the Tuesday launch.</span><span className="chat-caret" /></span>
        </div>
      </div>
    </div>
  );
}
