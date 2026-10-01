interface ProjectUrl {
  text: string;
  url: string;
}

export interface Project {
  title: string;
  date: string;
  /** Screenshot under public/, shown on the card. */
  image: string;
  /** Main technologies, shown on hover. */
  tech: string[];
  url?: string;
  urls?: ProjectUrl[];
  inProgress?: boolean;
}
