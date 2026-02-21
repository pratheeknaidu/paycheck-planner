import T from "../constants/theme";

function Modal({ open, onClose, title, children }) {
    if (!open) return null;
    return (
        <div
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.6)",
                zIndex: 100,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 20,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: T.card,
                    borderRadius: 16,
                    border: `1px solid ${T.border}`,
                    width: "100%",
                    maxWidth: 400,
                    maxHeight: "85vh",
                    overflow: "auto",
                    padding: "24px",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 20,
                    }}
                >
                    <span style={{ color: T.text, fontSize: 18, fontWeight: 600 }}>
                        {title}
                    </span>
                    <button
                        onClick={onClose}
                        aria-label="Close dialog"
                        style={{
                            color: T.textDim,
                            fontSize: 22,
                            cursor: "pointer",
                            lineHeight: 1,
                            background: "none",
                            border: "none",
                            padding: "4px",
                        }}
                    >
                        ×
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

export default Modal;
