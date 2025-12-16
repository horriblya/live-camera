import express from "express";
import digestFetch from 'digest-fetch';

const app = express();
const { CAMERA_USER, CAMERA_PASS, CAMERA_HOST } = process.env;

// Клиент с Digest‑аутентификацией 
const client = new digestFetch(CAMERA_USER, CAMERA_PASS);

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
        console.log('/camera:: incoming request from', req.ip);

        // Запрос к камере через digest-fetch
        const response = await client.fetch(CAMERA_HOST);

        // Проксируем заголовки и тело
        res.writeHead(response.status, response.headers.raw());
        response.body.pipe(res);
    }
    catch (err) 
    {
        console.error('/camera:: proxy error:', err);
        res.status(500).send('camera_proxy_error');
    }
});

// Проверка статуса камеры
app.get('/camera/status', async (req, res) =>
{
    try 
    {
        if (!CAMERA_HOST)
        {
            console.log('/camera/status:: CAMERA_HOST is not configured');
            res.json('camera_host_not_configure');
            return;
        }

        if (!CAMERA_USER || !CAMERA_PASS)
        {
            console.log('/camera/status:: CAMERA_USER or CAMERA_PASS is not configured');
            res.json('camera_credentials_not_configured');
            return;
        }

        const response = await client.fetch(CAMERA_HOST, { method: 'HEAD' });

        if (response.ok)
        {
            res.json({ status: 'ok' });
        }
        if (response.status === 401 || response.status === 403) 
        {
            res.json({ status: 'unauthorized' });
        }
        else
        {
            res.json({ status: 'camera_error' });
        }
    }
    catch (err)
    {
        console.error('/camera/status:: proxy error:', err);
        res.status(500).json('camera_proxy_error');
    }
});

app.listen(33001, () => console.log("Camera proxy running on port 33001"));