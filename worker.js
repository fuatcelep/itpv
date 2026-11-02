export default {
  async fetch(request) {
    const url = new URL(request.url);
    const ch = url.searchParams.get("ch");
    const sub = url.searchParams.get("sub");
    const debug = url.searchParams.get("debug");
    const ref = url.searchParams.get("ref") || "";
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

    // 2. ASAMA: Alt akis (Media Playlist) Proxy'si (Kanal D, Show TV, Star, NTV, TRT1 vb. icin)
    if (sub) {
      const subRes = await fetch(sub, {
        headers: {
          "User-Agent": ua,
          ...(ref ? { "Referer": ref, "Origin": new URL(ref).origin } : {})
        }
      });

      const effUrl = subRes.url;
      const cleanUrl = effUrl.split("?")[0];
      const queryPart = effUrl.includes("?") ? "?" + effUrl.split("?") : "";
      const baseDir = cleanUrl.substring(0, cleanUrl.lastIndexOf("/") + 1);
      const hostRoot = new URL(effUrl).origin;
      let text = await subRes.text();

      text = text.split("\n").map(line => {
        const l = line.trim();
        if (!l || l.startsWith("#")) return line;
        let fullTsUrl = l;
        if (!l.startsWith("http")) {
          fullTsUrl = l.startsWith("/") ? (hostRoot + l) : (baseDir + l);
        }
        if (!fullTsUrl.includes("?") && queryPart) {
          fullTsUrl += queryPart;
        }
        return fullTsUrl;
      }).join("\n");

      return new Response(text, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store"
        }
      });
    }

    if (!ch) return new Response("Worker Hazir! Ornek: ?ch=kanald", { status: 200 });

    let masterUrl = "";
    let referer = "";

    try {
      // 1. Cloudflare'in 403 almadan dogrudan cozebildigi kanallar
      if (ch === "kanald") {
        referer = "https://www.kanald.com.tr/";
        masterUrl = "https://demiroren.daioncdn.net/kanald/kanald.m3u8?app=kanald_web&ce=3";
      } else if (ch === "teve2") {
        referer = "https://www.teve2.com.tr/";
        masterUrl = "https://demiroren.daioncdn.net/teve2/teve2.m3u8?ce=3&app=6aab838a-437e-4a1b-bbd0-e30f79cdbbbd";
      } else if (ch === "startv") {
        referer = "https://puhutv.com/";
        masterUrl = "https://dogus.daioncdn.net/startv/startv.m3u8?ce=3&app=7a318fc3-c9cf-4587-b62e-900166ef7190";
      } else if (ch === "ntv") {
        referer = "https://puhutv.com/";
        masterUrl = "https://dogus.daioncdn.net/ntv/ntv.m3u8?ce=3&app=4f0228e3-6605-42f4-9507-d9fe2d9789bd";
      } else if (ch === "showtv") {
        referer = "https://www.showtv.com.tr/";
        masterUrl = "https://ciner.daioncdn.net/showtv/showtv.m3u8?ce=3&app=showtv_web";
      } else if (ch === "tv8") {
        referer = "https://www.tv8.com.tr/";
        masterUrl = "https://tv8.daioncdn.net/tv8/tv8.m3u8?app=7ddc255a-ef47-4e81-ab14-c0e5f2949788&ce=3";
      } else if (ch === "tv85") {
        referer = "https://www.tv8.com.tr/";
        masterUrl = "https://tv8.daioncdn.net/tv8bucuk/tv8bucuk.m3u8?app=tv8bucuk_web&ce=3";
      }

      // 2. ATV, A SPOR, A2, NOW TV, TRT1, CNN TURK vb. icin:
      // Once Vu+ Duo 4K'nin GitHub'a yukledigi streams/<ch>.m3u8 dosyasini oku!
      if (!masterUrl) {
        const ghRawUrl = `https://raw.githubusercontent.com/fuatcelep/itpv/main/streams/${ch}.m3u8?t=${Date.now()}`;
        const ghRes = await fetch(ghRawUrl, { headers: { "Cache-Control": "no-cache" } });
        if (ghRes.ok) {
          const ghText = await ghRes.text();
          // Eger Cloudflare 403 aliyorsa (atv, aspor, a2, nowtv, cnnturk),
          // Worker icinde fetch yapmadan DOGRUDAN Vu+'in cozdugu m3u8 icerigini oynaticiya ver!
          if (["atv", "aspor", "a2", "nowtv", "cnnturk", "szc", "beinsportshaber"].includes(ch)) {
            return new Response(ghText, {
              headers: {
                "Content-Type": "application/vnd.apple.mpegurl",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-store"
              }
            });
          }
          masterUrl = ghText.replace(/\r/g, "").split("\n").find(l => l.trim().startsWith("http"))?.trim() || "";
        }
      }

      if (!masterUrl) return new Response("Yayin linki bulunamadi", { status: 404 });

      // Master M3U8 icinden alt akisi coz
      let subUrl = masterUrl;
      let mStatus = 200;

      if (!masterUrl.includes("_1080") && !masterUrl.includes("_720") && !masterUrl.includes("track_")) {
        const mRes = await fetch(masterUrl, {
          headers: { "User-Agent": ua, ...(referer ? { "Referer": referer, "Origin": new URL(referer).origin } : {}) },
          redirect: "follow"
        });
        mStatus = mRes.status;
        const effUrl = mRes.url;
        const cleanUrl = effUrl.split("?")[0];
        const queryPart = effUrl.includes("?") ? "?" + effUrl.split("?") : "";
        const baseDir = cleanUrl.substring(0, cleanUrl.lastIndexOf("/") + 1);
        const hostRoot = new URL(effUrl).origin;
        const mText = await mRes.text();

        if (mText.includes("#EXT-X-STREAM-INF")) {
          const lines = mText.replace(/\r/g, "").split("\n").filter(l => l && !l.startsWith("#"));
          let picked = lines.find(l => /1080|720/i.test(l)) || lines[lines.length - 1];
          if (picked) {
            if (picked.startsWith("http")) subUrl = picked;
            else if (picked.startsWith("/")) subUrl = hostRoot + picked;
            else subUrl = baseDir + picked;
            if (!subUrl.includes("?") && queryPart) subUrl += queryPart;
          }
        } else {
          subUrl = effUrl;
        }
      }

      if (debug === "1") {
        return new Response(JSON.stringify({ ch, masterUrl, mStatus, subUrl }, null, 2), {
          headers: { "Content-Type": "application/json" }
        });
      }

      const proxySubUrl = `${url.origin}/?sub=${encodeURIComponent(subUrl)}&ref=${encodeURIComponent(referer)}`;
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
