(function () {
	const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
	const STORAGE_KEYS = {
		apiKey: 'movieLibrary.tmdbApiKey',
		watchlist: 'movieLibrary.watchlist',
	};

	// State
	let state = {
		activeRoute: '#/home',
		query: '',
		movies: [],
		watchlist: loadWatchlist(),
		isLoading: false,
		error: null,
	};

	// DOM
	const contentEl = document.getElementById('content');
	const heroEl = document.getElementById('hero');
	const searchInput = document.getElementById('searchInput');
	const apiKeyInput = document.getElementById('apiKeyInput');
	const saveKeyBtn = document.getElementById('saveKeyBtn');
	const navHome = document.getElementById('nav-home');
	const navWatchlist = document.getElementById('nav-watchlist');
	const hamburger = document.getElementById('hamburger');
	const primaryNav = document.getElementById('primary-nav');

	function hasApiKey() {
		return Boolean(localStorage.getItem(STORAGE_KEYS.apiKey));
	}

	// Initialize
	init();

	function init() {
		// Load saved API key
		const savedKey = localStorage.getItem(STORAGE_KEYS.apiKey) || '';
		apiKeyInput.value = savedKey;

		// Events
		window.addEventListener('hashchange', handleRouteChange);
		saveKeyBtn.addEventListener('click', handleSaveKey);
		searchInput.addEventListener('input', debounce(handleSearchInput, 400));
		hamburger.addEventListener('click', toggleMenu);
		primaryNav.addEventListener('click', handleNavClick);

		// Initial route
		if (!location.hash) {
			location.hash = '#/home';
		} else {
			handleRouteChange();
		}
	}

	function handleSaveKey() {
		const key = (apiKeyInput.value || '').trim();
		localStorage.setItem(STORAGE_KEYS.apiKey, key);
		alert('API key saved locally.');
		if (state.activeRoute === '#/home') {
			fetchPopularMovies();
		}
	}

	function handleRouteChange() {
		state.activeRoute = location.hash || '#/home';
		setActiveNav();
		render();
		closeMenu();
		if (state.activeRoute === '#/home') {
			if (state.query) {
				searchMovies(state.query);
			} else {
				fetchPopularMovies();
			}
		}
	}

	function toggleMenu() {
		const expanded = hamburger.getAttribute('aria-expanded') === 'true';
		hamburger.setAttribute('aria-expanded', String(!expanded));
		primaryNav.classList.toggle('open', !expanded);
	}

	function closeMenu() {
		hamburger.setAttribute('aria-expanded', 'false');
		primaryNav.classList.remove('open');
	}

	function handleNavClick(e) {
		const target = e.target;
		if (target && target.classList.contains('nav-link')) {
			closeMenu();
		}
	}

	function setActiveNav() {
		navHome.classList.toggle('active', state.activeRoute === '#/home');
		navWatchlist.classList.toggle('active', state.activeRoute === '#/watchlist');
	}

	function handleSearchInput(e) {
		state.query = e.target.value.trim();
		if (state.activeRoute !== '#/home') {
			location.hash = '#/home';
			return;
		}
		if (state.query.length === 0) {
			fetchPopularMovies();
		} else {
			searchMovies(state.query);
		}
	}

	// API Client
	async function tmdbFetch(endpoint, params = {}) {
		const apiKey = localStorage.getItem(STORAGE_KEYS.apiKey);
		if (!apiKey) {
			throw new Error('TMDB API key missing. Enter and save your key.');
		}
		const url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
		url.searchParams.set('api_key', apiKey);
		Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
		const res = await fetch(url.toString());
		if (!res.ok) {
			const msg = `TMDB error: ${res.status}`;
			throw new Error(msg);
		}
		return res.json();
	}

	async function fetchPopularMovies() {
		setLoading(true);
		try {
			const data = await tmdbFetch('movie/popular', { language: 'en-US', page: '1' });
			state.movies = data.results || [];
			state.error = null;
		} catch (err) {
			state.movies = [];
			state.error = err.message || String(err);
		} finally {
			setLoading(false);
			render();
		}
	}

	async function searchMovies(query) {
		if (!query) return fetchPopularMovies();
		setLoading(true);
		try {
			const data = await tmdbFetch('search/movie', {
				query,
				include_adult: 'false',
				language: 'en-US',
				page: '1',
			});
			state.movies = data.results || [];
			state.error = null;
		} catch (err) {
			state.movies = [];
			state.error = err.message || String(err);
		} finally {
			setLoading(false);
			render();
		}
	}

	// Watchlist storage
	function loadWatchlist() {
		try {
			const raw = localStorage.getItem(STORAGE_KEYS.watchlist);
			return raw ? JSON.parse(raw) : [];
		} catch { return []; }
	}
	function saveWatchlist(next) {
		localStorage.setItem(STORAGE_KEYS.watchlist, JSON.stringify(next));
	}
	function isInWatchlist(id) {
		return state.watchlist.some(m => m.id === id);
	}
	function addToWatchlist(movie) {
		if (isInWatchlist(movie.id)) return;
		state.watchlist = [movie, ...state.watchlist];
		saveWatchlist(state.watchlist);
		render();
	}
	function removeFromWatchlist(id) {
		state.watchlist = state.watchlist.filter(m => m.id !== id);
		saveWatchlist(state.watchlist);
		render();
	}

	// Render
	function setLoading(v) { state.isLoading = v; }

	function render() {
		if (state.activeRoute === '#/watchlist') {
			renderWatchlist();
		} else {
			renderHome();
		}
	}

	function renderHome() {
		const header = state.query ? `Results for "${escapeHtml(state.query)}"` : 'Popular Movies';
		const list = state.movies;
		if (!state.query && !state.isLoading && list && list.length > 0) {
			renderHero(list[0]);
		} else {
			heroEl.innerHTML = '';
		}
		const guide = hasApiKey() ? '' : renderGuide();
		contentEl.innerHTML = [
			`<h2 style="margin:8px 0 12px;">${header}</h2>`,
			guide,
			state.error ? `<div class="empty">${escapeHtml(state.error)}</div>` : '',
			state.isLoading ? renderSkeletons() : renderGrid(list),
		].join('');
		attachCardEvents(list);
	}

	function renderGuide() {
		const testKey = 'a1c7e2e519f3a64943cee7f175d79456';
		setTimeout(() => {
			const btn = document.getElementById('useTestKeyBtn');
			if (btn) {
				btn.addEventListener('click', () => {
					apiKeyInput.value = testKey;
					localStorage.setItem(STORAGE_KEYS.apiKey, testKey);
					fetchPopularMovies();
				});
			}
		}, 0);
		return `
			<div class="guide-box">
				<h3>First time here? How to use the app</h3>
				<ol>
					<li>Open <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">TMDB API</a> and create a free account.</li>
					<li>Request a TMDB v3 API key (free) and copy it.</li>
					<li>Paste the key into the "TMDB API Key" field above and click <b>Save Key</b>.</li>
					<li>Search/browse movies and build your watchlist.</li>
				</ol>
				<div class="guide-actions">
					<button class="btn" id="useTestKeyBtn">Use Test Key</button>
					<code>${testKey}</code>
				</div>
			</div>
		`;
	}

	function renderHero(movie) {
		const backdrop = movie.backdrop_path ? `${'https://image.tmdb.org/t/p/original'}${movie.backdrop_path}` : '';
		const year = (movie.release_date || '').slice(0,4);
		heroEl.innerHTML = `
			<div class="hero">
				<div class="hero-backdrop">${backdrop ? `<img src="${backdrop}" alt="${escapeHtml(movie.title)}" loading="lazy">` : ''}</div>
				<div class="hero-overlay"></div>
				<div class="hero-content">
					<h2 class="hero-title">${escapeHtml(movie.title)}</h2>
					<div class="hero-meta">${year || '—'} · ⭐ ${movie.vote_average?.toFixed ? movie.vote_average.toFixed(1) : movie.vote_average || '—'}</div>
					<div class="hero-actions">
						<button class="btn" data-hero-action="add" data-id="${movie.id}">Add to Watchlist</button>
						<a class="btn-secondary" href="#/watchlist">View Watchlist</a>
					</div>
				</div>
			</div>
		`;
		const addBtn = heroEl.querySelector('[data-hero-action="add"]');
		if (addBtn) {
			addBtn.addEventListener('click', () => addToWatchlist(slimMovie(movie)));
		}
	}

	function renderWatchlist() {
		contentEl.innerHTML = [
			`<h2 style="margin:8px 0 12px;">Your Watchlist</h2>`,
			state.watchlist.length === 0 ? `<div class="empty">No movies yet. Add some from Home.</div>` : renderGrid(state.watchlist, { showRemove: true }),
		].join('');
		attachCardEvents(state.watchlist, { isWatchlist: true });
	}

	function renderGrid(list, opts = {}) {
		if (state.isLoading) return '';
		if (!list || list.length === 0) return `<div class="empty">Nothing to show.</div>`;
		return `<div class="grid">${list.map(m => MovieCard(m, opts)).join('')}</div>`;
	}

	function renderSkeletons() {
		const count = 10;
		return `<div class="skeleton-grid">${Array.from({ length: count }).map(() => `
			<div class="skeleton-card">
				<div class="skeleton-poster"></div>
				<div class="skeleton-meta"></div>
			</div>
		`).join('')}</div>`;
	}

	function MovieCard(movie, opts = {}) {
		const poster = movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : '';
		const year = (movie.release_date || '').slice(0,4);
		const inList = isInWatchlist(movie.id);
		return `
			<article class="card" data-id="${movie.id}">
				<div class="poster-wrap">${poster ? `<img class="poster" src="${poster}" alt="${escapeHtml(movie.title)}" loading="lazy">` : ''}</div>
				<div class="card-body">
					<h3 class="title" title="${escapeHtml(movie.title)}">${escapeHtml(movie.title)}</h3>
					<div class="meta">${year || '—'} · ⭐ ${movie.vote_average?.toFixed ? movie.vote_average.toFixed(1) : movie.vote_average || '—'}</div>
					<div class="card-actions">
						${opts.showRemove ? `<button class="btn-secondary btn-remove" data-action="remove">Remove</button>` : `<button class="btn-secondary" data-action="${inList ? 'added' : 'add'}" ${inList ? 'disabled' : ''}>${inList ? 'Added' : 'Add to Watchlist'}</button>`}
					</div>
				</div>
			</article>
		`;
	}

	function attachCardEvents(list, opts = {}) {
		const cards = Array.from(contentEl.querySelectorAll('.card'));
		cards.forEach(card => {
			const id = Number(card.getAttribute('data-id'));
			const btn = card.querySelector('[data-action]');
			if (!btn) return;
			btn.addEventListener('click', () => {
				const movie = list.find(m => m.id === id);
				if (!movie) return;
				const action = btn.getAttribute('data-action');
				if (action === 'add') addToWatchlist(slimMovie(movie));
				if (action === 'remove') removeFromWatchlist(id);
			});
		});
	}

	function slimMovie(m) {
		return {
			id: m.id,
			title: m.title,
			poster_path: m.poster_path,
			release_date: m.release_date,
			vote_average: m.vote_average,
		};
	}

	// Utils
	function debounce(fn, delay) {
		let t = null;
		return function (...args) {
			clearTimeout(t);
			t = setTimeout(() => fn.apply(this, args), delay);
		};
	}
	function escapeHtml(str) {
		return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
	}
})();


