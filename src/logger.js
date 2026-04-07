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
