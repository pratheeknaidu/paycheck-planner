import T from "../constants/theme";

const Input = ({ label, value, onChange, type = "text", placeholder, small, error }) => (
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
        <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            type={type}
            placeholder={placeholder}
            aria-label={label || placeholder}
            style={{
                width: "100%",
                boxSizing: "border-box",
                background: T.surface,
                border: `1px solid ${error ? T.red : T.border}`,
                borderRadius: T.radiusSm,
                padding: small ? "8px 12px" : "10px 14px",
                color: T.text,
                fontSize: 14,
                fontFamily: T.font,
                outline: "none",
                transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.target.style.borderColor = error ? T.red : T.accent)}
            onBlur={(e) => (e.target.style.borderColor = error ? T.red : T.border)}
        />
        {error && (
            <div style={{ color: T.red, fontSize: 11, marginTop: 4 }}>{error}</div>
        )}
    </div>
);

export default Input;
