import { A } from '@solidjs/router';
import { MetaProvider, Title } from "@solidjs/meta";
import { u, uLogOut } from "../components/auth"
import { createPlaylist, getPlaylists, PlaylistsList } from '../components/playlists';
import { Bar } from '../components/bar';
import { LinkButton, RoundButton } from '../components/utils';
import { Icon } from '../components/icons';
import { Layout } from '../components/layout';

export default function App() {

  getPlaylists();

  return (
    <Layout>

      <MetaProvider>
        <Title>Mew - My profile</Title>
      </MetaProvider>

      <div class="flex flex-row items-center gap-1 font-bold">
        <h2 class="text-2xl">My profile</h2>
      </div>

      <div class="flex flex-col gap-2">
        <Show when={u.connected} fallback={<div>You are not logged in. Please log in <LinkButton href="/login"/>.</div>}>
          <div>Logged in as <span class="font-bold font-mono">{u.name}</span>. Click <LinkButton onclick={uLogOut} /> to log out.</div>

          <div class="flex flex-col gap-1">
            <h2 class="text-xl font-bold">My playlists</h2>
            <Bar onsubmit={createPlaylist} placeholder="playlist name" button={<div class="flex flex-row gap-1"><Icon type="square-plus" />Create a playlist</div>} />
            <Show when={u.playlists}>
              <div><PlaylistsList playlists={u.playlists} editable={true} /></div>
            </Show>
          </div>
        </Show>
      </div>

    </Layout>
  );
}
