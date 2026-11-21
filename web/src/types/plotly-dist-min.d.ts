// plotly.js-dist-min ships no types; it is the same API as plotly.js, so reuse @types/plotly.js.
// @types/plotly.js has only named exports (no default), hence the namespace import.
declare module "plotly.js-dist-min" {
  import * as Plotly from "plotly.js";
  export default Plotly;
}
