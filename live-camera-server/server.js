import express from "express";
import digestFetch from 'digest-fetch';

const app = express();
const { CAMERA_USER, CAMERA_PASS, CAMERA_HOST } = process.env;


// Allow React dev server (or any origin) to fetch status
app.use((req, res, next) =>
{
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.get("/camera", async (req, res) =>
{
    try 
    {
        // Client with Digest authentication
        const client = new digestFetch(CAMERA_USER, CAMERA_PASS);

        // Request to camera using digest-fetch
        const response = await client.fetch(CAMERA_HOST);

        // Proxing headers and body
        res.writeHead(response.status, response.headers.raw());
        response.body.pipe(res);
    }
    catch (err) 
    {
        console.error('/camera:: proxy error:', err);
        res.status(502);
    }
});

// Check camera status support
app.get('/camera/status', async (req, res) =>
{
    const fetchTimeout = 2500; // should be less than the client status check timeout

    try 
    {
        if (!CAMERA_HOST)
        {
            console.log('/camera/status:: CAMERA_HOST is not configured');
            res.json('camera_host_not_configured');
            return;
        }

        if (!CAMERA_USER || !CAMERA_PASS)
        {
            console.log('/camera/status:: CAMERA_USER or CAMERA_PASS is not configured');
            res.json('camera_credentials_not_configured');
            return;
        }

        // Client with Digest authentication
        const client = new digestFetch(CAMERA_USER, CAMERA_PASS);
        const response = await client.fetch(CAMERA_HOST, { method: 'HEAD', signal: AbortSignal.timeout(fetchTimeout) });

        if (response.ok)
        {
            res.json('ok');
        }
        else if (response.status === 401) 
        {
            res.json('unauthorized');
        }
        else
        {
            res.json('camera_error');
        }
    }
    catch (err)
    {
        if (err.name === 'AbortError') 
        {
            console.error('/camera/status:: failed to connect camera, timeout expired (' + fetchTimeout + ' ms)');
            res.json('camera_error');
        }
        else
        {
            console.error('/camera/status:: proxy error:', err);
            res.status(500).json('camera_proxy_error');
        }
    }
});

app.listen(33001, () => console.log("Camera proxy running on port 33001"));