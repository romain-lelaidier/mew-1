import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";

import Home from "./pages/index.jsx";

render(
    () => (
        <Router>
            <Route path="/" component={Home} />
            <Route path="/hello-world" component={() => <h1>Hello World!</h1>} />
        </Router>
    ),
    document.getElementById("app")
);