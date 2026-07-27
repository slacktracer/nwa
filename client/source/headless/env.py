"""
Headless RL environment for NWA — Python port of env.ts.
Pure Python, no external dependencies.
Provides Gym-style interface: reset(), step().
Matches TypeScript physics exactly.
"""

import math
import copy

# ── Vec2 helpers (replicating gl-matrix subset) ──────────────────────

def _create(x=0.0, y=0.0):
    return [x, y]

def _clone(v):
    return [v[0], v[1]]

def _add(a, b):
    return [a[0] + b[0], a[1] + b[1]]

def _add_into(out, a, b):
    out[0] = a[0] + b[0]
    out[1] = a[1] + b[1]

def _scale(v, s):
    return [v[0] * s, v[1] * s]

def _scale_into(out, v, s):
    out[0] = v[0] * s
    out[1] = v[1] * s

def _negate(v):
    return [-v[0], -v[1]]

def _negate_into(out, v):
    out[0] = -v[0]
    out[1] = -v[1]

def _distance(a, b):
    dx = a[0] - b[0]
    dy = a[1] - b[1]
    return math.sqrt(dx * dx + dy * dy)

def _length(v):
    return math.sqrt(v[0] * v[0] + v[1] * v[1])

def _normalize(v):
    mag = _length(v)
    if mag == 0.0:
        return [0.0, 0.0]
    return [v[0] / mag, v[1] / mag]

def _normalize_into(out, v):
    mag = _length(v)
    if mag == 0.0:
        out[0] = 0.0
        out[1] = 0.0
    else:
        out[0] = v[0] / mag
        out[1] = v[1] / mag

def _set(out, x, y):
    out[0] = x
    out[1] = y

def _copy_into(out, v):
    out[0] = v[0]
    out[1] = v[1]

# ── Physics (matches Physics.ts) ─────────────────────────────────────

def apply_force(body, force):
    """applyForce: add force to body.force"""
    _add_into(body["force"], body["force"], force)


def bind_body(body, boundary):
    """bind: wrap-around at frame edges"""
    hw = boundary["width"] / 2.0
    hh = boundary["height"] / 2.0
    r = body["radius"]
    if body["position"][0] - r > hw:
        body["position"][0] = -hw - r
    if body["position"][0] + r < -hw:
        body["position"][0] = hw + r
    if body["position"][1] - r > hh:
        body["position"][1] = -hh - r
    if body["position"][1] + r < -hh:
        body["position"][1] = hh + r


def calculate_pull_force_from_to(from_body, to_body):
    """calculatePullForceFromTo: gravity from from_body to to_body"""
    # direction = normalize(to.position) then negated
    # This gives the direction FROM to_body TOWARD from_body
    direction = _normalize(_clone(to_body["position"]))
    _negate_into(direction, direction)
    dist = _distance(from_body["position"], to_body["position"])
    magnitude = from_body["mass"] * to_body["mass"] / (dist * dist)
    return _scale(direction, magnitude)


def get_direction_vector(radians):
    return _create(math.cos(radians), math.sin(radians))


def integrate(body, delta_time):
    """integrate: Velocity Verlet half-step"""
    # acc = force / mass
    acc = _scale(body["force"], 1.0 / body["mass"])
    # acc *= dt/2
    _scale_into(acc, acc, delta_time / 2.0)
    # vel += acc
    _add_into(body["velocity"], body["velocity"], acc)
    # pos += vel * dt
    _add_into(body["position"], body["position"], _scale(body["velocity"], delta_time))
    # vel += acc
    _add_into(body["velocity"], body["velocity"], acc)
    # reset acc and force
    _set(body["acceleration"], 0.0, 0.0)
    _set(body["force"], 0.0, 0.0)


# ── Battery (matches Battery.ts) ─────────────────────────────────────

def battery_drain(battery, cost, exact=False):
    if battery["level"] >= cost:
        battery["level"] -= cost
        return cost
    if exact:
        return 0.0
    cost = battery["level"]
    battery["level"] = 0.0
    return cost


def battery_recharge(battery, charge):
    if charge < battery["maximum"]:
        battery["level"] += charge
        if battery["level"] > battery["maximum"]:
            battery["level"] = battery["maximum"]


# ── Collision detection (matches Physics.ts detectCollisions) ────────

