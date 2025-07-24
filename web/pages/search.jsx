import { useParams } from "@solidjs/router";

import searchBar from "../components/searchbar";

export default function App() {
  const params = useParams();
  return (
    <>
      {searchBar(params.query)}
    </>
  )
}