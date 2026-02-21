import T from "../constants/theme";

const Card = ({ children, style, onClick }) => (
    <div
        onClick={onClick}
        style={{
            background: T.card,
            borderRadius: T.radius,
            border: `1px solid ${T.border}`,
            padding: "16px 18px",
            transition: "all 0.2s",
            cursor: onClick ? "pointer" : "default",
            ...style,
        }}
    >
        {children}
    </div>
);

export default Card;
