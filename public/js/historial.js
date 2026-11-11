fetch('/api/sesion-actual')
    .then(res => res.json())
    .then(data => {
        if (!data.logueado) window.location.href = '/index.html';
        else cargarHistorial();
    });

async function cargarHistorial() {
    try {
        const res = await fetch('/api/movimientos');
        const movimientos = await res.json();
        const tbody = document.getElementById('tablaMovimientos');

        if (movimientos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px;">No hay movimientos registrados.</td></tr>`;
            return;
        }

        tbody.innerHTML = movimientos.map(mov => `
            <tr>
                <td>${mov.IdMovimiento}</td>
                <td>${new Date(mov.FechaMovimiento).toLocaleString()}</td>
                <td>
                    <span class="badge ${mov.TipoMovimiento === 'Entrada' ? 'entrada' : 'salida'}">
                        ${mov.TipoMovimiento}
                    </span>
                </td>
                <td>${mov.Cantidad}</td>
                <td>${mov.Usuario}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error(err);
    }
}