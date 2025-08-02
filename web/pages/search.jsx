import { useNavigate, useParams } from "@solidjs/router";
import { createResource, createSignal, onMount, Show, Switch } from 'solid-js';

import SearchBar from "../components/searchbar";
import { SearchResultsAll } from '../components/results';
import { MetaProvider, Title } from "@solidjs/meta";
import { Layout } from "../components/layout";

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
    <Layout>

      <MetaProvider>
        <Title>Mew - {query()}</Title>
      </MetaProvider>

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
    
    </Layout>
  )
}