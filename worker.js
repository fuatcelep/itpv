export default {
  async fetch(request) {
    const url = new URL(request.url);
    const ch = url.searchParams.get("ch");
    const sub = url.searchParams.get("sub");
    const ref = url.searchParams.get("ref") || "";
    const ts = Math.floor(Date.now() / 1000);
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

    // Alt akis (sub-playlist) proxy yapisi
    if (sub) {
      const subRes = await fetch(sub, {
        headers: { "User-Agent": ua, ...(ref ? { "Referer": ref, "Origin": new URL(ref).origin } : {}) }
      });
      const effUrl = subRes.url;
      const baseDir = effUrl.split("?")[0].substring(0, effUrl.split("?")[0].lastIndexOf("/") + 1);
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

    if (!ch) return new Response("Worker Hazir! Ornek kullanim: ?ch=kanald", { status: 200 });

    let masterUrl = "";
    let referer = "";

    try {
      switch (ch) {
        // --- CLOUDFLARE ÜZERİNDEN GEÇEN SORUNSUZ KANALLAR ---
        case "kanald":
          referer = "https://www.kanald.com.tr/";
          masterUrl = "https://demiroren.daioncdn.net/kanald/kanald.m3u8?app=kanald_web&ce=3";
          break;
        case "teve2":
          referer = "https://www.teve2.com.tr/";
          masterUrl = "https://demiroren.daioncdn.net/teve2/teve2.m3u8?ce=3&app=6aab838a-437e-4a1b-bbd0-e30f79cdbbbd";
          break;
        case "startv":
          referer = "https://puhutv.com/";
          masterUrl = "https://dogus.daioncdn.net/startv/startv.m3u8?ce=3&app=7a318fc3-c9cf-4587-b62e-900166ef7190";
          break;
        case "ntv":
          referer = "https://puhutv.com/";
          masterUrl = "https://dogus.daioncdn.net/ntv/ntv.m3u8?ce=3&app=4f0228e3-6605-42f4-9507-d9fe2d9789bd";
          break;
        case "tv8":
          referer = "https://www.tv8.com.tr/";
          masterUrl = "https://tv8.daioncdn.net/tv8/tv8.m3u8?app=7ddc255a-ef47-4e81-ab14-c0e5f2949788&ce=3";
          break;
        case "tv85":
          referer = "https://www.tv8.com.tr/";
          masterUrl = "https://tv8.daioncdn.net/tv8bucuk/tv8bucuk.m3u8?app=tv8bucuk_web&ce=3";
          break;
        case "showtv":
          referer = "https://www.showtv.com.tr/";
          masterUrl = "https://ciner.daioncdn.net/showtv/showtv.m3u8?ce=3&app=showtv_web";
          break;
        case "beinsportshaber":
          referer = "https://beinsports.com.tr/";
          masterUrl = "https://raw.githubusercontent.com/tecotv2025/tecotv/refs/heads/main/playlist/Bein_Spor_Haber.m3u8";
          break;
      }

      if (!masterUrl) return new Response("Bu kanal Vu+ cihazindan cozulmektedir.", { status: 404 });

      const mRes = await fetch(masterUrl, {
        headers: { 
          "User-Agent": ua, 
          ...(referer ? { "Referer": referer, "Origin": new URL(referer).origin } : {}) 
        },
        redirect: "follow"
      });
      
      const effUrl = mRes.url;
      const baseDir = effUrl.split("?")[0].substring(0, effUrl.split("?")[0].lastIndexOf("/") + 1);
      const hostRoot = new URL(effUrl).origin;
      const mText = await mRes.text();

      let subUrl = effUrl;
      if (mText.includes("#EXT-X-STREAM-INF")) {
        const lines = mText.replace(/\r/g, "").split("\n").filter(l => l && !l.startsWith("#"));
        let picked = lines.find(l => /1080|720/i.test(l)) || lines[lines.length - 1];
        if (picked) {
          if (picked.startsWith("http")) subUrl = picked;
          else if (picked.startsWith("/")) subUrl = hostRoot + picked;
          else subUrl = baseDir + picked;
        }
      }

      const proxySubUrl = `${url.origin}/?sub=${encodeURIComponent(subUrl)}&ref=${encodeURIComponent(referer)}`;
      const wrapperM3u8 = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1920x1080\n${proxySubUrl}\n`;

      return new Response(wrapperM3u8, {
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
