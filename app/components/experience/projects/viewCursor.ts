import gsap from "gsap";

/**
 * The silver "VIEW <project>" circle that replaces the cursor over a project
 * card. One element for every card, made when the first card mounts; it
 * trails the mouse while shown and waits under it while hidden, so it grows
 * where it is.
 */
let el: HTMLDivElement | null = null;
let label: HTMLSpanElement | null = null;
let shown = false;

const create = () => {
  el = document.createElement('div');
  el.className = 'view-cursor';
  el.innerHTML = '<span>VIEW</span>';
  label = document.createElement('span');
  el.appendChild(label);
  document.body.appendChild(el);
  gsap.set(el, { xPercent: -50, yPercent: -50, scale: 0 });

  const toX = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3' });
  const toY = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3' });
  window.addEventListener('pointermove', (e) => {
    toX(e.clientX, shown ? undefined : e.clientX);
    toY(e.clientY, shown ? undefined : e.clientY);
  });
};

export const showViewCursor = (title: string) => {
  if (!el) create();
  shown = true;
  label!.textContent = title;
  document.body.style.cursor = 'none';
  gsap.to(el, { scale: 1, duration: 0.35, ease: 'back.out(1.6)', overwrite: true });
};

/** Only the card that showed it hides it: moving between two cards, the new
 * card's show can run before the old card's hide. */
export const hideViewCursor = (title: string) => {
  if (!el) create();
  if (!shown || label!.textContent !== title) return;
  shown = false;
  document.body.style.cursor = 'auto';
  gsap.to(el, { scale: 0, duration: 0.25, overwrite: true });
};
