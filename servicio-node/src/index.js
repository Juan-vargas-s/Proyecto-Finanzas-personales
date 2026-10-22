require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { arrancarConsumidorAlertas } = require('./eventos');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

// ---------- SMTP (obligatorio) ----------
// El registro de cuentas exige enviar un código por correo, así que SMTP debe
// estar configurado. Sin SMTP_HOST/EMAIL_FROM los endpoints de registro y
// reenvío responden 503 y no se crean cuentas (ya existe Forma de verificado, login sigue funcionando).
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || '';

const smtpHabilitado = Boolean(SMTP_HOST && EMAIL_FROM);
const transporter = smtpHabilitado
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    })
  : null;

if (smtpHabilitado) {
  console.log(`SMTP habilitado (host: ${SMTP_HOST}:${SMTP_PORT}, desde: ${EMAIL_FROM})`);
} else {
  console.warn('SMTP NO configurado: el registro de nuevas cuentas está DESHABILITADO hasta definir SMTP_HOST/EMAIL_FROM');
}

app.use(cors());
app.use(express.json());

// ---------- Esquemas de validación ----------
const registroSchema = z
  .object({
    nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    email: z.string().email('Email inválido'),
    password: z.string({
      required_error: 'La contraseña es obligatoria',
    }).min(6, 'La contraseña debe tener al menos 6 caracteres'),
    passwordConfirm: z.string({
      required_error: 'Debes confirmar la contraseña',
    }).min(1, 'Debes confirmar la contraseña'),
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
    emailVerificado: u.emailVerificado,
    createdAt: u.createdAt,
  };
}

// ---------- Verificación por email ----------
const DURACION_CODIGO_MS = 15 * 60 * 1000; // 15 minutos

