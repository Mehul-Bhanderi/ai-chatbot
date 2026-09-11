import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['system', 'user', 'assistant'], required: true },
    content: { type: String, required: true },
    // Recorded per message so a conversation that spans a provider switch
    // still shows which model produced each reply.
    model: { type: String },
    provider: { type: String },
  },
  { timestamps: true, _id: true }
);

const conversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'New conversation' },
    systemPrompt: { type: String, default: '' },
    messages: [messageSchema],
  },
  { timestamps: true }
);

conversationSchema.index({ user: 1, updatedAt: -1 });

/** Names an untitled conversation after its first user message. */
conversationSchema.methods.ensureTitle = function ensureTitle() {
  if (this.title && this.title !== 'New conversation') return;

  const first = this.messages.find((m) => m.role === 'user');
  if (!first) return;

  this.title = first.content.trim().slice(0, 60) + (first.content.trim().length > 60 ? '…' : '');
};

export const Conversation = mongoose.model('Conversation', conversationSchema);
