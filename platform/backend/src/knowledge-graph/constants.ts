// Re-export document type constants from shared module
// These are used by both frontend (for UI filtering) and backend (for ingestion)
export { SUPPORTED_DOCUMENT_TYPES, SUPPORTED_EXTENSIONS } from "@shared";

/**
 * Maximum document size for ingestion (10MB)
 * Documents larger than this will be skipped to prevent memory issues
 */
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Maximum concurrent document ingestions to prevent overwhelming LightRAG service
 */
export const MAX_CONCURRENT_INGESTIONS = 3;
