import React from "react";

import PhasorDiagram, { COLORS } from "./PhasorDiagram.jsx";

const f = (x) => x.toFixed(1);

function Kpi({ label, value }) {
    return (
        <div className="kpi">
            <div className="label">{label}</div>
            <div className="value">{value}</div>
        </div>
    );
}

export default function Results({ data }) {
    const rows = [...data.phases, data.neutral_row];
    const barMax = Math.max(...rows.map((r) => r.current), 1e-9);

    return (
        <div>
            <div className="kpis">
                <Kpi label="Busbar Ib" value={`${ f(data.ib) } A`} />
                <Kpi label="Most loaded phase" value={data.most_loaded ?? "–"} />
                <Kpi label="Neutral current" value={`${ f(data.neutral) } A`} />
                <Kpi label="Unbalance" value={`${ f(data.unbalance) } %`} />
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Conductor</th><th className="num">|I| (A)</th><th className="num">Angle (°)</th>
                        <th className="num">Active (A)</th><th className="num">Reactive (A)</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.phase}>
                            <td>{r.phase}</td>
                            <td className="num">{f(r.current)}</td>
                            <td className="num">{f(r.angle)}</td>
                            <td className="num">{f(r.active)}</td>
                            <td className="num">{f(r.reactive)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="bars">
                {rows.map((r) => (
                    <div className="bar-row" key={r.phase}>
                        <span>{r.phase}</span>
                        <div className="bar-track">
                            <div className="bar-fill"
                                style={{ width: `${ (r.current / barMax) * 100 }%`, background: COLORS[r.phase] }} />
                        </div>
                        <span>{f(r.current)} A</span>
                    </div>
                ))}
            </div>

            <p className="note">
                Arithmetic sum of all load currents: {f(data.arithmetic_sum)} A (shown for comparison only, it
                ignores the phase angles). Reactive: negative = lagging, positive = leading; N is referenced to V1.
            </p>

            <PhasorDiagram rows={rows} />
        </div>
    );
}
