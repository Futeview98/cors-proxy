const express = require("express" );
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware" );
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "*",
  methods: ["GET", "HEAD", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.get("/", (req, res) => {
  res.send("Servidor proxy CORS para streaming HLS está funcionando!");
});

app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  
  if (!url) {
    return res.status(400).send("Parâmetro URL é obrigatório");
  }

  try {
    const options = {
      method: "GET",
      url: url,
      responseType: "stream",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Referer": "https://www.globo.com/",
        "Origin": "https://www.globo.com"
      }
    };

    const response = await axios(options );
    
    Object.keys(response.headers).forEach(key => {
      if (key.toLowerCase() !== "access-control-allow-origin" && 
          key.toLowerCase() !== "access-control-allow-methods" && 
          key.toLowerCase() !== "access-control-allow-headers") {
        res.setHeader(key, response.headers[key]);
      }
    });

    if (url.endsWith(".m3u8")) {
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    }

    response.data.pipe(res);
  } catch (error) {
    console.error("Erro ao acessar o stream:", error.message);
    res.status(500).send(`Erro ao acessar o stream: ${error.message}`);
  }
});

app.use("/stream", createProxyMiddleware({
  target: "https://live-01.edge-forte-caw-rj.video.globo.com",
  changeOrigin: true,
  pathRewrite: {
    "^/stream": ""
  },
  onProxyReq: (proxyReq ) => {
    proxyReq.setHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
    proxyReq.setHeader("Referer", "https://www.globo.com/" );
    proxyReq.setHeader("Origin", "https://www.globo.com" );
  }
}));

app.listen(PORT, () => {
  console.log(`Servidor proxy CORS rodando na porta ${PORT}`);
});
