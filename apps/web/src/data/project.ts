/* One project, one address. Every link to the repo and to the team resolves
   here, so a rename lands once and no page can point at a stale fork. */
const url = 'https://github.com/agentmerlinai/merlin';

export const repo = {
  star: url,
  fork: `${url}/fork`,
} as const;

/* The team address is the site: the story and the ending both send the reader
   there, so one URL serves both. The stage is stated in the ending's own
   sentence, next to the invitation it qualifies. */
export const project = {
  teamUrl: 'https://goatdb.dev',
} as const;
