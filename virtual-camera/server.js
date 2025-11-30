import express from "express";
import { spawn } from "child_process";

const app = express();

const {
  BASIC_USER,
  BASIC_PASS,
  SOURCE_TYPE = "file", // "file" or "device"
  SOURCE_FILE = "/media/sample.mp4",
  DEVICE = "/dev/video0",
  FPS = "30"
} = process.env;

function checkBasicAuth(req, res, next) {
  if (!BASIC_USER) return next(); // auth disabled
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="VirtualCamera"');
    return res.status(401).send("Authentication required");
  }
  const creds = Buffer.from(auth.split(" ")[1], "base64").toString();
  const [user, pass] = creds.split(":");
  if (user === BASIC_USER && pass === BASIC_PASS) return next();
  res.set("WWW-Authenticate", 'Basic realm="VirtualCamera"');
  return res.status(401).send("Invalid credentials");
}

// helper: запускаем ffmpeg и парсим stdout на JPEG кадры
function startFFmpegStream() {
  // входной источник
  const input = SOURCE_TYPE === "device" ? DEVICE : SOURCE_FILE;

  // ffmpeg: читаем вход, конвертим в последовательность JPEG в stdout
  // -re для реального времени, -stream_loop -1 для зацикливания файла
  const args = SOURCE_TYPE === "file"
    ? ["-re", "-stream_loop", "-1", "-i", input, "-r", FPS, "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "5", "-"]
    : ["-f", "v4l2", "-i", input, "-r", FPS, "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "5", "-"];

  const ff = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "inherit"] });

  ff.on("error", (err) => {
    console.error("ffmpeg error:", err);
  });

  ff.on("exit", (code, sig) => {
    console.log("ffmpeg exited", code, sig);
  });

  return ff.stdout;
}

// парсер JPEG из потока (ищем маркеры SOI/EOI)
function jpegFrameSplitter(stream, onFrame) {
  let buffer = Buffer.alloc(0);
  stream.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    let start = buffer.indexOf(Buffer.from([0xff, 0xd8])); // SOI
    let end = buffer.indexOf(Buffer.from([0xff, 0xd9]), start + 2); // EOI
    while (start !== -1 && end !== -1) {
      const frame = buffer.slice(start, end + 2);
      onFrame(frame);
      buffer = buffer.slice(end + 2);
      start = buffer.indexOf(Buffer.from([0xff, 0xd8]));
      end = buffer.indexOf(Buffer.from([0xff, 0xd9]), start + 2);
    }
  });
  stream.on("end", () => console.log("ffmpeg stdout ended"));
}

// single ffmpeg instance shared by all clients
let ffmpegStdout = null;
let clients = 0;
let frameBuffer = null;

app.get("/axis-cgi/mjpg/video.cgi", checkBasicAuth, (req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "close");
  const boundary = "--myboundary";
  res.setHeader("Content-Type", `multipart/x-mixed-replace; boundary=${boundary}`);

  clients++;
  console.log("Client connected, total:", clients);

  // если ffmpeg ещё не запущен — запускаем и подписываемся на кадры
  if (!ffmpegStdout) {
    ffmpegStdout = startFFmpegStream();
    jpegFrameSplitter(ffmpegStdout, (frame) => {
      frameBuffer = frame; // держим последний кадр
    });
  }

  // отправляем кадры клиенту в интервале (используем последний кадр)
  let closed = false;
  const sendFrame = () => {
    if (closed) return;
    if (frameBuffer) {
      res.write(`${boundary}\r\n`);
      res.write("Content-Type: image/jpeg\r\n");
      res.write(`Content-Length: ${frameBuffer.length}\r\n\r\n`);
      res.write(frameBuffer);
      res.write("\r\n");
    }
    // частота отправки контролируется FPS
    setTimeout(sendFrame, 1000 / Math.max(1, parseInt(process.env.FPS || "10")));
  };

  // сразу отправим, затем цикл
  sendFrame();

  req.on("close", () => {
    closed = true;
    clients--;
    console.log("Client disconnected, total:", clients);
    if (clients <= 0) {
      // остановим ffmpeg через небольшую задержку, если нет клиентов
      setTimeout(() => {
        if (clients === 0 && ffmpegStdout) {
          try { ffmpegStdout.destroy(); } catch (e) { }
          ffmpegStdout = null;
          frameBuffer = null;
          console.log("Stopped ffmpeg due to no clients");
        }
      }, 2000);
    }
  });
});

const port = 8080;
app.listen(port, () => console.log(`Virtual camera listening on :${port}`));