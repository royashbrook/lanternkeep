// what the screen is like right now, for the parts that lay themselves out in code
const land = matchMedia("(orientation: landscape)");
const calm = matchMedia("(prefers-reduced-motion: reduce)");

export const view = $state({ landscape: land.matches, reduced: calm.matches });

export function watchView() {
  const sync = () => {
    view.landscape = land.matches;
    view.reduced = calm.matches;
  };
  land.addEventListener("change", sync);
  calm.addEventListener("change", sync);
  sync();
  return () => {
    land.removeEventListener("change", sync);
    calm.removeEventListener("change", sync);
  };
}
