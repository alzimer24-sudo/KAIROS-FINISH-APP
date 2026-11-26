import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
export const configured = /^https:\/\/[^/]+\.supabase\.co\/?$/.test(url) && key.length > 20;

// Le credenziali anon/publishable NON sono segrete; l'accesso ai dati è protetto
// dalle policy RLS. MAI incorporare una service_role key nell'app mobile.
export const supabase = createClient(
  configured ? url : 'https://placeholder.supabase.co',
  configured ? key : 'NOT_CONFIGURED',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

AppState.addEventListener('change', state => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
