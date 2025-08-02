import { MetaProvider, Title } from "@solidjs/meta";
import { createSignal } from "solid-js";
import { u, uTryLog, uTrySignup } from "../components/auth"
import { LinkButton } from "../components/utils";
import { useNavigate } from "@solidjs/router";
import { Layout } from "../components/layout";

export default function App(props) {

  const navigate = useNavigate();

  const [ uname, setUname ] = createSignal('');
  const [ upassword, setUpassword ] = createSignal('');
  const [ uvpassword, setUvpassword ] = createSignal('');
  const [ error, setError ] = createSignal(null);

  uTryLog().then(logged => {
    if (logged) navigate('/');
  })

  const onsubmit = async (e) => {
    e.preventDefault();
    if (props.signup) {
      if (upassword() != uvpassword()) {
        return setError('The passwords do not match');
      }
      uTrySignup(uname(), upassword()).then(() => {
      }).catch(alert);
    } else {
      uTryLog(uname(), upassword()).then(logged => {
        if (logged) navigate('/');
      });
    }
  }

  const action = props.signup ? 'Sign up' : 'Log in';
  const classes = "font-mono w-full bg-white/10 border border-b/50 rounded-md pl-3 py-1 transition duration-200 ease focus:outline-none hover:bg-white/30 shadow-sm focus:shadow";

  return (
    <Layout floating={true}>

      <MetaProvider>
        <Title>Mew - Connection</Title>
      </MetaProvider>

      <div class="flex-grow flex flex-col gap-2">
        <Show when={!u.connected} fallback={<div>You are already connected.</div>}>
          <h2 class="text-2xl font-bold">{action}</h2>
          <form onSubmit={onsubmit} class="flex-grow flex flex-col gap-1">
            <input type="text" placeholder="username" value={uname()} onInput={(e) => setUname(e.target.value)} class={classes}/>
            <input type="password" placeholder="password" value={upassword()} onInput={(e) => setUpassword(e.target.value)} class={classes}/>
            <Show when={props.signup}>
              <input type="password" placeholder="verify password" value={uvpassword()} onInput={(e) => setUvpassword(e.target.value)} class={classes}/>
            </Show>
            <input type="submit" value={action} class="block w-full bg-b text-white px-3 py-1 rounded-md"></input>
            <Show when={error()}><span class="text-red-700 p-3 italic">{error()}</span></Show>
          </form>
          <Show when={props.signup} fallback={<div>Or create an account <LinkButton href="/signup"/>.</div>}>
            <div>If you already have an account, you can log in <LinkButton href="/login"/>.</div>
          </Show>
        </Show>
      </div>

    </Layout>
  );
}