def detect_collisions(missiles, ships, star):
    # Ship-ship and ship-star collisions
    for i in range(len(ships)):
        if ships[i]["live"]:
            dist = _distance(ships[i]["position"], star["position"])
            if dist > ships[i]["radius"] + star["radius"]:
                # Not hitting star — check ship-ship
                for j in range(i + 1, len(ships)):
                    if ships[j]["live"]:
                        d = _distance(ships[i]["position"], ships[j]["position"])
                        if d < ships[i]["radius"] + ships[j]["radius"] - 2:
                            ships[i]["collisionData"]["isColliding"] = True
                            ships[j]["collisionData"]["isColliding"] = True
            else:
                ships[i]["collisionData"]["isColliding"] = True

    # Missile-ship and missile-star collisions
    for i in range(len(missiles)):
        if missiles[i]["live"]:
            dist = _distance(missiles[i]["position"], star["position"])
            if dist > missiles[i]["radius"] + star["radius"]:
                for j in range(len(ships)):
                    if ships[j]["live"] and ships[j]["collisionData"]["isColliding"] is False:
                        d = _distance(missiles[i]["position"], ships[j]["position"])
                        if d < missiles[i]["radius"] + ships[j]["radius"] - 2:
                            missiles[i]["collisionData"]["isColliding"] = True
                            missiles[i]["collisionData"]["target"] = ships[j]["id"]
                            ships[j]["collisionData"]["isColliding"] = True
                            ships[j]["collisionData"]["hit"] = True
                            if missiles[i]["owner"] == ships[j]["id"]:
                                ships[j]["collisionData"]["self"] = True
            else:
                missiles[i]["collisionData"]["isColliding"] = True


# ── Templates (deep-copied per entity) ───────────────────────────────

def ship_template():
    return {
        "acceleration": [0.0, 0.0],
        "battery": {"level": 100.0, "maximum": 100.0},
        "collisionData": {"isColliding": False, "hit": False, "self": False, "target": False},
        "colours": {
            "crash": "hsla(360, 100%, 100%, 0.05)",
            "hull": "hsla(360, 100%, 100%, 0.7)",
            "shadow": "hsla(360, 100%, 100%, 0.02)",
        },
        "commands": {
            "anticlockwise": False,
            "clear": False,
            "clockwise": False,
            "fire": False,
            "thrust": False,
        },
        "crashed": False,
        "force": [0.0, 0.0],
        "hull": None,
        "live": True,
        "mass": 0.1,
        "memory": {
            "position": [0.0, 0.0],
            "radians": math.pi,
            "renderPosition": [0.0, 0.0],
            "velocity": [0.0, 0.0],
        },
        "name": "Untitled",
        "position": [0.0, 0.0],
        "propulsor": {
            "active": False,
            "colours": {
                "flame": "hsla(360, 100%, 100%, 0.4)",
                "shadow": "hsla(360, 100%, 100%, 0.05)",
            },
            "efficiency": 100000.0,
        },
        "radians": math.pi,
        "radius": 10.0,
        "renderPosition": [0.0, 0.0],
        "rotationVelocity": math.pi / 800.0,
        "shadow": None,
        "velocity": [0.0, 0.0],
        "weaponsSystem": {
            "missiles": {"cost": 5.0, "live": 0, "maximum": 3},
        },
    }


def missile_template():
    return {
        "acceleration": [0.0, 0.0],
        "blastRadius": 10.0,
        "collisionData": {"isColliding": False, "target": False},
        "colours": {
            "core": "hsla(360, 100%, 100%, 0.7)",
            "crash": "hsla(360, 100%, 100%, 0.05)",
            "shadow": "hsla(360, 100%, 100%, 0.02)",
        },
        "detonated": False,
        "force": [0.0, 0.0],
        "live": False,
        "mass": 0.001,
        "owner": None,
        "position": [0.0, 0.0],
        "power": 0.00001,
        "radius": 2.0,
        "renderPosition": [0.0, 0.0],
        "velocity": [0.0, 0.0],
    }


def star_template():
    return {
        "baseColour": "hsla(0, 0%, 9%, 0.9)",
        "baseRadius": 50.0,
        "colour": "hsla(0, 0%, 9%, 0.9)",
        "mass": 2.0,
        "oscillator": {"amplitude": 1.0, "step": 0.15, "value": 0.0},
        "position": [0.0, 0.0],
        "power": 150000.0,
        "radius": 50.0,
    }


# ── Ship configs (matches data/ships/*.ts) ───────────────────────────

