(() => {
  const cfg = window.INVITATION_CONFIG || {};
  const qs = new URLSearchParams(location.search);
  const cover = document.getElementById('cover');
  const seal = document.getElementById('sealButton');
  const main = document.getElementById('invitation');
  const music = document.getElementById('music');
  const musicButton = document.getElementById('musicButton');
  const rsvpForm = document.getElementById('rsvpForm');
  const submitButton = rsvpForm.querySelector('button[type="submit"]');
  const formStatus = document.getElementById('formStatus');
  const guestIdInput = document.getElementById('guestId');
  const assignedPassesInput = document.getElementById('assignedPasses');
  const attendance = document.getElementById('attendance');
  const countWrap = document.getElementById('countWrap');
  const confirmed = document.getElementById('confirmedCount');

  let guest = { codigo: '', nombre: 'Invitado Especial', pases: 1, valid: false };

  function renderGuest() {
    document.getElementById('guestName').textContent = guest.nombre;
    document.getElementById('passLabel').textContent = `${guest.pases} ${guest.pases === 1 ? 'pase asignado' : 'pases asignados'}`;
    document.getElementById('inviteGuestName').textContent = guest.nombre;
    document.getElementById('invitePassCount').textContent = guest.pases;
    assignedPassesInput.value = guest.pases;
    guestIdInput.value = guest.codigo;

    confirmed.innerHTML = '';
    for (let i = 1; i <= guest.pases; i++) {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = String(i);
      confirmed.appendChild(option);
    }
  }

  async function loadGuest() {
    const codigo = (qs.get('codigo') || '').trim().slice(0, 100);

    if (!codigo) {
      guest = { codigo: '', nombre: 'Invitación no identificada', pases: 1, valid: false };
      renderGuest();
      submitButton.disabled = true;
      formStatus.textContent = 'Este enlace no contiene un código privado de invitación válido.';
      return;
    }

    document.getElementById('inviteGuestName').textContent = 'Cargando…';
    document.getElementById('guestName').textContent = 'Cargando…';
    submitButton.disabled = true;

    try {
      const url = `${cfg.rsvpEndpoint}?codigo=${encodeURIComponent(codigo)}&_=${Date.now()}`;
      const response = await fetch(url, { method: 'GET', cache: 'no-store', redirect: 'follow' });
      if (!response.ok) throw new Error('No se pudo consultar la invitación.');
      const data = await response.json();
      if (!data.ok || !data.nombre || !Number.isFinite(Number(data.pases))) {
        throw new Error(data.error || 'Invitación no encontrada.');
      }

      const pases = Math.max(1, Math.min(Number.parseInt(data.pases, 10), 20));
      guest = {
        codigo,
        nombre: String(data.nombre).trim().slice(0, 100),
        pases,
        valid: true
      };
      renderGuest();
      submitButton.disabled = false;
      formStatus.textContent = '';
    } catch (error) {
      guest = { codigo, nombre: 'Invitación no encontrada', pases: 1, valid: false };
      renderGuest();
      submitButton.disabled = true;
      formStatus.textContent = 'No pudimos verificar esta invitación. Revisa el enlace o inténtalo nuevamente.';
    }
  }

  renderGuest();
  loadGuest();

  // La portada web se conserva para los enlaces normales.
  // Los enlaces que vienen desde el PDF incluyen ?abrir=1 y entran directamente.
  const directEntry = ['1', 'true', 'si', 'sí'].includes(
    (qs.get('abrir') || '').trim().toLowerCase()
  );

  let musicReady = false;
  let musicHint = document.getElementById('musicHint');

  function showMusicHint(show) {
    if (!musicHint) return;
    musicHint.hidden = !show;
  }

  function prepareMusic() {
    if (!cfg.musicSrc || musicReady) return;
    music.src = cfg.musicSrc;
    music.preload = 'auto';
    music.load();
    musicButton.hidden = false;
    musicReady = true;
  }

  function startMusicFromGesture() {
    if (!cfg.musicSrc) return;
    prepareMusic();

    // Se llama directamente desde una interacción real del usuario.
    const playAttempt = music.play();
    if (playAttempt && typeof playAttempt.then === 'function') {
      playAttempt.then(() => {
        showMusicHint(false);
        musicButton.setAttribute('aria-label', 'Pausar música');
      }).catch(() => {
        showMusicHint(true);
      });
    }
  }

  function enterInvitation({ animateCover = false, tryMusic = true } = {}) {
    document.body.classList.remove('locked');
    main.setAttribute('aria-hidden', 'false');

    if (cfg.musicSrc) {
      prepareMusic();
      if (tryMusic) {
        // Se intenta reproducir al entrar. Si el navegador bloquea autoplay,
        // la primera interacción dentro de la página iniciará la música.
        const attempt = music.play();
        if (attempt && typeof attempt.then === 'function') {
          attempt.then(() => {
            showMusicHint(false);
            musicButton.setAttribute('aria-label', 'Pausar música');
          }).catch(() => {
            showMusicHint(true);
          });
        }
      }
    }

    if (cover) {
      if (animateCover) {
        cover.classList.add('open');
        setTimeout(() => cover.remove(), 1250);
      } else {
        cover.remove();
      }
    }
  }

  // En móviles, la navegación desde un PDF normalmente no transmite el
  // permiso de reproducción. Si autoplay se bloquea, cualquier primer toque
  // o tecla dentro de la invitación inicia la música, sin exigir el botón.
  function firstPageInteraction(event) {
    if (event && event.target && event.target.closest && event.target.closest('#musicButton')) {
      return; // El propio botón tiene su manejador de reproducción.
    }
    startMusicFromGesture();
    document.removeEventListener('pointerdown', firstPageInteraction, true);
    document.removeEventListener('keydown', firstPageInteraction, true);
  }

  document.addEventListener('pointerdown', firstPageInteraction, true);
  document.addEventListener('keydown', firstPageInteraction, true);

  if (directEntry) {
    // Entrada desde PDF: no repetir la animación del sobre.
    enterInvitation({ animateCover: false, tryMusic: true });
  } else {
    seal.addEventListener('click', () => {
      enterInvitation({ animateCover: true, tryMusic: true });
    });
  }

  musicButton.addEventListener('click', async () => {
    if (!cfg.musicSrc) return;
    prepareMusic();
    if (music.paused) {
      await music.play().then(() => {
        showMusicHint(false);
        musicButton.setAttribute('aria-label', 'Pausar música');
      }).catch(() => showMusicHint(true));
    } else {
      music.pause();
      musicButton.setAttribute('aria-label', 'Reproducir música');
    }
  });

  const target = new Date(cfg.weddingDate || '2026-12-19T16:00:00-04:00').getTime();
  const ids = ['days', 'hours', 'minutes', 'seconds'];
  function tick() {
    const d = Math.max(0, target - Date.now());
    const vals = [
      Math.floor(d / 86400000),
      Math.floor(d % 86400000 / 3600000),
      Math.floor(d % 3600000 / 60000),
      Math.floor(d % 60000 / 1000)
    ];
    ids.forEach((id, i) => document.getElementById(id).textContent = String(vals[i]).padStart(2, '0'));
  }
  tick();
  setInterval(tick, 1000);

  const io = new IntersectionObserver(
    entries => entries.forEach(e => e.target.classList.toggle('visible', e.isIntersecting)),
    { threshold: .14 }
  );
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  const sharePhotosButton = document.getElementById('sharePhotosButton');
  const sharePhotosStatus = document.getElementById('sharePhotosStatus');
  sharePhotosButton?.addEventListener('click', () => {
    if (cfg.photoShareUrl) {
      window.open(cfg.photoShareUrl, '_blank', 'noopener,noreferrer');
    } else {
      sharePhotosStatus.textContent = 'El espacio para compartir fotos está listo. Falta conectar el álbum privado.';
    }
  });

  const dialog = document.getElementById('mapDialog');
  document.querySelectorAll('[data-map]').forEach(b => b.addEventListener('click', () => dialog.showModal()));
  document.getElementById('closeMap').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  attendance.addEventListener('change', () => {
    const no = attendance.value === 'no';
    countWrap.hidden = no;
    confirmed.disabled = no;
    if (no && confirmed.options.length) confirmed.selectedIndex = 0;
  });

  rsvpForm.addEventListener('submit', async e => {
    e.preventDefault();

    if (!guest.valid) {
      formStatus.textContent = 'No podemos registrar la respuesta porque la invitación no está verificada.';
      return;
    }
    if (!attendance.value) {
      formStatus.textContent = 'Selecciona si podrás acompañarnos.';
      return;
    }

    const count = attendance.value === 'no' ? 0 : Number(confirmed.value);
    if (!Number.isInteger(count) || count < 0 || count > guest.pases || (attendance.value === 'si' && count < 1)) {
      formStatus.textContent = `Esta invitación permite confirmar como máximo ${guest.pases} ${guest.pases === 1 ? 'persona' : 'personas'}.`;
      return;
    }

    const payload = {
      codigo: guest.codigo,
      asistira: attendance.value === 'si',
      asistentes: count,
      mensaje: document.getElementById('message').value.trim()
    };

    submitButton.disabled = true;
    formStatus.textContent = 'Enviando…';

    try {
      const response = await fetch(cfg.rsvpEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });
      if (!response.ok) throw new Error('No se pudo registrar.');
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || 'No se pudo registrar.');

      formStatus.textContent = '¡Gracias! Tu confirmación fue registrada correctamente.';
      attendance.disabled = true;
      confirmed.disabled = true;
      document.getElementById('message').disabled = true;
    } catch (error) {
      submitButton.disabled = false;
      formStatus.textContent = 'No pudimos registrar la respuesta. Revisa tu conexión e intenta nuevamente.';
    }
  });
})();
