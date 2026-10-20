require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

app.use(cors());
app.use(express.json());

// ---------- Esquemas de validación ----------
const registroSchema = z
  .object({
    nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    passwordConfirm: z.string().min(1, 'Debes confirmar la contraseña'),
    monedaPreferida: z.string().min(1).max(5).optional(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'Las contraseñas no coinciden',
    path: ['passwordConfirm'],
  });

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

const perfilUpdateSchema = z.object({
  nombre: z.string().min(2).optional(),
  monedaPreferida: z.string().min(1).max(5).optional(),
});

const cambioPasswordSchema = z
  .object({
    passwordActual: z.string().min(1, 'Debes ingresar la contraseña actual'),
    passwordNueva: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
    passwordConfirm: z.string().min(1, 'Debes confirmar la nueva contraseña'),
  })
  .refine((d) => d.passwordNueva === d.passwordConfirm, {
    message: 'Las nuevas contraseñas no coinciden',
    path: ['passwordConfirm'],
  });

// ---------- Middleware de autenticación ----------
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.usuarioId = payload.usuarioId;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function generarToken(usuarioId) {
  return jwt.sign({ usuarioId }, JWT_SECRET, { expiresIn: '24h' });
}

function datosUsuario(u) {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    monedaPreferida: u.monedaPreferida,
    createdAt: u.createdAt,
  };
}

// ---------- Health ----------
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', service: 'auth', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'error', service: 'auth', database: 'disconnected' });
  }
});

// ---------- Registro ----------
app.post('/api/auth/registro', async (req, res) => {
  const parsed = registroSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }
  const { nombre, email, password, monedaPreferida } = parsed.data;

  try {
    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        email,
        passwordHash,
        ...(monedaPreferida && { monedaPreferida }),
      },
    });

    return res.status(201).json({
      token: generarToken(usuario.id),
      usuario: datosUsuario(usuario),
    });
  } catch (error) {
    console.error('Error en registro:', error);
    return res.status(500).json({ error: 'Error interno al registrar' });
  }
});

// ---------- Login ----------
app.post('/api/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }
  const { email, password } = parsed.data;

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const passwordOk = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    return res.json({
      token: generarToken(usuario.id),
      usuario: datosUsuario(usuario),
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ error: 'Error interno al iniciar sesión' });
  }
});

// ---------- Perfil ----------
app.get('/api/auth/perfil', authMiddleware, async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuarioId } });
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    return res.json(datosUsuario(usuario));
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
});

app.put('/api/auth/perfil', authMiddleware, async (req, res) => {
  const parsed = perfilUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }
  if (Object.keys(parsed.data).length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }

  try {
    const usuario = await prisma.usuario.update({
      where: { id: req.usuarioId },
      data: parsed.data,
    });
    return res.json(datosUsuario(usuario));
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// ---------- Cambio de contraseña ----------
app.put('/api/auth/cambiar-password', authMiddleware, async (req, res) => {
  const parsed = cambioPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }
  const { passwordActual, passwordNueva } = parsed.data;

  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuarioId } });
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar que la contraseña actual sea correcta
    const actualOk = await bcrypt.compare(passwordActual, usuario.passwordHash);
    if (!actualOk) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }

    // La nueva contraseña debe ser distinta a la actual
    if (passwordActual === passwordNueva) {
      return res.status(400).json({
        error: 'La nueva contraseña debe ser distinta a la actual',
      });
    }

    const passwordHash = await bcrypt.hash(passwordNueva, 10);
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { passwordHash },
    });

    return res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    return res.status(500).json({ error: 'Error interno al cambiar la contraseña' });
  }
});

app.listen(PORT, () => {
  console.log(`Servicio Auth (Node.js) escuchando en el puerto ${PORT}`);
});
