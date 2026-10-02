import { router } from 'expo-router';
import { ChevronLeft } from '@/components/icons';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { FillButton, Tap } from '@/components/Buttons';
import { FieldHint, FormField, FormGroup } from '@/components/Form';
import { Wordmark } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { signIn } from '@/features/auth/auth';
import { cleanUsername, isDemo } from '@/lib/supabase';
import { colors, type } from '@/theme/tokens';

export default function SignIn() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!isDemo && (!username || !password)) {
      setError(
        !username && !password
          ? 'Enter your username and password.'
          : !username
            ? 'Enter your username.'
            : 'Enter your password.',
      );
      return;
    }
    setBusy(true);
    try {
      await signIn(username, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen tabs={false} gap={20}>
      <Tap
        accessibilityRole="link"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/onboarding'))}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' }}
      >
        <ChevronLeft size={18} color={colors.accent} strokeWidth={2.6} />
        <Text style={{ fontSize: 17, color: colors.accent }}>Create account</Text>
      </Tap>
      <View style={{ gap: 4 }}>
        <Wordmark />
        <Text style={type.largeTitle} accessibilityRole="header">
          Sign in
        </Text>
        {isDemo ? (
          <Text style={[type.small, { color: colors.accent }]}>
            Demo mode · signs in to a sample account on this device
          </Text>
        ) : null}
      </View>
      <FormGroup>
        <FormField
          label="Username"
          value={username}
          onChangeText={(t) => setUsername(cleanUsername(t))}
          placeholder="@username"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
        />
        <FormField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          autoComplete="current-password"
          onSubmitEditing={submit}
        />
      </FormGroup>
      {error ? <FieldHint text={error} error /> : null}
      <FillButton
        label="Sign in"
        onPress={submit}
        loading={busy}
        disabled={busy}
        labelStyle={isDemo || (username && password) ? undefined : { color: colors.text2 }}
      />
    </Screen>
  );
}
