import React, { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { useChildContext } from '@/lib/child-context';
import { apiClient } from '@/lib/api';
import { colors } from '@/lib/theme';
import type { ParentPortalData } from '@/lib/types';

export function ChildSwitcher() {
  const { accessToken } = useAuth();
  const { selectedStudentId, setSelectedStudentId } = useChildContext();
  const query = useQuery({
    queryKey: ['portal-parent'],
    queryFn: () => apiClient<ParentPortalData>('/portal/parent', { token: accessToken }),
    enabled: !!accessToken,
  });

  const children = query.data?.children ?? [];

  useEffect(() => {
    if (!children.length) return;
    if (!selectedStudentId || !children.some((child) => child.student.id === selectedStudentId)) {
      void setSelectedStudentId(children[0].student.id);
    }
  }, [children, selectedStudentId, setSelectedStudentId]);

  if (children.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
      <View className="flex-row gap-2">
        {children.map((child) => {
          const active = child.student.id === selectedStudentId;
          return (
            <Pressable
              key={child.student.id}
              onPress={() => setSelectedStudentId(child.student.id)}
              className="rounded-full px-3 py-2"
              style={{ backgroundColor: active ? colors.navy : colors.white, borderWidth: 1, borderColor: active ? colors.navy : colors.line }}
            >
              <Text className="text-sm font-semibold" style={{ color: active ? colors.white : colors.ink }}>
                {child.student.fullName.split(' ')[0]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
