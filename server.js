const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const { getConnection, sql } = require('./conexion');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'clave_super_secreta_para_tu_proyecto',
    resave: false,
    saveUninitialized: false
}));

// Middleware para proteger rutas de API
function requireLogin(req, res, next) {
    if (!req.session.usuarioId) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    next();
}

// ==========================================
// AUTH
// ==========================================

app.post('/api/registro', async (req, res) => {
    const { empresa, correo, password } = req.body;
    try {
        const pool = await getConnection();

        const existe = await pool.request()
            .input('correo', sql.NVarChar, correo)
            .query('SELECT IdUsuario FROM Usuarios WHERE Correo = @correo');

        if (existe.recordset.length > 0) {
            return res.status(400).json({ error: 'El correo ya está registrado.' });
        }

        const hash = await bcrypt.hash(password, 10);
        await pool.request()
            .input('empresa', sql.NVarChar, empresa)
            .input('correo', sql.NVarChar, correo)
            .input('passwordHash', sql.NVarChar, hash)
            .query('INSERT INTO Usuarios (Empresa, Correo, PasswordHash) VALUES (@empresa, @correo, @passwordHash)');

        res.json({ success: true, message: 'Registro exitoso.' });
    } catch (error) {
        console.error("DETALLE DEL ERROR DE REGISTRO:", error);
        res.status(500).json({ error: 'Error al registrar.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { empresa, correo, password } = req.body;

    if (!empresa || !correo || !password) {
        return res.status(400).json({ error: 'Empresa, correo y contraseña son obligatorios.' });
    }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('correo', sql.NVarChar, correo)
            .query('SELECT IdUsuario, Empresa, PasswordHash FROM Usuarios WHERE Correo = @correo');

        if (result.recordset.length === 0) {
            return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
        }

        const usuario = result.recordset[0];
        const passwordCorrecta = await bcrypt.compare(password, usuario.PasswordHash);
        if (!passwordCorrecta) {
            return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
        }

        const empresaIngresada = empresa.trim().toLowerCase();
        const empresaReal = usuario.Empresa.trim().toLowerCase();

        if (empresaIngresada !== empresaReal) {
            return res.status(401).json({ error: 'La empresa no coincide con esta cuenta.' });
        }

        req.session.regenerate((err) => {
            if (err) {
                console.error("Error regenerando sesión:", err);
                return res.status(500).json({ error: 'Error en el servidor.' });
            }
            req.session.usuarioId = usuario.IdUsuario;
            req.session.empresa = usuario.Empresa;
            res.json({ success: true, redirect: '/inicio.html' });
        });

    } catch (error) {
        console.error("DETALLE DEL ERROR DE LOGIN:", error);
        res.status(500).json({ error: 'Error en el servidor.' });
    }
});

app.get('/api/sesion-actual', (req, res) => {
    if (req.session.usuarioId) {
        res.json({ logueado: true, empresa: req.session.empresa, usuarioId: req.session.usuarioId });
    } else {
        res.status(401).json({ logueado: false });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// ==========================================
// CELDAS (Editor de distribución)
// ==========================================

app.get('/api/celdas', requireLogin, async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('idUsuario', sql.Int, req.session.usuarioId)
            .query('SELECT IdCelda, PosX, PosY, Tipo, CodigoCelda FROM Celdas WHERE IdUsuario = @idUsuario ORDER BY PosY, PosX');
        res.json(result.recordset);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener celdas' });
    }
});

app.put('/api/celdas', requireLogin, async (req, res) => {
    const { celdas } = req.body;
    try {
        const pool = await getConnection();
        const idUsuario = req.session.usuarioId;

        // Verificar si hay material en celdas que se van a borrar
        const actuales = await pool.request()
            .input('idUsuario', sql.Int, idUsuario)
            .query('SELECT CodigoCelda FROM Celdas WHERE IdUsuario = @idUsuario AND Tipo = \'Estante\'');

        const codigosNuevos = celdas.filter(c => c.Tipo === 'Estante').map(c => c.CodigoCelda);
        const codigosActuales = actuales.recordset.map(c => c.CodigoCelda);

        const eliminados = codigosActuales.filter(c => !codigosNuevos.includes(c));

        if (eliminados.length > 0) {
            const check = await pool.request()
                .input('idUsuario', sql.Int, idUsuario)
                .query(`SELECT TOP 1 Celda FROM Inventario WHERE IdUsuario = @idUsuario AND Celda IN ('${eliminados.join("','")}')`);
            
            if (check.recordset.length > 0) {
                return res.status(400).json({ error: 'No puedes borrar celdas que tienen material.' });
            }
        }

        // Borrar todas las celdas del usuario y volver a insertar
        await pool.request()
            .input('idUsuario', sql.Int, idUsuario)
            .query('DELETE FROM Celdas WHERE IdUsuario = @idUsuario');

        for (const celda of celdas) {
            await pool.request()
                .input('idUsuario', sql.Int, idUsuario)
                .input('posX', sql.Int, celda.PosX)
                .input('posY', sql.Int, celda.PosY)
                .input('tipo', sql.NVarChar, celda.Tipo)
                .input('codigo', sql.NVarChar, celda.CodigoCelda)
                .query(`INSERT INTO Celdas (IdUsuario, PosX, PosY, Tipo, CodigoCelda) 
                        VALUES (@idUsuario, @posX, @posY, @tipo, @codigo)`);
        }

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al guardar distribución' });
    }
});

// ==========================================
// INVENTARIO
// ==========================================

app.get('/api/inventario', requireLogin, async (req, res) => {
    try {
        const pool = await getConnection();
        const q = req.query.q || '';
        let query = `
            SELECT IdInventario, NumeroParte, Descripcion, Cantidad, Serial, Lote, Celda, Fecha
            FROM Inventario 
            WHERE IdUsuario = @idUsuario
        `;
        if (q) {
            query += ` AND (
                NumeroParte LIKE '%' + @q + '%' OR
                Descripcion LIKE '%' + @q + '%' OR
                Serial LIKE '%' + @q + '%' OR
                Lote LIKE '%' + @q + '%' OR
                Celda LIKE '%' + @q + '%'
            )`;
        }
        query += ' ORDER BY IdInventario DESC';

        const request = pool.request().input('idUsuario', sql.Int, req.session.usuarioId);
        if (q) request.input('q', sql.NVarChar, q);

        const result = await request.query(query);
        res.json(result.recordset);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener inventario' });
    }
});

app.post('/api/inventario', requireLogin, async (req, res) => {
    const { numeroParte, descripcion, cantidad, serial, lote, celda, fecha } = req.body;
    try {
        const pool = await getConnection();
        const idUsuario = req.session.usuarioId;

        // Insertar en inventario
        const result = await pool.request()
            .input('idUsuario', sql.Int, idUsuario)
            .input('numeroParte', sql.NVarChar, numeroParte)
            .input('descripcion', sql.NVarChar, descripcion)
            .input('cantidad', sql.Int, cantidad)
            .input('serial', sql.NVarChar, serial || null)
            .input('lote', sql.NVarChar, lote)
            .input('celda', sql.NVarChar, celda)
            .input('fecha', sql.Date, fecha)
            .query(`INSERT INTO Inventario (IdUsuario, NumeroParte, Descripcion, Cantidad, Serial, Lote, Celda, Fecha)
                    OUTPUT INSERTED.IdInventario
                    VALUES (@idUsuario, @numeroParte, @descripcion, @cantidad, @serial, @lote, @celda, @fecha)`);

        const idInventario = result.recordset[0].IdInventario;

        // Registrar movimiento de Entrada
        await pool.request()
            .input('idUsuario', sql.Int, idUsuario)
            .input('idInventario', sql.Int, idInventario)
            .input('tipo', sql.NVarChar, 'Entrada')
            .input('cantidad', sql.Int, cantidad)
            .input('usuario', sql.NVarChar, req.session.empresa)
            .query(`INSERT INTO Movimientos (IdUsuario, IdInventario, TipoMovimiento, Cantidad, Usuario)
                    VALUES (@idUsuario, @idInventario, @tipo, @cantidad, @usuario)`);

        // Guardar en catálogo de partes si no existe
        await pool.request()
            .input('numeroParte', sql.NVarChar, numeroParte)
            .input('descripcion', sql.NVarChar, descripcion)
            .query(`
                IF NOT EXISTS (SELECT 1 FROM Partes WHERE NumeroParte = @numeroParte)
                INSERT INTO Partes (NumeroParte, Descripcion) VALUES (@numeroParte, @descripcion)
            `);

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al guardar material' });
    }
});

app.post('/api/inventario/:id/retirar', requireLogin, async (req, res) => {
    const { cantidad } = req.body;
    const idInventario = req.params.id;

    try {
        const pool = await getConnection();
        const idUsuario = req.session.usuarioId;

        // Verificar existencia
        const item = await pool.request()
            .input('id', sql.Int, idInventario)
            .input('idUsuario', sql.Int, idUsuario)
            .query('SELECT Cantidad FROM Inventario WHERE IdInventario = @id AND IdUsuario = @idUsuario');

        if (item.recordset.length === 0) {
            return res.status(404).json({ error: 'Material no encontrado' });
        }

        const stock = item.recordset[0].Cantidad;
        if (cantidad > stock) {
            return res.status(400).json({ error: 'No hay suficiente stock' });
        }

        // Actualizar o eliminar
        if (cantidad === stock) {
            await pool.request()
                .input('id', sql.Int, idInventario)
                .query('DELETE FROM Inventario WHERE IdInventario = @id');
        } else {
            await pool.request()
                .input('id', sql.Int, idInventario)
                .input('cantidad', sql.Int, cantidad)
                .query('UPDATE Inventario SET Cantidad = Cantidad - @cantidad WHERE IdInventario = @id');
        }

        // Registrar movimiento de Salida
        await pool.request()
            .input('idUsuario', sql.Int, idUsuario)
            .input('idInventario', sql.Int, idInventario)
            .input('tipo', sql.NVarChar, 'Salida')
            .input('cantidad', sql.Int, cantidad)
            .input('usuario', sql.NVarChar, req.session.empresa)
            .query(`INSERT INTO Movimientos (IdUsuario, IdInventario, TipoMovimiento, Cantidad, Usuario)
                    VALUES (@idUsuario, @idInventario, @tipo, @cantidad, @usuario)`);

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al retirar material' });
    }
});

// ==========================================
// PARTES (autocompletar descripción)
// ==========================================

app.get('/api/partes/:numero', requireLogin, async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('numero', sql.NVarChar, req.params.numero)
            .query('SELECT Descripcion FROM Partes WHERE NumeroParte = @numero');

        if (result.recordset.length > 0) {
            res.json({ existe: true, descripcion: result.recordset[0].Descripcion });
        } else {
            res.json({ existe: false });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al buscar parte' });
    }
});

// ==========================================
// HISTORIAL
// ==========================================

app.get('/api/movimientos', requireLogin, async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('idUsuario', sql.Int, req.session.usuarioId)
            .query(`
                SELECT IdMovimiento, TipoMovimiento, Cantidad, FechaMovimiento, Usuario
                FROM Movimientos 
                WHERE IdUsuario = @idUsuario
                ORDER BY FechaMovimiento DESC
            `);
        res.json(result.recordset);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener historial' });
    }
});

// ==========================================

app.listen(3000, () => {
    console.log('Servidor corriendo en http://localhost:3000');
});