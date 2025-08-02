import { MetaProvider, Title } from "@solidjs/meta";
import { useNavigate } from '@solidjs/router';

import SearchBar from '../components/searchbar'
import { u, uLogOut, uTryLog } from '../components/auth';
import { LinkButton } from '../components/utils';
import { Layout } from '../components/layout';

export default function App() {
  const navigate = useNavigate();

  uTryLog();

  return (
    <Layout center={true}>
      
      <MetaProvider>
        <Title>Mew</Title>
      </MetaProvider>

      <div class="flex flex-col font-bold">
        <h1 class="text-6xl">Mew</h1>
        <h2 class="text-2xl">A minimalist YouTube Music player</h2>
      </div>

      <SearchBar navigator={navigate}/>

      <Show when={u.name} fallback=<div><LinkButton href="/login">Log in</LinkButton> or <LinkButton href="/signup">sign up</LinkButton> to save your playlists.</div>>
        <div>Logged in as <span class="font-bold font-mono">{u.name}</span>. View your playlists <LinkButton href="/profile" /> or <LinkButton onclick={uLogOut} text="log out" />.</div>
      </Show>

      <p class="text-red-700 font-bold max-w-150">
        This website is strictly restricted to its contributors.<br/>
        Users acknowledge that using this tool may be subject to third-party terms of service, including those of YouTube. By proceeding, users accept full responsibility for their actions and any resulting consequences.
      </p>

    </Layout>
  );
}
