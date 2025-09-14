// ok
import { useEffect } from 'react';
import { ensureViewportMeta } from '../components/widget/viewport';

export const useViewportMeta = (): void => {
  useEffect(() => {
    ensureViewportMeta();
  }, []);
};