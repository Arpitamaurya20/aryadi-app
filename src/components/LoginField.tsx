import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Brand } from '../theme/colors';

const iconTint = 'rgba(10, 29, 55, 0.45)';

type LoginFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  secureTextEntry?: boolean;
  passwordVisible?: boolean;
  onTogglePassword?: () => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address';
  returnKeyType?: 'next' | 'done';
  onSubmitEditing?: () => void;
};

export function LoginField({
  value,
  onChangeText,
  placeholder,
  icon,
  secureTextEntry = false,
  passwordVisible = false,
  onTogglePassword,
  autoCapitalize = 'none',
  keyboardType = 'default',
  returnKeyType = 'next',
  onSubmitEditing,
}: LoginFieldProps) {
  const isPassword = Boolean(onTogglePassword);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const id = 'hide-native-password-reveal';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      input[type="password"]::-ms-reveal,
      input[type="password"]::-ms-clear {
        display: none;
      }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <View style={[styles.field, isPassword ? styles.fieldWithEye : null]}>
      <Ionicons name={icon} size={18} color={iconTint} />
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Brand.placeholder}
          secureTextEntry={secureTextEntry && !passwordVisible}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          keyboardType={keyboardType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          underlineColorAndroid="transparent"
          accessibilityLabel={placeholder}
          style={[styles.input, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
        />
      </View>
      {isPassword ? (
        <Pressable
          onPress={onTogglePassword}
          accessibilityRole="button"
          accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
          hitSlop={4}
          style={styles.eye}
        >
          <Ionicons name={passwordVisible ? 'eye' : 'eye-off'} size={20} color={iconTint} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.fieldStroke,
    backgroundColor: Brand.white,
    paddingLeft: 14,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  fieldWithEye: {
    paddingRight: 6,
  },
  inputWrap: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    marginLeft: 10,
    marginRight: 6,
    justifyContent: 'center',
  },
  input: {
    width: '100%',
    color: Brand.navy,
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  eye: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
