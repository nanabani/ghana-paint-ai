<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Ynxm-2GQJgXDldtZvIgme8yy52SG4cLn

## Run Locally

**Prerequisites:**  Node.js


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

## Environment Variables

This project uses environment variables for sensitive configuration. Never commit your `.env` file to version control.

- Copy `.env.example` to `.env` and fill in your API keys
- The `.env` file is already in `.gitignore` and will not be pushed to GitHub
