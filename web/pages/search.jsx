import { useNavigate, useParams } from "@solidjs/router";
import { createResource, createSignal, onMount, Show, Switch } from 'solid-js';

import SearchBar from "../components/searchbar";
import { SearchResultsAll } from '../components/results';
import { MetaProvider, Title } from "@solidjs/meta";
import { BackButton } from "../components/backbutton";

async function fetchResults(query) {
  if (query.length < 3) return;
  const response = await fetch(`${window.location.origin}/api/search/${query}`);
  return response.json();
}

export default function App() {
  const params = useParams();
  const originQuery = decodeURIComponent(params.query);
  const [ query, setQuery ] = createSignal(originQuery);

  const [ results ] = createResource(query, fetchResults)

  return (
    <div class="bg-d flex flex-col flex-grow gap-2 py-4 px-4 sm:mx-16 md:mx-32 lg:mx-48 xl:mx-64 2xl:mx-80">

      <MetaProvider>
        <Title>Mew - {query()}</Title>
      </MetaProvider>

      {/* <BackButton /> */}

      <SearchBar onsubmit={setQuery} query={originQuery} />

      {/* Search Results */}
      <Show when={!results.loading} fallback={<div>Loading results...</div>}>
        <Switch>
          <Match when={results.error}>
            <span>Error: {results.error}</span>
          </Match>
          <Match when={results()}>
            <SearchResultsAll results={results()} />
          </Match>
        </Switch>
      </Show>
    </div>
  )
}