SHIP_CONFIGS = [
    {
        "colours": {
            "crash": "hsla(61, 100%, 40%, 0.05)",
            "hull": "hsla(61, 100%, 40%, 0.7)",
            "shadow": "hsla(61, 100%, 40%, 0.02)",
        },
        "id": "player1",
        "name": "Irregular Apocalypse",
        "position": [200.0, 200.0],
        "propulsor": {
            "colours": {
                "flame": "hsla(61, 100%, 40%, 0.4)",
                "shadow": "hsla(61, 100%, 40%, 0.05)",
            },
        },
        "radians": math.pi,
        "velocity": [0.05, -0.05],
    },
    {
        "colours": {
            "crash": "hsla(197, 100%, 50%, 0.05)",
            "hull": "hsla(197, 100%, 50%, 0.7)",
            "shadow": "hsla(197, 100%, 50%, 0.02)",
        },
        "id": "player2",
        "name": "Prosthetic Conscience",
        "position": [-200.0, 200.0],
        "propulsor": {
            "colours": {
                "flame": "hsla(197, 100%, 50%, 0.4)",
                "shadow": "hsla(197, 100%, 50%, 0.05)",
            },
        },
        "radians": math.pi,
        "velocity": [0.05, 0.05],
    },
    {
        "colours": {
            "crash": "hsla(116, 100%, 40%, 0.05)",
            "hull": "hsla(116, 100%, 40%, 0.7)",
            "shadow": "hsla(116, 100%, 40%, 0.02)",
        },
        "id": "player3",
        "name": "Revisionist",
        "position": [-200.0, -200.0],
        "propulsor": {
            "colours": {
                "flame": "hsla(116, 100%, 40%, 0.4)",
                "shadow": "hsla(116, 100%, 40%, 0.05)",
            },
        },
        "radians": math.pi,
        "velocity": [-0.05, 0.05],
    },
    {
        "colours": {
            "crash": "hsla(300, 100%, 70%, 0.05)",
            "hull": "hsla(300, 100%, 70%, 0.7)",
            "shadow": "hsla(300, 100%, 70%, 0.02)",
        },
        "id": "player4",
        "name": "The Ends Of Invention",
        "position": [200.0, -200.0],
        "propulsor": {
            "colours": {
                "flame": "hsla(300, 100%, 70%, 0.4)",
                "shadow": "hsla(300, 100%, 70%, 0.05)",
            },
        },
        "radians": math.pi,
        "velocity": [-0.05, -0.05],
    },
]


# ── Constants ────────────────────────────────────────────────────────

FRAME = {"height": 500, "width": 500}
DELTA_TIME = 16  # ms per tick
EMPTY_SHIP_OBS = {"x": 0.0, "y": 0.0, "vx": 0.0, "vy": 0.0, "angle": 0.0, "battery": 0.0, "missiles": 0.0, "alive": 0}
EMPTY_ACTION = {"thrust": False, "turnLeft": False, "turnRight": False, "fire": False, "clear": False}


# ── Missile helpers (matches Missile.ts) ─────────────────────────────

def _missile_build(missiles):
    """Find a dead missile or create a new one from template."""
    for m in missiles:
        if m["live"] is False:
            return m
    m = missile_template()
    missiles.append(m)
    return m


def _missile_launch(missiles, core_colour, crash_colour, direction, owner, position, shadow_colour, velocity):
    missile = _missile_build(missiles)
    missile["collisionData"]["isColliding"] = False
    missile["collisionData"]["target"] = False
    missile["colours"]["core"] = core_colour
    missile["colours"]["crash"] = crash_colour
    missile["colours"]["shadow"] = shadow_colour
    missile["detonated"] = False
    missile["live"] = True
    missile["owner"] = owner

    # position + direction * 20
    _add_into(missile["position"], position, _scale(direction, 20.0))
    _copy_into(missile["velocity"], velocity)
    apply_force(missile, _scale(direction, missile["power"]))

    return missile


def _missile_deactivate(missile):
    missile["live"] = False


def _missile_update(missile, star):
    """Missile.update: matches Missile.ts update()"""
    if missile["collisionData"]["isColliding"]:
        missile["live"] = False

    if missile["live"] is False:
        return

    bind_body(missile, FRAME)

    pull_force = calculate_pull_force_from_to(star, missile)
    apply_force(missile, pull_force)

    integrate(missile, DELTA_TIME)


# ── Ship helpers (matches Ship.ts) ───────────────────────────────────

