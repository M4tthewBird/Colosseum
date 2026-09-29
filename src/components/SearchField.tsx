import { Search } from 'lucide-react-native';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors } from '@/theme/tokens';

export function SearchField(props: TextInputProps) {
  return (
    <View style={styles.wrap}>
      <Search size={16} color={colors.text2} strokeWidth={2.2} />
      <TextInput
        placeholderTextColor={colors.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={styles.input}
        accessibilityLabel={props.placeholder}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.fill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  input: { flex: 1, fontSize: 16, color: colors.text, height: 40, outlineStyle: 'none' } as object,
});
