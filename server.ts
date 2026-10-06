import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { fileURLToPath } from 'url';
import path from 'path';

const app = express();
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

app.post('/api/gemini/extract-meter', async (req, res) => {
  try {
    const { base64Image } = req.body;
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash', // Updated to valid model from skill
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image.split(',')[1] || base64Image,
              },
            },
            {
              text: "Extract the numeric reading from this water meter image. Return only the number, no text. If you can't find a number, return 'null'.",
            },
          ],
        },
      ],
    });

    const text = response.text?.trim();
    if (!text || text.toLowerCase() === 'null') {
      res.json({ reading: null });
    } else {
      const number = parseFloat(text.replace(/[^0-9.]/g, ''));
      res.json({ reading: isNaN(number) ? null : number });
    }
  } catch (error) {
    console.error('OCR Error:', error);
    res.status(500).json({ error: 'Failed to extract reading' });
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In dev, we mount the express app on the vite dev server via middleware.
// In prod, this will be run by a production server.
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.listen(3000, () => console.log('Server running on port 3000'));
}

export default app;
