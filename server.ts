import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, { cors: { origin: '*' } });
  const PORT = 3000;
  
  const rooms = new Map();

  io.on('connection', (socket) => {
    socket.on('join-room', ({ roomId, username }) => {
      socket.join(roomId);
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map());
      }
      const room = rooms.get(roomId);
      const color = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
      room.set(socket.id, { id: socket.id, username, text: '', color });
      
      io.to(roomId).emit('room-update', Array.from(room.values()));
      
      socket.on('update-text', (text) => {
        const user = room.get(socket.id);
        if (user) {
          user.text = text;
          io.to(roomId).emit('room-update', Array.from(room.values()));
        }
      });
      
      socket.on('disconnect', () => {
        room.delete(socket.id);
        if (room.size === 0) {
          rooms.delete(roomId);
        } else {
          io.to(roomId).emit('room-update', Array.from(room.values()));
        }
      });
    });
  });

  app.use(express.json());

  app.post('/api/gemini/resolve', async (req, res) => {
    try {
      const { text, instruction } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Gemini API key is not configured.' });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `You are an expert AI developer and conflict resolver.
I have a text or code snippet with conflicts, or I want you to modify it according to some instruction.
Please output ONLY the resolved/modified text without any markdown blocks or explanations, unless I ask for an explanation.

Instruction: ${instruction || 'Resolve the conflicts in the most logical way.'}

Input text:
${text}
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
      });

      res.json({ result: response.text });
    } catch (error: any) {
      console.error('Gemini error:', error);
      res.status(500).json({ error: error.message || 'Failed to process request with Gemini.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
