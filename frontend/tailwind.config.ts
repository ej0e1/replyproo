import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        border: 'hsl(var(--border))',
        primary: 'hsl(var(--primary))',
        secondary: 'hsl(var(--secondary))',
        muted: 'hsl(var(--muted))',
        accent: 'hsl(var(--accent))',
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
      },
      boxShadow: {
        panel: '0 20px 60px rgba(16, 24, 40, 0.08)',
      },
      backgroundImage: {
        mesh: 'radial-gradient(circle at top left, rgba(244, 196, 48, 0.2), transparent 30%), radial-gradient(circle at top right, rgba(18, 109, 92, 0.22), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.95), rgba(247,244,236,0.98))',
      },
    },
  },
  plugins: [],
};

export default config;
