import express from "express";
import http from "http";
import { URL } from "url";

const app = express();
const { CAMERA_USER, CAMERA_PASS, CAMERA_HOST } = process.env;

// Allow React dev server (or any origin) to fetch status
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.get("/camera", (request, result) => {
  console.log('/camera handler: incoming request from', request.ip);
  if (!CAMERA_HOST) {
    console.log('/camera handler: CAMERA_HOST not configured');
    result.status(400).json({ error: "CAMERA_HOST is not configured" });
    return;
  }

  const url = new URL(`http://${CAMERA_HOST}/axis-cgi/mjpg/video.cgi`);
  console.log('/camera handler: connecting to camera at', url.href);
  const auth = Buffer.from(`${CAMERA_USER || ""}:${CAMERA_PASS || ""}`).toString("base64");

  const options = {
    hostname: url.hostname,
    port: url.port || 80,
    path: url.pathname + url.search,
    method: "GET",
    headers: {
      "Authorization": `Basic ${auth}`,
    },
  };

  let handled = false;

  const cameraUpstream = http.request(options, (result) => {
    console.log('/camera upstream: got response, status', result.statusCode);
    if (result.statusCode === 401 || result.statusCode === 403) {
      if (!handled) {
        handled = true;
        result.status(401).json({ error: "Unauthorized to access camera" });
        cameraUpstream.destroy();
      }
      return;
    }

    // Forward status and headers from camera
    if (!handled) {
      handled = true;
      console.log('/camera upstream: piping headers to client');

      // Copy and sanitize headers to avoid forwarding hop-by-hop headers
       const forwardedHeaders = { ...(result.headers || {}) };
      // delete forwardedHeaders['connection'];
      // delete forwardedHeaders['keep-alive'];
      // delete forwardedHeaders['proxy-connection'];
      // delete forwardedHeaders['transfer-encoding'];
      // delete forwardedHeaders['upgrade'];

      // Ensure sensible defaults for streaming
      forwardedHeaders['cache-control'] = forwardedHeaders['cache-control'] || 'no-cache';
      if (result.headers && result.headers['content-type']) {
        forwardedHeaders['content-type'] = result.headers['content-type'];
      }

      result.writeHead(result.statusCode || 200, forwardedHeaders);

      // Pipe camera response to client and wire up lifecycle logs
      result.pipe(result);
      result.on('close', () => console.log('/camera upstream: cameraRes closed'));
      result.on('end', () => console.log('/camera upstream: cameraRes end'));
      result.on('error', (err) => console.error('/camera upstream: cameraRes error', err && err.message));
    }
  });

  cameraUpstream.on("error", (err) => {
    console.error("/camera upstream error connecting to camera " + url, err && err.message);
    if (!handled) {
      handled = true;
      if (!result.headersSent) {
        result.status(502).json({ error: "Cannot connect to camera", details: err && err.message });
      } else {
        try { result.end(); } catch (e) {}
      }
    }
  });

  // If client disconnects, always abort upstream
  request.on("close", () => {
    console.log('/camera handler: client request closed - destroying upstream');
    try { cameraUpstream.destroy(); } catch (e) {}
  });

  cameraUpstream.end();
});

// Status endpoint for clients to know camera/proxy health
app.get('/camera/status', (request, result) => {
  if (!CAMERA_HOST) {
    result.status(200).json({ status: 'error', reason: 'no_camera_host_configured' });
    return;
  }

  const url = new URL(`http://${CAMERA_HOST}/axis-cgi/mjpg/video.cgi`);
  const auth = Buffer.from(`${CAMERA_USER || ''}:${CAMERA_PASS || ''}`).toString("base64");

  const options = {
    hostname: url.hostname,
    port: url.port || 80,
    path: url.pathname + url.search,
    method: "GET",
    headers: {
      "Authorization": `Basic ${auth}`,
    },
    timeout: 5000,
  };

  let handled = false;

  const upstream = http.request(options, (cameraRes) => {
    if (handled) return;

    if (cameraRes.statusCode === 401 || cameraRes.statusCode === 403) {
      handled = true;
      result.status(200).json({ status: 'error', reason: 'unauthorized' });
      upstream.destroy();
      return;
    }

    if (cameraRes.statusCode && cameraRes.statusCode >= 400) {
      handled = true;
      result.status(200).json({ status: 'error', reason: 'camera_error', code: cameraRes.statusCode });
      upstream.destroy();
      return;
    }

    handled = true;
    result.status(200).json({ status: 'ok' });
    upstream.destroy();
  });

  upstream.on('error', (err) => {
    if (handled) return;
    handled = true;
    result.status(200).json({ status: 'error', reason: 'cannot_connect', details: err && err.message });
  });

  upstream.on('timeout', () => {
    if (handled) return;
    handled = true;
    result.status(200).json({ status: 'error', reason: 'timeout' });
    upstream.destroy();
  });

  request.on('close', () => {
    if (!handled) {
      handled = true;
      upstream.destroy();
    }
  });

  upstream.end();
});

app.listen(3001, () => console.log("Camera proxy running on port 3001"));