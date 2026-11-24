// plotly.js-basic-dist-min ships no types; it has the API of plotly.js (with fewer trace types),
// so reuse @types/plotly.js.
// @types/plotly.js has only named exports (no default), hence the namespace import.
declare module "plotly.js-basic-dist-min" {
  import * as Plotly from "plotly.js";
  export default Plotly;
}
