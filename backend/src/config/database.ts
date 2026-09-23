import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/taskmanager';
    await mongoose.connect(mongoUri);
    // Mask credentials in logs — never print the full URI (it contains password)
    const safeUri = mongoUri.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
    console.log(`[MongoDB] Connected successfully to ${safeUri}`);
  } catch (error) {
    console.error('[MongoDB] Connection error:', error);
    process.exit(1);
  }
};
