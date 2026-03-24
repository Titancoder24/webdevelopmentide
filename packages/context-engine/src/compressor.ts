/**
 * Regex-based code compressor.
 *
 * Extracts function / class / method signatures and strips implementation
 * bodies, reducing token count by roughly 50-60 %.  This is intentionally a
 * lightweight approach -- a Tree-sitter version can be swapped in later for
 * higher accuracy.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find the index of the matching closing brace for an opening brace at `start`. */
function findMatchingBrace(src: string, start: number): number {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Language-specific compressors
// ---------------------------------------------------------------------------

function compressTypeScript(source: string): string {
  const lines = source.split('\n');
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trimStart();

    // Keep imports, exports (re-exports), type/interface declarations as-is
    if (
      trimmed.startsWith('import ') ||
      trimmed.startsWith('export type ') ||
      trimmed.startsWith('export interface ') ||
      trimmed.startsWith('export {') ||
      trimmed.startsWith('export * ') ||
      trimmed.startsWith('export default ') ||
      trimmed.startsWith('type ') ||
      trimmed.startsWith('interface ')
    ) {
      // Accumulate until the statement is complete (handles multi-line imports)
      let block = line;
      while (i < lines.length - 1 && !block.includes(';') && !block.trimEnd().endsWith('}') && !block.trimEnd().endsWith('{')) {
        i++;
        block += '\n' + lines[i]!;
      }
      output.push(block);
      i++;
      continue;
    }

    // Detect function / method / class declarations and keep only signature
    const fnMatch = trimmed.match(
      /^(export\s+)?(async\s+)?function\s+\w+|^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(|^(export\s+)?class\s+\w+/,
    );
    const methodMatch = trimmed.match(
      /^(public|private|protected|static|async|get|set|\*)\s+|^\w+\s*\(/,
    );

    if (fnMatch || methodMatch) {
      // Collect the full signature up to the opening brace
      let sigLines = line;
      let j = i;
      while (j < lines.length - 1 && !sigLines.includes('{')) {
        j++;
        sigLines += '\n' + lines[j]!;
      }

      const braceIdx = sigLines.indexOf('{');
      if (braceIdx !== -1) {
        const signature = sigLines.slice(0, braceIdx).trimEnd();
        // Find matching closing brace so we can skip the body
        const remaining = source.slice(source.indexOf(sigLines));
        const relBrace = remaining.indexOf('{');
        const closeIdx = findMatchingBrace(remaining, relBrace);

        if (closeIdx !== -1) {
          output.push(`${signature} { /* ... */ }`);
          // Count how many lines we need to skip
          const skippedText = remaining.slice(0, closeIdx + 1);
          const skippedLines = skippedText.split('\n').length - 1;
          i = i + skippedLines + 1;
          continue;
        }
      }
    }

    // Keep comments and decorators
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('@')
    ) {
      output.push(line);
      i++;
      continue;
    }

    // Keep blank lines (readability) and anything else we couldn't classify
    output.push(line);
    i++;
  }

  return output.join('\n');
}

function compressPython(source: string): string {
  const lines = source.split('\n');
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;

    // Keep imports, decorators, comments
    if (
      trimmed.startsWith('import ') ||
      trimmed.startsWith('from ') ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('@')
    ) {
      output.push(line);
      i++;
      continue;
    }

    // Function / class definitions: keep signature + docstring, skip body
    if (trimmed.startsWith('def ') || trimmed.startsWith('async def ') || trimmed.startsWith('class ')) {
      output.push(line);
      i++;
      // Check for docstring on the next line
      if (i < lines.length) {
        const nextTrimmed = lines[i]!.trimStart();
        if (nextTrimmed.startsWith('"""') || nextTrimmed.startsWith("'''")) {
          const quote = nextTrimmed.slice(0, 3);
          let docLine = lines[i]!;
          output.push(docLine);
          // Multi-line docstring
          if (!nextTrimmed.slice(3).includes(quote)) {
            i++;
            while (i < lines.length && !lines[i]!.includes(quote)) {
              output.push(lines[i]!);
              i++;
            }
            if (i < lines.length) output.push(lines[i]!);
          }
          i++;
        }
      }
      output.push(' '.repeat(indent + 4) + '...');
      // Skip body (lines with greater indent or blank)
      while (i < lines.length) {
        const bodyLine = lines[i]!;
        const bodyTrimmed = bodyLine.trimStart();
        const bodyIndent = bodyLine.length - bodyTrimmed.length;
        if (bodyTrimmed === '' || bodyIndent > indent) {
          i++;
        } else {
          break;
        }
      }
      continue;
    }

    output.push(line);
    i++;
  }

  return output.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Compress source code, extracting signatures and stripping bodies. */
export function compressCode(source: string, language: string): string {
  switch (language.toLowerCase()) {
    case 'typescript':
    case 'javascript':
    case 'tsx':
    case 'jsx':
      return compressTypeScript(source);
    case 'python':
      return compressPython(source);
    default:
      // For unsupported languages, strip consecutive blank lines and long comments
      return source
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\/\*[\s\S]*?\*\//g, '/* ... */');
  }
}
