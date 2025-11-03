const dotenv = require(`dotenv`);
const http = require("http");

// Environment variable connection
dotenv.config({ path: `./.env` });

const connectDB = require(`./config/db.js`);

// DB connection
connectDB();
const app = require(`./app.js`);
const { initSocket } = require("./socket");

const port = process.env.PORT || 5000;
const server = http.createServer(app);

initSocket(server);

server.listen(port, "0.0.0.0", () => {
  console.log(`server is listening at ${process.env.PORT}`);
});
