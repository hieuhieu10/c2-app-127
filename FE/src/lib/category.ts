/**
 * Colour scheme for a game's teacher-facing classification tag (e.g. 'Toán học').
 *
 * Category text is owned by the backend `GameSpec.category`, surfaced over
 * `GET /templates`; this maps it to a badge style shared by the library and the
 * chat game-picker so the two render identically.
 */
export function categoryStyle(category: string): { background: string; color: string; borderColor: string } {
  if (category === 'Toán học') return { background: '#eaf1ff', color: '#1e51b8', borderColor: '#d4e2fb' }
  // 'Tổng quát' and any future general-purpose tag.
  return { background: '#e7f7ef', color: '#0f7b4f', borderColor: '#cdeedd' }
}
