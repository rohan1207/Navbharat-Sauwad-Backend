// Proxy endpoint for Google Translate TTS to bypass CORS
export const getTTS = async (req, res) => {
  try {
    const { text, lang = 'mr' } = req.query;

    if (!text) {
      return res.status(400).json({ error: 'Text parameter is required' });
    }

    // Validate language code
    const validLangs = ['mr', 'hi', 'en', 'mr-IN', 'hi-IN', 'en-US'];
    const ttsLang = validLangs.includes(lang) ? lang.split('-')[0] : 'mr';

    // Google Translate TTS endpoint
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${ttsLang}&client=tw-ob&q=${encodeURIComponent(text)}`;

    // Fetch the audio from Google using fetch (built-in, no dependencies)
    const response = await fetch(ttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://translate.google.com/',
      },
    });

    if (!response.ok) {
      throw new Error(`Google TTS returned status ${response.status}`);
    }

    // Get audio data as buffer
    const audioBuffer = await response.arrayBuffer();

    // Set appropriate headers
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.byteLength,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    });

    // Send the audio data
    res.send(Buffer.from(audioBuffer));
  } catch (error) {
    console.error('TTS Error:', error.message);
    res.status(500).json({ error: 'Failed to generate TTS audio' });
  }
};

