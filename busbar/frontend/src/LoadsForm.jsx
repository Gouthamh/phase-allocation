import React from "react";

export const CONNECTIONS = [
    ["L1", "Ph1 - N (P+N)"],
    ["L2", "Ph2 - N (P+N)"],
    ["L3", "Ph3 - N (P+N)"],
    ["L1-L2", "Ph1 - Ph2 (2P)"],
    ["L2-L3", "Ph2 - Ph3 (2P)"],
    ["L3-L1", "Ph3 - Ph1 (2P)"],
    ["3P", "Ph1 - Ph2 - Ph3 (3P balanced)"],
];

const load = (name, current, cos, connection) => ({
    name, current: String(current), cos: String(cos), connection, leading: false,
});

const EXAMPLES = [
    ["Example 1: P+N on Ph1", [load("L_1", 100, 0.9, "L1")]],
    ["Example 2: 2P between phases", [load("L_1", 200, 1, "L1-L2"), load("L_2", 80, 0.85, "L2-L3")]],
    ["Example 3: balanced 3P", [load("Motor", 120, 0.85, "3P")]],
];

export default function LoadsForm({ loads, setLoads }) {
    const update = (i, patch) =>
        setLoads(loads.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

    return (
        <div>
            <table>
                <thead>
                    <tr>
                        <th style={{ width: "26%" }}>Name</th>
                        <th style={{ width: "17%" }}>Current (A)</th>
                        <th style={{ width: "13%" }}>cos φ</th>
                        <th>Connection</th>
                        <th title="Capacitive load: current leads the voltage">Lead</th>
                        <th />
                    </tr>
                </thead>
                <tbody>
                    {loads.map((l, i) => (
                        <tr key={i}>
                            <td>
                                <input aria-label={`Load ${i + 1} name`} value={l.name} maxLength={50}
                                    onChange={(e) => update(i, { name: e.target.value })} />
                            </td>
                            <td>
                                <input aria-label={`Load ${i + 1} current (A)`} type="number" min="0" step="any" value={l.current}
                                    onChange={(e) => update(i, { current: e.target.value })} />
                            </td>
                            <td>
                                <input aria-label={`Load ${i + 1} power factor`} type="number" min="0" max="1" step="0.01" value={l.cos}
                                    onChange={(e) => update(i, { cos: e.target.value })} />
                            </td>
                            <td>
                                <select aria-label={`Load ${i + 1} connection`} value={l.connection} onChange={(e) => update(i, { connection: e.target.value })}>
                                    {CONNECTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                                </select>
                            </td>
                            <td style={{ textAlign: "center" }}>
                                <input aria-label={`Load ${i + 1} leading`} type="checkbox" checked={l.leading}
                                    onChange={(e) => update(i, { leading: e.target.checked })} />
                            </td>
                            <td>
                                <button aria-label={`Remove load ${i + 1}`} className="btn remove" title="Remove load"
                                    onClick={() => setLoads(loads.filter((_, idx) => idx !== i))}>X</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="actions">
                <button className="btn primary"
                    onClick={() => setLoads([...loads, load(`Load ${ loads.length + 1 }`, "", 1, "L1")])}>
                    + Add load
                </button>
                {EXAMPLES.map(([label, ex]) => (
                    <button key={label} className="btn" onClick={() => setLoads(ex)}>{label}</button>
                ))}
            </div>

            <p className="note">
                Phase voltages are the reference: V1 at 0°, V2 at −120°, V3 at +120°. A load between two phases
                uses the line-to-line voltage (V12 at +30°, V23 at −90°, V31 at +150°). Loads are treated as
                inductive: the current lags its voltage by φ = arccos(cos φ), unless "Lead" is ticked. Neutral
                current is the vector sum I1 + I2 + I3.
            </p>
        </div>
    );
}
