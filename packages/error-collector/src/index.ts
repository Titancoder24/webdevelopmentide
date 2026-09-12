// Main entry point for @llm-ide/error-collector

export { ErrorCollector } from './collector.js';
export { ErrorStore } from './store.js';
export { normalize } from './normalizer.js';
export { Deduplicator, deduplicationKey, mergeInto } from './deduplicator.js';

// Parsers
export { parseTerminalOutput } from './parsers/terminal.js';
export { parseBuildOutput } from './parsers/build.js';
export { parseESLintJson, parseESLintText } from './parsers/lint.js';
export { parseRuntimeError, parseErrorObject } from './parsers/runtime.js';

// Types
export type {
  ErrorSeverity,
  ErrorSource,
  ErrorStatus,
  CodeSnippet,
  WorkspaceError,
  ErrorFilter,
  RawErrorData,
  ErrorSummary,
} from './types.js';
