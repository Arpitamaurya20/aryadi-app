import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type AryadiLogoProps = {
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export function AryadiLogo({ width = 160, height, style }: AryadiLogoProps) {
  const renderedHeight = height ?? width;

  return (
    <View style={[{ width, height: renderedHeight }, style]}>
      <Image
        source={require('../../assets/images/logo.png')}
        style={styles.image}
        resizeMode="contain"
        accessibilityLabel="Aryadi Business logo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
});
