import T from "../constants/theme";

const Select = ({ label, value, onChange, options }) => (
    <div style={{ marginBottom: 12 }}>
        {label && (
            <div
                style={{
                    color: T.textMuted,
                    fontSize: 11,
                    fontWeight: 600,
                    marginBottom: 6,
                    fontFamily: T.mono,
                    letterSpacing: 0.5,
                }}
            >
                {label}
            </div>
        )}
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={label}
            style={{
                width: "100%",
                boxSizing: "border-box",
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: T.radiusSm,
                padding: "10px 14px",
                color: T.text,
                fontSize: 14,
                fontFamily: T.font,
                outline: "none",
                appearance: "none",
            }}
        >
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    </div>
);

export default Select;
