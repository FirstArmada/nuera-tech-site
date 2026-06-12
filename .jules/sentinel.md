## 2024-06-12 - IP Spoofing and Rate Limit Bypass in Cloud Run Express Apps
**Vulnerability:** Express application `cloud/chat-proxy` extracted the client IP using manual parsing of the `x-forwarded-for` header (`req.headers['x-forwarded-for']`) to enforce rate limits. Attackers could spoof this header to bypass the rate limit.
**Learning:** In a reverse proxy environment like Cloud Run, manual parsing of `x-forwarded-for` allows for trivial header spoofing by malicious clients.
**Prevention:** Always configure `app.set('trust proxy', 1)` in Express apps deployed on environments like Cloud Run so the framework securely parses the real client IP, and retrieve it using `req.ip`.
