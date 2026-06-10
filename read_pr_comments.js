const https = require("https");
const req = https.request({
  hostname: "api.github.com",
  path: "/repos/FirstArmada/nuera-tech-site/pulls/88/comments",
  method: "GET",
  headers: { "User-Agent": "Node.js" }
}, res => {
  let data = "";
  res.on("data", chunk => data += chunk);
  res.on("end", () => {
    try {
        const comments = JSON.parse(data);
        console.log(JSON.stringify(comments.map(c => ({ file: c.path, line: c.line, body: c.body })), null, 2));
    } catch(e) { console.log(e); }
  });
});
req.end();
