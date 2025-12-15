// === Ontology (Phase 4.1) ===
export interface Ontology {
    types: Set<string>;
    relationships: Set<string>;
    constraints: Set<string>;
    synonyms: Map<string, string>;
}

export interface OntologyConfig {
    types?: string[];
    relationships?: string[];
    constraints?: string[];
    synonyms?: Record<string, string>;
}
