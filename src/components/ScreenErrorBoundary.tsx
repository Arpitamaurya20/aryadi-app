import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Brand } from '../theme/colors';

type Props = {
  children: ReactNode;
  onBack?: () => void;
  title?: string;
};

type State = {
  error: Error | null;
};

export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{this.props.title || 'Something went wrong'}</Text>
        <Text style={styles.message}>{this.state.error.message || 'Unable to open this screen.'}</Text>
        {this.props.onBack ? (
          <Pressable
            onPress={() => {
              this.setState({ error: null });
              this.props.onBack?.();
            }}
            style={styles.btn}
          >
            <Text style={styles.btnText}>Go Back</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Brand.background,
  },
  title: {
    color: Brand.text,
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    textAlign: 'center',
  },
  message: {
    marginTop: 10,
    color: Brand.placeholder,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
  },
  btn: {
    marginTop: 18,
    backgroundColor: Brand.buttonStart,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  btnText: {
    color: Brand.white,
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
  },
});
