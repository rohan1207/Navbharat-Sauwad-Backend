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

    // Google Translate TTS endpoint - use 'gtx' client which is more reliable
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${ttsLang}&client=gtx&q=${encodeURIComponent(text)}`;

    // Fetch the audio from Google using fetch (built-in, no dependencies)
    const response = await fetch(ttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/',
        'Accept': 'audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5',
      },
    });

    if (!response.ok) {
      throw new Error(`Google TTS returned status ${response.status}`);
    }

    // Get the actual content type from Google's response
    let contentType = response.headers.get('content-type') || 'audio/mpeg';
    
    // Google sometimes returns audio/mp3, normalize it
    if (contentType.includes('mp3') || contentType.includes('mpeg')) {
      contentType = 'audio/mpeg';
    }
    
    // Get audio data as buffer
    const audioBuffer = await response.arrayBuffer();
    
    // Validate audio buffer
    if (!audioBuffer || audioBuffer.byteLength === 0) {
      throw new Error('Empty audio buffer received from Google TTS');
    }
    
    // Check if it's a valid audio format
    const buffer = Buffer.from(audioBuffer);
    
    // Check for text/html error response (Google sometimes returns HTML errors)
    if (buffer.length > 0 && buffer[0] === 0x3C) { // '<' character - HTML starts with <
      const textResponse = buffer.toString('utf-8', 0, 500);
      if (textResponse.includes('<html') || textResponse.includes('Error')) {
        console.error('Google TTS returned HTML error:', textResponse.substring(0, 200));
        throw new Error('Google TTS blocked the request. Please try again.');
      }
    }
    
    // Validate it's actually audio (check for common audio file signatures)
    const isValidAudio = buffer.length > 4 && (
      buffer[0] === 0xFF || // MP3/MPEG
      (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) || // ID3 (MP3 tag)
      buffer[0] === 0x4F || // OGG
      (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) || // RIFF/WAV
      buffer[0] === 0x1A    // MP3 alternative
    );
    
    if (!isValidAudio) {
      console.warn('Audio buffer might not be valid audio format. First bytes:', buffer.slice(0, 10));
      // Still try to send it - some browsers might handle it
    }

    // Set appropriate headers with CORS
    // Use the actual content type from Google, or default to audio/mpeg
    res.set({
      'Content-Type': contentType.includes('audio') ? contentType : 'audio/mpeg',
      'Content-Length': audioBuffer.byteLength,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Accept-Ranges': 'bytes',
    });

    // Send the audio data
    res.send(Buffer.from(audioBuffer));
  } catch (error) {
    console.error('TTS Error:', error.message);
    console.error('TTS Error Stack:', error.stack);
    
    // Return proper error response with CORS headers
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    
    res.status(500).json({ 
      error: 'Failed to generate TTS audio',
      message: error.message 
    });
  }
};

