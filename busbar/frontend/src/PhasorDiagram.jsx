import React from "react";

export const COLORS = { Ph1: "#8b4513", Ph2: "#222222", Ph3: "#9e9e9e", N: "#1e6fe0" };
const VOLTAGES = [["V1", 0], ["V2", -120], ["V3", 120]];

const SIZE = 340;
const C = SIZE / 2;
const R = 130;

// SVG y grows downwards, so angles are drawn with -sin to keep them counter-clockwise.
const point = (r, deg) => [C + r * Math.cos((deg * Math.PI) / 180), C - r * Math.sin((deg * Math.PI) / 180)];

export default function PhasorDiagram({ rows }) {
    const max = Math.max(...rows.map((r) => r.current), 1e-9);
    const scale = (0.85 * R) / max;

    return (
        <div className="phasor">
            <h3>Current phasor diagram</h3>
            <svg viewBox={`0 0 ${ SIZE } ${ SIZE }`} width="100%" style={{ maxWidth: SIZE }}>
                <defs>
                    {Object.entries(COLORS).map(([k, c]) => (
                        <marker key={k} id={`arrow-${ k }`} viewBox="0 0 10 10" refX="9" refY="5"
                            markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                            <path d="M0,0 L10,5 L0,10 z" fill={c} />
                        </marker>
                    ))}
                </defs>

                {[0.25, 0.5, 0.75, 1].map((k) => (
                    <circle key={k} cx={C} cy={C} r={R * k} fill="none" stroke="#e5e7eb" />
                ))}
                <line x1={C - R} y1={C} x2={C + R} y2={C} stroke="#eef0f2" />
                <line x1={C} y1={C - R} x2={C} y2={C + R} stroke="#eef0f2" />

                {VOLTAGES.map(([name, deg]) => {
                    const [x, y] = point(R, deg);
                    const [lx, ly] = point(R + 16, deg);
                    return (
                        <g key={name}>
                            <line x1={C} y1={C} x2={x} y2={y} stroke="#9ca3af" strokeDasharray="5 4" />
                            <text x={lx} y={ly} fontSize="12" fill="#6b7280" textAnchor="middle" dominantBaseline="middle">
                                {name}
                            </text>
                        </g>
                    );
                })}

                {rows.filter((r) => r.current > 1e-6).map((r) => {
                    const len = r.current * scale;
                    const [x, y] = point(len, r.angle);
                    const [lx, ly] = point(len + 14, r.angle);
                    return (
                        <g key={r.phase}>
                            <line x1={C} y1={C} x2={x} y2={y} stroke={COLORS[r.phase]} strokeWidth="2.5"
                                markerEnd={`url(#arrow-${ r.phase })`} />
                            <text x={lx} y={ly} fontSize="11" fill={COLORS[r.phase]} textAnchor="middle"
                                dominantBaseline="middle" fontWeight="600">
                                {r.phase}
                            </text>
                        </g>
                    );
                })}
            </svg>
            <div className="legend">
                {rows.map((r) => (
                    <span key={r.phase}>
                        <i style={{ background: COLORS[r.phase] }} />
                        {r.phase}: {r.current.toFixed(1)} A ∠ {r.angle.toFixed(1)}°
                    </span>
                ))}
                <span className="muted">Outer ring = {(R / scale).toFixed(0)} A</span>
            </div>
        </div>
    );
}
