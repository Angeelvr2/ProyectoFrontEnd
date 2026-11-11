let inventario = [];
let celdas = [];
let celdaResaltada = null;
let itemRetiro = null;
let mostrarAlta = false;

// Verificar sesión
fetch('/api/sesion-actual')
    .then(res => res.json())
    .then(data => {
        if (!data.logueado) {
            window.location.href = '/index.html';
        } else {
            document.getElementById('empresaNombre').textContent = data.empresa;
            cargarDatos();
        }
    });

document.getElementById('logoutBtn').addEventListener('click', () => {
    fetch('/api/logout', { method: 'POST' }).then(() => {
        window.location.href = '/index.html';
    });
});

// Cargar datos
async function cargarDatos() {
    const busqueda = document.getElementById('busqueda').value;
    try {
        const [resInv, resCeldas] = await Promise.all([
            fetch(`/api/inventario?q=${encodeURIComponent(busqueda)}`),
            fetch('/api/celdas')
        ]);
        inventario = await resInv.json();
        celdas = await resCeldas.json();
        renderizarCroquis();
        renderizarTabla();
    } catch (err) {
        console.error(err);
    }
}

// Búsqueda con debounce
let timeoutBusqueda;
document.getElementById('busqueda').addEventListener('input', () => {
    clearTimeout(timeoutBusqueda);
    timeoutBusqueda = setTimeout(cargarDatos, 300);
});

// Renderizar croquis
function renderizarCroquis() {
    const maxX = celdas.length ? Math.max(...celdas.map(c => c.PosX)) : 10;
    const maxY = celdas.length ? Math.max(...celdas.map(c => c.PosY)) : 10;
    const grid = document.getElementById('gridCroquis');
    grid.style.gridTemplateColumns = `repeat(${maxX}, 40px)`;
    grid.style.gridTemplateRows = `repeat(${maxY}, 40px)`;
    grid.innerHTML = '';

    celdas.forEach(celda => {
        const div = document.createElement('div');
        div.className = 'celda';
        div.style.gridColumn = celda.PosX;
        div.style.gridRow = celda.PosY;

        if (celda.Tipo === 'Estante') {
            const items = inventario.filter(i => i.Celda === celda.CodigoCelda);
            const total = items.reduce((a, i) => a + i.Cantidad, 0);
            div.style.background = items.length === 0 ? '#e2e8f0' : (total < 5 ? '#fbbf24' : '#4ade80');
            div.textContent = celda.CodigoCelda;
            div.title = `Celda: ${celda.CodigoCelda}`;
            div.style.cursor = mostrarAlta ? 'crosshair' : 'default';

            if (celdaResaltada === celda.CodigoCelda) {
                div.classList.add('resaltada');
            }

            div.addEventListener('click', () => {
                if (mostrarAlta) {
                    document.getElementById('altaCelda').value = celda.CodigoCelda;
                    celdaResaltada = celda.CodigoCelda;
                    renderizarCroquis();
                }
            });
        } else {
            div.style.background = '#d1d5db';
            div.textContent = celda.Tipo === 'Pasillo' ? '' : celda.Tipo.charAt(0);
        }
        grid.appendChild(div);
    });
}

