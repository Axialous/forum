(() => {
    // Part de la jauge allouée aux deux utilisateurs : elle part de ALLOC_START
    // et, à chaque ALLOC_INTERVAL_MS de parole cumulée, augmente de
    // (ALLOC_MAX - part actuelle) * ALLOC_RATE.
    const ALLOC_START = 0;
    const ALLOC_MAX = 0.9;
    const ALLOC_RATE = 0.01;
    const ALLOC_INTERVAL_MS = 1000;

    const elapsed = [0, 0];   // temps de parole cumulé (ms) des utilisateurs 1 et 2
    let active = null;        // 0, 1 ou null (personne ne parle)
    let startedAt = 0;        // instant où l'utilisateur actif a pris la parole

    const buttons = [document.getElementById('btn1'), document.getElementById('btn2')];
    const times = [document.getElementById('time1'), document.getElementById('time2')];
    const percents = [document.getElementById('pct1'), document.getElementById('pct2')];
    const gauge = document.getElementById('gauge');

    const pad = (n) => String(n).padStart(2, '0');

    function format(ms) {
        const total = Math.floor(ms / 1000);
        return `${pad(Math.floor(total / 60))} : ${pad(total % 60)}`;
    }

    function current(i) {
        return elapsed[i] + (active === i ? performance.now() - startedAt : 0);
    }

    function render() {
        const t = [current(0), current(1)];
        const sum = t[0] + t[1];
        const share = sum === 0 ? [0.5, 0.5] : [t[0] / sum, t[1] / sum];

        const ticks = Math.floor(sum / ALLOC_INTERVAL_MS);
        const allocated = ALLOC_MAX - (ALLOC_MAX - ALLOC_START) * Math.pow(1 - ALLOC_RATE, ticks);

        const pct1 = Math.round(share[0] * 100);
        percents[0].textContent = `${pct1}%`;
        percents[1].textContent = `${100 - pct1}%`;

        times[0].textContent = format(t[0]);
        times[1].textContent = format(t[1]);
        gauge.style.setProperty('--share-1', share[0]);
        gauge.style.setProperty('--share-2', share[1]);
        gauge.style.setProperty('--allocated', allocated);

        if (active !== null) requestAnimationFrame(render);
    }

    // Empêche la mise en veille de l'écran tant qu'un compteur tourne
    let wakeLock = null;
    let wakeLockPending = false;

    async function requestWakeLock() {
        if (!('wakeLock' in navigator) || wakeLock || wakeLockPending) return;
        wakeLockPending = true;
        try {
            const lock = await navigator.wakeLock.request('screen');
            if (active === null) {
                lock.release();
                return;
            }
            wakeLock = lock;
            lock.addEventListener('release', () => {
                if (wakeLock === lock) wakeLock = null;
            });
        } catch (err) {
            // Indisponible (contexte non sécurisé, économie d'énergie, etc.)
        } finally {
            wakeLockPending = false;
        }
    }

    function releaseWakeLock() {
        if (!wakeLock) return;
        wakeLock.release().catch(() => {});
        wakeLock = null;
    }

    // Le verrou est perdu quand la page passe en arrière-plan : on le redemande au retour
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && active !== null) requestWakeLock();
    });

    function setActive(next) {
        if (active !== null) elapsed[active] += performance.now() - startedAt;
        active = next;
        startedAt = performance.now();

        buttons.forEach((btn, i) => {
            btn.classList.toggle('is-speaking', active === i);
            btn.setAttribute('aria-pressed', String(active === i));
        });
        if (active !== null) requestWakeLock();
        else releaseWakeLock();
        render();
    }

    buttons.forEach((btn, i) => {
        btn.addEventListener('click', () => setActive(active === i ? null : i));
    });

    render();
})();
