import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";

import Home from "./pages/index.jsx";

render(
  () => (
    <Router>
      <Route path="/" component={Home} />
      <Route path="/search" component={Home} />
      <Route path="/search/:query" component={Home} />
    </Router>
  ),
  document.getElementById("app")
);