let celdas = [];
let columnas = 15;
let filas = 10;
let herramienta = 'Estante';
let dibujando = false;

const colores = {
    'Estante': '#4ade80',
    'Pasillo': '#e2e8f0',
    'Pared': '#475569',
    'Puerta': '#8b5cf6',
    'Zona': '#93c5fd',
    'Borrar': '#fca5a5'
};

fetch('/api/sesion-actual')
    .then(res => res.json())
    .then(data => {
        if (!data.logueado) {
            window.location.href = '/index.html';
        } else {
            cargarCeldas();
        }
    })
    .catch(() => {
        window.location.href = '/index.html';
    });

function cargarCeldas() {
    fetch('/api/celdas')
        .then(res => res.json())
        .then(data => {
            celdas = data || [];
            if (celdas.length > 0) {
                columnas = Math.max(...celdas.map(c => c.PosX), 15);
                filas = Math.max(...celdas.map(c => c.PosY), 10);
                document.getElementById('columnas').value = columnas;
                document.getElementById('filas').value = filas;
            }
            crearBotonesHerramientas();
            renderizar();
        })
        .catch(err => {
            console.error('Error cargando celdas:', err);
            crearBotonesHerramientas();
            renderizar();
        });
}

function crearBotonesHerramientas() {
    const cont = document.getElementById('herramientas');
    cont.innerHTML = '';

    Object.keys(colores).forEach(h => {
        const btn = document.createElement('button');
        btn.textContent = h;
        btn.style.background = colores[h];
        btn.style.color = (h === 'Pared') ? 'white' : 'black';
        
        if (h === herramienta) {
            btn.classList.add('activa');
        }

        btn.addEventListener('click', () => {
            herramienta = h;
            document.querySelectorAll('#herramientas button').forEach(b => b.classList.remove('activa'));
            btn.classList.add('activa');
        });

        cont.appendChild(btn);
    });
}

// Cambiar tamaño de la cuadrícula
document.getElementById('columnas').addEventListener('change', (e) => {
    columnas = Number(e.target.value) || 15;
    renderizar();
});

document.getElementById('filas').addEventListener('change', (e) => {
    filas = Number(e.target.value) || 10;
    renderizar();
});

function aplicarHerramienta(x, y) {
    const idx = celdas.findIndex(c => c.PosX === x && c.PosY === y);

    if (herramienta === 'Borrar') {
        if (idx >= 0) celdas.splice(idx, 1);
    } else {
        const nuevaCelda = { 
            PosX: x, 
            PosY: y, 
            Tipo: herramienta, 
            CodigoCelda: herramienta 
        };
        if (idx >= 0) {
            celdas[idx] = nuevaCelda;
        } else {
            celdas.push(nuevaCelda);
        }
    }
    renderizar();
}

function generarCodigos() {
    const estantes = celdas.filter(c => c.Tipo === 'Estante');
    const filasY = [...new Set(estantes.map(c => c.PosY))].sort((a, b) => a - b);

    celdas = celdas.map(celda => {
        if (celda.Tipo !== 'Estante') {
            return { ...celda, CodigoCelda: celda.Tipo };
        }

        const indexLetra = filasY.indexOf(celda.PosY);
        const letra = String.fromCharCode(65 + (indexLetra % 26)); // A, B, C...

        const estantesEnFila = estantes
            .filter(c => c.PosY === celda.PosY)
            .sort((a, b) => a.PosX - b.PosX);

        const numero = estantesEnFila.findIndex(c => c.PosX === celda.PosX) + 1;

        return { ...celda, CodigoCelda: `${letra}${numero}` };
    });

    return celdas;
}

document.getElementById('btnGuardar').addEventListener('click', async () => {
    const finales = generarCodigos();

    try {
        const res = await fetch('/api/celdas', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ celdas: finales })
        });

        const data = await res.json();

        if (res.ok) {
            alert('Distribución guardada correctamente.');
            celdas = finales;
            renderizar();
        } else {
            alert(data.error || 'Error al guardar');
        }
    } catch (err) {
        console.error(err);
        alert('Error de conexión con el servidor');
    }
});

function renderizar() {
    const grid = document.getElementById('gridEditor');
    if (!grid) {
        console.error('No se encontró el elemento #gridEditor');
        return;
    }

    grid.style.gridTemplateColumns = `repeat(${columnas}, 40px)`;
    grid.style.gridTemplateRows = `repeat(${filas}, 40px)`;
    grid.innerHTML = '';

    for (let y = 1; y <= filas; y++) {
        for (let x = 1; x <= columnas; x++) {
            const celda = celdas.find(c => c.PosX === x && c.PosY === y);
            const div = document.createElement('div');
            div.className = 'celda-editor';
            div.style.gridColumn = x;
            div.style.gridRow = y;
            div.style.background = celda ? colores[celda.Tipo] : 'white';

            if (celda) {
                if (celda.Tipo === 'Estante') {
                    div.textContent = (celda.CodigoCelda && celda.CodigoCelda !== 'Estante') 
                        ? celda.CodigoCelda 
                        : '';
                } else {
                    div.textContent = celda.Tipo.charAt(0);
                }
            }

            // Eventos de dibujo
            div.addEventListener('mousedown', (e) => {
                e.preventDefault();
                dibujando = true;
                aplicarHerramienta(x, y);
            });

            div.addEventListener('mouseenter', () => {
                if (dibujando) {
                    aplicarHerramienta(x, y);
                }
            });

            div.addEventListener('mouseup', () => {
                dibujando = false;
            });

            grid.appendChild(div);
        }
    }
}

document.addEventListener('mouseup', () => {
    dibujando = false;
});