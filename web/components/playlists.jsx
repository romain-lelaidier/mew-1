import { For, createSignal } from "solid-js";
import { u, setU, uTryLog, post } from "./auth";
import { is2xx, LinkButton, timeAgo } from "./utils";
import { A } from "@solidjs/router";
import { Icon } from "./icons";
import { Popper } from "./popper";
import { Bar } from "./bar";
import { playlistSaveSid, setPlaylistSaveSid } from "../player/utils";

function setPlaylist(pl) {
  const songsIds = pl.songsIds || pl.songs.map(song => song.id);
  setU("playlists", pl.id, { name: pl.name, songsIds: JSON.stringify(songsIds), created: pl.created, modified: pl.modified })
}

export const getPlaylists = async () => {

  if (!u.connected) await uTryLog();
  if (!u.connected) return;
  const res = await post('/api/um/playlists');
  if (!is2xx(res)) throw await res.text();
  const pls = await res.json();
  pls.map(setPlaylist)

}

export const createPlaylist = async (name) => {

  if (!u.connected) await uTryLog();
  if (!u.connected) return;
  const res = await post('/api/pl/create', { name });
  if (!is2xx(res)) throw await res.text();
  const pl = await res.json();
  setPlaylist(pl);

}

export const addToPlaylist = async (pid, sid) => {

  if (!u.connected) await uTryLog();
  if (!u.connected) return;
  const res = await post('/api/pl/add', { pid, sid });
  if (!is2xx(res)) throw await res.text();
  const pl = await getPlaylist(pid);
  setPlaylist(pl);

}

export const removeFromPlaylist = async (pid, sid) => {

  if (!u.connected) await uTryLog();
  if (!u.connected) return;
  const res = await post('/api/pl/remove', { pid, sid });
  if (!is2xx(res)) throw await res.text();
  const pl = await getPlaylist(pid);
  setPlaylist(pl);

}

export const togglePlaylistSong = async (pid, sid) => {
  
  if (JSON.parse(u.playlists[pid].songsIds.includes(sid))) {
    await removeFromPlaylist(pid, sid);
  } else {
    await addToPlaylist(pid, sid);
  }

}

export const renamePlaylist = async (pid, name) => {

  if (!u.connected) await uTryLog();
  if (!u.connected) return;
  const res = await post('/api/pl/rename', { pid, name });
  if (!is2xx(res)) throw await res.text();
  const pl = await getPlaylist(pid);
  setPlaylist(pl);

}

export const getPlaylist = async (pid) => {

  if (!u.connected) await uTryLog();
  if (!u.connected) return;
  const res = await post('/api/pl/get', { pid });
  if (!is2xx(res)) throw await res.text();
  return await res.json();

}

export const removePlaylist = async (pid) => {
  
  if (!u.connected) await uTryLog();
  if (!u.connected) return;
  const res = await post('/api/pl/delete', { pid });
  if (!is2xx(res)) throw await res.text();
  setU("playlists", pid, null);
  return await res.json();

}

export function PlaylistsList(props) {

  function songString(length) {
    if (length == 0) return 'Empty playlist'
    if (length == 1) return '1 song';
    return length + ' songs'
  }

  const [ editPid, setEditPid ] = createSignal(null);
  const [ trashPid, setTrashPid ] = createSignal(null);

  function PlaylistBlock(props2) {
    const pl = props2.pl;
    if (!pl || !pl.name) return (<></>)
    return (
      <div class="px-2 pb-1 rounded-md hover:bg-white/10">
        <div class="flex flex-row gap-2 items-center">
          <Show when={props.sid && props.sid()}>
            <Icon type={JSON.parse(pl.songsIds).includes(props.sid()) ? 'square-check' : 'empty-square'} />
          </Show>
          <div class="flex-grow leading-[1.2] py-1">
            <div class="font-bold">{pl.name}</div>
            <div class="opacity-80">
              <div>{songString(JSON.parse(pl.songsIds).length)}</div>
              <div class="italic">Edited {timeAgo(new Date(pl.modified))}</div>
              {/* <div>Last modified: {new Date(pl.modified).toLocaleString()}</div> */}
            </div>
          </div>
          <Show when={props.editable}>
            <div class="flex flex-row gap-2 items-center">
              <div onClick={(e) => { e.preventDefault(); setTrashPid(props2.pid) }}><Icon type="trash" /></div>
              <div onClick={(e) => { e.preventDefault(); setEditPid(props2.pid) }}><Icon type="pen" /></div>
            </div>
          </Show>
        </div>
      </div>
    )
  }

  return (
    <>
      <For each={Object.entries(props.playlists).filter(p => p[1] != null).sort((a, b) => new Date(b[1].modified) - new Date(a[1].modified))}>{([pid, pl], i) => 
        <Show when={props.onClick} fallback={<A href={"/playlist/" + pid}><PlaylistBlock pl={pl} pid={pid} /></A>}>
          <div onClick={() => props.onClick(pid)}><PlaylistBlock pl={pl} pid={pid} /></div>
        </Show>
      }</For>
      <Popper trigger={editPid} setTrigger={setEditPid} title="Edit playlist name">
        <div class="py-2">
          <Bar onsubmit={(name) => { renamePlaylist(editPid(), name); setEditPid(null) }} placeholder={props.playlists[editPid()].name} value={props.playlists[editPid()].name} button={<div class="flex flex-row gap-1"><Icon type="pen" size="1.1"/></div>} />
        </div>
      </Popper>
      <Popper trigger={trashPid} setTrigger={setTrashPid} title="Remove playlist">
        <div class="py-2">
          <div>Are you sure you want to remove the playlist <span class="font-bold">{props.playlists[trashPid()].name}</span> ?</div>
          <div class="flex flex-row-reverse mt-1">
            <button class="flex flex-row px-3 py-1 bg-red-700 text-white rounded-md items-center gap-1" onclick={() => { removePlaylist(trashPid()); setTrashPid(null) }}><Icon type="trash" size="1.1"/>Delete</button>
          </div>
        </div>
      </Popper>
    </>
  )
}

export function PlaylistAdder(props) {

  const adder = (pid) => {
    const sid = playlistSaveSid();
    setPlaylistSaveSid(null);
    togglePlaylistSong(pid, sid);
  }

  return (
    <Popper trigger={playlistSaveSid} setTrigger={setPlaylistSaveSid} title="Save to playlist">
      <div>Manage your playlists <LinkButton href="/profile"/></div>
      <div class="overflow-scroll flex-grow flex flex-col mt-1">
        <PlaylistsList playlists={u.playlists} onClick={adder} sid={playlistSaveSid} />
      </div>
    </Popper>
  )
}