/**
 * Project data for the "Selected Work" section.
 * `previewImg` is intentionally left undefined for now — the UI renders a
 * styled placeholder block until real imagery is dropped in.
 */
export interface Project {
  num: string
  title: string
  subtitle: string
  description: string
  tags: string[]
  previewImg?: string
  url?: string
  link: { label: string; url: string }
}

export const projects: Project[] = [
  {
    num: '01',
    title: 'Rejox',
    subtitle: 'AI migration engineer',
    description: 'AI engineer that migrates React web apps into native React Native apps.',
    tags: ['React', 'React Native', 'AI'],
    link: { label: 'View Repo', url: 'https://github.com/ashrafjr-n/REJOX' },
  },
  {
    num: '02',
    title: 'Datassert',
    subtitle: 'Client-side data analysis tool',
    description: 'Client-side CSV analysis tool built for data scientists.',
    tags: ['React', 'Data'],
    link: {
      label: 'View Project',
      url: 'https://synthetic-data-lab-omega.vercel.app/',
    },
  },
  {
    num: '03',
    title: 'AGB Media',
    subtitle: 'TV & artistic production studio',
    description: 'Portfolio site for a TV and artistic production company.',
    tags: ['TBA'],
    link: { label: 'Visit Site', url: 'https://agb-media.net' },
  },
]
