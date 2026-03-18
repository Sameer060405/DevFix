import mongoose from "mongoose";

const fixSchema = new mongoose.Schema(
  {
    title:         { type: String, required: true },
    confidence:    { type: Number, required: true, min: 0, max: 100 },
    affectedLines: { type: [Number], default: [] },
    steps:         { type: [String], default: [] },
    improvedCode:  { type: String, default: "" },
  },
  { _id: false }
);

const chatMessageSchema = new mongoose.Schema(
  {
    role:      { type: String, enum: ["user", "assistant"], required: true },
    content:   { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type:     String,
      required: true,
      trim:     true,
      index:    true,
    },
    title:    { type: String, default: "Untitled Session", trim: true, maxlength: 200 },
    fileName: { type: String, trim: true },
    language: { type: String, trim: true },

    // Code in the editor at save time — capped at 100 KB in the route layer
    codeSnapshot: { type: String },

    // The error message the user typed when running Analyze
    errorMessage: { type: String, trim: true },

    // Snapshot of the AI analysis result
    analysisResult: {
      rootCause:     { type: String },
      errorCategory: { type: String, enum: ["syntax", "runtime", "logic", "dependency"] },
      fixes:         { type: [fixSchema], default: [] },
    },

    // Snapshot of the last N chat messages at save time
    chatMessages: { type: [chatMessageSchema], default: [] },
  },
  { timestamps: true }
);

// Fast per-user listing, newest first
sessionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("Session", sessionSchema);
