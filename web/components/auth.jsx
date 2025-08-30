import { createEffect, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { is2xx } from "./utils";

const [ token, setToken ] = createSignal(localStorage.getItem("token"));
createEffect(() => {
  localStorage.setItem("token", token());
})

export const [ u, setU ] = createStore({
  connected: false,
  name: null,
  playlists: {}
});

export const uLogOut = async () => {
  setToken(null);
  setU("name", null);
  setU("connected", false);
  setU("playlists", null);
  setU("playlists", {});
}

export async function post(url, json) {
  const params = {
    method: 'POST',
    body: JSON.stringify(json),
    headers: { "Content-type": "application/json" },
  }
  if (token() != 'null') params.headers.authorization = token();
  return await fetch(url, params);
}

async function logFromRes(res) {
  if (!is2xx(res)) {
    uLogOut();
    throw await res.text();
  }
  const json = await res.json();
  if ('token' in json) {
    setToken(json.token);
    setU("name", json.name);
    setU("connected", true);
  } else {
    uLogOut();
    throw await res.text();
  }
}

export const uTryLog = async (username, password) => {

  if (u.connected) return true;

  if (username && password) {
    const res = await post('/api/um/login', { username, password });
    await logFromRes(res);
    return true;
  } else if (token()) {
    // try to relog (probably restarting a session)
    const res = await post('/api/um/relog');
    await logFromRes(res);
    return true;
  }

  return false;

}

export const uTrySignup = async (username, password) => {

  const res = await post('/api/um/signup', { username, password });
  await logFromRes(res);
  
}

export const uVerify = async (token) => {
  const res = await post('/api/um/verify', { token });
  if (!is2xx(res)) {
    throw await res.text();
  }
  await logFromRes(res);
}

export const uSaveParams = async (params) => {
  const res = await post('/api/um/changeparams', { params });
  if (!is2xx(res)) {
    throw await res.text();
  }
  setU("params", await res.json())
}