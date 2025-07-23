import searchBar from "../components/searchbar"

export default function App() {
  return (
    <div class="flex flex-col gap-4 justify-center">
      <div class="flex flex-col font-bold">
        <h1 class="text-6xl">Mew</h1>
        <h2 class="text-2xl">A minimalist YouTube Music player</h2>
      </div>
      {searchBar}
      <p class="text-red-700 font-bold max-w-150">
        This website is strictly restricted to its contributors.<br/>
        Users acknowledge that using this tool may be subject to third-party terms of service, including those of YouTube. By proceeding, users accept full responsibility for their actions and any resulting consequences.
      </p>
    </div>
  )
}