import mongoose from "mongoose";
import { randomUUID } from "crypto";

const messageSchema = new mongoose.Schema(
  {
    role:    { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    _id: true,
  }
);

const chatSessionSchema = new mongoose.Schema(
  {
    sessionId:   { type: String, required: true, unique: true, default: () => randomUUID() },
    title:       { type: String, default: "New Chat" },
    codeContext: { type: String, default: "" },
    messages:    { type: [messageSchema], default: [] },
  },
  { timestamps: true }
);

// Auto-delete sessions inactive for 30 days
chatSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Fast lookup by sessionId
chatSessionSchema.index({ sessionId: 1 });

export default mongoose.model("ChatSession", chatSessionSchema);
