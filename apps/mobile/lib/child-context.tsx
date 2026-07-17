import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { APP_ROLE } from './config';

const STORAGE_KEY = 'eims_selected_student_id';

interface ChildContextValue {
  selectedStudentId: string | null;
  setSelectedStudentId: (id: string | null) => Promise<void>;
}

const ChildContext = createContext<ChildContextValue | null>(null);

export function ChildProvider({ children }: { children: React.ReactNode }) {
  const [selectedStudentId, setSelectedStudentIdState] = useState<string | null>(null);

  useEffect(() => {
    if (APP_ROLE !== 'parent') return;
    SecureStore.getItemAsync(STORAGE_KEY).then((value) => {
      if (value) setSelectedStudentIdState(value);
    });
  }, []);

  const setSelectedStudentId = async (id: string | null) => {
    setSelectedStudentIdState(id);
    if (id) {
      await SecureStore.setItemAsync(STORAGE_KEY, id);
    } else {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    }
  };

  const value = useMemo(
    () => ({ selectedStudentId, setSelectedStudentId }),
    [selectedStudentId],
  );

  if (APP_ROLE !== 'parent') {
    return <>{children}</>;
  }

  return <ChildContext.Provider value={value}>{children}</ChildContext.Provider>;
}

export function useChildContext() {
  const ctx = useContext(ChildContext);
  if (APP_ROLE !== 'parent') {
    return { selectedStudentId: null, setSelectedStudentId: async () => undefined };
  }
  if (!ctx) throw new Error('useChildContext must be used within ChildProvider');
  return ctx;
}
