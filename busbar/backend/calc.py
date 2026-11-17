import cmath
import math

V_ANGLES = {1: 0.0, 2: -120.0, 3: 120.0}

# Phase-to-phase: (from phase, to phase, reference angle of Vx - Vy in degrees)
PH_PH = {
    "L1-L2": (1, 2, 30.0),
    "L2-L3": (2, 3, -90.0),
    "L3-L1": (3, 1, 150.0),
}
PH_N = {"L1": 1, "L2": 2, "L3": 3}
CONNECTIONS = [*PH_N, *PH_PH, "3P"]

EPS = 1e-9


def load_to_phasors(current, cos, connection, leading=False):
    """Return {phase: complex current} contributed by one load."""
    phi = math.acos(cos) * (-1 if leading else 1)
    out = {1: 0j, 2: 0j, 3: 0j}

    if connection in PH_N:
        n = PH_N[connection]
        out[n] = cmath.rect(current, math.radians(V_ANGLES[n]) - phi)
    elif connection in PH_PH:
        x, y, ref = PH_PH[connection]
        i = cmath.rect(current, math.radians(ref) - phi)
        out[x], out[y] = i, -i
    elif connection == "3P":
        for n, v in V_ANGLES.items():
            out[n] = cmath.rect(current, math.radians(v) - phi)
    else:
        raise ValueError(f"Unknown connection: {connection}")
    return out


def summarize(phasors, arithmetic_sum=0.0):
    phases = []
    for n in (1, 2, 3):
        i = phasors[n]
        mag = abs(i)
        if mag < EPS:
            phases.append({"phase": f"Ph{n}", "current": 0.0, "angle": 0.0, "re": 0.0, "im": 0.0,
                           "phi": 0.0, "state": "none", "active": 0.0, "reactive": 0.0})
            continue
        angle = math.degrees(cmath.phase(i))
        # Normalise to (-180, 180]; positive phi means current lags its own voltage.
        phi = (V_ANGLES[n] - angle + 180) % 360 - 180
        state = "lagging" if phi > 1e-6 else "leading" if phi < -1e-6 else "unity"
        phases.append({
            "phase": f"Ph{n}",
            "current": mag,
            "angle": angle,
            "re": i.real,
            "im": i.imag,
            "phi": phi,
            "state": state,
            "active": mag * math.cos(math.radians(phi)),
            # Negative = lagging (inductive), relative to the phase's own voltage.
            "reactive": -mag * math.sin(math.radians(phi)),
        })

    n_sum = sum(phasors.values())
    n_mag = abs(n_sum)
    neutral = {
        "phase": "N",
        "current": n_mag,
        "angle": math.degrees(cmath.phase(n_sum)) if n_mag >= EPS else 0.0,
        "re": n_sum.real if n_mag >= EPS else 0.0,
        "im": n_sum.imag if n_mag >= EPS else 0.0,
    }
    neutral["active"], neutral["reactive"] = neutral["re"], neutral["im"]

    mags = [p["current"] for p in phases]
    ib = max(mags)
    return {
        "phases": phases,
        "neutral_row": neutral,
        "ib": ib,
        "neutral": n_mag,
        "most_loaded": phases[mags.index(ib)]["phase"] if ib >= EPS else None,
        "unbalance": (ib - min(mags)) / ib * 100 if ib >= EPS else 0.0,
        "arithmetic_sum": arithmetic_sum,
    }


def calculate(loads):
    total = {1: 0j, 2: 0j, 3: 0j}
    for ld in loads:
        for n, i in load_to_phasors(ld["current"], ld["cos"], ld["connection"],
                                    ld.get("leading", False)).items():
            total[n] += i
    return summarize(total, sum(ld["current"] for ld in loads))