// Renderizar tabla
function renderizarTabla() {
    const tbody = document.getElementById('tablaInventario');

    if (inventario.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="vacio">No se encontraron materiales</td>
            </tr>`;
        return;
    }

    tbody.innerHTML = inventario.map(item => `
        <tr>
            <td>${item.NumeroParte}</td>
            <td>${item.Descripcion}</td>
            <td><span class="badge">${item.Cantidad}</span></td>
            <td>${item.Serial || '—'}</td>
            <td>${item.Lote || '—'}</td>
            <td><strong>${item.Celda}</strong></td>
            <td>
                <button class="btn btn-ghost" onclick="abrirRetiro(${item.IdInventario})">
                    Retirar
                </button>
            </td>
        </tr>
    `).join('');
}

function resaltar(codigo) {
    if (!mostrarAlta) {
        celdaResaltada = codigo;
        renderizarCroquis();
    }
}

// Modal Alta
document.getElementById('btnAgregar').addEventListener('click', () => {
    mostrarAlta = true;
    document.getElementById('hintAlta').style.display = 'inline';
    document.getElementById('modalAlta').classList.add('activo');
    document.getElementById('altaFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('altaCelda').value = '';
    celdaResaltada = null;
    renderizarCroquis();
});

document.getElementById('cancelarAlta').addEventListener('click', () => {
    mostrarAlta = false;
    document.getElementById('hintAlta').style.display = 'none';
    document.getElementById('modalAlta').classList.remove('activo');
    document.getElementById('formAlta').reset();
});

document.getElementById('altaNumeroParte').addEventListener('blur', async (e) => {
    const numero = e.target.value;
    if (!numero) return;
    try {
        const res = await fetch(`/api/partes/${encodeURIComponent(numero)}`);
        const data = await res.json();
        if (data.existe) {
            document.getElementById('altaDescripcion').value = data.descripcion;
        }
    } catch (err) {}
});

document.getElementById('formAlta').addEventListener('submit', async (e) => {
    e.preventDefault();
    const celda = document.getElementById('altaCelda').value;
    if (!celda) return alert('Debes seleccionar una celda en el croquis.');

    const body = {
        numeroParte: document.getElementById('altaNumeroParte').value,
        descripcion: document.getElementById('altaDescripcion').value,
        cantidad: Number(document.getElementById('altaCantidad').value),
        serial: document.getElementById('altaSerial').value,
        lote: document.getElementById('altaLote').value,
        celda: celda,
        fecha: document.getElementById('altaFecha').value
    };

    try {
        const res = await fetch('/api/inventario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (res.ok) {
            alert('Material agregado con éxito');
            document.getElementById('cancelarAlta').click();
            cargarDatos();
        } else {
            alert(data.error || 'Error al guardar');
        }
    } catch (err) {
        alert('Error de conexión');
    }
});

// Retiro
window.abrirRetiro = function(id) {
    itemRetiro = inventario.find(i => i.IdInventario === id);
    if (!itemRetiro) return;

    document.getElementById('retiroInfo').innerHTML = 
        `<strong>${itemRetiro.NumeroParte}</strong> — ${itemRetiro.Descripcion}<br>
         Existencia actual: <strong>${itemRetiro.Cantidad}</strong>`;

    document.getElementById('retiroCantidad').value = 1;
    document.getElementById('retiroCantidad').max = itemRetiro.Cantidad;
    
    // Abrir modal
    document.getElementById('modalRetiro').classList.add('activo');
};

document.getElementById('cancelarRetiro').addEventListener('click', () => {
    document.getElementById('modalRetiro').classList.remove('activo');
    itemRetiro = null;
});

document.getElementById('formRetiro').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!itemRetiro) {
        alert('No hay material seleccionado');
        return;
    }

    const cantidad = Number(document.getElementById('retiroCantidad').value);

    if (cantidad > itemRetiro.Cantidad) {
        alert('No puedes retirar más de lo que hay en existencia');
        return;
    }

    try {
        const res = await fetch(`/api/inventario/${itemRetiro.IdInventario}/retirar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cantidad })
        });

        const data = await res.json();

        if (res.ok) {
            // 1. Cerrar modal primero
            document.getElementById('modalRetiro').classList.remove('activo');
            
            // 2. Limpiar estado
            itemRetiro = null;
            
            // 3. Mostrar mensaje
            alert('Material retirado correctamente');
            
            // 4. Recargar datos (esto vuelve a dibujar los botones)
            await cargarDatos();
        } else {
            alert(data.error || 'Error al retirar el material');
        }
    } catch (err) {
        console.error(err);
        alert('Error de conexión con el servidor');
    }
});