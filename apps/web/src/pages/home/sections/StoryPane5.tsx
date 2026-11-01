import type { ReactNode } from 'react';
import { vars } from '../../../components/vars';
import { Icon } from '../../../components/Icon';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

/* The plan is the rota's record one step later. Ten columns give two per day,
   so every bar starts and ends on a day edge: a span is a date range, and a
   drag can only stop on a day. Access is the protagonist; the scene moves its
   end from Thu to Fri and closes the brief that the move unblocks. Four bars
   are also the arrival of the rota's seam, so each names the week's item it
   carries (`data-item`): the Cutover and Rollback rows are the notes the plan
   schedules, named once across both surfaces. */
function Row({ name, s, e, barClass = '', item, arrive, drag, after, children }: {
  name: string;
  s?: number;
  e?: number;
  barClass?: string;
  item?: string;
  arrive?: number;
  drag?: boolean;
  after?: ReactNode;
  children?: ReactNode;
}) {
  const geometry = s === undefined || e === undefined ? undefined : vars({ '--s': s, '--e': e });
  /* A day is two track lines and its last line is the day after it, so the end
     line maps back as (e - 3) / 2 and the span is (e - s) / 2 days. Deriving
     both keeps the drag's readout from holding a second copy of the date. */
  const days = s === undefined || e === undefined ? 0 : (e - s) / 2;
  const endDay = e === undefined ? '' : DAYS[(e - 3) / 2];
  return (
    <div className="plan-row" style={geometry}>
      <span className="plan-name">{name}</span>
      <span className="plan-track">
        <span className={`plan-bar ${barClass}`.trim()} data-item={item} data-arrive={arrive}>{children}</span>
        {drag && (
          /* The dragged end. The bar's own width is the pull, so the seam, the
             readout and the hand ride the edge she holds and none can drift. */
          <span className="plan-live" aria-hidden="true">
            <span className="plan-edge" />
            <span className="plan-ends">ends {endDay} · {days}d</span>
            <span className="collab-pointer collab-pointer--human plan-hand plan-hand--drag">
              <Icon name="icon-arrows-horizontal" className="icon" />
            </span>
          </span>
        )}
        {after}
      </span>
    </div>
  );
}

export function StoryPane5() {
  return (
    <div className="story-pane" data-pane={5}>
      {/* The plan is one field: paint, chrome and sheet are one surface, so
          the plan clears as a whole and the base under it is what remains. */}
      <div className="plan-field">
        <div className="collab-chrome">
          <Icon name="icon-check-circle" className="icon" />
          <span className="collab-name">Rollout plan</span>
          {/* Both actors are present, as they were in the rota: the plan is
              theirs, and the header is the only place a name belongs. */}
          <span className="collab-here">
            <span className="doc-presence doc-presence--human presence presence--human"><Icon name="icon-user" className="icon" /></span>
            <span className="doc-presence doc-presence--merlin presence presence--merlin"><Icon name="icon-robot" className="icon" /></span>
            <span className="collab-here-label">Maya · Merlin</span>
          </span>
        </div>
        <div className="pane-body surface-well plan">
          <div className="plan-sheet">
            <div className="plan-gantt">
              <div className="plan-row plan-row--days">
                <span className="plan-name" />
                <span className="plan-days">
                  {DAYS.map((day) => (
                    <span key={day} className={day === 'Fri' ? 'plan-day--end' : undefined}>
                      {day}
                      {/* Friday is the day the rota already covered, so the plan
                          has a reason to reach it. */}
                      {day === 'Fri' && <i className="plan-cover">cover</i>}
                    </span>
                  ))}
                </span>
              </div>
              <Row name="Cutover" s={1} e={5} item="cutover" arrive={4} />
              {/* A Gantt bar is a time frame, so its end is a date and the end
                  edge is what she grabs. The scene opens one day short and drags
                  the gap shut; the keyframe derives that first width from the
                  same span, so the drag holds no second date. */}
              <Row name="Access" s={3} e={11} barClass="plan-bar--grow" item="access" arrive={4} drag />
              <Row name="Dry run" s={5} e={9} item="dryrun" arrive={4} />
              {/* The brief is committed on the cover day. It starts on Thu and
                  lands on Fri: the proposal holds the day until the hand moves
                  the bar into it. Dashed means one thing only - proposed, not
                  committed - and the tag outlives the slot, so the consent is
                  read on a label and never on a shape. */}
              <Row name="Brief" s={9} e={11} barClass="plan-bar--shell"
                after={(
                  <>
                    <span className="plan-ghost" aria-hidden="true" />
                    <span className="plan-tag plan-tag--pending" aria-hidden="true">
                      <span className="plan-ghost-who">Brief</span>
                      <span className="plan-ghost-day">Fri</span>
                      <span className="plan-ghost-state">proposed</span>
                      <span className="plan-approve"><Icon name="icon-check" className="icon" /></span>
                      <span className="collab-pointer collab-pointer--human plan-hand plan-hand--approve">
                        <Icon name="icon-cursor" className="icon" />
                      </span>
                    </span>
                    <span className="plan-tag plan-tag--approved" aria-hidden="true">
                      <Icon name="icon-check" className="icon plan-tag-check" />
                      <span className="plan-ghost-who">Brief</span>
                      <span className="plan-ghost-day">Fri</span>
                      <span className="plan-ghost-state">approved</span>
                    </span>
                  </>
                )}>
                <span className="plan-brief plan-alt" />
              </Row>
              <Row name="Rollback" s={7} e={11} item="rollback" arrive={4} />
              <Row name="Sign-off" s={9} e={11} barClass="plan-alt" />
            </div>
            <div className="plan-todos">
              <p className="plan-title">Scope</p>
              <p className="todo todo--done"><span className="todo-box"><Icon name="icon-check" className="icon todo-check" /></span>Access + MFA</p>
              <p className="todo todo--done"><span className="todo-box"><Icon name="icon-check" className="icon todo-check" /></span>Dry run</p>
              <p className="todo plan-todo--brief">
                <span className="todo-box"><Icon name="icon-check" className="icon todo-check plan-tick" /></span>
                {/* The strike is drawn, not a text decoration: the item closes on
                    the same beat as the bar, so the reader sees one act. */}
                <span className="plan-todo-text">Brief on-call<span className="plan-strike" /></span>
              </p>
              <p className="todo"><span className="todo-box" />Sign-off</p>
              {/* The record is one line in the four states the reader watched.
                  The audit keeps the consent and the undo, as in the rota. */}
              <span className="plan-record" data-anchor="5">
                <span className="plan-status">
                  <span className="plan-status-line plan-status--open"><span className="plan-status-dot" />Access ends Thu · 2 of 4</span>
                  <span className="plan-status-line plan-status--read"><Icon name="icon-robot" className="icon" />Reading the week…</span>
                  <span className="plan-status-line plan-status--proposed"><Icon name="icon-robot" className="icon" />Awaiting Maya · Brief to Fri</span>
                  <span className="plan-status-line plan-status--done"><Icon name="icon-check-circle" className="icon" />Access ends Fri · 3 of 4</span>
                </span>
                <span className="plan-audit">Maya approved · Undo</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
