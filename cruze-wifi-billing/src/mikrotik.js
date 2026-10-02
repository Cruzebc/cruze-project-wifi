import axios from "axios";
import https from "node:https";

function client() {
  const host = process.env.MIKROTIK_HOST;
  const port = process.env.MIKROTIK_REST_PORT || "443";
  const scheme = process.env.MIKROTIK_REST_SSL === "false" ? "http" : "https";
  return axios.create({
    baseURL: `${scheme}://${host}:${port}/rest`,
    auth: {username: process.env.MIKROTIK_USERNAME, password: process.env.MIKROTIK_PASSWORD},
    timeout: 5000,
    httpsAgent: new https.Agent({
      rejectUnauthorized: process.env.MIKROTIK_TLS_VERIFY !== "false"
    })
  });
}

export async function mikrotikStatus() {
  try {
    const r = await client().get("/system/resource");
    const x = r.data?.[0] || {};
    return {connected:true, host:process.env.MIKROTIK_HOST, version:x.version, board:x["board-name"], uptime:x.uptime};
  } catch (e) {
    return {connected:false,host:process.env.MIKROTIK_HOST,error:e.response?.data?.message || e.message};
  }
}

function safeName(phone) {
  return `cruze-${String(phone).replace(/[^0-9A-Za-z_-]/g,"")}`;
}
function rate(download, upload) {
  if (!download && !upload) return undefined;
  const d = download ? `${download}M` : "0";
  const u = upload ? `${upload}M` : "0";
  return `${u}/${d}`;
}
function duration(minutes) {
  const m = Math.max(1, Math.round(minutes));
  if (m % 1440 === 0) return `${m/1440}d`;
  if (m % 60 === 0) return `${m/60}h`;
  return `${m}m`;
}

export async function activateCustomer(customer, session) {
  const api = client();
  const name = safeName(customer.phone);
  const profile = process.env.MIKROTIK_DEFAULT_PROFILE || process.env.MIKROTIK_PROFILE || "default";
  const data = {
    name,
    password: name,
    profile,
    comment: `CRUZE session=${session.id}`,
    "limit-uptime": duration((new Date(session.expiresAt)-new Date(session.startedAt))/60000)
  };
  if (session.dataLimit) data["limit-bytes-total"] = String(session.dataLimit);
  const rr = rate(session.downloadMbps, session.uploadMbps);
  if (rr) {
    // Create/update a dedicated per-session profile so speed is enforced by HotSpot.
    const pname = `cruze-${session.id.slice(-10)}`;
    try {
      const old = await api.get(`/ip/hotspot/user/profile?name=${encodeURIComponent(pname)}`);
      if (old.data?.length) await api.patch(`/ip/hotspot/user/profile/${encodeURIComponent(old.data[0][".id"])}`, {"rate-limit":rr});
      else await api.put("/ip/hotspot/user/profile", {name:pname,"rate-limit":rr,comment:"CRUZE Billing generated profile"});
    } catch {}
    data.profile = pname;
  }
  try {
    const existing = await api.get(`/ip/hotspot/user?name=${encodeURIComponent(name)}`);
    if (existing.data?.length) await api.patch(`/ip/hotspot/user/${encodeURIComponent(existing.data[0][".id"])}`, data);
    else await api.put("/ip/hotspot/user", data);
  } catch (e) {
    throw new Error(`MikroTik activation failed: ${e.response?.data?.message || e.message}`);
  }
  return {ok:true, ref:name};
}

export async function terminateCustomer(customer, session) {
  const api = client();
  const name = safeName(customer.phone);
  try {
    const active = await api.get(`/ip/hotspot/active?user=${encodeURIComponent(name)}`);
    for (const row of active.data || []) {
      if (row[".id"]) await api.delete(`/ip/hotspot/active/${encodeURIComponent(row[".id"])}`);
    }
  } catch {}
  try {
    const users = await api.get(`/ip/hotspot/user?name=${encodeURIComponent(name)}`);
    for (const row of users.data || []) {
      if (row[".id"]) await api.patch(`/ip/hotspot/user/${encodeURIComponent(row[".id"])}`, {disabled:"true"});
    }
  } catch {}
  return {ok:true};
}
