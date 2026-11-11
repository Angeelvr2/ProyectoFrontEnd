const { getConnection } = require('./conexion');

async function probarConexion() {
    console.log("Iniciando prueba de conexión a SQL Server...");
    try {
        const pool = await getConnection();
        console.log("✅ ¡ÉXITO! Tu Node.js ya puede hablar con SQL Server.");
        pool.close(); // Cerramos la prueba
    } catch (error) {
        console.log("❌ ERROR ENCONTRADO:");
        console.log(error);
    }
}

probarConexion();