import FPSMeter from "../../lib/fpsmeter.ts";

const meter = new FPSMeter({
  bottom: "40px",
  graph: 1,
  heat: 1,
  left: "50%",
  margin: "0 0 0 -58px",
  top: "auto",
});

meter.hide();

export default meter;
