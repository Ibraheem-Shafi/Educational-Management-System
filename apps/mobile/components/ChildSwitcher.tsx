import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { useChildContext } from '@/lib/child-context';
import { apiClient } from '@/lib/api';
import { useTheme } from '@/lib/theme-context';
import type { ParentPortalData } from '@/lib/types';

export function ChildSwitcher() {
  const { accessToken } = useAuth();
  const { selectedStudentId, setSelectedStudentId } = useChildContext();
  const { primaryColor } = useTheme();

  const { data } = useQuery({
    queryKey: ['portal-parent'],
    queryFn: () => apiClient<ParentPortalData>('/portal/parent', { token: accessToken }),
    enabled: !!accessToken,
  });

  const children = data?.children ?? [];

  useEffect(() => {
    if (children.length > 0 && !selectedStudentId) {
      setSelectedStudentId(children[0].student.id);
    }
  }, [children, selectedStudentId, setSelectedStudentId]);

  if (children.length <= 1) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Viewing child</Text>
      <View style={styles.row}>
        {children.map((child) => {
          const active = selectedStudentId === child.student.id;
          return (
            <Pressable
              key={child.student.id}
              onPress={() => setSelectedStudentId(child.student.id)}
              style={[
                styles.chip,
                active && { backgroundColor: primaryColor, borderColor: primaryColor },
              ]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {child.student.fullName}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
  },
  chipText: {
    fontSize: 14,
    color: '#334155',
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
