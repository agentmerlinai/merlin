import { vars } from '../../../components/vars';
import { BOARD, Entry } from './StoryCard';
import { Icon } from '../../../components/Icon';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const RULES = ['Maya off Fri', 'Jonas free', 'Priya dry run'];

/* The week is a shared plan, not a form the agent fills. Three people hold
   rows; the agent holds a presence. Maya's Friday cell is the one gap, and the
   only cell the scene changes. */
function Who({ name }: { name: string }) {
  return (
    <span className="rota-who presence presence--human">
      <Icon name="icon-user" className="icon" />{name}
    </span>
  );
}

function Shift({ time }: { time: string }) {
  return <span className="slot surface-plate">{time}</span>;
}

export function StoryPane4() {
  return (
    <div className="story-pane" data-pane={4}>
      <div className="collab-chrome">
        <Icon name="icon-clock-countdown" className="icon" />
        <span className="collab-name">Rota</span>
        {/* Presence is the header's only job: two actors are here. The agent
            chip pulses while it reads, then rests; it never becomes a row. */}
        <span className="collab-here">
          <span className="doc-presence doc-presence--human presence presence--human"><Icon name="icon-user" className="icon" /></span>
          <span className="doc-presence doc-presence--merlin presence presence--merlin"><Icon name="icon-robot" className="icon" /></span>
          <span className="collab-here-label">Maya · Merlin</span>
        </span>
      </div>
      <div className="pane-body surface-well rota">
        <span />
        {DAYS.map((day) => <span className="rota-day" key={day}>{day}</span>)}
        {/* The rules are visible because the copy claims the agent reads them.
            Each chip turns on in order; the three are the whole reason Jonas is
            the answer. */}
        <span className="rota-rules">
          {RULES.map((rule, i) => (
            <span className="rota-rule" key={rule} style={vars({ '--i': i })}>
              <span className="rota-rule-dot" />
              <span className="rota-rule-tick" />
              {rule}
            </span>
          ))}
        </span>
        <Who name="Maya" />
        <Shift time="08–16" />
        <Shift time="08–16" />
        <Shift time="08–16" />
        <Shift time="08–16" />
        {/* The gap is the scene's one changed cell. The human ring and pointer
            are neutral; the agent's proposal and pointer take Merlin's hue, so
            intent and consent never share a colour. */}
        {/* The gap leaves as the plan's Access bar, so it carries that item's
            key like the three notes beside it: one name per item, every
            surface. */}
        <span className="slot surface-plate slot--open" data-anchor="4" data-item="access">
          <span className="rota-gap-face">
            <span className="rota-gap-time">08–16</span>
            <span className="rota-gap-word rota-gap-word--open">open</span>
            <span className="rota-gap-word rota-gap-word--off">off</span>
          </span>
          <span className="collab-select collab-select--human rota-ring" aria-hidden="true" />
          <span className="collab-pointer collab-pointer--human rota-pointer rota-pointer--human" aria-hidden="true">
            <Icon name="icon-cursor" className="icon" />
          </span>
          <span className="collab-pointer collab-pointer--merlin rota-pointer rota-pointer--merlin" aria-hidden="true">
            <Icon name="icon-cursor" className="icon" />
          </span>
          <span className="rota-proposal rota-proposal--pending" aria-hidden="true">
            <span className="rota-proposal-line"><span className="rota-proposal-who">Jonas</span><span className="rota-proposal-time">08–16</span></span>
            <span className="rota-proposal-state">proposed</span>
            <span className="rota-approve"><Icon name="icon-check" className="icon" /></span>
          </span>
          <span className="rota-proposal rota-proposal--approved" aria-hidden="true">
            <Icon name="icon-check-circle" className="icon rota-approved-check" />
            <span className="rota-proposal-line"><span className="rota-proposal-who">Jonas</span><span className="rota-proposal-time">08–16</span></span>
            <span className="rota-proposal-state">Maya approved</span>
          </span>
        </span>
        <Who name="Jonas" />
        <span className="slot slot--off">off</span>
        <Shift time="08–16" />
        <span className="slot slot--off">off</span>
        <Shift time="08–16" />
        {/* The assignment lands here. Its start pose is one row above (the
            gap), so the tile reads as the approved shift moving to its owner. */}
        <span className="slot slot--target">
          <span className="rota-landed">
            <span>08–16</span>
            <span className="rota-landed-via"><Icon name="icon-robot" className="icon" />via Merlin</span>
          </span>
        </span>
        <Who name="Priya" />
        {/* Her week reads left to right: the board's three tiles take the first,
            middle and last day, and her two shifts fill the days between. */}
        <Entry card={BOARD[0]} />
        <Shift time="08–16" />
        <Entry card={BOARD[1]} />
        <Shift time="08–16" />
        <Entry card={BOARD[2]} />
        {/* The record is one line, but it passes through the states the reader
            watched: open, checking, waiting, covered. Only the last one holds. */}
        <span className="rota-status">
          <span className="rota-status-line rota-status--open"><span className="rota-status-dot" />1 open · Fri 08–16</span>
          <span className="rota-status-line rota-status--read"><Icon name="icon-robot" className="icon" />Merlin is checking…</span>
          <span className="rota-status-line rota-status--proposed"><Icon name="icon-robot" className="icon" />Awaiting Maya · Jonas 08–16</span>
          <span className="rota-status-line rota-status--done">
            <Icon name="icon-check-circle" className="icon" />
            Friday covered · <span className="rota-status-who">Jonas</span>
            <span className="rota-audit">Maya approved · Undo</span>
          </span>
        </span>
      </div>
    </div>
  );
}
