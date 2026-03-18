import mongoose from "mongoose";

const analysisSchema = new mongoose.Schema(
  {
    errorMessage:   { type: String, required: true, trim: true },
    codeSnippet:    { type: String, required: true, trim: true },
    rootCause:      { type: String, required: true },
    errorCategory:        { type: String, enum: ["syntax", "runtime", "logic", "dependency"], required: true },
    classificationMethod: { type: String, enum: ["pattern", "ai", "default"], default: "ai" },
    fixes: {
      type: [
        {
          title:         { type: String, required: true },
          confidence:    { type: Number, required: true, min: 0, max: 100 },
          affectedLines: { type: [Number], default: [] },
          steps:         { type: [String], required: true },
          improvedCode:  { type: String, required: true },
        },
      ],
      required: true,
    },
    optimizations: {
      performance: [
        {
          title:       { type: String, required: true },
          description: { type: String, required: true },
          impact:      { type: String, enum: ["high", "medium", "low"], required: true },
        },
      ],
      quality: [
        {
          title:       { type: String, required: true },
          description: { type: String, required: true },
        },
      ],
      bestPractices: [
        {
          title:       { type: String, required: true },
          description: { type: String, required: true },
        },
      ],
      improvedCode: { type: String, required: true },
    },
  },
  {
    timestamps: true,   // adds createdAt + updatedAt automatically
  }
);

// Index so GET /history sorts fast
analysisSchema.index({ createdAt: -1 });

export default mongoose.model("Analysis", analysisSchema);
