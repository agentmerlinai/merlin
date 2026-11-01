import { Icon } from '../../../components/Icon';

/* 6 · Behind the app. Station 6 opens on the deployment the reader would
   otherwise run: six containers across three VMs, with thin clients asking the
   server for everything. When the station settles, the backend folds into one
   server peer: five containers become the five signed blocks the peer holds,
   the ops container becomes the peer's key role, and the clients — plain icons
   that never move — keep the same replica through the data mesh.

   The morph moves and reshapes those objects; it never scales or fades the two
   poses. Every position below is read by CSS from one pose factor (see the
   pane-6 block in site.css).

   Base styles are the conclusion, so a still (reduced-motion) reader sees the
   local-first pose; the scene's first frame restores the deployment. */

/* The six containers the reader runs today: three hosts, two containers each.
   Five of them land as the peer's five signed blocks; the sixth (ops
   pipelines) lands as the peer's role line, because that is what it becomes.
   The host row and the landing slot of each key live in the pane-6 CSS, so the
   drawing has one geometry source. */
type Part = {
  key: string;
  icon: string;
  name: string;
  volume?: true;
  role?: true;
};

const PARTS: Part[] = [
  { key: 'app', icon: 'icon-cpu', name: 'App server' },
  { key: 'auth', icon: 'icon-key', name: 'Auth service' },
  { key: 'repo', icon: 'icon-database', name: 'Postgres', volume: true },
  { key: 'cache', icon: 'icon-lightning', name: 'Cache' },
  { key: 'audit', icon: 'icon-scroll', name: 'Audit log' },
  { key: 'ops', icon: 'icon-arrow-clockwise', name: 'Ops pipelines', role: true }
];

/* The two containers each outer host keeps. The middle host is the peer, so its
   head is the peer's own head (see `Peer`). */
const HOSTS = [
  { key: 'app', name: 'VM 1 · app' },
  { key: 'data', name: 'VM 2 · data' },
  { key: 'ops', name: 'VM 3 · ops' }
] as const;

/* Clients are icons and labels, not cards: they are the fixed band, and nothing
   about them changes when the backend does. */
const CLIENTS = [
  { key: 'laptop', name: 'Laptop', icon: 'icon-monitor' },
  { key: 'tablet', name: 'Tablet', icon: 'icon-device-tablet' },
  { key: 'phone', name: 'Phone', icon: 'icon-device-mobile' }
] as const;

/* One container. The bar slots are empty in the markup: the container itself
   travels into them, so the figure has one object where a fade would have had
   two. */
function Part({ part }: { part: Part }) {
  return (
    <span className="base-part surface-plate" data-service={part.key}>
      <span className="base-part-strip">
        <span className="base-part-row">
          <span className="base-part-head">
            <Icon name={part.icon} />
            <span className="base-part-name">{part.name}</span>
          </span>
          {part.volume && (
            <span className="base-part-fact">
              <Icon name="icon-hard-drive" />
              1 volume
            </span>
          )}
        </span>
        {part.role && (
          <span className="base-part-role">
            <Icon name="icon-key" />
            root keys · auth
          </span>
        )}
      </span>
    </span>
  );
}

/* The middle host is the server peer. Its frame becomes a plate, its head
   becomes the peer's head, and its body rises into the frame. The five blocks
   are the five containers that land in the slot below. */
function Peer() {
  return (
    <div className="base-peer surface-plate" data-peer="server">
      {/* The host's name lifts out of the frame as the peer's name rises with
          the body: two motions in one window, never two half texts. */}
      <span className="base-peer-head">{HOSTS[1].name}</span>
      <span className="base-peer-body">
        <span className="base-peer-line">
          <Icon name="icon-shield-check" />
          server peer
        </span>
        <span className="base-replica surface-well">
          <span className="base-replica-bars" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => <i key={i} />)}
          </span>
          <span className="base-replica-name">5 blocks · signed replica</span>
        </span>
      </span>
    </div>
  );
}

function Client({ client }: { client: typeof CLIENTS[number] }) {
  return (
    <span className="base-client" data-client={client.key}>
      <span className="base-client-icon"><Icon name={client.icon} /></span>
      <span className="base-client-name">{client.name}</span>
    </span>
  );
}

