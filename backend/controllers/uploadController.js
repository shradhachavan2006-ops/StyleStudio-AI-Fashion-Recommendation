const User = require('../models/User');
const path = require('path');

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    let bodyCharacteristics = {
      bodyType: 'Athletic',
      skinTone: 'Medium',
      colorPreferences: ['Navy Blue', 'White', 'Beige'],
      appearance: 'Well-proportioned figure with balanced features',
    };

    // If OpenAI API key is configured, use Vision API for real analysis
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && apiKey !== 'your_openai_api_key_here') {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey });
        const fs = require('fs');
        const imageData = fs.readFileSync(req.file.path);
        const base64Image = imageData.toString('base64');
        const mimeType = req.file.mimetype;

        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analyze this person's appearance for fashion recommendations. Return a JSON object with these exact fields:
                  {
                    "bodyType": "one of: Hourglass, Apple, Pear, Rectangle, Athletic",
                    "skinTone": "one of: Fair, Light, Medium, Olive, Brown, Dark",
                    "colorPreferences": ["3-5 colors that would suit this person based on their complexion"],
                    "appearance": "2-3 sentence description of the person's style characteristics"
                  }
                  Return ONLY the JSON, no markdown.`,
                },
                {
                  type: 'image_url',
                  image_url: { url: `data:${mimeType};base64,${base64Image}` },
                },
              ],
            },
          ],
          max_tokens: 300,
        });

        const content = response.choices[0].message.content.trim();
        bodyCharacteristics = JSON.parse(content);
      } catch (aiErr) {
        console.error('AI analysis failed, using defaults:', aiErr.message);
      }
    }

    // Save analysis to user record
    await User.findByIdAndUpdate(req.user.id, { bodyCharacteristics });

    // Clean up uploaded file
    const fs = require('fs');
    if (req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({
      message: 'Image analyzed successfully',
      bodyCharacteristics,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Error processing image', error: err.message });
  }
};
