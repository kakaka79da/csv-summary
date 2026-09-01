/** @type {import('tailwindcss').Config} */
// 판타지 오피스 톤: 어두운 석조 배경 + 황금/에메랄드 강조색.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        stone: {
          950: '#0d0b0f',
          900: '#15121a',
          850: '#1c1824',
          800: '#241f2e',
          700: '#332c40',
          600: '#463d57',
        },
        gold: { DEFAULT: '#d9a441', soft: '#f0cd85', deep: '#8a6320' },
        arcane: { DEFAULT: '#7b6bd6', soft: '#a99cf0' },
        vital: { DEFAULT: '#4fbf8b', soft: '#8fe0bb' },
        ember: { DEFAULT: '#d8604f', soft: '#f0958a' },
      },
      fontFamily: {
        display: ['"Cinzel"', 'Georgia', 'serif'],
        body: ['"Pretendard"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        rune: '0 0 0 1px rgba(217,164,65,0.28), 0 8px 28px -12px rgba(0,0,0,0.9)',
      },
    },
  },
  plugins: [],
};
