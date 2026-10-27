import { devices } from "../learning/devices.js";

export const reviewParts = [
  {
    id: "raspberry-pi-5",
    name: "Raspberry Pi 5",
    role: "Runs the application and reads digital inputs.",
    source:
      "https://www.raspberrypi.com/documentation/computers/raspberry-pi.html",
    fact: "GPIO uses 3.3 V logic and is not 5 V tolerant. Analogue voltage measurement requires an external ADC.",
  },
  {
    id: "arduino-uno-r3",
    name: "Arduino Uno R3",
    role: "Reads inputs and controls outputs.",
    source: "https://docs.arduino.cc/hardware/uno-rev3/",
    fact: "Uno R3 uses 5 V logic and has six analogue input pins. Verify sensor and breakout voltage compatibility.",
  },
  ...devices.map((d) => ({
    id: d.id,
    name: d.name,
    role: d.summary,
    source: d.source,
    fact:
      d.summary +
      " Interface: " +
      d.interface +
      ". Pin functions: " +
      d.pins.join(", ") +
      ". Verify exact package and breakout board.",
  })),
  {
    id: "led",
    name: "LED",
    role: "Shows a visible status.",
    source: "https://docs.arduino.cc/built-in-examples/basics/Blink/",
    fact: "An external LED needs suitable current limiting. The Uno onboard LED already has its own circuit.",
  },
  {
    id: "resistor",
    name: "Current-limiting resistor",
    role: "Limits current through an external LED.",
    source: "https://learn.sparkfun.com/tutorials/resistors/all",
    fact: "Ohm’s law: R = (supply voltage minus LED forward voltage) / desired current. Check resistor power dissipation and tolerances.",
  },
  {
    id: "motor",
    name: "DC motor",
    role: "Turns electrical power into motion.",
    source:
      "https://docs.arduino.cc/learn/electronics/transistor-motor-control/",
    fact: "A motor requires a suitable driver and power supply; do not power it directly from a GPIO pin.",
  },
  {
    id: "driver",
    name: "Motor driver",
    role: "Switches motor power independently of GPIO.",
    source:
      "https://docs.arduino.cc/learn/electronics/transistor-motor-control/",
    fact: "Match the driver to motor voltage, stall current, logic levels and protection requirements.",
  },
  {
    id: "supply",
    name: "External power supply",
    role: "Supplies the load without drawing motor current from GPIO.",
    source:
      "https://docs.arduino.cc/learn/electronics/transistor-motor-control/",
    fact: "Verify supply voltage, current capacity and the required common ground for a non-isolated driver.",
  },
];
export const scenarios = [
  {
    id: "temperature",
    title: "Temperature monitor",
    goal: "Read temperature and show a warning when it gets too warm.",
    board: "raspberry-pi-5",
    parts: ["tmp36", "mcp3008", "led", "resistor"],
  },
  {
    id: "rover",
    title: "Obstacle-aware rover",
    goal: "Drive a small rover and stop when an obstacle is detected.",
    board: "arduino-uno-r3",
    parts: ["hcsr04", "motor", "driver", "supply"],
  },
  {
    id: "indicator",
    title: "First external LED",
    goal: "Blink an external LED and explain why each component is needed.",
    board: "arduino-uno-r3",
    parts: ["led", "resistor"],
  },
];
export function inspectBuild({ board, parts, missing = [] }) {
  const included = new Set([board, ...parts]),
    available = new Set([...included].filter((p) => !missing.includes(p))),
    findings = [],
    edges = [];
  const add = (id, status, title, detail, affected, source) =>
    findings.push({ id, status, title, detail, affected, source });
  const require = (from, to, detail) => {
    if (!included.has(from)) return;
    edges.push({ from, to, label: "requires" });
    if (available.has(from) && !available.has(to))
      add(
        `${from}-${to}`,
        "blocked",
        "A required part is missing",
        detail,
        [from, to],
        reviewParts.find((p) => p.id === from)?.source,
      );
  };
  if (board === "raspberry-pi-5")
    require("tmp36", "mcp3008", "This TMP36 learning recipe uses an MCP3008 ADC because Raspberry Pi GPIO cannot measure analogue voltage directly. Another suitable ADC would require a revised recipe.");
  require("led", "resistor", "This external LED recipe requires a suitably sized current-limiting resistor.");
  require("motor", "driver", "A GPIO pin cannot drive this motor directly. Select a driver using the actual motor’s voltage and stall current.");
  require("motor", "supply", "The motor needs an appropriate power supply; GPIO is a control signal, not motor power.");
  if (available.has("hcsr04") && board === "raspberry-pi-5")
    add(
      "echo-level",
      "blocked",
      "Echo voltage needs attention",
      "The 5 V HC-SR04-style Echo output must not connect directly to a Raspberry Pi input. A verified level conversion circuit is not included in this recipe.",
      ["hcsr04", board],
      reviewParts.find((p) => p.id === "hcsr04").source,
    );
  if (missing.includes(board))
    add(
      "board-missing",
      "blocked",
      "The host board is unavailable",
      "Choose a board you have before building.",
      [board],
      null,
    );
  for (const id of parts) edges.push({ from: board, to: id, label: "uses" });
  add(
    "variants",
    "unknown",
    "Confirm the exact hardware",
    "Package, breakout regulators, pin order, supply and logic levels must match the actual parts. These checks do not establish every connection or physical operation.",
    [board, ...parts],
    null,
  );
  if (!findings.some((f) => f.status === "blocked"))
    add(
      "dependencies",
      "pass",
      "Selected dependency checks passed",
      "No missing dependency was found by the supported rules. Remaining electrical checks and physical tests are still required.",
      [board, ...parts],
      null,
    );
  return {
    findings,
    edges,
    nodes: [
      ...new Set([board, ...parts, ...edges.flatMap((e) => [e.from, e.to])]),
    ].map((id) => ({
      ...(id === "standalone" ? {name:"Standalone circuit",role:"A circuit without a required host board."} : reviewParts.find((p) => p.id === id)),
      id,
      missing: !available.has(id),
    })),
    status: findings.some((f) => f.status === "blocked")
      ? "Changes needed"
      : "Needs review",
  };
}
export function ledResistance(supplyV, forwardV, currentMa) {
  if (
    ![supplyV, forwardV, currentMa].every(Number.isFinite) ||
    supplyV <= forwardV ||
    forwardV < 0 ||
    currentMa <= 0 ||
    currentMa > 20 ||
    supplyV > 24
  )
    throw Error(
      "Use a supply above the LED forward voltage and a current between 0 and 20 mA.",
    );
  const current = currentMa / 1000;
  return {
    ohms: (supplyV - forwardV) / current,
    watts: (supplyV - forwardV) * current,
  };
}
