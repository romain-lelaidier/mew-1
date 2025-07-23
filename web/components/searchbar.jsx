export default function searchBar() {
  return (
    <div class="relative max-w-150">
      <input type="email" class="w-full bg-white/10 border border-b/50 rounded-md pl-3 pr-9 py-1 transition duration-200 ease focus:outline-none hover:bg-white/30 shadow-sm focus:shadow" placeholder="Search" />
      <button class="absolute right-0 top-0 rounded-r-lg bg-b p-2 border border-transparent text-center text-sm text-white transition-all shadow-sm hover:shadow focus:bg-b/80 focus:shadow-none active:bg-b/80 hover:bg-b/80 active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none" type="button">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">
          <path fill-rule="evenodd" d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>
  )
}