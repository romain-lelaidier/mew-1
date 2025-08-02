import { A } from "@solidjs/router";
import { BottomPlayer } from "../player/bottom";
import { Match, Show, Switch } from "solid-js";
import { PlaylistAdder } from "./playlists";
import { player } from "../player/logic";
import { u } from "./auth";

export function Layout(props) {
  return (
    <>
      <div class="flex-grow overflow-y-scroll flex flex-col bg-d bg-[radial-gradient(#0006_1px,transparent_1px)] [background-size:16px_16px] bg-fixed">
        <Switch>
          <Match when={props.isplayer}>
            <div class="flex flex-col ls:flex-row flex-grow ls:max-h-full ls:overflow-y-scroll">
              {props.children}
            </div>
          </Match>
          <Match when={props.floating}>
            <div class="flex-grow flex flex-col items-center justify-center">
              <div style={{'max-width': '100%'}} class="bg-d p-4 flex w-100 rounded-md drop-shadow-[0_0px_10px_rgba(0,0,0,0.15)]">
                {props.children}
              </div>
            </div>
          </Match>
          <Match when={true}>
            <div class={"bg-d p-4 flex flex-col gap-2 flex-grow sm:mx-16 md:mx-32 lg:mx-48 xl:mx-64 2xl:mx-80" + (props.center ? ' justify-center' : '')}>
              {props.children}
            </div>
          </Match>
        </Switch>
      </div>
      <Show when={!props.isplayer && player.s.started && player.s.queue.length > 0}>
        <div class="bg-d p-2 drop-shadow-[0_0px_10px_rgba(0,0,0,0.15)]">
          <BottomPlayer />
        </div>
      </Show>
      <PlaylistAdder/>
      <footer class="footer sm:footer-horizontal bg-b text-d flex justify-center flex-wrap [&>*]:px-4 [&>*]:py-0.5">
        <A href="/">Home</A>
        <Show when={u.connected}>
          <A href="/profile">My profile</A>
        </Show>
        <span>MIT License · 2025</span>
        <A href="https://github.com/romain-lelaidier/mew-1" target="_blank">GitHub</A>
        {/* <A href="/profile">My profile</A> */}
        <A href="/legal">Legal</A>
      </footer>
    </>
  )
}