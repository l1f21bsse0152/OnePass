
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(
      process.env.MONGODB_URI
    );

    console.log("MongoDB connected successfully!");
    console.log("Database:", connection.connection.name);

  } catch (error) {
    console.error("MongoDB error:", error.message);
    throw error;
  }
};

export default connectDB;