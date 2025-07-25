import { useParams } from '@solidjs/router';
import { MetaProvider, Title } from "@solidjs/meta";
import { useNavigate } from '@solidjs/router';

import SearchBar from '../components/searchbar'

export default function App() {
  const params = useParams();
  const navigate = useNavigate();

  return (
    <div class="bg-d px-4 flex flex-col gap-2 flex-grow justify-center sm:mx-16 md:mx-32 lg:mx-48 xl:mx-64 2xl:mx-80">
      
      <MetaProvider>
        <Title>Mew</Title>
      </MetaProvider>

      <div class="flex flex-col font-bold">
        <h1 class="text-6xl">Mew</h1>
        <h2 class="text-2xl">A minimalist YouTube Music player</h2>
      </div>

      <SearchBar navigator={navigate}/>

      <p class="text-red-700 font-bold max-w-150">
        This website is strictly restricted to its contributors.<br/>
        Users acknowledge that using this tool may be subject to third-party terms of service, including those of YouTube. By proceeding, users accept full responsibility for their actions and any resulting consequences.
      </p>

    </div>
  );
}
