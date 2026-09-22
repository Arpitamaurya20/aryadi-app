import { Platform, type ViewStyle } from 'react-native';

export function brandShadow(web: string, native: ViewStyle): ViewStyle {
  if (Platform.OS === 'web') {
    return { boxShadow: web } as ViewStyle;
  }
  return native;
}
