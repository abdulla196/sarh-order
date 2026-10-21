
import express from "express";
import cors from "cors";
import ordersRouter from "./routes/orders.routes";
import authRouter from "./routes/auth.routes";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
  }),
);

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "sarh-orders-api",
  });
});

app.use("/api/auth", authRouter);
app.use("/api/orders", ordersRouter);

export default app;
