// ==========================================
// LÓGICA PARA ALTERNAR ENTRE LOGIN Y REGISTRO
// ==========================================
const loginContainer = document.getElementById('loginContainer');
const registerContainer = document.getElementById('registerContainer');

document.getElementById('showRegister').addEventListener('click', () => {
    loginContainer.classList.add('hidden');
    registerContainer.classList.remove('hidden');
});

document.getElementById('showLogin').addEventListener('click', () => {
    registerContainer.classList.add('hidden');
    loginContainer.classList.remove('hidden');
});

// ==========================================
// VALIDACIÓN DEL FORMULARIO DE REGISTRO
// ==========================================
const formularioRegistro = document.getElementById('formulario_registro');
const inputs = document.querySelectorAll('#formulario_registro input');

const expresiones = {
    usuario: /^[a-zA-Z0-9\_\-]{4,16}$/, 
    password: /^.{4,12}$/, 
    correo: /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/
};

const campos = {
    usuario: false,
    correo: false,
    correo2: false, 
    password: false,
    password2: false 
};

const validarFormulario = (e) => {
    switch (e.target.name) {
        case "usuario":
            validarCampo(expresiones.usuario, e.target, 'usuario');
            break;
        case "correo":
            validarCampo(expresiones.correo, e.target, 'correo');
            validarCorreo2();
            break;
        case "correo2":
            validarCorreo2();
            break;
        case "password":
            validarCampo(expresiones.password, e.target, 'password');
            validarPassword2();
            break;
        case "password2":
            validarPassword2();
            break;
    }
};

const validarCampo = (expresion, input, campo) => {
    if(expresion.test(input.value)){
        document.getElementById(`grupo__${campo}`).classList.remove('formulario__grupo-incorrecto');
        document.getElementById(`grupo__${campo}`).classList.add('formulario__grupo-correcto');
        document.querySelector(`#grupo__${campo} i`).classList.add('fa-check-circle');
        document.querySelector(`#grupo__${campo} i`).classList.remove('fa-times-circle');
        document.querySelector(`#grupo__${campo} .formulario__input-error`).classList.remove('formulario__input-error-activo');
        campos[campo] = true;
    } else {
        document.getElementById(`grupo__${campo}`).classList.add('formulario__grupo-incorrecto');
        document.getElementById(`grupo__${campo}`).classList.remove('formulario__grupo-correcto');
        document.querySelector(`#grupo__${campo} i`).classList.add('fa-times-circle');
        document.querySelector(`#grupo__${campo} i`).classList.remove('fa-check-circle');
        document.querySelector(`#grupo__${campo} .formulario__input-error`).classList.add('formulario__input-error-activo');
        campos[campo] = false;
    }
};

const validarPassword2 = () => {
    const inputPassword1 = document.getElementById('password');
    const inputPassword2 = document.getElementById('password2');

    if(inputPassword1.value !== inputPassword2.value || inputPassword2.value === ""){
        document.getElementById(`grupo__password2`).classList.add('formulario__grupo-incorrecto');
        document.getElementById(`grupo__password2`).classList.remove('formulario__grupo-correcto');
        document.querySelector(`#grupo__password2 i`).classList.add('fa-times-circle');
        document.querySelector(`#grupo__password2 i`).classList.remove('fa-check-circle');
        document.querySelector(`#grupo__password2 .formulario__input-error`).classList.add('formulario__input-error-activo');
        campos['password2'] = false; 
    } else {
        document.getElementById(`grupo__password2`).classList.remove('formulario__grupo-incorrecto');
        document.getElementById(`grupo__password2`).classList.add('formulario__grupo-correcto');
        document.querySelector(`#grupo__password2 i`).classList.remove('fa-times-circle');
        document.querySelector(`#grupo__password2 i`).classList.add('fa-check-circle');
        document.querySelector(`#grupo__password2 .formulario__input-error`).classList.remove('formulario__input-error-activo');
        campos['password2'] = true; 
    }
};

