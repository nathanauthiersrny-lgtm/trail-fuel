import { useEffect, useState } from 'react';

import type { KnowledgePack } from '../models/knowledge-pack';
import { loadKnowledgePack } from '../services/knowledge-pack/load';

type PackState =
  | { status: 'loading'; pack: null; error: null }
  | { status: 'ready'; pack: KnowledgePack; error: null }
  | { status: 'error'; pack: null; error: Error };

export function useKnowledgePack(): PackState {
  const [state, setState] = useState<PackState>({
    status: 'loading',
    pack: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    loadKnowledgePack()
      .then((pack) => {
        if (!cancelled) setState({ status: 'ready', pack, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error(String(err));
          setState({ status: 'error', pack: null, error });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
