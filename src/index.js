const app = require("./service.js");
const logger = require("./logger.js");

process.on("unhandledRejection", (reason, promise) => {
  logger.log("error", "unhandledRejection", {
    reason: reason.message || reason,
    stack: reason.stack,
  });
});

// Catch uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.log("error", "uncaughtException", {
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

const port = process.argv[2] || 5000;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
