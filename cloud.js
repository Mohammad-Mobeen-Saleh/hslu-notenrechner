window.connectGradebook = function ({readGuest, getBook, setBook}) {
  const el = id => document.getElementById('cloud-' + id);
  let returnAfterLogin = false;
  const status = message => { el('status').textContent = message; };
  if (!window.supabase || !window.crypto?.randomUUID) {
    status('Lokaler Modus. Für die Anmeldung HTTPS oder localhost öffnen.');
    return;
  }
  const client = window.supabase.createClient('https://mbdluhqgyjmshbtehlnq.supabase.co',
    'sb_publishable_NrIrCpXvrUojIINqnIhPsg_0VLkgSpq', {auth: {persistSession: true, autoRefreshToken: true}});
  let user = null;
  let revision = 0;
  let ready = false;
  let pending = false;
  let writing = false;
  let timer;
  let generation = 0;
  let edit = 0;
  const draftKey = () => 'noten-entwurf-' + user.id;
  function lock(locked) {
    for (const selector of ['.main-actions','#semesterContainer','#emptyState','.study','dialog']) {
      document.querySelectorAll(selector).forEach(node => { node.inert = locked; });
    }
  }
  function draft() {
    sessionStorage.setItem(draftKey(), JSON.stringify({revision, book: getBook()}));
  }
  function changed() {
    if (!ready) return;
    edit++;
    pending = true;
    try { draft(); } catch { status('Browserspeicher voll. Seite bis zum Speichern offen lassen.'); }
    clearTimeout(timer);
    status('Änderungen werden gespeichert …');
    timer = setTimeout(flush, 450);
  }
  async function flush() {
    if (!pending || !ready || writing) return;
    const version = edit;
    const stamp = generation;
    writing = true;
    el('retry').hidden = true;
    let saved = false;
    let conflict = false;
    try {
      const {data,error} = await client.rpc('save_gradebook', {
        expected_revision: revision, book: structuredClone(getBook())
      });
      if (stamp !== generation) return;
      if (error) throw error;
      revision = data;
      pending = edit !== version;
      if (pending) draft();
      else {
        sessionStorage.removeItem(draftKey());
        el('link').textContent = 'Konto';
        status('Im Konto gespeichert.');
      }
      saved = true;
    } catch (error) {
      if (stamp !== generation) return;
      el('link').textContent = 'Speicherproblem · Konto';
      if (error.message?.includes('VERSION_CONFLICT')) {
        // Ein anderes Gerät hat zwischenzeitlich gespeichert: aktuellen Kontostand übernehmen.
        conflict = true;
      } else {
        el('retry').hidden = false;
        status('Speichern fehlgeschlagen. Bitte Verbindung prüfen und erneut speichern. ' + error.message);
      }
    } finally {
      if (stamp === generation) {
        writing = false;
        if (saved && pending) void flush();
        if (conflict) await load(true, 'Ein anderes Gerät hat zwischenzeitlich gespeichert. Der aktuelle Kontostand wurde geladen. Bitte deine letzte Änderung prüfen.');
      }
    }
  }
  async function load(discard = false, message = '') {
    if (!user || writing) return;
    const stamp = ++generation;
    clearTimeout(timer);
    ready = false;
    lock(true);
    status('Kontodaten werden geladen …');
    try {
      const {data,error} = await client.rpc('load_gradebook');
      if (stamp !== generation) return;
      if (error) throw error;
      const local = discard ? null : JSON.parse(sessionStorage.getItem(draftKey()));
      if (discard) sessionStorage.removeItem(draftKey());
      const {revision: remoteVersion, ...remoteBook} = data;
      revision = local?.revision ?? remoteVersion;
      pending = Boolean(local);
      setBook(local?.book ?? remoteBook);
      ready = true;
      el('link').textContent = 'Konto';
      lock(false);
      el('retry').hidden = !pending;
      el('import').hidden = getBook().semesters.length > 0 || !readGuest().semesters.length;
      status(message || (pending ? 'Lokaler Kontoentwurf wiederhergestellt.' : 'Aktueller Kontostand geladen.'));
      if (message) el('link').textContent = 'Hinweis · Konto';
      if (returnAfterLogin && location.hash === '#konto') location.replace('#noten');
      returnAfterLogin = false;
      if (pending) void flush();
    } catch (error) {
      if (stamp === generation) el('link').textContent = 'Ladeproblem · Konto';
      if (stamp === generation) status('Laden fehlgeschlagen. Bitte supabase-sync.sql ausführen oder die Verbindung prüfen. ' + error.message);
    }
  }
  function switchUser(next) {
    ++generation;
    clearTimeout(timer);
    writing = ready = pending = false;
    user = next;
    el('link').textContent = user ? 'Konto' : 'Anmelden';
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    el('login').hidden = Boolean(user);
    el('account').hidden = !user;
    el('retry').hidden = el('import').hidden = true;
    if (user) {
      el('user').textContent = user.email;
      setBook({semesters: []});
      void load();
    } else {
      setBook(readGuest());
      lock(false);
      status('Lokaler Modus. Deine Eingaben werden in diesem Browser gespeichert.');
    }
  }
  el('login').onsubmit = async event => {
    event.preventDefault();
    const register = event.submitter?.value === 'register';
    const credentials = {email: el('email').value.trim(), password: el('password').value};
    returnAfterLogin = true;
    el('login').inert = true;
    status(register ? 'Konto wird erstellt …' : 'Anmeldung läuft …');
    try {
      const {data,error} = register ? await client.auth.signUp(credentials)
        : await client.auth.signInWithPassword(credentials);
      if (error) throw error;
      el('password').value = '';
      if (!data.session) returnAfterLogin = false;
      if (!data.session) status('Bitte bestätige deine E-Mail-Adresse und melde dich danach hier an.');
    } catch (error) { returnAfterLogin = false; status(error.message); }
    finally { el('login').inert = false; }
  };
  el('exit').onclick = async () => {
    if (writing) { status('Speichern läuft. Bitte kurz warten.'); return; }
    if (pending && !confirm('Ungespeicherte Änderungen bleiben in diesem Tab als Kontoentwurf. Jetzt abmelden?')) return;
    const {error} = await client.auth.signOut({scope:'local'});
    if (error) status(error.message);
  };
  el('retry').onclick = flush;
  el('import').onclick = () => {
    if (!ready || getBook().semesters.length) return;
    const book = readGuest();
    for (const s of book.semesters) {
      s.id = crypto.randomUUID();
      for (const m of s.modules) {
        m.id = crypto.randomUUID();
        for (const a of m.assessments) a.id = crypto.randomUUID();
      }
    }
    setBook(book);
    el('import').hidden = true;
    changed();
  };
  lock(true);
  let initialized = false;
  client.auth.onAuthStateChange((_event, session) => {
    const next = session?.user ?? null;
    if (!initialized || next?.id !== user?.id) {
      initialized = true;
      // Folgeabfragen erst nach Abschluss des Auth-Ereignisses starten.
      setTimeout(() => switchUser(next), 0);
    }
  });
  return {accountActive: () => Boolean(user), changed};
};
