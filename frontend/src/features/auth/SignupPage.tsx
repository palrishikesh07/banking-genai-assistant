import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

type AuthResponse = {
    user: {
        id: string;
        email: string;
        role: string;
    };
};

export default function SignupPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await api<AuthResponse>("/auth/signup", {
                method: "POST",
                body: JSON.stringify({ email, password }),
            });

            navigate("/chat");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Signup failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main>
            <h1>Create your account</h1>

            <form onSubmit={handleSubmit}>
                <label htmlFor="email">Email</label>
                <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <label htmlFor="password">Password</label>
                <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                {error && <p role="alert">{error}</p>}

                <button disabled={loading} type="submit">
                    {loading ? "Creating account..." : "Sign up"}
                </button>
            </form>

            <p>Already registered? <Link to="/login">Log in</Link></p>
        </main>
    );
}