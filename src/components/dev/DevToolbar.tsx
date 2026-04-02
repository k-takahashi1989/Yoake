import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '../../stores/authStore';

export default function DevToolbar() {
  const { isPremium, _devSetPremium } = useAuthStore();
  const [expanded, setExpanded] = useState(false);

  if (!__DEV__) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {expanded ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>DEV TOOLS</Text>

          <View style={styles.row}>
            <Text style={styles.label}>プラン</Text>
            <View style={styles.toggle}>
              <TouchableOpacity
                style={[styles.toggleBtn, !isPremium && styles.toggleBtnActive]}
                onPress={() => _devSetPremium(false)}
              >
                <Text style={[styles.toggleText, !isPremium && styles.toggleTextActive]}>
                  FREE
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, isPremium && styles.toggleBtnPremium]}
                onPress={() => _devSetPremium(true)}
              >
                <Text style={[styles.toggleText, isPremium && styles.toggleTextActive]}>
                  ⭐ PRO
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={() => setExpanded(false)}>
            <Text style={styles.closeBtnText}>閉じる</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.fab, isPremium ? styles.fabPremium : styles.fabFree]}
          onPress={() => setExpanded(true)}
        >
          <Text style={styles.fabText}>{isPremium ? '⭐' : '🆓'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 96,
    right: 16,
    zIndex: 9999,
    alignItems: 'flex-end',
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 8,
  },
  fabFree: { backgroundColor: '#444' },
  fabPremium: { backgroundColor: '#6B5CE7' },
  fabText: { fontSize: 20 },
  panel: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#6B5CE7',
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 12,
  },
  panelTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B5CE7',
    letterSpacing: 2,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: { fontSize: 13, color: '#FFFFFF' },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#2D2D44',
    borderRadius: 8,
    overflow: 'hidden',
  },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  toggleBtnActive: { backgroundColor: '#555' },
  toggleBtnPremium: { backgroundColor: '#6B5CE7' },
  toggleText: { fontSize: 12, color: '#9A9AB8', fontWeight: '600' },
  toggleTextActive: { color: '#FFFFFF' },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#2D2D44',
    marginTop: 4,
  },
  closeBtnText: { fontSize: 12, color: '#666' },
});
