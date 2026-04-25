<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/1601ade1-419a-4ca1-976a-a83b66f06485

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the server API keys in `.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   OPENAI_API_KEY=your_openai_api_key
   PORT=3001
   ```
3. Run the frontend and backend together:
   `yarn dev`

   Or with npm:
   `npm run dev`

The frontend calls `/api/*` only. API keys are read by the Express backend and are not injected into the browser bundle.
