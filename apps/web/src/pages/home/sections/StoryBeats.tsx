import { project } from '../../../data/project';
import { Icon } from '../../../components/Icon';

/* Chips annotate the claims a chapter's figure cannot draw (a signature, one
   history, a schema edit, a revert). One component keeps the anatomy in one
   place; the icons stay registry ids, never inline paths. They are annotations,
   not controls, so they carry no button role and no hover. */
function Chip({ icon, children }: { icon: string; children: string }) {
  return (
    <li>
      <span className="story-chip surface-plate">
        <Icon name={icon} className="icon" />
        {children}
      </span>
    </li>
  );
}

export function StoryBeats() {
  return (
    <ol className="story-beats">
      <li className="story-beat" data-story-beat={1} id="chapter-1">
        {/* One point per station: the snap must never be the reading block,
            whose height is pacing and would make every position a legal rest. */}
        <span className="snap-point" aria-hidden="true" />
        <div className="story-copy">
          <div className="story-copy-track">
            <span className="story-index">01 · Loop</span>
            <h2 className="story-label">Start from the standard chat.</h2>
            <p className="story-line">Merlin ships a standard chat: tools, context, and an answer, with people and agents on one record. Pick the model, write tools in TypeScript or over MCP, and own the context window: you decide what the model sees on every turn. Adapt the base to the work, not the other way around.</p>
            {/* The slip is content: it names what the chapter's "adapt the base"
                means in practice. One control, one place: the nav chip is the
                only door, so the slip is a note, not a second button. It shows
                the current pair, but not the chip's uppercase caption: the
                swatches tie the note to the studio, the prose keeps it from
                reading as a duplicate control. The leader is decoration and
                lives outside the copy. */}
            <div className="brand-thread-slot" data-island="brand-thread">
              <p className="brand-thread-ticket surface-plate" role="note">
                <span className="swatch-pair" aria-hidden="true"><span /><span /></span>
                <span className="brand-thread-lead">The design system is a base too.</span>
                <span className="brand-thread-line">Adapt it to your brand, not the other way around.</span>
              </p>
            </div>
          </div>
        </div>
      </li>
      <li className="story-beat" data-story-beat={2} id="chapter-2">
        <span className="snap-point" aria-hidden="true" />
        <div className="story-copy">
          <div className="story-copy-track">
            <span className="story-index">02 · Record</span>
            <h2 className="story-label">Both hands on one document.</h2>
            <p className="story-line">People and agents work on the same data, in real time — no copies, nothing overwritten. The base gives them one shared record: history is kept, every change carries a name, and you can undo any of it. Close the laptop; the work is still there.</p>
          </div>
        </div>
      </li>
      <li className="story-beat" data-story-beat={3} id="chapter-3">
        <span className="snap-point" aria-hidden="true" />
        <div className="story-copy">
          <div className="story-copy-track">
            <span className="story-index">03 · Surface</span>
            <h2 className="story-label">A view costs a component.</h2>
            <p className="story-line">Every screen is a view of the same record. Shape a board, a table, a calendar in your own components, and the agent acts on what it sees. The work lives once; every surface reads it.</p>
          </div>
        </div>
      </li>
      <li className="story-beat" data-story-beat={4} id="chapter-4">
        <span className="snap-point" aria-hidden="true" />
        <div className="story-copy">
          <div className="story-copy-track">
            <span className="story-index">04 · Audit</span>
            <h2 className="story-label">The record is the audit.</h2>
            <p className="story-line">People and agents change the same record, and every change is cryptographically signed into one history. You can see who made it and check it against your rules, so the history stands as its own evidence.</p>
            {/* The rota shows the two actors and the consent, not the seal: the
                chips name only the two guarantees a reader must keep — the
                signed history, and the audit it leaves behind. */}
            <ul className="story-chips">
              <Chip icon="icon-signature">Signed history</Chip>
              <Chip icon="icon-shield-check">Full audit trail</Chip>
            </ul>
          </div>
        </div>
      </li>
      <li className="story-beat" data-story-beat={5} id="chapter-5">
        <span className="snap-point" aria-hidden="true" />
        <div className="story-copy">
          <div className="story-copy-track">
            <span className="story-index">05 · Schema</span>
            <h2 className="story-label">Data follows a schema.</h2>
            <p className="story-line">Every item in the record follows a schema you define. Add a field, change a type, or drop one — the same engine that keeps people in sync applies the change to every item, and a rollback is that change undone.</p>
            {/* The plan shows items and dates, never their shape: the two
                chips name the guarantee, not the fields — an agent can read
                the schema, and a change is reversible without a migration. */}
            <ul className="story-chips">
              <Chip icon="icon-robot">Agent-friendly</Chip>
              <Chip icon="icon-git-branch">Effortless migrations &amp; rollbacks</Chip>
            </ul>
          </div>
        </div>
      </li>
      <li className="story-beat" data-story-beat={6} id="chapter-6">
        <span className="snap-point" aria-hidden="true" />
        <div className="story-copy">
          <div className="story-copy-track">
            <span className="story-index">06 · Binary</span>
            <h2 className="story-label">One record. One binary.</h2>
            <p className="story-line">Your app is the database. One binary serves the UI, holds the keys, and relays signed commits. Every device holds a full replica: reads are instant, writes work offline, and a dead server refills from an authorized copy. Concurrent edits merge field by field. No database server, cache, or API tier to run.</p>
            <a className="story-credit surface-plate" href={project.teamUrl} target="_blank" rel="noopener">
              <svg className="goat-mark" viewBox="0 0 90.6 90.6" aria-hidden="true"><use href="#goatdb-mark" /></svg>
              <span className="story-credit-copy">
                <span className="story-credit-name">Powered by GoatDB</span>
                <span className="story-credit-link">Read the architecture <Icon name="icon-arrow-right" className="icon" /></span>
              </span>
            </a>
          </div>
        </div>
      </li>
    </ol>
  );
}
