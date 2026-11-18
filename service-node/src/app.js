const express = require("express");
const cors = require("cors");
require("dotenv").config();

const labRoutes = require("./routes/labRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const pdfRoutes = require("./routes/pdfRoutes");
const errorHandler = require("./middlewares/errorHandler");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status_code: 200,
    message: "SIMRS Node.js Service aktif dan sehat.",
    data: { service: "simrs-service-node", port: PORT, timestamp: new Date() },
    errors: null,
  });
});

// Register Modules
app.use("/api/lab", labRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/pdf", pdfRoutes);

// Global Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 SIMRS Node.js Service berjalan di http://localhost:${PORT}`);
});
