import T from "../constants/theme";

/**
 * Action menu for bill items — Split, Defer, Undo operations.
 * Extracted from DashboardScreen (#5 fix) to prevent re-creation on every render.
 */
export default function ActionMenu({ billId, bill, isDeferrable = true, alloc, onOpenSplit, onDefer, onUndoDefer, onUndoSplit, actionMenu, setActionMenu }) {
    const isMenuOpen = actionMenu === billId;
    const hasSplit = alloc?.splitAmount != null;
    const isDeferred = alloc?.deferred;

    if (isDeferred) {
        return (
            <button
                onClick={() => onUndoDefer(billId)}
                aria-label={`Undo defer for ${bill.name}`}
                style={{
                    color: T.amber, fontSize: 10, cursor: "pointer", padding: "2px 8px",
                    background: T.amberDim, borderRadius: 12, fontWeight: 600, fontFamily: T.font,
                    border: "none",
                }}
            >
                DEFERRED ↩
            </button>
        );
    }
    if (hasSplit) {
        return (
            <button
                onClick={() => onUndoSplit(billId)}
                aria-label={`Undo split for ${bill.name}`}
                style={{
                    color: T.purple, fontSize: 10, cursor: "pointer", padding: "2px 8px",
                    background: T.purpleDim, borderRadius: 12, fontWeight: 600, fontFamily: T.font,
                    border: "none",
                }}
            >
                SPLIT ↩
            </button>
        );
    }

    return (
        <div style={{ position: "relative" }}>
            <button
                onClick={(e) => { e.stopPropagation(); setActionMenu(isMenuOpen ? null : billId); }}
                aria-label={`Actions for ${bill.name}`}
                aria-expanded={isMenuOpen}
                style={{
                    color: T.textDim, fontSize: 18, cursor: "pointer", padding: "0 4px",
                    lineHeight: 1, userSelect: "none", background: "none", border: "none",
                }}
            >
                ⋯
            </button>
            {isMenuOpen && (
                <div
                    onClick={(e) => e.stopPropagation()}
                    role="menu"
                    style={{
                        position: "absolute", right: 0, top: 24, zIndex: 10,
                        background: T.card, border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
                        padding: 4, minWidth: 110, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                    }}
                >
                    <button
                        role="menuitem"
                        onClick={() => onOpenSplit(bill)}
                        style={{
                            display: "block", width: "100%", textAlign: "left",
                            padding: "8px 12px", fontSize: 12, color: T.purple, cursor: "pointer",
                            borderRadius: 6, fontWeight: 500, background: "transparent", border: "none",
                            fontFamily: T.font,
                        }}
                        onMouseEnter={(e) => (e.target.style.background = T.purpleDim)}
                        onMouseLeave={(e) => (e.target.style.background = "transparent")}
                    >
                        ✂️ Split
                    </button>
                    {isDeferrable && (
                        <button
                            role="menuitem"
                            onClick={() => { onDefer(billId); setActionMenu(null); }}
                            style={{
                                display: "block", width: "100%", textAlign: "left",
                                padding: "8px 12px", fontSize: 12, color: T.amber, cursor: "pointer",
                                borderRadius: 6, fontWeight: 500, background: "transparent", border: "none",
                                fontFamily: T.font,
                            }}
                            onMouseEnter={(e) => (e.target.style.background = T.amberDim)}
                            onMouseLeave={(e) => (e.target.style.background = "transparent")}
                        >
                            ⏩ Defer
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
