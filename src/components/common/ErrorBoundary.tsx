import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import crashlytics from '@react-native-firebase/crashlytics';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    crashlytics().recordError(error);
    crashlytics().log(`React ErrorBoundary: ${info.componentStack ?? ''}`);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>問題が発生しました</Text>
          <Text style={styles.body}>
            エラー情報を送信しました。アプリを再起動してください。
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ hasError: false })}
          >
            <Text style={styles.buttonText}>再試行</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08111E',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F6F1E8',
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    color: '#A5B6C5',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#D9B46A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    color: '#08111E',
    fontWeight: '700',
    fontSize: 15,
  },
});
