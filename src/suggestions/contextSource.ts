import type {
  ArtifactReference,
  DocumentSnapshot,
  MutableAgentContextSource,
} from "./types";

function fingerprint(blocks: DocumentSnapshot["blocks"]) {
  return JSON.stringify(blocks);
}

export function createAgentContextSource(
  artifacts: readonly ArtifactReference[],
): MutableAgentContextSource {
  let snapshot: DocumentSnapshot = { revision: 0, blocks: [] };
  let currentFingerprint = fingerprint(snapshot.blocks);
  const listeners = new Set<(next: DocumentSnapshot) => void>();

  return {
    getDocumentSnapshot: () => snapshot,
    getArtifactReferences: () => artifacts,
    subscribeToDocument(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    updateDocument(blocks) {
      const nextFingerprint = fingerprint(blocks);
      if (nextFingerprint === currentFingerprint) {
        return;
      }

      currentFingerprint = nextFingerprint;
      snapshot = { revision: snapshot.revision + 1, blocks };
      listeners.forEach((listener) => listener(snapshot));
    },
  };
}
