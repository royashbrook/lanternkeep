/** the pack keeps its words plain; a sentence on screen starts with a capital */
export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
