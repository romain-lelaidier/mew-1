import { createSignal } from "solid-js";

export default function SearchBar(props) {
  const [query, setQuery] = createSignal(props.query || '');
  const [error, setError] = createSignal(null);

  const onsubmit = (event) => {
    event.preventDefault();
    if (query().length < 3) {
      return setError('Query length should be at least 3.');
    }
    if (typeof props.navigator === 'function') {
      props.navigator('/search/' + query());
    }
    if (typeof props.onsubmit === 'function') {
      props.onsubmit(query())
    }
  }

  const oninputchange = (event) => {
    setQuery(event.target.value);
    setError(null);
  }

  return (
    <div class="relative">
      <form onSubmit={onsubmit}>
        <input
          type="text"
          placeholder="Search"
          value={query()}
          onInput={oninputchange}
          class="w-full bg-white/10 border border-b/50 rounded-md pl-3 pr-9 py-1 transition duration-200 ease focus:outline-none hover:bg-white/30 shadow-sm focus:shadow"
        />
        <Show when={query().length > 0}>
          <button type="reset" class="absolute right-8 top-0 p-2 flex flex-col justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" class="w-4 h-4">
              <path d="M183.1 137.4C170.6 124.9 150.3 124.9 137.8 137.4C125.3 149.9 125.3 170.2 137.8 182.7L275.2 320L137.9 457.4C125.4 469.9 125.4 490.2 137.9 502.7C150.4 515.2 170.7 515.2 183.2 502.7L320.5 365.3L457.9 502.6C470.4 515.1 490.7 515.1 503.2 502.6C515.7 490.1 515.7 469.8 503.2 457.3L365.8 320L503.1 182.6C515.6 170.1 515.6 149.8 503.1 137.3C490.6 124.8 470.3 124.8 457.8 137.3L320.5 274.7L183.1 137.4z"/>
            </svg>
          </button>
        </Show>
        <button type="submit" class="absolute right-0 top-0 rounded-r-lg bg-b p-2 border border-transparent text-center text-sm text-white transition-all shadow-sm hover:shadow focus:bg-b/80 focus:shadow-none active:bg-b/80 hover:bg-b/80 active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">
            <path fill-rule="evenodd" d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" clip-rule="evenodd" />
          </svg>

          {/* <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
            <path fill-rule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clip-rule="evenodd" />
          </svg> */}

        </button>
      </form>
      <Show when={error()}>
        <span class="text-red-700 p-3 italic">{error()}</span>
      </Show>
    </div>
  )
}