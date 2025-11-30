import express from "express";
import request from "request";

const app = express();
const { CAMERA_USER, CAMERA_PASS, CAMERA_HOST } = process.env;

// Allow React dev server (or any origin) to fetch status
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

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
    console.error("Error connecting to camera " + url, err && err.message);
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

// Status endpoint for clients to know camera/proxy health
app.get('/camera/status', (req, res) => {
  if (!CAMERA_HOST) {
    res.status(200).json({ status: 'error', reason: 'no_camera_host_configured' });
    return;
  }

  const url = `http://${CAMERA_HOST}/axis-cgi/mjpg/video.cgi`;

  const upstream = request.get(url, {
    auth: {
      user: CAMERA_USER || '',
      pass: CAMERA_PASS || '',
      sendImmediately: true,
    },
    timeout: 5000,
  });

  let handled = false;

  upstream.on('response', (cameraRes) => {
    if (handled) return;

    if (cameraRes.statusCode === 401 || cameraRes.statusCode === 403) {
      handled = true;
      res.status(200).json({ status: 'error', reason: 'unauthorized' });
      upstream.abort && upstream.abort();
      return;
    }

    if (cameraRes.statusCode && cameraRes.statusCode >= 400) {
      handled = true;
      res.status(200).json({ status: 'error', reason: 'camera_error', code: cameraRes.statusCode });
      upstream.abort && upstream.abort();
      return;
    }

    handled = true;
    res.status(200).json({ status: 'ok' });
    upstream.abort && upstream.abort();
  });

  upstream.on('error', (err) => {
    if (handled) return;
    handled = true;
    res.status(200).json({ status: 'error', reason: 'cannot_connect', details: err && err.message });
  });

  req.on('close', () => {
    upstream.abort && upstream.abort();
  });
});

app.listen(3001, () => console.log("Camera proxy running on port 3001"));