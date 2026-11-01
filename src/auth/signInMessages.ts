/** Turns Firebase Auth errors into plain sentences. Never says whether an account exists. */
export function authErrorMessage(cause: unknown): string {
  const code = typeof cause === "object" && cause && "code" in cause ? String((cause as { code: unknown }).code) : "";
  switch (code) {
    case "auth/invalid-credential": case "auth/wrong-password": case "auth/user-not-found": case "auth/invalid-email": return "That email and password don't match. Try again or reset your password.";
    case "auth/email-already-in-use": return "There's already an account with that email. Sign in instead.";
    case "auth/weak-password": case "auth/password-does-not-meet-requirements": return "Choose a password with at least 8 characters.";
    case "auth/too-many-requests": return "Too many tries. Wait a few minutes and try again.";
    case "auth/network-request-failed": return "No connection. Check your internet and try again.";
    default: return "Something went wrong. Please try again.";
  }
}
