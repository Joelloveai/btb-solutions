// A stand-in for OpenWeatherMap so the tests exercise the real fetch path without the internet.
// Always reports light rain at 27.4 degrees, unless lat=0 (then 500, to show the diary copes).
const http = require("node:http");
http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/health") return void res.end("ok");
    if (url.searchParams.get("lat") === "0") {
      res.statusCode = 500;
      return void res.end("{}");
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ weather: [{ main: "Rain", description: "light rain" }], main: { temp: 27.4 } }));
  })
  .listen(3199);
