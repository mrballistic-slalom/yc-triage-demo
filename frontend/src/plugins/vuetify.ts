import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi';

export const vuetify = createVuetify({
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#5B21B6',
          secondary: '#0EA5E9',
          'priority-critical': '#F44336',
          'priority-high': '#FF9800',
          'priority-medium': '#2196F3',
          'priority-low': '#9E9E9E',
          surface: '#FFFFFF',
          background: '#F5F5F7',
        },
      },
    },
  },
  defaults: {
    VBtn: { variant: 'flat', density: 'comfortable' },
    VTextField: { variant: 'outlined', density: 'comfortable' },
    VTextarea: { variant: 'outlined', density: 'comfortable' },
    VSelect: { variant: 'outlined', density: 'comfortable' },
  },
});
