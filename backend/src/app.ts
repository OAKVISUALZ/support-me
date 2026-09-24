import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import creatorsRouter from "./routes/creators";
import donationsRouter from "./routes/donations";
import withdrawalsRouter from "./routes/withdrawals";
import subscriptionsRouter from "./routes/subscriptions";
import eventsRouter from "./routes/events";
import adminRouter from "./routes/admin";
import activityRouter from "./routes/activity";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import { checkSorobanRpc } from "./services/sorobanHealth";

const app = express();

app.use(requestLogger);
app.use(cors());
app.use(express.json());

app.get("/health", async (req, res) => {
  const sorobanRpc = await checkSorobanRpc();
  return res.json({
    status: sorobanRpc.status === "ok" ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    dependencies: { sorobanRpc },
  });
});

app.use("/api/auth", authRouter);
app.use("/api/creators", creatorsRouter);
app.use("/api/donations", donationsRouter);
app.use("/api/withdrawals", withdrawalsRouter);
app.use("/api/subscriptions", subscriptionsRouter);
app.use("/api/events", eventsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/activity", activityRouter);

app.use((req, res) => {
  return res.status(404).json({
    error: "Not Found",
    code: "NOT_FOUND",
    ...(req.requestId ? { requestId: req.requestId } : {}),
  });
});

app.use(errorHandler);

export default app;

