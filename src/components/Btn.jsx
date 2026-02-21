import T from "../constants/theme";

const Btn = ({ children, color = T.accent, bg, onClick, full, style: s }) => (
    <button
        onClick={onClick}
        style={{
            background: bg || `${color}18`,
            color,
            border: "none",
            borderRadius: T.radiusSm,
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: T.font,
            width: full ? "100%" : "auto",
            transition: "opacity 0.15s",
            ...s,
        }}
    >
        {children}
    </button>
);

export default Btn;
