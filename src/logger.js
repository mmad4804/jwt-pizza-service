const config = require("./config");
const JwtPizzaLogger = require("jwt-pizza-logger");

class Logger {
  constructor() {
    this.factory = new JwtPizzaLogger(config);
  }

  httpLogger = (req, res, next) => {
    this.factory.httpLogger(req, res, next);
  };

  dbLogger(query) {
    this.factory.dbLogger(query);
  }

  factoryLogger(orderInfo) {
    this.factory.factoryLogger(orderInfo);
  }

  unhandledErrorLogger(err) {
    this.factory.unhandledErrorLogger(err);
  }

  log(level, type, logData) {
    const labels = {
      component: config.logging.source,
      level: level,
      type: type,
    };

    this.factory.log(labels, this.sanitize(logData));
  }

  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return "error";
    if (statusCode >= 400) return "warn";
    return "info";
  }

  nowString() {
    return (Math.floor(Date.now()) * 1000000).toString();
  }

  sanitize(logData) {
    let logString = JSON.stringify(logData);
    // Sanitize passwords, tokens, and credit cards
    return logString
      .replace(/\\"password\\":\s*\\"[^"]*\\"/g, '\\"password\\":\\"*****\\"')
      .replace(/\\"token\\":\s*\\"[^"]*\\"/g, '\\"token\\":\\"*****\\"')
      .replace(/\\"email\\":\s*\\"[^"]*\\"/g, '\\"email\\":\\"*****\\"')
      .replace(/\\"jwt\\":\s*\\"[^"]*\\"/g, '\\"jwt\\":\\"*****\\"');
  }

  sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    fetch(`${config.logging.endpointUrl}`, {
      method: "post",
      body: body,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.logging.accountId}:${config.logging.apiKey}`,
      },
    }).then((res) => {
      if (!res.ok) console.log("Failed to send log to Grafana");
    });
  }
}
module.exports = new Logger();
