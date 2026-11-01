import { vars } from '../../../components/vars';
import { Icon } from '../../../components/Icon';

export function StoryPane2() {
  return (
    <div className="story-pane" data-pane={2}>
      {/* The doc surface wears an editor, not a file name: the reader is past
          which file this is (the card's head named it) and is now watching two
          people edit it. The controls are generic so the bar reads as "a
          document editor" first; the presence pair is the same Maya and Merlin
          who hold the carets below, so the bar and the page agree on who is
          here. Decorative: the stage takes no input. */}
      <div className="collab-chrome doc-bar">
        <span className="doc-bar-group">
          <Icon name="icon-arrow-u-up-left" className="icon" />
          <Icon name="icon-arrow-u-up-right" className="icon" />
        </span>
        <span className="doc-bar-sep" />
        <span className="doc-bar-style">Normal text<Icon name="icon-caret-down" className="icon" /></span>
        <span className="doc-bar-sep" />
        <span className="doc-bar-group">
          <Icon name="icon-text-b" className="icon" />
          <Icon name="icon-text-italic" className="icon" />
          <Icon name="icon-text-underline" className="icon" />
          <Icon name="icon-list-numbers" className="icon" />
        </span>
        <span className="doc-bar-presence">
          <span className="doc-presence doc-presence--human presence presence--human"><Icon name="icon-user" className="icon" /></span>
          <span className="doc-presence doc-presence--merlin presence presence--merlin"><Icon name="icon-robot" className="icon" /></span>
        </span>
      </div>
      <div className="pane-body surface-well collab-body--doc">
        <div className="collab-paper surface-plate" data-anchor="2" data-arrive="1">
          {/* The card's head carries over: it is the same document, so the
              reader keeps the mark, the title and the two actions while the
              page grows around them. */}
          <div className="artifact-head">
            <Icon name="icon-file-text" className="icon artifact-mark" />
            <p className="artifact-title">Tuesday launch</p>
            <span className="artifact-actions">
              <Icon name="icon-pencil-simple" className="icon" />
              <Icon name="icon-download-simple" className="icon" />
            </span>
          </div>
          <div className="collab-lines">
            <p className="collab-line"><span className="collab-num">1</span><span className="collab-text">Provision the VM.</span></p>
            <p className="collab-line collab-line--human"><span className="collab-num">2</span><span className="collab-text"><span className="collab-sel">Verify team access</span> <span className="collab-ins" style={vars({'--n': 8})}>and MFA.</span></span><span className="collab-caret collab-caret--maya"><span className="collab-pointer-name collab-caret-name presence presence--human"><Icon name="icon-user" className="icon" />Maya</span></span></p>
            <p className="collab-line collab-line--merlin"><span className="collab-num">3</span><span className="collab-text"><span className="collab-sel">Dry run the rollout</span> <span className="collab-ins" style={vars({'--n': 9})}>at 09:00.</span></span><span className="collab-caret collab-caret--merlin"><span className="collab-pointer-name collab-caret-name presence presence--merlin"><Icon name="icon-robot" className="icon" />Merlin</span></span></p>
            <p className="collab-line"><span className="collab-num">4</span><span className="collab-text">Freeze the change window.</span></p>
            <p className="collab-line"><span className="collab-num">5</span><span className="collab-text">Page the on-call.</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
