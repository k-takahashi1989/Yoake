import { create } from 'zustand';
import firestore from '@react-native-firebase/firestore';
import {
  getHabitTemplates,
  saveHabitTemplate,
  deleteHabitTemplate,
} from '../services/firebase';
import { HabitTemplate, HabitEntry } from '../types';
import { DEFAULT_HABITS } from '../constants';

interface HabitState {
  templates: HabitTemplate[];
  isLoaded: boolean;

  loadHabits: () => Promise<void>;
  addHabit: (label: string, emoji: string) => Promise<void>;
  toggleActive: (id: string) => Promise<void>;
  removeHabit: (id: string) => Promise<void>;
  reorderHabits: (orderedIds: string[]) => Promise<void>;

  /** SleepInputModal 用: アクティブな習慣を HabitEntry[] で返す */
  getActiveEntries: () => HabitEntry[];
}

export const useHabitStore = create<HabitState>((set, get) => ({
  templates: [],
  isLoaded: false,

  loadHabits: async () => {
    try {
      const templates = await getHabitTemplates();
      if (templates.length > 0) {
        set({ templates, isLoaded: true });
      } else {
        // 初回 or テンプレート未登録 → デフォルト習慣を Firestore に保存してからセット
        const defaults: HabitTemplate[] = DEFAULT_HABITS.map((h, i) => ({
          id: h.id,
          label: h.label,
          emoji: h.emoji,
          isDefault: true,
          isActive: true,
          order: i,
          createdAt: firestore.Timestamp.now(),
        }));
        await Promise.all(defaults.map(t => saveHabitTemplate(t)));
        set({ templates: defaults, isLoaded: true });
      }
    } catch (e) {
      // オフラインなどで失敗した場合はデフォルトをローカルで使う
      const defaults: HabitTemplate[] = DEFAULT_HABITS.map((h, i) => ({
        id: h.id,
        label: h.label,
        emoji: h.emoji,
        isDefault: true,
        isActive: true,
        order: i,
        createdAt: firestore.Timestamp.now(),
      }));
      set({ templates: defaults, isLoaded: true });
    }
  },

  addHabit: async (label, emoji) => {
    const { templates } = get();
    const id = `custom_${Date.now()}`;
    const newTemplate: HabitTemplate = {
      id,
      label,
      emoji,
      isDefault: false,
      isActive: true,
      order: templates.length,
      createdAt: firestore.Timestamp.now(),
    };
    await saveHabitTemplate(newTemplate);
    set({ templates: [...templates, newTemplate] });
  },

  toggleActive: async (id) => {
    const { templates } = get();
    const updated = templates.map(t =>
      t.id === id ? { ...t, isActive: !t.isActive } : t,
    );
    const target = updated.find(t => t.id === id);
    if (target) await saveHabitTemplate(target);
    set({ templates: updated });
  },

  removeHabit: async (id) => {
    const { templates } = get();
    await deleteHabitTemplate(id);
    const remaining = templates
      .filter(t => t.id !== id)
      .map((t, i) => ({ ...t, order: i }));
    await Promise.all(remaining.map(t => saveHabitTemplate(t)));
    set({ templates: remaining });
  },

  reorderHabits: async (orderedIds) => {
    const { templates } = get();
    const map = new Map(templates.map(t => [t.id, t]));
    const reordered = orderedIds
      .filter(id => map.has(id))
      .map((id, i) => ({ ...map.get(id)!, order: i }));
    await Promise.all(reordered.map(t => saveHabitTemplate(t)));
    set({ templates: reordered });
  },

  getActiveEntries: () => {
    const { templates } = get();
    return templates
      .filter(t => t.isActive)
      .sort((a, b) => a.order - b.order)
      .map(t => ({ id: t.id, label: t.label, emoji: t.emoji, checked: false }));
  },
}));
