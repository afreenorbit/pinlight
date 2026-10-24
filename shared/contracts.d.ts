/** Domain contracts for persisted inspection records. */
export interface SourceReference {
  id: string;
  documentId: string;
  revision: string;
  page: number;
  label: string;
  /** Normalized top-left coordinates, 0–1, in the PDF.js viewport including page rotation. */
  bounds: { x: number; y: number; width: number; height: number };
  pdfBounds: { x: number; y: number; width: number; height: number };
  manual?: boolean;
}
export interface InspectionFinding {
  id: string;
  referenceId: string;
  documentId: string;
  reference: { documentId: string; revision: string; page: number; label: string };
  observation: string;
  status: 'open' | 'reviewed' | 'resolved';
  confirmedAt: string;
  updatedAt?: string;
  supersedes?: string;
}
export type InspectionCommand =
  | { type: 'find_reference'; label: string; documentId: string }
  | { type: 'draft_finding'; referenceId: string; observation: string }
  | { type: 'list_findings'; documentId: string };
