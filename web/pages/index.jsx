import { useParams } from '@solidjs/router';
import { createResource, createSignal, onMount, Show, Switch } from 'solid-js';
import { SearchResults } from '../components/results';
import { MetaProvider, Title } from "@solidjs/meta";

async function fetchResults(query) {
  if (query.length < 3) return;
  const response = await fetch(`${window.location.origin}/api/search/${query}`);
  return response.json();
}

export default function App() {
  const params = useParams();

  const [query, setQuery] = createSignal('');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [isSubmitted, setIsSubmitted] = createSignal(false);
  const [results] = createResource(searchQuery, fetchResults)

  // On component mount, check if there's a query in the URL
  onMount(() => {
    if (params.query) {
      const realQuery = decodeURIComponent(params.query);
      setQuery(realQuery);
      setSearchQuery(realQuery);
      setIsSubmitted(true);
    }
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    const searchQuery = query();
    setSearchQuery(searchQuery);
    setIsSubmitted(true);

    // Update the URL with the search query
    const newUrl = `${window.location.origin}/search/${encodeURIComponent(searchQuery)}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  return (
    <div classList={{
      flex: true,
      'flex-col': true,
      'gap-2': true,
      'flex-grow': true,
      'justify-center': !isSubmitted()
    }}>
      
      <MetaProvider>
        <Title>{isSubmitted() ? 'Mew: Search Results' : 'Mew'}</Title>
      </MetaProvider>

      {/* Home Page */}
      <Show when={!isSubmitted()}>
        <div class="flex flex-col font-bold">
          <h1 class="text-6xl">Mew</h1>
          <h2 class="text-2xl">A minimalist YouTube Music player</h2>
        </div>
      </Show>

      {/* Search bar */}
      <div class="relative max-w-180">
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Search"
            value={query()}
            onInput={(e) => setQuery(e.target.value)}
            class="w-full bg-white/10 border border-b/50 rounded-md pl-3 pr-9 py-1 transition duration-200 ease focus:outline-none hover:bg-white/30 shadow-sm focus:shadow"
          />
          <button type="submit" class="absolute right-0 top-0 rounded-r-lg bg-b p-2 border border-transparent text-center text-sm text-white transition-all shadow-sm hover:shadow focus:bg-b/80 focus:shadow-none active:bg-b/80 hover:bg-b/80 active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">
              <path fill-rule="evenodd" d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" clip-rule="evenodd" />
            </svg>
          </button>
        </form>
      </div>

      {/* Home Page */}
      <Show when={!isSubmitted()}>
        <p class="text-red-700 font-bold max-w-150">
          This website is strictly restricted to its contributors.<br/>
          Users acknowledge that using this tool may be subject to third-party terms of service, including those of YouTube. By proceeding, users accept full responsibility for their actions and any resulting consequences.
        </p>
      </Show>

      {/* Search Results */}
      <Show when={isSubmitted()}>
        <Show when={!results.loading} fallback={<div>Loading results...</div>}>
          <Switch>
            <Match when={results.error}>
              <span>Error: {results.error}</span>
            </Match>
            <Match when={results()}>
              <SearchResults results={results()} />
            </Match>
          </Switch>
        </Show>
      </Show>
    </div>
  );
}
