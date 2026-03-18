import mongoose from "mongoose";

/**
 * Stores one document per HTTP request for analytics and monitoring.
 * Kept intentionally lean — only what's needed for dashboards and alerting.
 */
const requestLogSchema = new mongoose.Schema(
  {
    method:        { type: String, required: true, uppercase: true },
    path:          { type: String, required: true },   // normalised (IDs replaced with :param)
    statusCode:    { type: Number, required: true },
    responseTimeMs:{ type: Number, required: true },
    userId:        { type: String, default: null },    // null for unauthenticated / auth routes
    errorMessage:  { type: String, default: null },    // set for 4xx / 5xx
    ip:            { type: String, default: null },
    userAgent:     { type: String, default: null },
  },
  { timestamps: true }
);

// Queries needed by the analytics dashboard
requestLogSchema.index({ createdAt: -1 });                    // recent-first listing
requestLogSchema.index({ path: 1, createdAt: -1 });           // per-route stats
requestLogSchema.index({ statusCode: 1, createdAt: -1 });     // error queries

// Auto-expire logs after 90 days to keep the collection lean
requestLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model("RequestLog", requestLogSchema);
