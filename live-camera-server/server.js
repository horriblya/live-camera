import express from "express";
import request from "request";

const app = express();
const { CAMERA_USER, CAMERA_PASS, CAMERA_HOST } = process.env;

app.get("/camera", (req, res) => {
  if (!CAMERA_HOST) {
    res.status(400).json({ error: "CAMERA_HOST is not configured" });
    return;
  }

  const url = `http://${CAMERA_HOST}/axis-cgi/mjpg/video.cgi`;

  const upstream = request.get(url, {
    auth: {
      user: CAMERA_USER || "",
      pass: CAMERA_PASS || "",
      sendImmediately: true,
    },
    timeout: 10000,
  });

  let handled = false;

  upstream.on("response", (cameraRes) => {
    if (cameraRes.statusCode === 401 || cameraRes.statusCode === 403) {
      if (!handled) {
        handled = true;
        res.status(401).json({ error: "Unauthorized to access camera" });
        upstream.abort && upstream.abort();
      }
      return;
    }

    // Forward status and headers from camera
    res.writeHead(cameraRes.statusCode || 200, cameraRes.headers);
    cameraRes.pipe(res);
  });

  upstream.on("error", (err) => {
    console.error("Error connecting to camera:", err && err.message);
    if (!handled) {
      handled = true;
      if (!res.headersSent) {
        res.status(502).json({ error: "Cannot connect to camera", details: err && err.message });
      } else {
        try { res.end(); } catch (e) {}
      }
    }
  });

  // If client disconnects, abort upstream
  req.on("close", () => {
    upstream.abort && upstream.abort();
  });
});

app.listen(3001, () => console.log("Camera proxy running on port 3001"));