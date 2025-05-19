const express = require("express");
const cors = require("cors");
const axios = require("axios");
const url = require("url");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração CORS mais permissiva
app.use(cors({
  origin: "*",
  methods: ["GET", "HEAD", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Origin", "Accept"],
  credentials: true,
  maxAge: 86400
}));

// Rota principal
app.get("/", (req, res) => {
  res.send("Servidor proxy CORS para streaming HLS está funcionando!");
});

// Função para modificar URLs em arquivos m3u8
function processM3u8Content(content, baseUrl, proxyBaseUrl) {
  // Substituir URLs absolutas
  content = content.replace(/(https?:\/\/[^"'\s]+ )/g, (match) => {
    return `${proxyBaseUrl}/proxy?url=${encodeURIComponent(match)}`;
  });
  
  // Substituir URLs relativas
  content = content.replace(/^([^#][^:]*\.ts|[^#][^:]*\.m3u8)/gm, (match) => {
    const absoluteUrl = new URL(match, baseUrl).href;
    return `${proxyBaseUrl}/proxy?url=${encodeURIComponent(absoluteUrl)}`;
  });
  
  return content;
}

// Rota de proxy principal
app.get("/proxy", async (req, res) => {
  const requestedUrl = req.query.url;
  
  if (!requestedUrl) {
    return res.status(400).send("Parâmetro URL é obrigatório");
  }

  try {
    const parsedUrl = url.parse(requestedUrl);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}${path.dirname(parsedUrl.pathname)}`;
    const proxyBaseUrl = `${req.protocol}://${req.get('host')}`;
    
    const options = {
      method: "GET",
      url: requestedUrl,
      responseType: requestedUrl.endsWith('.ts') ? 'arraybuffer' : 'text',
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Referer": "https://www.globo.com/",
        "Origin": "https://www.globo.com"
      },
      timeout: 30000
    };

    const response = await axios(options );
    
    // Configurar cabeçalhos de resposta
    Object.keys(response.headers).forEach(key => {
      // Não copiar cabeçalhos CORS, definiremos nossos próprios
      if (!key.toLowerCase().startsWith('access-control-')) {
        res.setHeader(key, response.headers[key]);
      }
    });

    // Definir tipo de conteúdo apropriado
    if (requestedUrl.endsWith('.m3u8')) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      
      // Processar conteúdo do m3u8 para substituir URLs
      const modifiedContent = processM3u8Content(response.data, baseUrl, proxyBaseUrl);
      res.send(modifiedContent);
    } 
    else if (requestedUrl.endsWith('.ts')) {
      res.setHeader('Content-Type', 'video/mp2t');
      res.send(Buffer.from(response.data));
    } 
    else {
      // Para outros tipos de conteúdo
      res.send(response.data);
    }
  } catch (error) {
    console.error("Erro ao acessar o stream:", error.message);
    res.status(500).send(`Erro ao acessar o stream: ${error.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor proxy CORS rodando na porta ${PORT}`);
});
