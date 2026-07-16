(() => {
  "use strict";

  const DIRTY_KEY = "optimizerHudCloudDirtyV1";
  const CLIENT_ID_KEY = "optimizerHudCloudClientIdV1";
  const DIRTY_OWNER_STALE_MS = 15000;
  const clientId = sessionStorage.getItem(CLIENT_ID_KEY) || crypto.randomUUID();
  sessionStorage.setItem(CLIENT_ID_KEY, clientId);
  const SYNC_DEBOUNCE_MS = 350;
  const originalSaveState = saveState;

  let client = null;
  let currentUser = null;
  let currentRevision = 0;
  let channel = null;
  let pushTimer = null;
  let pushing = false;
  let applyingRemote = false;
  let changeSequence = 0;
  let activeUserId = null;

  function readDirtyRecord() {
    const value = storage.getItem(DIRTY_KEY);
    if (!value) return null;
    if (value === "1") return { owner: null, at: 0 };
    try {
      return JSON.parse(value);
    } catch {
      return { owner: null, at: 0 };
    }
  }

  function markLocalDirty() {
    storage.setItem(DIRTY_KEY, JSON.stringify({ owner: clientId, at: Date.now() }));
  }

  function hasLocalDirty() {
    const record = readDirtyRecord();
    if (!record) return false;
    if (record.owner === clientId) return true;
    if (!record.owner || Date.now() - Number(record.at || 0) > DIRTY_OWNER_STALE_MS) {
      markLocalDirty();
      return true;
    }
    return false;
  }

  function clearLocalDirty() {
    const record = readDirtyRecord();
    if (!record || !record.owner || record.owner === clientId) storage.removeItem(DIRTY_KEY);
  }

  const ui = installSyncUi();
  installSaveBridge();
  bindUi();
  initializeCloudSync();

  function installSyncUi() {
    const style = document.createElement("style");
    style.textContent = `
      .cloud-sync-btn{position:relative;min-width:112px}
      .cloud-sync-btn[data-state="live"]{border-color:#2f9d57;background:#0b2c19;color:#8bf0a8}
      .cloud-sync-btn[data-state="saving"],.cloud-sync-btn[data-state="connecting"]{border-color:#2b8eb8;background:#0a2b3a;color:#9be5ff}
      .cloud-sync-btn[data-state="offline"]{border-color:#a45d21;background:#38200c;color:#ffc47c}
      .cloud-sync-btn[data-state="error"]{border-color:#a43d3a;background:#381413;color:#ff918d}
      .cloud-sync-btn[data-state="signin"]{border-color:#806c1f;background:#2c260b;color:#ffe47b}
      .cloud-auth-backdrop{position:fixed;inset:0;z-index:1000;display:none;place-items:center;padding:18px;background:rgba(0,0,0,.78)}
      .cloud-auth-backdrop.open{display:grid}
      .cloud-auth-card{width:min(440px,96vw);border:1px solid #27bdf5;border-radius:8px;background:linear-gradient(155deg,#071923,#030b10);box-shadow:0 0 50px rgba(39,189,245,.18);overflow:hidden}
      .cloud-auth-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #17445a}
      .cloud-auth-head h2{margin:0;color:#59caff;font-size:16px;letter-spacing:.8px;text-transform:uppercase}
      .cloud-auth-body{padding:17px}
      .cloud-auth-body p{margin:0 0 14px;color:#a9c2ce;font-size:11px;line-height:1.55}
      .cloud-auth-field{display:block;margin-top:10px;color:#8fdcff;font-size:10px;font-weight:800;letter-spacing:.8px;text-transform:uppercase}
      .cloud-auth-field input{display:block;width:100%;margin-top:5px;padding:10px;border:1px solid #285a70;border-radius:4px;background:#04131b;color:#edfaff;outline:none}
      .cloud-auth-field input:focus{border-color:#59caff}
      .cloud-auth-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
      .cloud-auth-message{min-height:18px;margin-top:12px;color:#9db7c5;font-size:10px;line-height:1.45}
      .cloud-auth-message.error{color:#ff918d}
      .cloud-auth-user{margin-top:10px;color:#7fe9a1;font-size:10px;word-break:break-all}
      @media(max-width:760px){.cloud-sync-btn{min-width:0}.cloud-auth-actions .btn{flex:1}}
    `;
    document.head.appendChild(style);

    const statusButton = document.createElement("button");
    statusButton.type = "button";
    statusButton.className = "btn cloud-sync-btn";
    statusButton.id = "cloudSyncBtn";
    statusButton.dataset.state = "connecting";
    statusButton.textContent = "SYNC: CONNECTING";
    document.querySelector(".quick-actions")?.prepend(statusButton);

    const backdrop = document.createElement("div");
    backdrop.className = "cloud-auth-backdrop";
    backdrop.id = "cloudAuthModal";
    backdrop.innerHTML = `
      <section class="cloud-auth-card" role="dialog" aria-modal="true" aria-labelledby="cloudAuthTitle">
        <div class="cloud-auth-head">
          <h2 id="cloudAuthTitle">Cloud HUD Sync</h2>
          <button class="icon-btn" type="button" data-cloud-close aria-label="Close">X</button>
        </div>
        <div class="cloud-auth-body">
          <p>Use the same account on PC and mobile. Sign in on the PC first to migrate its current HUD into the shared cloud state.</p>
          <form id="cloudAuthForm">
            <label class="cloud-auth-field">Email<input id="cloudEmail" type="email" autocomplete="email" required></label>
            <label class="cloud-auth-field">Password<input id="cloudPassword" type="password" autocomplete="current-password" minlength="8" required></label>
            <div class="cloud-auth-actions">
              <button class="btn primary" type="submit">SIGN IN</button>
              <button class="btn" type="button" id="cloudCreateAccount">CREATE ACCOUNT</button>
              <button class="btn danger" type="button" id="cloudSignOut" hidden>SIGN OUT</button>
            </div>
          </form>
          <div class="cloud-auth-user" id="cloudAuthUser"></div>
          <div class="cloud-auth-message" id="cloudAuthMessage" aria-live="polite"></div>
        </div>
      </section>
    `;
    document.body.appendChild(backdrop);

    return {
      statusButton,
      backdrop,
      form: backdrop.querySelector("#cloudAuthForm"),
      email: backdrop.querySelector("#cloudEmail"),
      password: backdrop.querySelector("#cloudPassword"),
      create: backdrop.querySelector("#cloudCreateAccount"),
      signOut: backdrop.querySelector("#cloudSignOut"),
      user: backdrop.querySelector("#cloudAuthUser"),
      message: backdrop.querySelector("#cloudAuthMessage"),
    };
  }

  function bindUi() {
    ui.statusButton.addEventListener("click", () => ui.backdrop.classList.add("open"));
    ui.backdrop.querySelector("[data-cloud-close]").addEventListener("click", closeAuthModal);
    ui.backdrop.addEventListener("click", (event) => {
      if (event.target === ui.backdrop) closeAuthModal();
    });
    ui.form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await signIn();
    });
    ui.create.addEventListener("click", createAccount);
    ui.signOut.addEventListener("click", signOut);
    window.addEventListener("offline", () => setSyncStatus("offline", "SYNC: OFFLINE"));
    window.addEventListener("online", reconnectSync);
  }

  function installSaveBridge() {
    saveState = function syncedSaveState(show = false) {
      originalSaveState(show);
      if (applyingRemote) return;
      changeSequence += 1;
      markLocalDirty();
      schedulePush();
    };
  }

  async function initializeCloudSync() {
    try {
      if (!window.supabase?.createClient) throw new Error("Supabase client failed to load");
      const response = await fetch("/api/config", { cache: "no-store" });
      if (!response.ok) throw new Error("Cloud configuration is unavailable");
      const config = await response.json();
      client = window.supabase.createClient(config.url, config.key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });

      client.auth.onAuthStateChange((_event, session) => {
        setTimeout(() => useSession(session), 0);
      });

      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      await useSession(data.session);
    } catch (error) {
      console.error("Cloud sync initialization failed", error);
      setSyncStatus("error", "SYNC: ERROR", error.message);
      setAuthMessage(error.message, true);
    }
  }

  async function useSession(session) {
    const user = session?.user || null;
    if (!user) {
      await removeChannel();
      currentUser = null;
      activeUserId = null;
      currentRevision = 0;
      ui.user.textContent = "";
      ui.signOut.hidden = true;
      setSyncStatus("signin", "SYNC: SIGN IN", "Sign in to share one HUD across devices");
      return;
    }

    if (activeUserId === user.id) return;
    activeUserId = user.id;
    currentUser = user;
    ui.user.textContent = `SIGNED IN: ${user.email || user.id}`;
    ui.signOut.hidden = false;
    setSyncStatus("connecting", "SYNC: CONNECTING");

    try {
      await client.realtime.setAuth(session.access_token);
      await subscribeToChanges();
      await hydrateCloudState();
      closeAuthModal();
    } catch (error) {
      console.error("Cloud session setup failed", error);
      setSyncStatus("error", "SYNC: ERROR", error.message);
      setAuthMessage(error.message, true);
    }
  }

  async function subscribeToChanges() {
    await removeChannel();
    channel = client
      .channel(`hud:${currentUser.id}`, {
        config: { private: true, broadcast: { ack: true, self: false } },
      })
      .on("broadcast", { event: "state" }, handleRemoteChange);

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Realtime connection timed out")), 15000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timer);
          if (!pushing) setSyncStatus("live", "SYNC: LIVE");
          resolve();
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timer);
          setSyncStatus("error", "SYNC: RETRYING");
          reject(new Error(`Realtime channel ${status.toLowerCase()}`));
        }
        if (status === "CLOSED" && !currentUser) setSyncStatus("signin", "SYNC: SIGN IN");
      });
    });
  }

  async function removeChannel() {
    if (client && channel) await client.removeChannel(channel);
    channel = null;
  }

  async function hydrateCloudState() {
    const remote = await fetchCloudState();
    const localIsDirty = hasLocalDirty();

    if (!remote) {
      markLocalDirty();
      await pushCloudState(true);
      toast("Current HUD moved to cloud sync");
      return;
    }

    currentRevision = Number(remote.revision) || 0;
    if (localIsDirty) {
      await pushCloudState(true);
      return;
    }

    applyRemoteState(remote, false);
    setSyncStatus("live", "SYNC: LIVE");
  }

  async function fetchCloudState() {
    const { data, error } = await client
      .from("hud_state")
      .select("state,revision,updated_at")
      .eq("user_id", currentUser.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  function handleRemoteChange(payload) {
    const remote = payload.payload;
    if (!remote) return;
    const revision = Number(remote.revision) || 0;
    if (revision <= currentRevision) return;

    if (pushing || hasLocalDirty()) {
      currentRevision = revision;
      schedulePush(80);
      return;
    }

    applyRemoteState(remote, true);
  }

  function applyRemoteState(remote, notify) {
    applyingRemote = true;
    try {
      state = mergeDeep(clone(defaultState), remote.state || {});
      normalizeState();
      originalSaveState(false);
      render();
      currentRevision = Number(remote.revision) || currentRevision;
      clearLocalDirty();
      if (notify) toast("HUD updated from another device");
    } finally {
      applyingRemote = false;
    }
    setSyncStatus("live", "SYNC: LIVE");
  }

  function schedulePush(delay = SYNC_DEBOUNCE_MS) {
    clearTimeout(pushTimer);
    if (!currentUser) {
      setSyncStatus("signin", "SYNC: SIGN IN");
      return;
    }
    if (!navigator.onLine) {
      setSyncStatus("offline", "SYNC: OFFLINE");
      return;
    }
    setSyncStatus("saving", "SYNC: SAVING");
    pushTimer = setTimeout(() => pushCloudState(), delay);
  }

  async function pushCloudState(force = false) {
    if (!currentUser || pushing || !navigator.onLine) return;
    if (!force && !hasLocalDirty()) return;

    pushing = true;
    const sequenceAtStart = changeSequence;
    const snapshot = clone(state);
    setSyncStatus("saving", "SYNC: SAVING");

    try {
      let result = await writeSnapshot(snapshot, currentRevision);
      if (!result) {
        const latest = await fetchCloudState();
        currentRevision = Number(latest?.revision) || 0;
        result = await writeSnapshot(snapshot, currentRevision);
      }
      if (!result) throw new Error("Cloud state changed during save; retrying");

      currentRevision = Number(result.revision) || currentRevision;
      const broadcastStatus = await channel?.send({
        type: "broadcast",
        event: "state",
        payload: result,
      });
      if (broadcastStatus && broadcastStatus !== "ok") {
        throw new Error(`Realtime broadcast returned ${broadcastStatus}`);
      }
      if (changeSequence === sequenceAtStart) {
        clearLocalDirty();
        setSyncStatus("live", "SYNC: LIVE");
      } else {
        schedulePush(80);
      }
    } catch (error) {
      console.error("Cloud save failed", error);
      markLocalDirty();
      setSyncStatus(navigator.onLine ? "error" : "offline", navigator.onLine ? "SYNC: RETRYING" : "SYNC: OFFLINE", error.message);
      clearTimeout(pushTimer);
      pushTimer = setTimeout(() => pushCloudState(), 2500);
    } finally {
      pushing = false;
    }
  }

  async function writeSnapshot(snapshot, expectedRevision) {
    if (!expectedRevision) {
      const { data, error } = await client
        .from("hud_state")
        .upsert({ user_id: currentUser.id, state: snapshot }, { onConflict: "user_id" })
        .select("state,revision,updated_at")
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await client
      .from("hud_state")
      .update({ state: snapshot })
      .eq("user_id", currentUser.id)
      .eq("revision", expectedRevision)
      .select("state,revision,updated_at")
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function reconnectSync() {
    if (!currentUser) return;
    setSyncStatus("connecting", "SYNC: CONNECTING");
    try {
      if (!channel) await subscribeToChanges();
      if (hasLocalDirty()) await pushCloudState(true);
      else {
        const remote = await fetchCloudState();
        if (remote && Number(remote.revision) > currentRevision) applyRemoteState(remote, true);
      }
      setSyncStatus("live", "SYNC: LIVE");
    } catch (error) {
      setSyncStatus("error", "SYNC: RETRYING", error.message);
    }
  }

  async function signIn() {
    if (!client) return;
    setAuthMessage("Signing in...");
    const email = ui.email.value.trim();
    const password = ui.password.value;
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return setAuthMessage(error.message, true);
    ui.password.value = "";
    setAuthMessage("Signed in. Connecting your HUD...");
  }

  async function createAccount() {
    if (!client) return;
    const email = ui.email.value.trim();
    const password = ui.password.value;
    if (!email || password.length < 8) return setAuthMessage("Enter an email and a password of at least 8 characters.", true);

    setAuthMessage("Creating account...");
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) return setAuthMessage(error.message, true);
    ui.password.value = "";
    if (data.session) setAuthMessage("Account created. Connecting your HUD...");
    else setAuthMessage("Check your email to confirm the account, then return here and sign in.");
  }

  async function signOut() {
    if (!client) return;
    setAuthMessage("Signing out...");
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) return setAuthMessage(error.message, true);
    closeAuthModal();
  }

  function setSyncStatus(mode, label, title = "") {
    ui.statusButton.dataset.state = mode;
    ui.statusButton.textContent = label;
    ui.statusButton.title = title;
  }

  function setAuthMessage(message, isError = false) {
    ui.message.textContent = message || "";
    ui.message.classList.toggle("error", isError);
  }

  function closeAuthModal() {
    ui.backdrop.classList.remove("open");
  }
})();
