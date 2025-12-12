<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Huey - AI Paint Color Visualizer

See your walls before you paint. Upload a photo of your space, and our AI visualizes new colors instantly while generating a complete shopping list with local Ghanaian prices.

## Features

- 🎨 **Instant AI Visualization** - See how paint colors look on your walls in real-time
- 📸 **Smart Image Analysis** - AI detects surfaces, textures, and lighting conditions
- 🛒 **Shopping Lists** - Get complete material lists with local Ghanaian prices (GHS)
- ⚡ **Fast & Cached** - Optimized performance with intelligent caching
- 🎯 **Pro Recommendations** - AI-powered color suggestions based on your space

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the root directory and set your Gemini API key:
   ```bash
   GEMINI_API_KEY=your_api_key_here
   ```
   Get your API key from: https://ai.google.dev/

3. Run the app:
   ```bash
   npm run dev
   ```

## Build for Production

```bash
npm run build
```

## Environment Variables

This project uses environment variables for sensitive configuration. Never commit your `.env` file to version control.

- Copy `.env.example` to `.env` and fill in your API keys
- The `.env` file is already in `.gitignore` and will not be pushed to GitHub

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **Google Gemini AI** - Image analysis and visualization
- **Framer Motion** - Animations

## License

Private project - All rights reserved

---

Built by [Nana Bani Adu](https://linkedin.com/in/nanabaniadu/)
