/**
 * Simple token estimation without external dependencies.
 *
 * Uses the widely-accepted heuristic of ~4 characters per token for English /
 * code text.  This is intentionally simple -- accurate counting would require
 * pulling in tiktoken or a similar tokenizer which adds significant weight.
 */

const CHARS_PER_TOKEN = 4;

/** Estimate the number of tokens in a string. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Estimate token count for multiple strings. */
export function estimateTokensBatch(texts: string[]): number {
  return texts.reduce((sum, t) => sum + estimateTokens(t), 0);
}
