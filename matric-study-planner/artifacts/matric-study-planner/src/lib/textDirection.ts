const URDU_SCRIPT_RE = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/;

export function containsUrduScript(text: string): boolean {
  return URDU_SCRIPT_RE.test(text);
}

export function rtlTextClass(text: string): string {
  return containsUrduScript(text) ? 'font-urdu text-right leading-loose [direction:rtl]' : '';
}