function generarCodigo() {
  // 6 dígitos, con ceros a la izquierda si hace falta
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function enviarCodigoVerificacion(email, nombre, codigo) {
  // SMTP es obligatorio: si el envío falla lanza y el endpoint responde error
  // (los endpoints garantizan que transporter exista antes de llamar aquí).
  await transporter.sendMail({
    from: EMAIL_FROM,
    to: email,
    subject: 'Tu código de verificación — Finanzas Personales',
    text:
      `Hola ${nombre},\n\n` +
      `Tu código de acceso es: ${codigo}\n\n` +
      `Expira en 15 minutos. Si no solicitaste este código, ignora este correo.\n`,
    html: `
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Tu código de acceso es:</p>
      <p style="font-size:28px;letter-spacing:8px;font-weight:bold;">${codigo}</p>
      <p>Expira en <strong>15 minutos</strong>. Si no solicitaste este código, ignora este correo.</p>
    `,
  });
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
// Ya no inicia sesión automáticamente: envía un código de 6 dígitos al correo
// (SMTP obligatorio) y crea la cuenta pendiente de verificación. El correo se
// envía ANTES de crear la cuenta: si el envío falla no queda cuenta huérfana.
app.post('/api/auth/registro', async (req, res) => {
  const parsed = registroSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }
  const { nombre, email, password, monedaPreferida } = parsed.data;

  if (!smtpHabilitado) {
    return res.status(503).json({
      error: 'El servidor de correo no está configurado. Contacta al administrador',
    });
  }

  try {
    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente) {
      if (existente.emailVerificado) {
        return res.status(409).json({ error: 'El email ya está registrado' });
      }
      // La cuenta existe pero no está verificada: reenviar código
      const codigo = generarCodigo();
      await enviarCodigoVerificacion(email, existente.nombre, codigo);
      await prisma.usuario.update({
        where: { id: existente.id },
        data: {
          verificationToken: codigo,
          verificationExpires: new Date(Date.now() + DURACION_CODIGO_MS),
        },
      });
      return res.status(201).json({
        requiereVerificacion: true,
        email,
        mensaje: 'Reenviamos un código a tu correo',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const codigo = generarCodigo();
    await enviarCodigoVerificacion(email, nombre, codigo);

    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        email,
        passwordHash,
        ...(monedaPreferida && { monedaPreferida }),
        emailVerificado: false,
        verificationToken: codigo,
        verificationExpires: new Date(Date.now() + DURACION_CODIGO_MS),
      },
    });

    return res.status(201).json({
      requiereVerificacion: true,
      email,
      mensaje: 'Cuenta creada. Revisa tu correo para el código de verificación',
    });
  } catch (error) {
    console.error('Error en registro:', error);
    return res.status(502).json({
      error: 'No se pudo enviar el correo de verificación. Intenta de nuevo más tarde',
    });
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

    // El login exige correo verificado
    if (!usuario.emailVerificado) {
      return res.status(403).json({
        error: 'Tu cuenta aún no está verificada. Revisa tu correo para el código de 6 dígitos',
        codigo: 'EMAIL_NO_VERIFICADO',
      });
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

// ---------- Verificación de email ----------
app.post('/api/auth/verificar-email', async (req, res) => {
  const { email, codigo } = req.body || {};
  if (!email || !codigo) {
    return res.status(400).json({ error: 'Email y código son obligatorios' });
  }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) {
      return res.status(404).json({ error: 'No existe una cuenta con ese email' });
    }
    if (usuario.emailVerificado) {
      return res.status(400).json({ error: 'Esta cuenta ya está verificada. Inicia sesión' });
    }
    if (!usuario.verificationToken || usuario.verificationToken !== String(codigo)) {
      return res.status(400).json({ error: 'Código incorrecto' });
    }
    if (usuario.verificationExpires < new Date()) {
      return res.status(400).json({
        error: 'El código expiró. Solicita uno nuevo con "Reenviar código"',
      });
    }

    const verificado = await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        emailVerificado: true,
        verificationToken: null,
        verificationExpires: null,
      },
    });

    // Sesión directa tras verificar
    return res.json({
      mensaje: 'Cuenta verificada correctamente',
      token: generarToken(verificado.id),
      usuario: datosUsuario(verificado),
    });
  } catch (error) {
    console.error('Error al verificar email:', error);
    return res.status(500).json({ error: 'Error interno al verificar' });
  }
});

// ---------- Reenviar código de verificación ----------
app.post('/api/auth/reenviar-codigo', async (req, res) => {
  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'Email obligatorio' });
  }

  if (!smtpHabilitado) {
    return res.status(503).json({
      error: 'El servidor de correo no está configurado. Contacta al administrador',
    });
  }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) {
      return res.status(404).json({ error: 'No existe una cuenta con ese email' });
    }
    if (usuario.emailVerificado) {
      return res.status(400).json({ error: 'Esta cuenta ya está verificada. Inicia sesión' });
    }

    const codigo = generarCodigo();
    await enviarCodigoVerificacion(email, usuario.nombre, codigo);
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        verificationToken: codigo,
        verificationExpires: new Date(Date.now() + DURACION_CODIGO_MS),
      },
    });

    return res.json({ mensaje: 'Código reenviado. Revisa tu correo' });
  } catch (error) {
    console.error('Error al reenviar código:', error);
    return res.status(502).json({
      error: 'No se pudo enviar el correo de verificación. Intenta de nuevo más tarde',
    });
  }
});

let detenerEventos = null;

app.listen(PORT, () => {
  console.log(`Servicio Auth (Node.js) escuchando en el puerto ${PORT}`);

  // Consumidor del bus de eventos: Go publica `alerta.creada` cuando un
  // presupuesto cruza el 80 % o se excede; aquí se manda el correo.
  detenerEventos = arrancarConsumidorAlertas({
    prisma,
    transporter,
    smtpHabilitado,
    emailFrom: EMAIL_FROM,
  });
});

async function apagar(senal) {
  console.log(`Señal ${senal}: cerrando el servicio…`);
  if (detenerEventos) await detenerEventos();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));
