/* ============================================================
   Interacción de la página (común a las webs de práctica)
   Sin datos del negocio: el horario, el WhatsApp y el saludo del
   mensaje se leen del HTML, así que sirve tal cual para otros clientes.
   ============================================================ */

// ---------- Cabecera y menú en móvil ----------
const cabecera = document.querySelector('.cabecera');
const botonMenu = document.querySelector('.menu-boton');
const menu = document.getElementById('menu');

function abrirMenu(abrir) {
  botonMenu.setAttribute('aria-expanded', String(abrir));
  botonMenu.setAttribute('aria-label', abrir ? 'Cerrar menú' : 'Abrir menú');
  menu.classList.toggle('abierto', abrir);
}

if (botonMenu && menu) {
  botonMenu.addEventListener('click', () => abrirMenu(botonMenu.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) abrirMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') abrirMenu(false); });
}

// Línea bajo la cabecera en cuanto se hace scroll
const marcarScroll = () => cabecera?.classList.toggle('con-sombra', window.scrollY > 8);
window.addEventListener('scroll', marcarScroll, { passive: true });
marcarScroll();

// ---------- Horario: aviso de "Abierto ahora" y día de hoy ----------
const tablaHorario = document.querySelector('.horario');
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const aMinutos = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const hora = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
const lasHora = (min) => (Math.floor(min / 60) === 1 ? 'la ' : 'las ') + hora(min);
const plural = (dia) => (dia.endsWith('s') ? dia : `${dia}s`);

// horario[dia] = [[abre, cierra], ...] en minutos desde medianoche (0 = domingo)
const horario = {};
tablaHorario?.querySelectorAll('tr[data-dia]').forEach((fila) => {
  horario[fila.dataset.dia] = (fila.dataset.horas || '')
    .split(',').filter(Boolean)
    .map((tramo) => tramo.split('-').map(aMinutos));
});

// Día y hora actuales en la zona horaria del negocio, no en la del visitante
function ahoraEnElNegocio() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: tablaHorario?.dataset.zonaHoraria || undefined,
    weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(new Date());
  const parte = (tipo) => partes.find((p) => p.type === tipo).value;
  return {
    dia: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parte('weekday')),
    minutos: Number(parte('hour')) * 60 + Number(parte('minute')),
  };
}

function calcularEstado() {
  const { dia, minutos } = ahoraEnElNegocio();
  const hoy = horario[dia] || [];

  const tramoActual = hoy.find(([abre, cierra]) => minutos >= abre && minutos < cierra);
  if (tramoActual) {
    const cierra = tramoActual[1];
    const texto = cierra - minutos <= 30
      ? `Abierto · cierra pronto, a ${lasHora(cierra)}`
      : `Abierto ahora · hasta ${lasHora(cierra)}`;
    return { dia, abierto: true, texto };
  }

  const siguienteHoy = hoy.find(([abre]) => abre > minutos);
  if (siguienteHoy) return { dia, abierto: false, texto: `Cerrado · abrimos hoy a ${lasHora(siguienteHoy[0])}` };

  for (let i = 1; i <= 7; i++) {
    const otroDia = (dia + i) % 7;
    const tramos = horario[otroDia] || [];
    if (tramos.length) {
      const cuando = i === 1 ? 'mañana' : `el ${DIAS[otroDia]}`;
      return { dia, abierto: false, texto: `Cerrado · abrimos ${cuando} a ${lasHora(tramos[0][0])}` };
    }
  }
  return { dia, abierto: false, texto: 'Cerrado temporalmente' };
}

function pintarEstado() {
  const { dia, abierto, texto } = calcularEstado();
  document.querySelectorAll('[data-estado]').forEach((aviso) => {
    aviso.classList.toggle('abierto', abierto);
    aviso.classList.toggle('cerrado', !abierto);
    aviso.querySelector('.estado-texto').textContent = texto;
  });
  tablaHorario.querySelectorAll('tr[data-dia]').forEach((fila) => {
    if (Number(fila.dataset.dia) === dia) fila.setAttribute('aria-current', 'date');
    else fila.removeAttribute('aria-current');
  });
}

if (tablaHorario) {
  pintarEstado();
  setInterval(pintarEstado, 60 * 1000);
}

// ---------- Formulario: prepara un mensaje de WhatsApp ----------
const formulario = document.querySelector('.formulario[data-whatsapp]');

function hoyISO() {
  const d = new Date();
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(2, '0')).join('-');
}

// Convierte cada campo en texto legible para el mensaje
function valorLegible(campo) {
  const valor = campo.value.trim();
  if (!valor) return '';
  if (campo.type === 'date') {
    return new Date(`${valor}T12:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  if (campo.tagName === 'SELECT') return campo.selectedOptions[0].textContent.trim();
  return valor;
}

if (formulario) {
  // Las fechas empiezan hoy y, si el campo lo pide, avisan de los días en que se cierra
  formulario.querySelectorAll('input[type="date"]').forEach((campo) => {
    campo.min = hoyISO();
    if (!('validarHorario' in campo.dataset) || !tablaHorario) return;
    campo.addEventListener('input', () => {
      const dia = campo.value ? new Date(`${campo.value}T12:00`).getDay() : null;
      const cerrado = dia !== null && !(horario[dia] || []).length;
      campo.setCustomValidity(cerrado ? `Los ${plural(DIAS[dia])} estamos cerrados. Elige otro día, por favor.` : '');
    });
  });

  formulario.addEventListener('submit', (e) => {
    e.preventDefault();
    const lineas = [...formulario.querySelectorAll('[data-etiqueta]')]
      .map((campo) => [campo.dataset.etiqueta, valorLegible(campo)])
      .filter(([, valor]) => valor)
      .map(([etiqueta, valor]) => `• ${etiqueta}: ${valor}`);
    const mensaje = [formulario.dataset.saludo || '¡Hola!', ...lineas].join('\n');
    window.open(`https://wa.me/${formulario.dataset.whatsapp}?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener');
  });
}

// ---------- El botón flotante se esconde en la sección que indique data-ocultar-en ----------
const flotante = document.querySelector('[data-ocultar-en]');
const zonaSinBoton = flotante && document.querySelector(flotante.dataset.ocultarEn);

if (zonaSinBoton && 'IntersectionObserver' in window) {
  new IntersectionObserver(([entrada]) => {
    flotante.classList.toggle('oculto', entrada.isIntersecting);
  }, { threshold: 0.2 }).observe(zonaSinBoton);
}

// ---------- Aparición suave de las secciones al hacer scroll ----------
const revelables = document.querySelectorAll('.revelar');

if ('IntersectionObserver' in window) {
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      if (!entrada.isIntersecting) return;
      entrada.target.classList.add('visible');
      observador.unobserve(entrada.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  revelables.forEach((el) => observador.observe(el));
} else {
  revelables.forEach((el) => el.classList.add('visible'));
}

// Año actual en el pie de página
document.querySelectorAll('[data-anio]').forEach((el) => { el.textContent = new Date().getFullYear(); });
