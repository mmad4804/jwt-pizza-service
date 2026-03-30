const app = require("./service.js");

const port = process.argv[2] || 5000;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
