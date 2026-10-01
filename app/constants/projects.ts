import { Project } from "../types";

// TODO: Move this to API
export const PROJECTS: Project[] = [
  {
    title: 'παλιγγενεσία',
    date: 'Feb 2025',
    image: 'projects/palingenesis.jpg',
    tech: ['JavaScript', 'Canvas API', 'Cloudflare Workers'],
    url: 'https://palingenesis.aannaelj.workers.dev/',
  },
  {
    title: 'TTU Clinic',
    date: 'Sep 2025',
    image: 'projects/ttu.jpg',
    tech: ['Laravel', 'PHP', 'Alpine.js', 'Tailwind CSS', 'Chart.js'],
    url: 'https://github.com/ashrafjr-n/TTU',
  },
  {
    title: 'Vecto',
    date: 'Jul 2026',
    image: 'projects/vecto.jpg',
    tech: ['React', 'Vite', 'Tailwind CSS', 'Framer Motion', 'PapaParse'],
    url: 'https://vecto.aannaelj.workers.dev/',
  },
  {
    title: 'REJOX',
    date: 'Jul 2026',
    image: 'projects/rejox.jpg',
    tech: ['TypeScript', 'React', 'Python', 'FastAPI', 'Gemini', 'Docker'],
    url: 'https://github.com/ashrafjr-n/REJOX',
  },
  {
    title: 'Edenic World',
    date: 'Aug 2026',
    image: 'projects/edenic-world.jpg',
    tech: ['Next.js', 'TypeScript', 'Tailwind CSS', 'Zustand'],
    url: 'https://edenic-wrold.vercel.app/',
    inProgress: true,
  },
  {
    title: 'RedLine',
    date: 'Sep 2026',
    image: 'projects/redline.jpg',
    tech: ['Next.js', 'NestJS', 'PostgreSQL', 'Prisma', 'OpenAI API'],
    url: 'https://redline-tau-eight.vercel.app/',
  },
];