const validarCorreo2 = () => {
    const inputCorreo1 = document.getElementById('correo');
    const inputCorreo2 = document.getElementById('correo2');

    if(inputCorreo1.value !== inputCorreo2.value || inputCorreo2.value === ""){
        document.getElementById(`grupo__correo2`).classList.add('formulario__grupo-incorrecto');
        document.getElementById(`grupo__correo2`).classList.remove('formulario__grupo-correcto');
        document.querySelector(`#grupo__correo2 i`).classList.add('fa-times-circle');
        document.querySelector(`#grupo__correo2 i`).classList.remove('fa-check-circle');
        document.querySelector(`#grupo__correo2 .formulario__input-error`).classList.add('formulario__input-error-activo');
        campos['correo2'] = false; 
    } else {
        document.getElementById(`grupo__correo2`).classList.remove('formulario__grupo-incorrecto');
        document.getElementById(`grupo__correo2`).classList.add('formulario__grupo-correcto');
        document.querySelector(`#grupo__correo2 i`).classList.remove('fa-times-circle');
        document.querySelector(`#grupo__correo2 i`).classList.add('fa-check-circle');
        document.querySelector(`#grupo__correo2 .formulario__input-error`).classList.remove('formulario__input-error-activo');
        campos['correo2'] = true; 
    }
};

inputs.forEach((input) => {
    input.addEventListener('keyup', validarFormulario);
    input.addEventListener('blur', validarFormulario);
});

// ==========================================
// CONEXIÓN CON EL SERVIDOR NODE.JS
// ==========================================

// --- Enviar Formulario de Registro ---
formularioRegistro.addEventListener('submit', async (e) => {
    e.preventDefault();
    const terminos = document.getElementById('terminos').checked;
    
    if(campos.usuario && campos.correo && campos.correo2 && campos.password && campos.password2 && terminos){
        const datosRegistro = {
            empresa: document.getElementById('usuario').value,
            correo: document.getElementById('correo').value,
            password: document.getElementById('password').value
        };

        try {
            const respuesta = await fetch('/api/registro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datosRegistro)
            });

            const resultado = await respuesta.json();

            if (respuesta.ok) {
                formularioRegistro.reset();
                document.getElementById('formulario__mensaje-exito').innerText = resultado.message;
                document.getElementById('formulario__mensaje-exito').classList.add('formulario__mensaje-exito-activo');
                
                document.querySelectorAll('.formulario__grupo-correcto').forEach((icono) => {
                    icono.classList.remove('formulario__grupo-correcto');
                });
                document.getElementById('formulario__mensaje').classList.remove('formulario__mensaje-activo');
                
                setTimeout(() => { 
                    document.getElementById('formulario__mensaje-exito').classList.remove('formulario__mensaje-exito-activo');
                    document.getElementById('showLogin').click(); 
                }, 2000);
            } else {
                alert(resultado.error);
            }
        } catch (error) {
            console.error("Error:", error);
            alert("Ocurrió un error de conexión con el servidor.");
        }
    } else {
        document.getElementById('formulario__mensaje').classList.add('formulario__mensaje-activo');
    }
});

// --- Enviar Formulario de Login (CORREGIDO: ahora incluye el campo Empresa) ---
document.getElementById('formulario_login').addEventListener('submit', async (e) => {
    e.preventDefault();

    const inputEmpresa = document.getElementById('login_empresa');

    if (!inputEmpresa) {
        console.error('No se encontró el input con id "login_empresa". Revisa el id del campo Empresa en tu HTML de login.');
        alert('Error de configuración: falta el campo Empresa en el formulario.');
        return;
    }

    const datosLogin = {
        empresa: inputEmpresa.value,
        correo: document.getElementById('login_correo').value,
        password: document.getElementById('login_password').value
    };

    try {
        const respuesta = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosLogin)
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            window.location.href = resultado.redirect;
        } else {
            alert(resultado.error);
        }
    } catch (error) {
        console.error("Error:", error);
        alert("Ocurrió un error de conexión con el servidor.");
    }
});