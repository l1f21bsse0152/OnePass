import mongoose from "mongoose";

export const getHealth = (req, res) => {
  res.status(200).json({
    success: true,
    message: "OnePass API is running!",
    server: "Online",
    database:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Disconnected",
    timestamp: new Date().toISOString()
  });
};