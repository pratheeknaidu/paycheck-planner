import { Component } from "react";
import T from "../constants/theme";

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div
                    style={{
                        fontFamily: T.font,
                        background: T.bg,
                        color: T.text,
                        minHeight: "100vh",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                >
                    <div style={{ textAlign: "center", padding: 24, maxWidth: 400 }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
                        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
                            Something went wrong
                        </div>
                        <div
                            style={{
                                color: T.textMuted,
                                fontSize: 13,
                                marginBottom: 20,
                                lineHeight: 1.5,
                            }}
                        >
                            The app encountered an unexpected error. Try refreshing the page.
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                background: T.accent,
                                color: "#fff",
                                border: "none",
                                borderRadius: T.radiusSm,
                                padding: "12px 24px",
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: "pointer",
                                fontFamily: T.font,
                            }}
                        >
                            Refresh Page
                        </button>
                        {this.state.error && (
                            <div
                                style={{
                                    marginTop: 16,
                                    padding: 12,
                                    background: T.surface,
                                    borderRadius: T.radiusSm,
                                    border: `1px solid ${T.border}`,
                                    textAlign: "left",
                                }}
                            >
                                <div
                                    style={{
                                        color: T.red,
                                        fontSize: 11,
                                        fontFamily: T.mono,
                                        wordBreak: "break-word",
                                    }}
                                >
                                    {this.state.error.message}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
