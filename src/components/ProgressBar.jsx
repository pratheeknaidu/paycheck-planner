import T from "../constants/theme";

const ProgressBar = ({ value, color, height = 6 }) => (
    <div
        style={{
            background: T.border,
            borderRadius: 20,
            height,
            overflow: "hidden",
            width: "100%",
        }}
    >
        <div
            style={{
                width: `${Math.max(0, Math.min(100, value))}%`,
                height: "100%",
                borderRadius: 20,
                background: color,
                transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
            }}
        />
    </div>
);

export default ProgressBar;
