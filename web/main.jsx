import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";

import Home from "./pages/index.jsx";
import Search from "./pages/search.jsx"
import Artist from "./pages/artist.jsx"
import Legal from "./pages/legal.jsx"
import Player from "./pages/player.jsx"

render(
  () => (
    <Router>
      <Route path="/" component={Home} />
      <Route path="/search" component={Home} />
      <Route path="/search/:query" component={Search} />
      <Route path="/artist/:id" component={Artist} />
      <Route path="/legal" component={Legal} />
      <Route path="/player/:id" component={Player} />
    </Router>
  ),
  document.getElementById("app")
);