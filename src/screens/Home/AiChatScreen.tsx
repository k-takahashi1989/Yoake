import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../i18n';
import { useSleepStore } from '../../stores/sleepStore';
import { getGoal } from '../../services/firebase';
import { sendChatMessage } from '../../services/claudeApi';
import { UserGoal } from '../../types';
import { haptics } from '../../utils/haptics';

const CHAT_HISTORY_STORAGE_KEY = 'ai_chat_history';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AiChatScreen() {
  const { t, i18n } = useTranslation();
  const { isPremium } = useAuthStore();
  const navigation = useNavigation<any>();
  const { recentLogs, loadRecent } = useSleepStore();
  const isJa = i18n.language === 'ja';
  const scrollViewRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: t('aiChat.welcome'),
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [goal, setGoal] = useState<UserGoal | null>(null);

  useEffect(() => {
    loadRecent(14);
    getGoal().then(g => setGoal(g));
    AsyncStorage.getItem(CHAT_HISTORY_STORAGE_KEY).then(raw => {
      if (!raw) return;
      try {
        const saved: Array<{
          id: string;
          role: 'user' | 'assistant';
          content: string;
          timestamp: string;
        }> = JSON.parse(raw);
        if (saved.length > 0) {
          setMessages(saved.map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
        }
      } catch {
        // Ignore corrupted local history.
      }
    });
  }, [loadRecent]);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const previousMessagesRef = useRef(messages);
  useEffect(() => {
    if (messages === previousMessagesRef.current) return;
    previousMessagesRef.current = messages;
    if (messages.length <= 1) return;
    AsyncStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(messages)).catch(() => {});
  }, [messages]);

  const paywallFeatures = useMemo(
    () =>
      isJa
        ? [
            '直近の睡眠記録をもとに回答',
            '行動の影響や改善ポイントを質問できる',
            '今の自分に合う次の一手が分かる',
            '記録を続けるほど相談の精度が上がる',
          ]
        : [
            'Answers based on your recent sleep logs',
            'Ask about action impacts and improvement points',
            'Get the next step that fits your current pattern',
            'Advice gets sharper as you keep logging',
          ],
    [isJa],
  );

  const handleReset = () => {
    Alert.alert(t('aiChat.resetTitle'), t('aiChat.resetMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
          setMessages([
            {
              id: 'welcome',
              role: 'assistant',
              content: t('aiChat.welcome'),
              timestamp: new Date(),
            },
          ]);
        },
      },
    ]);
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isSending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsSending(true);

    try {
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }));

      const reply = await sendChatMessage(
        text,
        history,
        recentLogs,
        goal ?? {
          targetHours: 7.5,
          targetScore: 80,
          bedTimeTarget: null,
          updatedAt: null,
        },
      );

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      haptics.light();
    } catch (error: any) {
      if (error?.code === 'functions/resource-exhausted') {
        Alert.alert(
          t('aiChat.limitReachedTitle'),
          error.message ?? t('aiChat.limitReachedMessage'),
        );
      } else {
        Alert.alert(t('aiChat.errorTitle'), t('aiChat.errorMessage'));
      }
    } finally {
      setIsSending(false);
    }
  };

  if (!isPremium) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.paywall}>
          <Text style={styles.paywallIcon}>AI</Text>
          <Text style={styles.paywallTitle}>
            {isJa ? 'AIに相談して、次の一手を知る' : 'Ask AI what to try next'}
          </Text>
          <Text style={styles.paywallDesc}>
            {isJa
              ? '睡眠記録をもとに、スコアが下がった理由や改善ポイントをAIに相談できます。'
              : 'Use your sleep logs to ask AI why your score dropped and what to improve next.'}
          </Text>
          <View style={styles.paywallCard}>
            {paywallFeatures.map(feature => (
              <View key={feature} style={styles.paywallRow}>
                <Text style={styles.paywallCheck}>+</Text>
                <Text style={styles.paywallFeature}>{feature}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={styles.paywallBtn}
            onPress={() => navigation.navigate('SubscriptionManage')}
          >
            <Text style={styles.paywallBtnText}>
              {isJa ? '7日間無料で改善相談を試す' : 'Try AI guidance free for 7 days'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
            <Text style={styles.resetBtnText}>{t('aiChat.resetBtn')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map(message => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {isSending && (
            <View style={[styles.bubble, styles.bubbleAssistant]}>
              <ActivityIndicator size="small" color="#9C8FFF" />
            </View>
          )}
        </ScrollView>

        <View style={styles.inputArea}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={isJa ? '相談したいことを入力...' : 'Type your question...'}
            placeholderTextColor="#555"
            multiline
            maxLength={200}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || isSending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
          >
            <Text style={styles.sendIcon}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.bubbleWrapper, isUser && styles.bubbleWrapperUser]}>
      {!isUser && <Text style={styles.aiBubbleBadge}>AI</Text>}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{message.content}</Text>
        <Text style={styles.bubbleTime}>{format(message.timestamp, 'HH:mm')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1A1A2E' },
  keyboardContainer: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#2D2D44',
  },
  resetBtn: { paddingHorizontal: 12, paddingVertical: 4 },
  resetBtnText: { color: '#9A9AB8', fontSize: 12 },
  messageList: { flex: 1 },
  messageListContent: { padding: 16, gap: 12, paddingBottom: 8 },
  bubbleWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '85%',
  },
  bubbleWrapperUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  aiBubbleBadge: {
    fontSize: 11,
    color: '#CFCBFF',
    marginBottom: 4,
    backgroundColor: '#2D2D44',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  bubble: {
    borderRadius: 16,
    padding: 12,
    flexShrink: 1,
  },
  bubbleAssistant: { backgroundColor: '#2D2D44' },
  bubbleUser: { backgroundColor: '#6B5CE7' },
  bubbleText: { fontSize: 14, color: '#E0E0F0', lineHeight: 22 },
  bubbleTextUser: { color: '#FFFFFF' },
  bubbleTime: { fontSize: 10, color: '#9A9AB8', marginTop: 4, textAlign: 'right' },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#2D2D44',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#2D2D44',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6B5CE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#444' },
  sendIcon: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  paywall: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  paywallIcon: {
    fontSize: 34,
    color: '#CFCBFF',
    fontWeight: '800',
    marginBottom: 16,
  },
  paywallTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  paywallDesc: {
    fontSize: 15,
    color: '#B0B0C8',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  paywallCard: {
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  paywallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  paywallCheck: {
    color: '#6B5CE7',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 10,
    width: 14,
  },
  paywallFeature: {
    fontSize: 14,
    color: '#D0D0E8',
    flex: 1,
    lineHeight: 20,
  },
  paywallBtn: {
    backgroundColor: '#6B5CE7',
    borderRadius: 28,
    paddingHorizontal: 32,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  paywallBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
