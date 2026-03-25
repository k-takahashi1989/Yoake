import React, { useState, useRef, useEffect } from 'react';
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
import { useAuthStore } from '../../stores/authStore';
import { useSleepStore } from '../../stores/sleepStore';
import { getGoal } from '../../services/firebase';
import { sendChatMessage } from '../../services/claudeApi';
import { UserGoal } from '../../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AiChatScreen() {
  const { isPremium } = useAuthStore();
  const navigation = useNavigation<any>();
  const { recentLogs, loadRecent } = useSleepStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'こんにちは！睡眠についてなんでも聞いてね。睡眠データをもとにアドバイスするよ。',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [goal, setGoal] = useState<UserGoal | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadRecent(14);
    getGoal().then(g => setGoal(g));
  }, []);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isSending) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
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
        goal ?? { targetHours: 7.5, targetScore: 80, bedTimeTarget: null, updatedAt: null },
      );

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e: any) {
      if (e?.code === 'functions/resource-exhausted') {
        Alert.alert('上限に達しました', e.message ?? '本日のチャット上限に達しました。');
      } else {
        Alert.alert('エラー', 'AIの返答を取得できませんでした。');
      }
    } finally {
      setIsSending(false);
    }
  };

  // 非プレミアムユーザー向けペイウォール
  if (!isPremium) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.paywall}>
          <Text style={styles.paywallIcon}>🤖</Text>
          <Text style={styles.paywallTitle}>AIチャット</Text>
          <Text style={styles.paywallDesc}>
            睡眠データをもとに、AIが{'\n'}あなたの質問に答えます。
          </Text>
          <View style={styles.paywallCard}>
            {PAYWALL_FEATURES.map(f => (
              <View key={f} style={styles.paywallRow}>
                <Text style={styles.paywallCheck}>✓</Text>
                <Text style={styles.paywallFeature}>{f}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={styles.paywallBtn}
            onPress={() => navigation.navigate('SubscriptionManage')}
          >
            <Text style={styles.paywallBtnText}>7日間無料トライアルを始める</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.kvContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isSending && (
            <View style={[styles.bubble, styles.bubbleAssistant]}>
              <ActivityIndicator size="small" color="#9C8FFF" />
            </View>
          )}
        </ScrollView>

        {/* 入力エリア */}
        <View style={styles.inputArea}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="メッセージを入力..."
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
      {!isUser && <Text style={styles.aiIcon}>🤖</Text>}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
          {message.content}
        </Text>
        <Text style={styles.bubbleTime}>
          {format(message.timestamp, 'HH:mm')}
        </Text>
      </View>
    </View>
  );
}

const PAYWALL_FEATURES = [
  '直近14日の睡眠データをもとに回答',
  '習慣の影響や改善ポイントを質問できる',
  '会話は5往復まで保持',
  '200文字以内のフレンドリーな返答',
];

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1A1A2E' },
  kvContainer: { flex: 1 },
  messageList: { flex: 1 },
  messageListContent: { padding: 16, gap: 12, paddingBottom: 8 },
  bubbleWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '85%',
  },
  bubbleWrapperUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  aiIcon: { fontSize: 20, marginBottom: 4 },
  bubble: {
    borderRadius: 16,
    padding: 12,
    flexShrink: 1,
  },
  bubbleAssistant: { backgroundColor: '#2D2D44' },
  bubbleUser: { backgroundColor: '#6B5CE7' },
  bubbleText: { fontSize: 14, color: '#E0E0F0', lineHeight: 22 },
  bubbleTextUser: { color: '#FFFFFF' },
  bubbleTime: { fontSize: 10, color: '#888', marginTop: 4, textAlign: 'right' },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  // ペイウォール
  paywall: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  paywallIcon: { fontSize: 64, marginBottom: 16 },
  paywallTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  paywallDesc: { fontSize: 15, color: '#B0B0C8', textAlign: 'center', lineHeight: 24, marginBottom: 24 },
  paywallCard: { backgroundColor: '#2D2D44', borderRadius: 16, padding: 16, width: '100%', marginBottom: 24 },
  paywallRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  paywallCheck: { color: '#6B5CE7', fontSize: 14, fontWeight: 'bold', marginRight: 10 },
  paywallFeature: { fontSize: 14, color: '#D0D0E8' },
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