export function StoryPane6() {
  return (
    <div className="story-pane" data-pane={6}>
      <div className="pane-body base-body">
        {/* The perimeter is the air gap: the one boundary the architecture
            cannot change. On-prem is the constant; the backend is the
            variable. The phone drops the gloss and keeps the fact: the fence
            and the sealed port still say the perimeter is on-prem. */}
        <div className="base-perimeter surface-panel">
          {/* One rail, two annotations: the boundary's name and the mode. They
              are flex items with a token gap, so no frame width can make them
              collide. */}
          <div className="base-head">
            <span className="canvas-label">
              <Icon name="icon-shield-check" />
              Enterprise perimeter
              <span className="base-const">on-prem</span>
            </span>
            {/* The mode names the architecture, not a count. */}
            <p className="base-mode">
              <span className="base-mode--cloud">Cloud-first</span>
              <span className="base-mode--local">Local-first</span>
            </p>
          </div>
          <div className="base-field">
            {/* One backend band. Three hosts hold six containers; the middle
                host is the peer, so only its frame and its body change. */}
            <div className="base-backend">
              <span className="base-well base-well--app surface-well" aria-hidden="true">
                <span className="base-well-head">{HOSTS[0].name}</span>
              </span>
              <span className="base-well base-well--ops surface-well" aria-hidden="true">
                <span className="base-well-head">{HOSTS[2].name}</span>
              </span>
              <Peer />
              {PARTS.map((part) => <Part part={part} key={part.key} />)}
              {/* The record lands on the peer. The seat is the middle host's
                  box in both poses, so the seam measures one destination. */}
              <span className="base-seat" data-arrive="5" aria-hidden="true" />
              {/* The server's authority is a bus to every client. The data
                  mesh is the peer links between the clients; the server is an
                  equal peer for data and the key holder for access. */}
              <span className="base-link base-link--stem" aria-hidden="true" />
              <span className="base-link base-link--bus" aria-hidden="true" />
              {[0, 1, 2].map((i) => (
                <span className={`base-link base-link--drop base-link--drop-${i}`} aria-hidden="true" key={i}>
                  <i className="base-link-line" />
                  <i className="base-link-tip" />
                </span>
              ))}
            </div>
            {/* The client band is fixed. The same three icons appear in both
                architectures; only the network between them changes. */}
            <div className="base-clients">
              <span className="base-link base-link--mesh base-link--pair-a" aria-hidden="true" />
              <span className="base-link base-link--mesh base-link--pair-b" aria-hidden="true" />
              {CLIENTS.map((client) => <Client client={client} key={client.key} />)}
            </div>
            {/* One footer line. The architecture label and the counts are the
                only words the figure needs; the count that moves is the ink.
                The volume is drawn on the Postgres plate, so the count drops
                the repeat where the row is shared with the sealed port. */}
            <div className="base-footer">
              <span className="base-footer--cloud"><strong>3 VMs</strong> · 6 containers<span className="base-footer-fact"> · 1 volume</span></span>
              <span className="base-footer--local"><strong>3 peers</strong> · 1 key holder</span>
            </div>
          </div>
          {/* The sealed port: a plate on the fence, a short break that ends in a
              plug, then the name. The mark rides the footer row inside the
              frame, so it never lands on the client labels or on the caption.
              The gloss drops at narrow widths; the name always stays. */}
          <span className="base-egress" aria-hidden="true">
            <span className="base-egress-label">
              <Icon name="icon-wifi-slash" />
              Air gap<span className="base-egress-fact"> · no egress</span>
            </span>
            <Icon name="icon-plug" />
            <i className="base-egress-stub" />
            <i className="base-egress-port" />
          </span>
        </div>
        {/* The caption hangs from the drawing's row, so nothing the words do
            can size the centring or move the figure off the stage line. */}
        <p className="topology-caption">Six containers on three VMs. Now one binary holds the signed record and the root keys; the clients keep the same five blocks, so any of them can restore the server.</p>
      </div>
    </div>
  );
}
