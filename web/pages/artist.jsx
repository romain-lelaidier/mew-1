import { useNavigate, useParams } from "@solidjs/router";
import { createResource, createSignal, onMount, Show, Switch } from 'solid-js';

import SearchBar from "../components/searchbar";
import { SearchResultsArtist } from '../components/results';
import { MetaProvider, Title } from "@solidjs/meta";
import { BackButton } from "../components/backbutton";

async function fetchArtist(id) {
  // if (!!id.match(/^[a-zA-Z0-9_-]{24}$/)) return;
  const response = await fetch(`${window.location.origin}/api/artist/${id}`);
  return response.json();
}

export default function App() {
  const params = useParams();
  const id = decodeURIComponent(params.id);

  const navigate = useNavigate();

  const [ artist ] = createResource(id, fetchArtist)

  return (
    <div class="bg-d flex flex-col flex-grow gap-2 py-4 px-4 sm:mx-16 md:mx-32 lg:mx-48 xl:mx-64 2xl:mx-80">

      <MetaProvider>
        <Title>Mew - {artist()?.title || 'Loading...'}</Title>
      </MetaProvider>

      {/* <BackButton /> */}

      <SearchBar navigator={navigate} />

      {/* Search Results */}
      <Show when={!artist.loading} fallback={<div>Loading results...</div>}>
        <Switch>
          <Match when={artist.error}>
            <span>Error: {artist.error}</span>
          </Match>
          <Match when={artist()}>
            <SearchResultsArtist artist={artist()} />
          </Match>
        </Switch>
      </Show>

    </div>
  )
}
