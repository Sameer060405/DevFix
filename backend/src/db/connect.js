import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not set in environment variables.");
  }

  await mongoose.connect(uri, { tls: true, tlsAllowInvalidCertificates: true });
  console.log("MongoDB connected:", mongoose.connection.host);
}
