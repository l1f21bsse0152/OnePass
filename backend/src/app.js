
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.routes.js";
import walletRoutes from "./routes/wallet.routes.js";
import facilityQRRoutes from "./routes/facility-qr.routes.js";
import accessRoutes from "./routes/access.routes.js";
import healthRoutes from "./routes/health.routes.js";
import facilityRoutes from "./routes/facility.routes.js";
import passRoutes from "./routes/pass.routes.js";
import historyRoutes from "./routes/history.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import demoRoutes from "./routes/demo.routes.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// Global API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  skip: (req) => req.originalUrl.startsWith("/api/demo/"),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later."
  }
});

app.use("/api", apiLimiter);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to OnePass API"
  });
});

// Health check route
app.use("/api/health", healthRoutes);

// Authentication routes
app.use("/api/auth", authRoutes);

// Wallet routes
app.use("/api/wallet", walletRoutes);

// Facility QR routes
app.use("/api/facility-qr", facilityQRRoutes);

// Facility access routes
app.use("/api/access", accessRoutes);

// Facility discovery routes
app.use("/api/facilities", facilityRoutes);

// OnePass pass catalog and traveler pass status.
app.use("/api/passes", passRoutes);

// Monthly traveler wallet and facility history.
app.use("/api/history", historyRoutes);

// Role-specific web dashboard endpoints.
app.use("/api/dashboard", dashboardRoutes);

// Isolated sample data for the web dashboard; this router does not access MongoDB.
app.use("/api/demo", demoRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found."
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled Application Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "An unexpected error occurred."
  });
});

export default app;
