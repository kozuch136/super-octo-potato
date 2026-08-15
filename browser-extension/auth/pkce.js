function base64UrlEncode(bytes) {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateRandomString(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

// RFC 7636 (PKCE) - potrzebne, zeby przechwycony w przegladarce "code"
// autoryzacji nie wystarczyl sam w sobie do wymiany na token bez znajomosci
// losowego "code_verifier", ktory nigdy nie opuszcza tego procesu.
export async function generatePkcePair() {
  const verifier = generateRandomString(48);
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}
