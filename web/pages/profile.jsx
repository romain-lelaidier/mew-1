import { A, useParams } from '@solidjs/router';
import { MetaProvider, Title } from "@solidjs/meta";
import { u, uLogOut } from "../components/auth"
import { createPlaylist, getUser, PlaylistsList } from '../components/playlists';
import { Bar } from '../components/bar';
import { BackButton, LinkButton, User } from '../components/utils';
import { Icon } from '../components/icons';
import { Layout } from '../components/layout';
import { createResource } from 'solid-js';

export default function App() {

  const uname = useParams().uname;

  const [ data ] = createResource(uname, getUser);

  return (
    <Layout>

      <MetaProvider>
        <Title>Mew - {uname}</Title>
      </MetaProvider>

      <div>
        <BackButton/>
        <div class="text-3xl">user <b>{uname}</b></div>
      </div>

      <div class="flex flex-col gap-2">
        <Show when={data()} fallback={<div>Loading data...</div>}>
          <div class="flex flex-col gap-1">
            <h2 class="text-xl font-bold">Playlists</h2>
            <Show when={uname == u.name && u.connected}>
              <Bar onsubmit={createPlaylist} placeholder="playlist name" button={<div class="flex flex-row gap-1"><Icon type="square-plus" />Create a playlist</div>} />
            </Show>
            <Show when={data().playlists}>
              <div><PlaylistsList playlists={data().playlists} editable={uname == u.name && u.connected} /></div>
            </Show>
          </div>
        </Show>
      </div>

    </Layout>
  );
}
