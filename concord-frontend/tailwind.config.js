/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0A0A0B",
        panel: "#151518",
        accent: "#6366f1", // Indigo accent
        accentHover: "#4f46e5",
        success: "#10b981", // Emerald success
        borderLight: "rgba(255, 255, 255, 0.08)",
      }
    },
  },
  plugins: [],
}
