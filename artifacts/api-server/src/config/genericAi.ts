export const ENGLISH_ONLY_INSTRUCTION =
  "Response language: English only. Write every answer in clear, simple English using Latin letters. Do not write in Urdu, Arabic, Persian, Hindi, Roman Urdu, or any non-English script, regardless of the selected subject.";

export function hasUrduScript(text: string): boolean {
  return /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/.test(text);
}
