import { Router } from 'express';
import { Conversation } from '../models/Conversation.js';
import { requireAuth } from '../middleware/auth.js';
import { getProvider, listProviders, resolveModel } from '../llm/index.js';

const router = Router();

router.use(requireAuth);

router.get('/providers', (req, res) => {
  const active = getProvider();
  res.json({
    available: listProviders(),
    active: active.name,
    model: resolveModel(active),
  });
});

router.get('/conversations', async (req, res, next) => {
  try {
    const conversations = await Conversation.find({ user: req.user._id })
      .select('title createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(100);

    res.json({ conversations });
  } catch (err) {
    next(err);
  }
});

router.post('/conversations', async (req, res, next) => {
  try {
    const conversation = await Conversation.create({
      user: req.user._id,
      systemPrompt: req.body.systemPrompt || '',
    });

    res.status(201).json({ conversation });
  } catch (err) {
    next(err);
  }
});

router.get('/conversations/:id', async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ conversation });
  } catch (err) {
    next(err);
  }
});

router.delete('/conversations/:id', async (req, res, next) => {
  try {
    const result = await Conversation.deleteOne({ _id: req.params.id, user: req.user._id });
    if (!result.deletedCount) return res.status(404).json({ error: 'Conversation not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/**
 * Streams a reply token by token over SSE.
 *
 * The user message is saved before generation starts, so a dropped connection
 * never loses what was asked. The assistant message is saved once the stream
 * finishes, including the partial text if the client disconnects early.
 */
router.post('/conversations/:id/messages', async (req, res, next) => {
  try {
    const { content, model: requestedModel, temperature } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'content is required' });

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    conversation.messages.push({ role: 'user', content });
    conversation.ensureTitle();
    await conversation.save();

    const provider = getProvider();
    const model = resolveModel(provider, requestedModel);

    const history = [
      ...(conversation.systemPrompt
        ? [{ role: 'system', content: conversation.systemPrompt }]
        : []),
      ...conversation.messages.map(({ role, content: text }) => ({ role, content: text })),
    ];

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send('start', { model, provider: provider.name });

    // Lets us stop paying for tokens the moment the browser goes away.
    const controller = new AbortController();
    req.on('close', () => controller.abort());

    let answer = '';
    try {
      for await (const delta of provider.streamChat({
        messages: history,
        model,
        temperature,
        signal: controller.signal,
      })) {
        answer += delta;
        send('delta', { delta });
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        send('error', { message: err.message });
      }
    }

    if (answer) {
      conversation.messages.push({
        role: 'assistant',
        content: answer,
        model,
        provider: provider.name,
      });
      await conversation.save();
    }

    send('done', { conversationId: conversation._id });
    res.end();
  } catch (err) {
    next(err);
  }
});

export default router;