def _ship_process_commands(ship):
    """processCommands: matches Ship.ts processCommands()"""
    if ship["commands"]["anticlockwise"]:
        ship["radians"] -= ship["rotationVelocity"] * DELTA_TIME

    if ship["commands"]["clockwise"]:
        ship["radians"] += ship["rotationVelocity"] * DELTA_TIME

    if ship["commands"]["thrust"]:
        energy = battery_drain(ship["battery"], 1.0, True)
        energy /= ship["propulsor"]["efficiency"]

        if energy > 0.0:
            direction = get_direction_vector(ship["radians"])
            apply_force(ship, _scale(direction, energy))
            ship["propulsor"]["active"] = True
        else:
            ship["propulsor"]["active"] = False
    else:
        ship["propulsor"]["active"] = False

    if ship["commands"]["fire"]:
        if ship["weaponsSystem"]["missiles"]["live"] < ship["weaponsSystem"]["missiles"]["maximum"]:
            energy = battery_drain(ship["battery"], float(ship["weaponsSystem"]["missiles"]["cost"]), True)
            if energy:
                # Need access to global missiles list — handled in _ship_update
                ship["_fire_pending"] = True
        ship["commands"]["fire"] = False

    if ship["commands"]["clear"] is True:
        ship["_clear_pending"] = True
        ship["commands"]["clear"] = False


def _ship_update(ship, star, missiles):
    """Ship.update: matches Ship.ts update()"""
    if ship["collisionData"]["isColliding"]:
        ship["live"] = False

    if ship["live"]:
        bind_body(ship, FRAME)

        pull_force = calculate_pull_force_from_to(star, ship)
        apply_force(ship, pull_force)
        battery_recharge(ship["battery"], star["power"] * _length(pull_force))

        _ship_process_commands(ship)

        # Handle fire (needs missiles list)
        if ship.get("_fire_pending"):
            ship["_fire_pending"] = False
            direction = get_direction_vector(ship["radians"])
            _missile_launch(
                missiles,
                ship["colours"]["hull"],
                ship["colours"]["crash"],
                direction,
                ship["id"],
                ship["position"],
                ship["colours"]["shadow"],
                ship["velocity"],
            )
            ship["weaponsSystem"]["missiles"]["live"] += 1

        # Handle clear
        if ship.get("_clear_pending"):
            ship["_clear_pending"] = False
            for m in missiles:
                if m["owner"] == ship["id"]:
                    _missile_deactivate(m)
            ship["weaponsSystem"]["missiles"]["live"] = 0

        integrate(ship, DELTA_TIME)


# ── Star update (matches Star.ts update, headless — no color rng) ────

def _star_update(star, tick):
    """Star.update: pulsates radius (skips color rng for determinism)"""
    star["oscillator"]["value"] += star["oscillator"]["step"]
    star["radius"] = star["baseRadius"] + math.sin(star["oscillator"]["value"]) * star["oscillator"]["amplitude"]


# ── Helper ───────────────────────────────────────────────────────────

def _ship_index(ship_id):
    """Extract player index from ship id e.g. 'player3' → 2"""
    return int(ship_id[-1]) - 1


# ── NWAEnv ───────────────────────────────────────────────────────────

