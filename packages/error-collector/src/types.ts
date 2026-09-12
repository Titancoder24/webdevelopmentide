export type ErrorSeverity = 'error' | 'warning' | 'info';
export type ErrorSource = 'terminal' | 'runtime' | 'build' | 'lint' | 'preview' | 'test';
export type ErrorStatus = 'open' | 'resolved';

export interface CodeSnippet {
  before: string[];
  error_line: string;
  after: string[];
}

export interface WorkspaceError {
  id: string;
  timestamp: string;
  source: ErrorSource;
  severity: ErrorSeverity;
  type: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  stack_trace?: string;
  code_snippet?: CodeSnippet;
  related_files: string[];
  status: ErrorStatus;
  resolved_by?: string | null;
  occurrences: number;
  first_seen: string;
  last_seen: string;
}

export interface ErrorFilter {
  status?: ErrorStatus | 'all';
  severity?: ErrorSeverity;
  since?: string;
  file?: string;
}

export interface RawErrorData {
  source: ErrorSource;
  severity?: ErrorSeverity;
  type?: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  stack_trace?: string;
  code_snippet?: CodeSnippet;
  related_files?: string[];
}

export interface ErrorSummary {
  total: number;
  open: number;
  resolved: number;
  by_severity: Record<ErrorSeverity, number>;
  by_source: Partial<Record<ErrorSource, number>>;
  most_recent?: WorkspaceError;
}
