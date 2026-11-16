export async function detectSubnet(timeoutMs = 3500) {
  return new Promise((resolve) => {
    const ips = new Set();
    let pc;
    try {
      pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pc.createDataChannel('');
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(() => resolve(null));
      pc.onicecandidate = (evt) => {
        if (!evt.candidate) return;
        const m = evt.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
        if (m && !m[0].startsWith('0.0.')) ips.add(m[0]);
      };
    } catch {
      resolve(null);
      return;
    }
    setTimeout(() => {
      try { pc?.close(); } catch {}
      const ipList = [...ips];
      if (!ipList.length) { resolve(null); return; }
      const ip = ipList[0];
      const subnet = ip.split('.').slice(0, 3).join('.') + '.0/24';
      resolve({ ip, subnet });
    }, timeoutMs);
  });
}

export function matchPlace(subnet, places) {
  if (!subnet || !places?.length) return null;
  return places.find(p => (p.subnets ?? []).includes(subnet)) ?? null;
}
