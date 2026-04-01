/**
 * AI Caption Generation
 *
 * Uses a structured system prompt that handles broken, short, or unclear captions.
 * Returns JSON: { "caption": "..." }
 *
 * Priority: OpenAI → HuggingFace (keyed) → 503
 */

const SYSTEM_PROMPT = `You are an intelligent social media caption assistant.

Your job:
1. Analyze the user's caption, even if it is broken, short, or unclear.
2. Infer the intended meaning.
3. Rewrite it into a clear, natural, and engaging caption.
4. Keep the original intent — DO NOT completely change meaning unless it is gibberish.
5. If the input is too vague, improve it but stay minimal and realistic (avoid generic hype).
6. Match tone based on content (casual, business, motivational, etc.)
7. Add emojis only when appropriate (not always).
8. Add hashtags only if they make sense.

IMPORTANT: Return ONLY valid JSON in this exact format, nothing else:
{"caption": "improved caption here"}`;

const buildUserMessage = (existingCaption, title, tags, platform) => {
  const platformHints = {
    twitter:  'Platform: Twitter/X — keep under 280 characters, punchy.',
    linkedin: 'Platform: LinkedIn — professional tone, include a call to action.',
    meta:     'Platform: Facebook — conversational, can be longer.',
    tiktok:   'Platform: TikTok — fun, trendy.',
  };
  const hint = platformHints[platform] || '';

  if (existingCaption) {
    return `${hint ? hint + '\n' : ''}Input caption: "${existingCaption}"`;
  }

  const tagStr = tags.length > 0 ? `\nKeywords/tags: ${tags.join(', ')}` : '';
  return `${hint ? hint + '\n' : ''}Create a caption for a post about: "${title}"${tagStr}`;
};

// ── OpenAI ────────────────────────────────────────────────────────────────────
const generateWithOpenAI = async (userMessage) => {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    max_tokens: 200,
    temperature: 0.75,
    response_format: { type: 'json_object' },
  });
  const raw = (res.choices[0]?.message?.content || '').trim();
  const parsed = JSON.parse(raw);
  return (parsed.caption || '').trim();
};

// ── HuggingFace (keyed, new chatCompletion API) ───────────────────────────────
const generateWithHF = async (userMessage) => {
  const { HfInference } = await import('@huggingface/inference');
  const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

  const models = [
    'meta-llama/Llama-3.2-3B-Instruct',
    'Qwen/Qwen2.5-7B-Instruct',
    'microsoft/Phi-3.5-mini-instruct',
  ];

  for (const model of models) {
    try {
      const result = await hf.chatCompletion({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 200,
        temperature: 0.75,
      });

      const raw = (result.choices?.[0]?.message?.content || '').trim();

      // Extract JSON from response (model may wrap it in markdown)
      const jsonMatch = raw.match(/\{[\s\S]*"caption"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const caption = (parsed.caption || '').trim();
        if (caption.length > 5) {
          console.log(`[AI] HF chatCompletion succeeded with ${model}`);
          return caption;
        }
      }
    } catch (e) {
      console.warn(`[AI] HF model ${model} failed:`, e.message);
    }
  }
  throw new Error('All HuggingFace models failed');
};

// ── Quality check ─────────────────────────────────────────────────────────────
const isGibberish = (text) => {
  const words = text.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/).filter(Boolean);
  return (
    words.length < 3 ||
    text.toLowerCase().includes('system prompt') ||
    text.toLowerCase().includes('your job:') ||
    /^(.)\1{8,}/.test(text) ||
    (text.match(/[a-zA-Z]/g) || []).length < 8
  );
};

// ── Main handler ─────────────────────────────────────────────────────────────
exports.generateCaption = async (req, res) => {
  try {
    const { title, tags = [], platform, existingCaption } = req.body;

    if (!title && !existingCaption) {
      return res.status(400).json({ error: 'Provide title (from asset) or existingCaption to rewrite.' });
    }

    const userMessage = buildUserMessage(existingCaption, title, tags, platform);

    const hasOpenAI = process.env.OPENAI_API_KEY &&
      !process.env.OPENAI_API_KEY.includes('your_') &&
      !process.env.OPENAI_API_KEY.includes('sk-...');

    const hasHF = process.env.HUGGINGFACE_API_KEY &&
      !process.env.HUGGINGFACE_API_KEY.includes('your_') &&
      !process.env.HUGGINGFACE_API_KEY.includes('hf_...');

    let caption = '';

    if (hasOpenAI) {
      try {
        caption = await generateWithOpenAI(userMessage);
        console.log('[AI] Used OpenAI');
      } catch (e) {
        console.warn('[AI] OpenAI failed:', e.message);
      }
    }

    if (!caption && hasHF) {
      try {
        caption = await generateWithHF(userMessage);
        console.log('[AI] Used HuggingFace');
      } catch (e) {
        console.warn('[AI] HuggingFace failed:', e.message);
      }
    }

    if (!caption) {
      return res.status(503).json({
        error: 'AI service unavailable. Make sure your OPENAI_API_KEY or HUGGINGFACE_API_KEY is set correctly in .env and the server is restarted.',
      });
    }

    if (isGibberish(caption)) {
      return res.status(422).json({
        error: 'The AI could not generate a meaningful caption. Please provide more context — a clearer title or descriptive tags.',
      });
    }

    res.json({ caption });
  } catch (err) {
    console.error('[AI caption error]', err.message);
    res.status(500).json({ error: 'Caption generation failed: ' + err.message });
  }
};