class NWAEnv:
    """Headless NWA environment, Gym-style."""

    def __init__(self, num_players=2, max_ticks=10000):
        self.num_players = min(4, max(2, num_players))
        self.max_ticks = max_ticks
        self.rewards = [0.0] * self.num_players
        self.tick = 0
        self.done = False
        self._ships = []
        self._ships_by_id = {}
        self._missiles = []
        self._star = None

    # ── Public API ──────────────────────────────────────────────────

    def reset(self):
        """Reset environment. Returns initial observation dict."""
        self.tick = 0
        self.done = False
        self.rewards = [0.0] * self.num_players

        # Clear old state
        self._missiles.clear()
        self._ships.clear()
        self._ships_by_id.clear()
        self._star = None

        # Build ships
        for i in range(self.num_players):
            template = ship_template()
            config = SHIP_CONFIGS[i]

            ship = {
                **template,
                "id": config["id"],
                "name": config["name"],
                "position": list(config["position"]),
                "velocity": list(config["velocity"]),
                "radians": config["radians"],
                "colours": {
                    "crash": config["colours"]["crash"],
                    "hull": config["colours"]["hull"],
                    "shadow": config["colours"]["shadow"],
                },
                "propulsor": {
                    **template["propulsor"],
                    "colours": {
                        "flame": config["propulsor"]["colours"]["flame"],
                        "shadow": config["propulsor"]["colours"]["shadow"],
                    },
                },
                "memory": {
                    "position": list(config["position"]),
                    "radians": config["radians"],
                    "renderPosition": list(config["position"]),
                    "velocity": list(config["velocity"]),
                },
                "_fire_pending": False,
                "_clear_pending": False,
            }

            self._ships.append(ship)
            self._ships_by_id[ship["id"]] = ship

        # Build star
        self._star = star_template()

        return self._observe()

    def step(self, actions):
        """
        Advance one tick.
        actions: list of dicts with thrust/turnLeft/turnRight/fire/clear booleans.
        Returns dict with obs, rewards, done, winner, tick.
        """
        if self.done:
            return self._result()

        # Reset per-tick rewards
        self.rewards = [0.0] * self.num_players

        # Apply actions → ship.commands
        for i in range(self.num_players):
            ship = self._ships[i]
            if not ship["live"]:
                continue
            a = actions[i] if i < len(actions) else EMPTY_ACTION
            a = {**EMPTY_ACTION, **a}  # default missing keys
            ship["commands"]["anticlockwise"] = a.get("turnLeft", False)
            ship["commands"]["clockwise"] = a.get("turnRight", False)
            ship["commands"]["thrust"] = a.get("thrust", False)
            if a.get("fire", False):
                ship["commands"]["fire"] = True
            if a.get("clear", False):
                ship["commands"]["clear"] = True

        # Run one physics tick
        self._tick()

        # Collect death/detonation events
        self._collect_events()

        # Survival bonus: small reward per alive ship per tick.
        # This makes the reward signal dense so the policy can learn.
        for i in range(self.num_players):
            if self._ships[i]["live"]:
                self.rewards[i] += 0.01

        self.tick += 1

        # Check termination
        alive_count = sum(1 for s in self._ships if s["live"])
        if alive_count <= 1 or self.tick >= self.max_ticks:
            self.done = True

        return self._result()

    # ── Internal ────────────────────────────────────────────────────

    def _tick(self):
        """One physics tick: star → collisions → missiles → ships"""
        _star_update(self._star, self.tick)

        detect_collisions(self._missiles, self._ships, self._star)

        for missile in self._missiles:
            _missile_update(missile, self._star)

        for ship in self._ships:
            _ship_update(ship, self._star, self._missiles)

    def _collect_events(self):
        """Replicates event-driven scoring from dispatcher.ts, headless style."""
        # Detonations: missiles that just died this tick
        for missile in self._missiles:
            if missile["live"] is False and missile["detonated"] is False:
                missile["detonated"] = True

                # Decrement owner's live missile count
                owner_id = missile.get("owner")
                if owner_id:
                    owner_ship = self._ships_by_id.get(owner_id)
                    if owner_ship:
                        owner_ship["weaponsSystem"]["missiles"]["live"] -= 1
                        if owner_ship["weaponsSystem"]["missiles"]["live"] < 0:
                            owner_ship["weaponsSystem"]["missiles"]["live"] = 0

                # Award point if missile hit a target
                if missile["collisionData"].get("target") and owner_id:
                    self.rewards[_ship_index(owner_id)] += 1.0

        # Crashes: ships that just died this tick
        for ship in self._ships:
            if ship["live"] is False and ship["crashed"] is False:
                ship["crashed"] = True

                i = _ship_index(ship["id"])

                if ship["collisionData"].get("self"):
                    # Self-hit (own missile): -1 (undo hit point) then -2
                    self.rewards[i] -= 1.0
                    self.rewards[i] -= 2.0
                elif ship["collisionData"].get("hit"):
                    # Hit by opponent missile
                    self.rewards[i] -= 1.0
                else:
                    # Hit the star
                    self.rewards[i] -= 2.0

    def _observe(self):
        """Build observation dict."""
        ships_obs = []
        for i in range(self.num_players):
            s = self._ships[i]
            if s["live"]:
                ships_obs.append({
                    "x": s["position"][0],
                    "y": s["position"][1],
                    "vx": s["velocity"][0],
                    "vy": s["velocity"][1],
                    "angle": s["radians"] % (math.pi * 2),
                    "battery": s["battery"]["level"] / s["battery"]["maximum"],
                    "missiles": s["weaponsSystem"]["missiles"]["live"] / s["weaponsSystem"]["missiles"]["maximum"],
                    "alive": 1,
                })
            else:
                ships_obs.append(dict(EMPTY_SHIP_OBS))

        return {
            "ships": ships_obs,
            "starRadius": self._star["radius"],
        }

    def _result(self):
        """Build StepResult."""
        winner = None
        if self.done:
            alive = [s for s in self._ships if s["live"]]
            winner = alive[0]["id"] if len(alive) == 1 else None

        return {
            "obs": self._observe(),
            "rewards": list(self.rewards),
            "done": self.done,
            "winner": winner,
            "tick": self.tick,
        }
