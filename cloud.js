/* Awe-Struck Supabase auth + shared workspace sync. */
(() => {
  const cfg = window.AWESTRUCK_SUPABASE_CONFIG || {};
  const keyReady = cfg.publishableKey && !cfg.publishableKey.includes("PASTE_");
  const client = window.supabase?.createClient && keyReady
    ? window.supabase.createClient(cfg.url, cfg.publishableKey)
    : null;
  let user = null, workspaceId = null, ready = false, saveTimer = null;

  const style = document.createElement("style");
  style.textContent = ".cloud-auth{position:fixed;inset:0;z-index:9999;background:#191725f2;display:grid;place-items:center;padding:18px}.cloud-card{background:#fff;border-radius:18px;padding:25px;width:min(100%,420px);box-shadow:0 25px 90px #0004}.cloud-card h2{margin:0 0 8px}.cloud-card p,.cloud-card small{color:#817d90;font-size:13px}.cloud-card label{display:block;color:#817d90;font-size:12px;font-weight:700;margin:14px 0 6px}.cloud-card input{width:100%;padding:11px;border:1px solid #ebe8f0;border-radius:9px}.cloud-card button{cursor:pointer;padding:10px 13px;border-radius:9px;border:1px solid #ebe8f0;background:white;margin-top:10px}.cloud-card .cloud-primary{background:#7955d9;color:white;border-color:#7955d9;width:100%}.cloud-message{background:#f4f0ff;color:#5c478f;padding:10px;border-radius:9px;font-size:12px;white-space:pre-wrap;margin-top:12px}.cloud-hide{display:none!important}";
  document.head.appendChild(style);
  const gate = document.createElement("div");
  gate.className = "cloud-auth";
  gate.innerHTML = '<div class="cloud-card"><b style="letter-spacing:1px">AWE-STRUCK</b><h2>Sign in to your store</h2><p>Sign in to sync inventory, expenses, suppliers, tasks and sales across devices.</p><form id="cloud-form"><label for="cloud-email">Email</label><input id="cloud-email" type="email" autocomplete="email" required placeholder="you@example.com"><label for="cloud-password">Password</label><input id="cloud-password" type="password" autocomplete="current-password" minlength="6" required placeholder="At least 6 characters"><button class="cloud-primary" id="cloud-submit">Sign in</button></form><button id="cloud-create">Create account</button><div id="cloud-message" class="cloud-message"></div><p id="cloud-status">Private workspace · Supabase</p></div>';
  document.body.appendChild(gate);
  const message = (s) => { document.getElementById("cloud-message").textContent = s || ""; };
  const status = (s) => { document.getElementById("cloud-status").textContent = s || ""; };
  if (!client) {
    document.getElementById("cloud-submit").disabled = true;
    document.getElementById("cloud-create").disabled = true;
    message("Add the Supabase publishable key to supabase-config.js, then reload. Never use a secret/service_role key here.");
    status("Cloud connection is not configured yet.");
    return;
  }
  async function loadWorkspace(signedInUser) {
    user = signedInUser; ready = false; workspaceId = null;
    status("Loading workspace…"); message("");
    const { data: memberships, error: membershipError } = await client.from("awestruck_members").select("workspace_id,role").eq("user_id", user.id).limit(1);
    if (membershipError || !memberships?.length) { message(membershipError?.message || "No workspace membership found for this account."); return; }
    workspaceId = memberships[0].workspace_id;
    const { data: record, error } = await client.from("awestruck_workspace_data").select("payload").eq("workspace_id", workspaceId).maybeSingle();
    if (error) { message("Could not load workspace: " + error.message); return; }
    if (record?.payload?.budgetRows && record?.payload?.settings) {
      data = record.payload;
      localStorage.setItem("awestruck-admin-v1", JSON.stringify(data));
    } else {
      const { error: seedError } = await client.from("awestruck_workspace_data").upsert({workspace_id:workspaceId,payload:data,updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:"workspace_id"});
      if (seedError) { message("Could not initialise workspace: " + seedError.message); return; }
    }
    ready = true; gate.classList.add("cloud-hide");
    renderAll();
    status("Synced as " + (user.email || "signed-in user"));
    toast("Connected to Awe-Struck cloud");
  }
  async function saveCloud() {
    if (!ready || !workspaceId || !user) return;
    const { error } = await client.from("awestruck_workspace_data").upsert({workspace_id:workspaceId,payload:data,updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:"workspace_id"});
    status(error ? "Cloud save failed: " + error.message : "Cloud synced · " + new Date().toLocaleTimeString());
    if (error) toast("Cloud save failed — export a backup");
  }
  const originalSave = window.save;
  window.save = function() {
    if (originalSave) originalSave();
    if (ready) { clearTimeout(saveTimer); saveTimer = setTimeout(saveCloud, 400); }
  };
  document.getElementById("cloud-form").addEventListener("submit", async (e) => {
    e.preventDefault(); message("Signing in…");
    const email = document.getElementById("cloud-email").value.trim();
    const password = document.getElementById("cloud-password").value;
    const { data: result, error } = await client.auth.signInWithPassword({email,password});
    if (error) { message(error.message); return; }
    if (result.user) await loadWorkspace(result.user);
  });
  document.getElementById("cloud-create").addEventListener("click", async () => {
    message("Creating account…");
    const email = document.getElementById("cloud-email").value.trim();
    const password = document.getElementById("cloud-password").value;
    if (!email || !password) { message("Enter an email and password first."); return; }
    const { data: result, error } = await client.auth.signUp({email,password});
    if (error) { message(error.message); return; }
    if (!result.session) { message("Account created. Check your email to confirm it, then sign in."); return; }
    if (result.user) await loadWorkspace(result.user);
  });
  client.auth.getSession().then(({data: sessionData}) => { if (sessionData.session?.user) loadWorkspace(sessionData.session.user); });
  client.auth.onAuthStateChange((event, session) => { if (event === "SIGNED_IN" && session?.user && !ready) loadWorkspace(session.user); });
})();