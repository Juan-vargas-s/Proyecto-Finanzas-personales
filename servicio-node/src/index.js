require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', service: 'auth', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'error', service: 'auth', database: 'disconnected' });
  }
});

app.listen(PORT, () => {
  console.log(`Servicio Auth (Node.js) escuchando en el puerto ${PORT}`);
});
