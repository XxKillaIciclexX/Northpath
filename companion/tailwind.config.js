/** @type {import('tailwindcss').Config} */
export default {
  content: {
    relative: true,
    files: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', '../src/companion-account-entry.tsx', '../src/components/{CompanionConnections,RelayRegistry,WebsiteAccount}.tsx'],
  },
  theme: { extend: {} },
  plugins: [],
};
