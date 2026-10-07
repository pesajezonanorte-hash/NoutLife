import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { colors } from '../../theme/colors';

export function LoginScreen() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const login = useAuthStore((s) => s.login);

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch {
      Alert.alert('Error', 'Email o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.center}>
        <Text style={styles.logo}>NOUTLIFE</Text>
        <Text style={styles.tagline}>La aventura de tu vida empieza hoy</Text>

        <View style={styles.form}>
          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={colors.textSecondary}
            placeholder="miguel@noutlife.com"
          />

          <Text style={[styles.label, { marginTop: 12 }]}>CONTRASEÑA</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={colors.textSecondary}
            placeholder="••••••••"
          />

          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color={colors.borderPixel} />
              : <Text style={styles.buttonText}>ENTRAR AL REINO</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: colors.bgDeep },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  logo:       { fontFamily: 'monospace', fontSize: 22, color: colors.accentGold, letterSpacing: 4, marginBottom: 8 },
  tagline:    { fontFamily: 'monospace', fontSize: 14, color: colors.textSecondary, marginBottom: 32 },
  form:       { width: '100%' },
  label:      { fontFamily: 'monospace', fontSize: 9, color: colors.textSecondary, marginBottom: 4 },
  input:      {
    backgroundColor: colors.bgPanel,
    borderWidth: 2,
    borderColor: colors.borderPixel,
    color: colors.textPrimary,
    fontFamily: 'monospace',
    fontSize: 14,
    padding: 10,
    marginBottom: 4,
  },
  button:     {
    backgroundColor: colors.accentGold,
    borderWidth: 2,
    borderColor: colors.borderPixel,
    padding: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { fontFamily: 'monospace', fontSize: 10, color: colors.borderPixel, fontWeight: 'bold' },
});
