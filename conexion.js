const sql = require('mssql/msnodesqlv8');

// Usamos el Driver 17 y el nombre real de la instancia (ADRIAN\SQLEXPRESS)
const connectionString = 'Driver={ODBC Driver 17 for SQL Server};Server=ADRIAN\\SQLEXPRESS;Database=SistemaLogin;Trusted_Connection=yes;';

const getConnection = async () => {
    try {
        const pool = await sql.connect({ connectionString: connectionString });
        return pool;
    } catch (error) {
        console.error("Error detallado:", error.message);
        throw error;
    }
};

module.exports = { getConnection, sql };