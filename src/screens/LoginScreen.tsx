import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AryadiLogo } from '../components/AryadiLogo';
import { BottomBrandWaves, TopBrandWave } from '../components/BrandWaves';
import { LoginField } from '../components/LoginField';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

type LoginScreenProps = {
  onLogin: (username: string, password: string) => Promise<void>;
};

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const { width, height } = useWindowDimensions();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pressed, setPressed] = useState(false);

  const logoWidth = useMemo(() => {
    if (width < 360) return 132;
    if (width > 420) return 160;
    return 148;
  }, [width]);

  const brandGap = height < 700 ? 28 : 36;
  const side = width < 360 ? 16 : 20;

  async function handleLogin() {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await onLogin(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <TopBrandWave height={120} />
      <BottomBrandWaves height={150} />

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[styles.content, { paddingHorizontal: side }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <AryadiLogo width={logoWidth} height={logoWidth} />

            <View style={[styles.card, { marginTop: brandGap }]}>
              <LoginField
                value={username}
                onChangeText={(value) => {
                  setUsername(value);
                  setError(null);
                }}
                placeholder="Username"
                icon="person-outline"
                autoCapitalize="none"
                returnKeyType="next"
              />
              <View style={styles.fieldGap} />
              <LoginField
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setError(null);
                }}
                placeholder="Password"
                icon="lock-closed-outline"
                secureTextEntry
                passwordVisible={passwordVisible}
                onTogglePassword={() => setPasswordVisible((visible) => !visible)}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign In"
                onPress={handleLogin}
                onPressIn={() => setPressed(true)}
                onPressOut={() => setPressed(false)}
                disabled={loading}
                style={[styles.buttonWrap, pressed && !loading ? styles.buttonPressed : null]}
              >
                <LinearGradient
                  colors={[Brand.buttonStart, Brand.buttonEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.button}
                >
                  {loading ? (
                    <ActivityIndicator color={Brand.white} />
                  ) : (
                    <Text style={styles.buttonText}>Sign In</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 24,
  },
  card: {
    width: '92%',
    maxWidth: 400,
    backgroundColor: Brand.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Brand.fieldStroke,
    paddingHorizontal: 20,
    paddingVertical: 24,
    ...brandShadow('0 10px 18px rgba(10, 29, 55, 0.08)', {
      shadowColor: Brand.navy,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 18,
      elevation: 8,
    }),
  },
  fieldGap: {
    height: 16,
  },
  error: {
    marginTop: 12,
    color: Brand.error,
    fontSize: 13,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
  },
  buttonWrap: {
    marginTop: 22,
    borderRadius: 12,
    overflow: 'hidden',
    ...brandShadow('0 8px 12px rgba(10, 29, 55, 0.20)', {
      shadowColor: Brand.navy,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 6,
    }),
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
  button: {
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: Brand.white,
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
});
