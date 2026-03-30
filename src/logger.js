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
    this.factory.log(level, type, logData);
  }
}
module.exports = new Logger();
