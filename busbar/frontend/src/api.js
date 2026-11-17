export async function calculate(loads) {
    const res = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loads }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = Array.isArray(body.detail)
            ? body.detail.map((d) => `${ d.loc.slice(1).join(".") }: ${ d.msg }`).join("; ")
            : `Request failed (${ res.status })`;
        throw new Error(detail);
    }
    return res.json();
}
