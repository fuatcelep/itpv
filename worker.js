export default {
  async fetch(request) {
    const url = new URL(request.url);
    const ch = url.searchParams.get("ch");
    const sub = url.searchParams.get("sub");
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

    // Kanal bazli Referer tablosu
    const refMap = {
      trt1: "https://www.trtizle.com/",
      trtspor: "https://www.trtizle.com/",
      trtsporyildiz: "https://www.trtizle.com/",
      atv: "https://www.atv.com.tr/",
      aspor: "https://www.aspor.com.tr/",
      a2: "https://www.atv.com.tr/",
      kanald: "https://www.kanald.com.tr/",
      teve2: "https://www.teve2.com.tr/",
      startv: "https://puhutv.com/",
      ntv: "https://puhutv.com/",
      showtv: "https://www.showtv.com.tr/",
      nowtv: "https://www.nowtv.com.tr/",
      tv8: "https://www.tv8.com.tr/",
      tv85: "https://www.tv8.com.tr/",
      cnnturk: "https://www.cnnturk.com/",
      halktv: "https://halktv.com.tr/",
      "360tv": "https://www.tv360.com.tr/"
    };

    // 2. ASAMA: Alt akis (Media Playlist) Proxy'si (.ts linklerini tam URL yapar)
    if (sub) {
      const ref = url.searchParams.get("ref") || "";
      const subRes = await fetch(sub, {
        headers: {
          "User-Agent": ua,
          ...(ref ? { "Referer": ref, "Origin": new URL(ref).origin } : {})
        }
      });

      const effUrl = subRes.url;
      const cleanUrl = effUrl.split("?")[0];
      const baseDir = cleanUrl.substring(0, cleanUrl.lastIndexOf("/") + 1);
      const hostRoot = new URL(effUrl).origin;
      let text = await subRes.text();

      text = text.split("\n").map(line => {
        const l = line.trim();
        if (!l || l.startsWith("#")) return line;
        if (l.startsWith("http")) return l;
        if (l.startsWith("/")) return hostRoot + l;
        return baseDir + l;
      }).join("\n");

      return new Response(text, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store"
        }
      });
    }

    if (!ch) return new Response("Worker Hazir! Ornek: ?ch=trt1", { status: 200 });

    try {
      // 1. ASAMA: Vu+ Duo 4K'nin GitHub'a yukledigi streams/<kanal>.m3u8 dosyasini oku!
      const ghRawUrl = `https://raw.githubusercontent.com/fuatcelep/itpv/main/streams/${ch}.m3u8?t=${Date.now()}`;
      const ghRes = await fetch(ghRawUrl, { headers: { "Cache-Control": "no-cache" } });

      if (!ghRes.ok) {
        return new Response(`GitHub'da streams/${ch}.m3u8 bulunamadi (${ghRes.status})`, { status: 404 });
      }

      const ghText = await ghRes.text();
      // Vu+'in yazdigi #EXTM3U icindeki asil stream URL'sini al
      const streamUrl = ghText.replace(/\r/g, "").split("\n").find(l => l.trim().startsWith("http"))?.trim();

      if (!streamUrl) {
        return new Response("m3u8 icinde gecerli URL bulunamadi", { status: 404 });
      }

      const referer = refMap[ch] || "";

      // Oynaticiyi Cloudflare Worker'in alt akis proxy'sine yonlendir
      const proxySubUrl = `${url.origin}/?sub=${encodeURIComponent(streamUrl)}&ref=${encodeURIComponent(referer)}`;
      const outM3u8 = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1920x1080\n${proxySubUrl}\n`;

      return new Response(outM3u8, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store"
        }
      });

    } catch (e) {
      return new Response("Hata: " + e.message, { status: 500 });
    }
  }
};
