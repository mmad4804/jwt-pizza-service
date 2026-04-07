const config = require("./config");
const JwtPizzaLogger = require("jwt-pizza-logger");

class Logger {
  constructor() {
    if (!config.logging) {
      console.warn(
        "Logging config is missing; logger initialized in idle mode.",
      );
      this.factory = {
        httpLogger: (req, res, next) => next(),
        log: () => {},
        dbLogger: () => {},
        factoryLogger: () => {},
        unhandledErrorLogger: () => {},
      };
      return;
    }

    this.factory = new JwtPizzaLogger(config);
  }

  httpLogger = (req, res, next) => {
    let send = res.send;
    res.send = (resBody) => {
      const sanitizedBody = this.sanitize(resBody);

      const logData = {
        authorized: !!req.headers.authorization,
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: JSON.stringify(req.body),
        resBody: sanitizedBody,
      };

      this.log(this.statusToLogLevel(res.statusCode), "http", logData);

      res.send = send;
      return res.send(resBody);
    };
    next();
  };

  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return "error";
    if (statusCode >= 400) return "warn";
    return "info";
  }

  dbLogger(query) {
    this.factory.dbLogger(query);
  }

  factoryLogger(orderInfo) {
    this.factory.factoryLogger(orderInfo);
  }

  unhandledErrorLogger(err) {
    this.factory.unhandledErrorLogger(err);
  }

  sanitize(logData) {
    let logString = JSON.stringify(logData);
    return logString
      .replace(/\\"password\\":\s*\\"[^"]*\\"/g, '\\"password\\":\\"*****\\"')
      .replace(/\\"token\\":\s*\\"[^"]*\\"/g, '\\"token\\":\\"*****\\"')
      .replace(/\\"jwt\\":\s*\\"[^"]*\\"/g, '\\"jwt\\":\\"*****\\"');
  }

  log(level, type, logData) {
    const sanitizedData = this.sanitize(logData);
    this.factory.log(level, type, sanitizedData);
  }
}
module.exports = new Logger();
