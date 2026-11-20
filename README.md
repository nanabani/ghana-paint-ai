# Huey - AI Paint Color Visualizer

See your walls before you paint. Upload a photo of your space, and our AI visualizes new colors instantly while generating a complete shopping list with local Ghanaian prices.

## Features

- 🎨 **Instant AI Visualization** - See how paint colors look on your walls in real-time
- 📸 **Smart Image Analysis** - AI detects surfaces, textures, and lighting conditions
- 🛒 **Shopping Lists** - Get complete material lists with local Ghanaian prices (GHS)
- ⚡ **Fast & Cached** - Optimized performance with intelligent caching
- 🎯 **Pro Recommendations** - AI-powered color suggestions based on your space

## Local Development

**Prerequisites:** Node.js 22.12.0 or newer. The locked Vitest toolchain
requires Node 22.12.0 at minimum.

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the example environment file to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Set `GEMINI_API_KEY` in `.env.local` to a key from
   [Google AI Studio](https://ai.google.dev/). `.env.local` is ignored by Git
   and must not be committed.

3. Start the local app:
   ```bash
   npm run dev
   ```
   This runs Vercel CLI's development server, which serves the Vite frontend
   and the `/api` functions together.

## Deploying to Vercel

Before merging or deploying, the project owner must add `GEMINI_API_KEY` in
**Vercel Project Settings → Environment Variables** for every intended
environment (Production, Preview, and/or Development), then redeploy so the
configuration takes effect.

`GEMINI_API_KEY` is server-only. Never expose it through a `VITE_` variable,
Vite `define`, or any other client build-time injection.

## Build for Production

```bash
npm run build
```

## Environment Variables

This project uses environment variables for sensitive configuration. Never commit your `.env` file to version control.

- `.env.example` documents required variable names with non-secret placeholders.
- All other `.env*` files are ignored by Git.

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
