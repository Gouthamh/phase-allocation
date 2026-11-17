import React, { useEffect, useState } from "react";
import LoadsForm from "./LoadsForm.jsx";
import Results from "./Results.jsx";
import { calculate } from "./api.js";

const INITIAL = [
    { name: "L_1", current: "139", cos: "0.8", connection: "L1", leading: false },
    { name: "L_2", current: "130", cos: "1", connection: "L2", leading: false },
    { name: "Load 3", current: "200", cos: "1", connection: "L1-L2", leading: false },
];

const toValid = (loads) =>
    loads
        .map((l) => ({ ...l, current: Number(l.current), cos: Number(l.cos) }))
        .filter((l) => l.current > 0 && l.cos > 0 && l.cos <= 1);

export default function App() {
    const [loads, setLoads] = useState(INITIAL);
    const [data, setData] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        const valid = toValid(loads);
        if (valid.length === 0) {
            setData(null);
            setError("Enter at least one load with current > 0 and 0 < cos φ ≤ 1.");
            return;
        }
        let stale = false;
        const timer = setTimeout(async () => {
            try {
                const result = await calculate(valid);
                if (!stale) { setData(result); setError(""); }
            } catch (e) {
                if (!stale) setError(e.message);
            }
        }, 300);
        return () => { stale = true; clearTimeout(timer); };
    }, [loads]);

    return (
        <>
            <header className="header">
                <h1>Busbar phase balance calculator</h1>
                <p>Phasor sum of load currents per phase, neutral current and busbar Ib (most loaded phase)</p>
            </header>
            <main className="grid">
                <section className="card">
                    <h2>Loads</h2>
                    <LoadsForm loads={loads} setLoads={setLoads} />
                </section>
                <section className="card">
                    <h2>Results</h2>
                    {error && <p className="error">{error}</p>}
                    {data && <Results data={data} />}
                </section>
            </main>
        </>
    );
}
