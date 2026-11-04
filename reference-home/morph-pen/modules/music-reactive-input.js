import { withResourceScope } from "./resource-scope.js";
import { DEFAULT_MUSIC_REACTIVE_STATE, MUSIC_REACTIVE_EVENT } from "/reference-home/music-reactive-bridge.js";

export function createMusicReactiveInput(parent) {
  return withResourceScope(parent, (resources) => {
    let state = { ...DEFAULT_MUSIC_REACTIVE_STATE };

    const handleReactiveUpdate = (event) => {
      state = {
        ...DEFAULT_MUSIC_REACTIVE_STATE,
        ...event.detail,
      };
    };

    resources.listen(window, MUSIC_REACTIVE_EVENT, handleReactiveUpdate);

    return {
      dispose: resources.dispose,
      getState() {
        return state;
      },
    };
  });
}
