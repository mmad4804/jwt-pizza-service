class StatusCodeError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  asyncHandler,
  StatusCodeError,
};
