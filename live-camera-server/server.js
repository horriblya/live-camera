import express from "express";
import http from "http";
import { URL } from "url";

const app = express();
const { CAMERA_USER, CAMERA_PASS, CAMERA_HOST } = process.env;

// Allow React dev server (or any origin) to fetch status
app.use((req, res, next) =>
{
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.get("/camera", (req, res) =>
{
    let writeHeadersRequired = true;
    let cameraUpstream = null;
    let reconnectTimer = null;
    let reconnectAttempts = 0;

    console.log('/camera: incoming request from', req.ip);
    if (!CAMERA_HOST)
    {
        console.log('/camera: CAMERA_HOST not configured');
        res.status(400).json({ error: "CAMERA_HOST is not configured" });
        return;
    }

    const url = new URL(`http://${CAMERA_HOST}/axis-cgi/mjpg/video.cgi`);
    console.log('/camera: connecting to camera at', url.href);
    const auth = Buffer.from(`${CAMERA_USER || ""}:${CAMERA_PASS || ""}`).toString("base64");

    // If client disconnects, always abort upstream
    req.on("close", () =>
    {
        console.log('/camera: client request closed, destroying upstream');

        if(reconnectTimer)
        {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        if (cameraUpstream)
        {
            try 
            {
                cameraUpstream.destroy();
            }
            catch (e) 
            {
                console.log('/camera: failed to destroy upstream', e);
            }
        }
    });

    const writeHeaders = (cameraRes) =>
    {
        console.log('/camera: piping headers to client');

        if(writeHeadersRequired)
        {
            // Copy and sanitize headers to avoid forwarding hop-by-hop headers
            const forwardedHeaders = { ...(cameraRes.headers || {}) };
            delete forwardedHeaders['connection'];
            delete forwardedHeaders['keep-alive'];
            delete forwardedHeaders['proxy-connection'];
            delete forwardedHeaders['transfer-encoding'];
            delete forwardedHeaders['upgrade'];

            // Ensure sensible defaults for streaming
            forwardedHeaders['cache-control'] = forwardedHeaders['cache-control'] || 'no-cache';
            if (cameraRes.headers && cameraRes.headers['content-type'])
            {
                forwardedHeaders['content-type'] = cameraRes.headers['content-type'];
            }

            res.writeHead(cameraRes.statusCode || 200, forwardedHeaders);

            writeHeadersRequired = false;
        }
    }


    // Helper to establish camera connection
    const connectToCamera = () =>
    {
        console.log('/camera: connecting, attempt: ', ++reconnectAttempts);

        const options = 
        {
            hostname: url.hostname,
            port: url.port || 80,
            path: url.pathname + url.search,
            method: "GET",
            headers: { "Authorization": `Basic ${auth}` },
        };

        let handled = false;

        cameraUpstream = http.request(options, (cameraRes) =>
        {
            console.log('/camera upstream: got response, status', cameraRes.statusCode);
            if (cameraRes.statusCode === 401 || cameraRes.statusCode === 403)
            {
                if (handled == false)
                {
                    handled = true;
                    res.status(401).json({ error: "Unauthorized to access camera" });
                    cameraUpstream.destroy();
                }
                return;
            }

            // Forward status and headers from camera
            if (handled == false)
            {
                handled = true;

                writeHeaders(cameraRes);

                // Pipe camera response to client and wire up lifecycle logs
                cameraRes.pipe(res);
                cameraRes.on('close', () => 
                {
                    console.log('/camera upstream: closed')
                    scheduleReconnect();
                });
                cameraRes.on('error', (err) => 
                {
                    console.error('/camera upstream: error', err && err.message)
                    scheduleReconnect();
                });
            }
        });

        cameraUpstream.on("error", (err) =>
        {
            console.error("/camera upstream: error connecting to camera " + url, err && err.message);
            scheduleReconnect();
        });

        cameraUpstream.end();
    }

    const scheduleReconnect = () =>
    {
        let delay = 5000;
        reconnectAttempts = 0;

        // Prevent scheduling multiple reconnects for the same upstream
        if (reconnectTimer) 
        {
            console.log('/camera: reconnect already scheduled, skipping');
            return;
        }

        console.log('/camera: scheduling reconnect in', delay, 'ms');
        
        reconnectTimer = setTimeout(() =>
        {
            reconnectTimer = null;
            connectToCamera();
        }, delay);
    };

    // Start the first connection
    connectToCamera();
});


// Status endpoint for clients to know camera/proxy health
app.get('/camera/status', (req, res) =>
{
    if (!CAMERA_HOST)
    {
        res.status(200).json({ status: 'error', reason: 'no_camera_host_configured' });
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

    const upstream = http.request(options, (cameraRes) =>
    {
        if (handled) return;

        if (cameraRes.statusCode === 401 || cameraRes.statusCode === 403)
        {
            handled = true;
            res.status(200).json({ status: 'error', reason: 'unauthorized' });
            upstream.destroy();
            return;
        }

        if (cameraRes.statusCode && cameraRes.statusCode >= 400)
        {
            handled = true;
            res.status(200).json({ status: 'error', reason: 'camera_error', code: cameraRes.statusCode });
            upstream.destroy();
            return;
        }

        handled = true;
        res.status(200).json({ status: 'ok' });
        upstream.destroy();
    });

    upstream.on('error', (err) =>
    {
        if (handled) return;
        handled = true;
        res.status(200).json({ status: 'error', reason: 'cannot_connect', details: err && err.message });
    });

    upstream.on('timeout', () =>
    {
        if (handled) return;
        handled = true;
        res.status(200).json({ status: 'error', reason: 'timeout' });
        upstream.destroy();
    });

    req.on('close', () =>
    {
        if (!handled)
        {
            handled = true;
            upstream.destroy();
        }
    });

    upstream.end();
});

app.listen(3001, () => console.log("Camera proxy running on port 3001"));