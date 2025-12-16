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
        console.log('/camera: incoming request from', req.ip);

        if (!CAMERA_HOST)
        {
            console.log('/camera: CAMERA_HOST is not configured');
            res.status(400).json({ error: "CAMERA_HOST is not configured" });
            return;
        }

        if(!CAMERA_HOST || !CAMERA_PASS)
        {
            console.log('/camera: CAMERA_HOST or CAMERA_PASS is not configured');
            res.status(400).json({ error: "CAMERA_HOST or CAMERA_PASS is not configured" });
            return;
        }

        // Клиент с Digest‑аутентификацией 
        const client = new digestFetch(CAMERA_USER, CAMERA_PASS);

        // Запрос к камере через digest-fetch
        const response = await client.fetch(CAMERA_HOST);

        // Проксируем заголовки и тело
        res.writeHead(response.status, response.headers.raw());
        response.body.pipe(res);
    }
    catch (err) 
    {
        console.error('/camera: proxy error:', err);
        res.status(500).send('Proxy error');
    }
});

app.listen(33001, () => console.log("Camera proxy running on port 33001"));