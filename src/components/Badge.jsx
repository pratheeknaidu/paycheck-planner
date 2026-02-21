import T from "../constants/theme";

const Badge = ({ text, color, bg }) => (
    <span
        style={{
            background: bg,
            color,
            fontSize: 10,
            fontWeight: 600,
            fontFamily: T.font,
            padding: "2px 10px",
            borderRadius: 20,
            letterSpacing: 0.5,
            textTransform: "uppercase",
        }}
    >
        {text}
    </span>
);

export default Badge;
