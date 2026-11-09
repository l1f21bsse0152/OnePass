
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import authRoutes from "./routes/auth.routes.js";
import walletRoutes from "./routes/wallet.routes.js";
import facilityQRRoutes from "./routes/facility-qr.routes.js";
import accessRoutes from "./routes/access.routes.js";

const app = express();

app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to OnePass API"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "OnePass API is running!",
    server: "Online",
    database: "Connected",
    timestamp: new Date().toISOString()
  });
});

// Authentication routes
app.use("/api/auth", authRoutes);

// Wallet routes
app.use("/api/wallet", walletRoutes);

// Facility QR routes
app.use("/api/facility-qr", facilityQRRoutes);

// Facility access routes
app.use("/api/access", accessRoutes);

export default app;
