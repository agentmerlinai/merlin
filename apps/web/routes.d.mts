export type Route = {
  id: string;
  path: string;
  out: string;
  entry: string;
  title: string;
  description: string;
  canonical: string;
};

export const routes: Route[];
